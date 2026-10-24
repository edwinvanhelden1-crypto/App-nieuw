package nl.ledbediening.ikea

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import nl.ledbediening.tuya.Dp
import nl.ledbediening.tuya.Hsv
import nl.ledbediening.tuya.LightCodec
import nl.ledbediening.tuya.LightDevice
import nl.ledbediening.tuya.TuyaException
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.Base64
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.X509TrustManager
import kotlin.math.roundToInt

/** Een lamp aan de IKEA DIRIGERA-hub. */
data class IkeaLight(
    val id: String,
    val name: String,
    val room: String,
    val isOn: Boolean,
    val level: Int,            // 1–100
    val hue: Float,            // 0–360
    val saturation: Float,     // 0–1
    val temperature: Int,      // kelvin
    val tempWarm: Int,         // laagste kelvin
    val tempCool: Int,         // hoogste kelvin
    val colorMode: String,     // "color" of "temperature"
    val canColor: Boolean,
    val canTemperature: Boolean,
    val canLevel: Boolean,
    val reachable: Boolean,
)

/**
 * Lokale verbinding met de IKEA DIRIGERA-hub (HTTPS op poort 8443). De hub gebruikt een
 * eigen certificaat; na het koppelen onthouden we de vingerafdruk ervan ([certSha256]) en
 * accepteren we daarna alleen nog dat certificaat.
 */
class DirigeraHub(
    val host: String,
    @Volatile var token: String? = null,
    private val pinnedSha256: String? = null,
    private val port: Int = 8443,
    private val useTls: Boolean = true,
) {
    /** Vingerafdruk van het certificaat van de hub (na de eerste verbinding). */
    @Volatile var certSha256: String? = pinnedSha256
        private set

    private var socket: Socket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null

    val isConnected: Boolean
        @Synchronized get() = socket?.isClosed == false

    // ---------- koppelen ----------

    class Pairing(val code: String, val verifier: String)

    /** Stap 1: vraag een code aan. Daarna moet de gebruiker op de knop van de hub drukken. */
    fun startPairing(): Pairing {
        val verifier = randomVerifier()
        val challenge = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
        val path = "/v1/oauth/authorize?audience=homesmart.local&response_type=code" +
            "&code_challenge=$challenge&code_challenge_method=S256"
        val (status, body) = request("GET", path, null, auth = false)
        if (status !in 200..299) throw TuyaException("De hub weigert het koppelen (HTTP $status)")
        val code = parse(body).jsonObject["code"]?.jsonPrimitive?.content
            ?: throw TuyaException("Geen koppelcode van de hub ontvangen")
        return Pairing(code, verifier)
    }

    /**
     * Stap 2: na het drukken op de knop een sleutel ophalen. Geeft null zolang de knop
     * nog niet is ingedrukt.
     */
    fun finishPairing(p: Pairing, name: String = "LED Bediening"): String? {
        val form = "code=${enc(p.code)}&name=${enc(name)}&grant_type=authorization_code&code_verifier=${enc(p.verifier)}"
        val (status, body) = request("POST", "/v1/oauth/token", form, auth = false, contentType = "application/x-www-form-urlencoded")
        if (status in 400..499) return null
        if (status !in 200..299) throw TuyaException("Koppelen mislukt (HTTP $status)")
        val t = parse(body).jsonObject["access_token"]?.jsonPrimitive?.content ?: return null
        token = t
        return t
    }

    // ---------- lampen ----------

    fun lights(): List<IkeaLight> {
        val (status, body) = request("GET", "/v1/devices", null)
        check(status, body)
        return parse(body).jsonArray.mapNotNull { (it as? JsonObject)?.let(::parseLight) }
    }

    fun light(id: String): IkeaLight {
        val (status, body) = request("GET", "/v1/devices/${enc(id)}", null)
        check(status, body)
        return parseLight(parse(body).jsonObject) ?: throw TuyaException("Apparaat is geen lamp")
    }

    fun setAttributes(id: String, attributes: Map<String, Any>) {
        val attrs = JsonObject(attributes.mapValues { (_, v) ->
            when (v) {
                is Boolean -> JsonPrimitive(v)
                is Number -> JsonPrimitive(v)
                else -> JsonPrimitive(v.toString())
            }
        })
        val body = JsonArray(listOf(JsonObject(mapOf("attributes" to attrs)))).toString()
        val (status, resp) = request("PATCH", "/v1/devices/${enc(id)}", body)
        check(status, resp)
    }

    @Synchronized
    fun close() {
        try { socket?.close() } catch (_: Exception) {}
        socket = null
        input = null
        output = null
    }

    private fun check(status: Int, body: String) {
        when {
            status == 401 || status == 403 -> throw TuyaException("De hub accepteert de sleutel niet meer: koppel opnieuw")
            status !in 200..299 -> throw TuyaException("Hub gaf een fout (HTTP $status): ${body.take(120)}")
        }
    }

    // ---------- HTTP/1.1 met keep-alive ----------

    /** Eén verzoek; bij een verbroken verbinding wordt één keer opnieuw verbonden. */
    @Synchronized
    internal fun request(method: String, path: String, body: String?, auth: Boolean = true, contentType: String = "application/json"): Pair<Int, String> {
        var last: Exception? = null
        repeat(2) {
            try {
                connect()
                val bytes = body?.toByteArray() ?: ByteArray(0)
                val head = StringBuilder()
                    .append("$method $path HTTP/1.1\r\n")
                    .append("Host: $host:$port\r\n")
                    .append("Connection: keep-alive\r\n")
                    .append("Accept: application/json\r\n")
                if (auth) token?.let { head.append("Authorization: Bearer $it\r\n") }
                if (body != null) head.append("Content-Type: $contentType\r\n")
                head.append("Content-Length: ${bytes.size}\r\n\r\n")
                val out = output!!
                out.write(head.toString().toByteArray())
                out.write(bytes)
                out.flush()
                return readResponse()
            } catch (e: CertificateException) {
                close()
                throw TuyaException("Het certificaat van de hub is veranderd. Koppel de hub opnieuw.", e)
            } catch (e: IOException) {
                close()
                if (e.cause is CertificateException) throw TuyaException("Het certificaat van de hub is veranderd. Koppel de hub opnieuw.", e)
                last = e
            }
        }
        throw TuyaException("Geen verbinding met de IKEA-hub op $host: ${last?.message}", last)
    }

    private fun connect() {
        if (socket?.isClosed == false) return
        val raw = Socket()
        raw.tcpNoDelay = true
        raw.connect(InetSocketAddress(host, port), 4000)
        raw.soTimeout = 8000
        val s = if (useTls) {
            val ctx = SSLContext.getInstance("TLS")
            ctx.init(null, arrayOf(PinningTrustManager()), SecureRandom())
            (ctx.socketFactory.createSocket(raw, host, port, true) as SSLSocket).also { it.startHandshake() }
        } else raw
        socket = s
        input = BufferedInputStream(s.getInputStream())
        output = s.getOutputStream()
    }

    private fun readResponse(): Pair<Int, String> {
        val inp = input!!
        val statusLine = readLine(inp) ?: throw IOException("Verbinding gesloten door hub")
        val status = statusLine.split(' ').getOrNull(1)?.toIntOrNull() ?: throw IOException("Ongeldig antwoord: $statusLine")
        val headers = HashMap<String, String>()
        while (true) {
            val line = readLine(inp) ?: break
            if (line.isEmpty()) break
            val i = line.indexOf(':')
            if (i > 0) headers[line.substring(0, i).trim().lowercase()] = line.substring(i + 1).trim()
        }
        val body = when {
            headers["transfer-encoding"]?.contains("chunked", true) == true -> {
                val buf = ByteArrayOutputStream()
                while (true) {
                    val size = (readLine(inp) ?: "0").substringBefore(';').trim().toInt(16)
                    if (size == 0) {
                        readLine(inp)
                        break
                    }
                    buf.write(readN(inp, size))
                    readLine(inp)
                }
                buf.toByteArray()
            }
            headers["content-length"] != null -> readN(inp, headers.getValue("content-length").toInt())
            status == 204 || status == 304 -> ByteArray(0)
            else -> inp.readBytes().also { close() }
        }
        if (headers["connection"].equals("close", true)) close()
        return status to body.toString(Charsets.UTF_8)
    }

    private fun readLine(inp: InputStream): String? {
        val sb = StringBuilder()
        while (true) {
            val b = inp.read()
            if (b < 0) return if (sb.isEmpty()) null else sb.toString()
            if (b == '\n'.code) return sb.toString().trimEnd('\r')
            sb.append(b.toChar())
        }
    }

    private fun readN(inp: InputStream, n: Int): ByteArray {
        val out = ByteArray(n)
        var off = 0
        while (off < n) {
            val r = inp.read(out, off, n - off)
            if (r < 0) throw IOException("Verbinding gesloten door hub")
            off += r
        }
        return out
    }

    /** Accepteert het eigen certificaat van de hub; na het koppelen alleen nog datzelfde certificaat. */
    private inner class PinningTrustManager : X509TrustManager {
        override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun checkServerTrusted(chain: Array<out X509Certificate>, authType: String?) {
            val fp = MessageDigest.getInstance("SHA-256").digest(chain[0].encoded).joinToString("") { "%02x".format(it) }
            val pin = pinnedSha256
            if (pin != null && pin != fp) throw CertificateException("Onverwacht certificaat")
            certSha256 = fp
        }
        override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
    }

    companion object {
        private const val VERIFIER_CHARS = "_-~.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

        private fun randomVerifier(): String {
            val r = SecureRandom()
            return String(CharArray(128) { VERIFIER_CHARS[r.nextInt(VERIFIER_CHARS.length)] })
        }

        private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

        private fun parse(body: String): JsonElement = try {
            Json.parseToJsonElement(body)
        } catch (e: Exception) {
            throw TuyaException("Onverwacht antwoord van de hub")
        }

        /** Kelvin van IKEA (soms als mired opgegeven). */
        private fun kelvin(v: Int) = if (v in 1..999) (1_000_000.0 / v).roundToInt() else v

        internal fun parseLight(o: JsonObject): IkeaLight? {
            val type = o["type"]?.jsonPrimitive?.content ?: o["deviceType"]?.jsonPrimitive?.content
            if (type != "light") return null
            val a = o["attributes"] as? JsonObject ?: return null
            val receive = (o["capabilities"] as? JsonObject)?.get("canReceive")?.let { it as? JsonArray }
                ?.mapNotNull { (it as? JsonPrimitive)?.content }?.toSet() ?: emptySet()
            fun str(k: String) = a[k]?.jsonPrimitive?.content
            fun num(k: String) = a[k]?.jsonPrimitive?.doubleOrNull
            val tMin = num("colorTemperatureMin")?.toInt()?.let(::kelvin)
            val tMax = num("colorTemperatureMax")?.toInt()?.let(::kelvin)
            val warm = listOfNotNull(tMin, tMax).minOrNull() ?: 2200
            val cool = listOfNotNull(tMin, tMax).maxOrNull() ?: 4000
            return IkeaLight(
                id = o["id"]?.jsonPrimitive?.content ?: return null,
                name = str("customName")?.ifBlank { null } ?: str("model") ?: "IKEA-lamp",
                room = (o["room"] as? JsonObject)?.get("name")?.jsonPrimitive?.content ?: "",
                isOn = a["isOn"]?.jsonPrimitive?.booleanOrNull ?: false,
                level = a["lightLevel"]?.jsonPrimitive?.intOrNull ?: 100,
                hue = num("colorHue")?.toFloat() ?: 0f,
                saturation = num("colorSaturation")?.toFloat() ?: 0f,
                temperature = num("colorTemperature")?.toInt()?.let(::kelvin) ?: warm,
                tempWarm = warm,
                tempCool = cool,
                colorMode = str("colorMode") ?: "temperature",
                canColor = "colorHue" in receive,
                canTemperature = "colorTemperature" in receive,
                canLevel = "lightLevel" in receive,
                reachable = o["isReachable"]?.jsonPrimitive?.booleanOrNull ?: true,
            )
        }
    }
}

/** Vertaling tussen Tuya-datapunten (die de rest van de app gebruikt) en IKEA-eigenschappen. */
object IkeaMapping {
    fun toAttributes(values: Map<String, Any?>, light: IkeaLight): Map<String, Any> {
        val out = LinkedHashMap<String, Any>()
        (values[Dp.SWITCH] as? Boolean)?.let { out["isOn"] = it }
        val mode = values[Dp.MODE] as? String
        val hex = (values[Dp.COLOUR] as? String) ?: (values[Dp.CONTROL] as? String)?.takeIf { it.length >= 13 }?.substring(1, 13)
        val colour = LightCodec.parseColour(hex)
        if (colour != null && mode != "white") {
            if (light.canColor) {
                out["colorHue"] = colour.h.roundToInt().mod(360).toDouble()
                out["colorSaturation"] = (colour.s.coerceIn(0f, 1f) * 100).roundToInt() / 100.0
            }
            if (light.canLevel) out["lightLevel"] = (colour.v * 100).roundToInt().coerceIn(1, 100)
        } else {
            (values[Dp.BRIGHTNESS] as? Number)?.let { if (light.canLevel) out["lightLevel"] = (it.toInt() / 10).coerceIn(1, 100) }
            (values[Dp.TEMPERATURE] as? Number)?.let {
                if (light.canTemperature) {
                    val t = it.toInt().coerceIn(0, 1000) / 1000.0
                    out["colorTemperature"] = (light.tempWarm + t * (light.tempCool - light.tempWarm)).roundToInt()
                }
            }
        }
        return out
    }

    fun toDps(light: IkeaLight): Map<String, Any?> {
        val m = LinkedHashMap<String, Any?>()
        m[Dp.SWITCH] = light.isOn
        m[Dp.MODE] = if (light.colorMode == "color" && light.canColor) "colour" else "white"
        m[Dp.BRIGHTNESS] = (light.level * 10).coerceIn(10, 1000)
        val span = (light.tempCool - light.tempWarm).coerceAtLeast(1)
        m[Dp.TEMPERATURE] = (((light.temperature - light.tempWarm).toDouble() / span) * 1000).roundToInt().coerceIn(0, 1000)
        if (light.canColor) m[Dp.COLOUR] = LightCodec.colour(Hsv(light.hue, light.saturation, light.level / 100f))
        return m
    }
}

/** Eén IKEA-lamp als [LightDevice], via een gedeelde [DirigeraHub]. */
class DirigeraLight(private val hub: DirigeraHub, val deviceId: String) : LightDevice {
    override val dps: MutableMap<String, Any?> = java.util.concurrent.ConcurrentHashMap()
    @Volatile override var onDps: ((Map<String, Any?>) -> Unit)? = null
    @Volatile private var info: IkeaLight? = null

    override val isConnected: Boolean get() = hub.isConnected

    /** Zigbee-lampen via de hub: niet vaker dan ±4 keer per seconde. */
    override val minIntervalMs: Long get() = 250

    override fun status(): Map<String, Any?> {
        val l = hub.light(deviceId)
        info = l
        if (!l.reachable) throw TuyaException("De hub kan deze lamp niet bereiken (staat de stroom eraf?)")
        val m = IkeaMapping.toDps(l)
        m.forEach { (k, v) -> if (v != null) dps[k] = v }
        onDps?.invoke(m)
        return HashMap(dps)
    }

    override fun set(values: Map<String, Any?>, waitAck: Boolean) {
        val l = info ?: hub.light(deviceId).also { info = it }
        val attrs = IkeaMapping.toAttributes(values, l)
        if (attrs.isEmpty()) return
        // Aan/uit apart sturen: sommige lampen negeren de rest als ze in dezelfde opdracht aangaan.
        val on = attrs["isOn"]
        val rest = attrs - "isOn"
        if (on != null) hub.setAttributes(deviceId, mapOf("isOn" to on))
        if (rest.isNotEmpty() && on != false) hub.setAttributes(deviceId, rest)
        values.forEach { (k, v) -> if (v != null) dps[k] = v }
    }

    override fun heartbeat() {}

    override fun close() {}
}
