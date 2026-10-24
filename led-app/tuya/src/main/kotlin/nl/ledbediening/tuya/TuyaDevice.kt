package nl.ledbediening.tuya

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import java.io.Closeable
import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException

/**
 * Lokale verbinding met één Tuya-apparaat (protocol 3.3, 3.4 of 3.5) via TCP-poort 6668.
 *
 * Alle methodes blokkeren; roep ze aan vanaf een achtergrondthread. De verbinding blijft
 * open tussen opdrachten; houd hem levend met [heartbeat] of sluit hem met [close].
 */
class TuyaDevice(
    val id: String,
    val ip: String,
    localKey: String,
    val version: String,
    private val port: Int = 6668,
    private val connectTimeoutMs: Int = 3000,
    private val readTimeoutMs: Int = 3000,
) : Closeable {
    private val realKey = localKey.toByteArray(Charsets.ISO_8859_1)
    private var sessionKey = realKey
    private var socket: Socket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null
    private var seq = 1
    private val ver = version.toDoubleOrNull() ?: throw TuyaException("Onbekende protocolversie $version")
    private val versionHeader = version.toByteArray() + ByteArray(12)

    /** Laatst bekende waarden van alle datapunten. */
    val dps: MutableMap<String, Any?> = java.util.concurrent.ConcurrentHashMap()

    /** Wordt aangeroepen als het apparaat (ook uit zichzelf) nieuwe waarden meldt. */
    @Volatile var onDps: ((Map<String, Any?>) -> Unit)? = null

    init {
        if (realKey.size != 16) throw TuyaException("De lokale sleutel moet 16 tekens lang zijn")
        if (ver !in setOf(3.3, 3.4, 3.5)) throw TuyaException("Protocolversie $version wordt niet ondersteund (alleen 3.3, 3.4 en 3.5)")
    }

    val isConnected: Boolean
        @Synchronized get() = socket?.isConnected == true && socket?.isClosed == false

    @Synchronized
    fun connect() {
        if (isConnected) return
        close()
        try {
            val s = Socket()
            s.tcpNoDelay = true
            s.connect(InetSocketAddress(ip, port), connectTimeoutMs)
            s.soTimeout = readTimeoutMs
            socket = s
            input = s.getInputStream().buffered()
            output = s.getOutputStream()
            seq = 1
            sessionKey = realKey
            if (ver >= 3.4) negotiateSessionKey()
        } catch (e: TuyaException) {
            close()
            throw e
        } catch (e: SocketTimeoutException) {
            close()
            throw TuyaException("Geen antwoord van $ip (staat de strip aan en op hetzelfde wifi?)", e)
        } catch (e: EOFException) {
            close()
            throw TuyaException("Strip verbrak de verbinding: verkeerde sleutel of protocolversie?", e)
        } catch (e: java.net.NoRouteToHostException) {
            close()
            throw TuyaException("Lamp onbereikbaar op $ip. Staat hij aan, en zit hij op hetzelfde wifi als je telefoon?", e)
        } catch (e: java.net.ConnectException) {
            close()
            val m = e.message ?: ""
            throw if ("EHOSTUNREACH" in m || "ENETUNREACH" in m) {
                TuyaException("Lamp onbereikbaar op $ip. Staat hij aan, en zit hij op hetzelfde wifi als je telefoon?", e)
            } else {
                TuyaException("Lamp weigert de verbinding op $ip (is de Smart Life-app er nog mee verbonden?)", e)
            }
        } catch (e: Exception) {
            close()
            throw TuyaException("Kan geen verbinding maken met $ip: ${e.message}", e)
        }
    }

    /** Vraagt alle datapunten op. */
    @Synchronized
    fun status(): Map<String, Any?> = withConnection {
        val cmd = if (ver >= 3.4) Cmd.DP_QUERY_NEW else Cmd.DP_QUERY
        val body = if (ver >= 3.4) "{}" else jsonString(
            buildJsonObject { put("gwId", id); put("devId", id); put("uid", id); put("t", now().toString()) },
        )
        send(cmd, body.toByteArray())
        // Wacht op het antwoord; tussendoor binnenkomende statusmeldingen worden verwerkt.
        repeat(10) {
            val frame = receiveFrame()
            val result = handlePayload(frame) ?: return@repeat
            if (frame.cmd == cmd && result.containsKey("dps")) return@withConnection HashMap(dps)
        }
        throw TuyaException("Strip gaf geen status terug")
    }

    /**
     * Zet één of meer datapunten, bijvoorbeeld `mapOf("20" to true, "24" to "007803e803e8")`.
     * Met [waitAck] wordt gewacht op de bevestiging; dat remt vanzelf af tot de snelheid
     * die de strip aankan.
     */
    @Synchronized
    fun set(values: Map<String, Any?>, waitAck: Boolean = true) = withConnection {
        val dpsJson = toJson(values)
        val (cmd, body) = if (ver >= 3.4) {
            Cmd.CONTROL_NEW to jsonString(buildJsonObject {
                put("protocol", 5)
                put("t", now())
                put("data", buildJsonObject { put("dps", dpsJson) })
            })
        } else {
            Cmd.CONTROL to jsonString(buildJsonObject {
                put("devId", id); put("uid", id); put("t", now().toString())
                put("dps", dpsJson)
            })
        }
        send(cmd, body.toByteArray())
        values.forEach { (k, v) -> dps[k] = v }
        if (waitAck) awaitAck(cmd) else drainAvailable()
    }

    /** Houdt de verbinding open (apparaten sluiten hem na ±30 s stilte). */
    @Synchronized
    fun heartbeat() = withConnection {
        send(Cmd.HEART_BEAT, jsonString(buildJsonObject { put("gwId", id); put("devId", id) }).toByteArray())
        awaitAck(Cmd.HEART_BEAT)
    }

    @Synchronized
    override fun close() {
        try { socket?.close() } catch (_: Exception) {}
        socket = null
        input = null
        output = null
    }

    // ---------- intern ----------

    /** Voert [block] uit; mislukt het op een bestaande verbinding, dan één keer opnieuw verbinden. */
    private inline fun <T> withConnection(block: () -> T): T {
        val wasConnected = isConnected
        connect()
        return try {
            block()
        } catch (e: Exception) {
            close()
            if (!wasConnected) throw wrap(e)
            connect()
            try {
                block()
            } catch (e2: Exception) {
                close()
                throw wrap(e2)
            }
        }
    }

    private fun wrap(e: Exception) = e as? TuyaException ?: TuyaException("Verbinding mislukt: ${e.message}", e)

    private var missedAcks = 0

    /** Of deze lamp opdrachten bevestigt; zo niet, dan wachten we er niet meer op. */
    private var sendsAcks = true

    /**
     * Wacht kort op de bevestiging van [cmd] (of een statusmelding). Lampen die niet
     * bevestigen zouden anders elke opdracht vertragen: na twee gemiste bevestigingen
     * lezen we alleen nog wat er al binnen is.
     */
    private fun awaitAck(cmd: Int, timeoutMs: Int = 600) {
        if (!sendsAcks) {
            drainAvailable()
            return
        }
        val deadline = System.currentTimeMillis() + timeoutMs
        while (true) {
            val left = deadline - System.currentTimeMillis()
            if (left <= 0) break
            val frame = try {
                receiveFrame(left.toInt())
            } catch (e: TuyaException) {
                if (e.cause is SocketTimeoutException) break else throw e
            }
            handlePayload(frame)
            if (frame.cmd == cmd || frame.cmd == Cmd.STATUS) {
                missedAcks = 0
                return
            }
        }
        if (++missedAcks >= 2) sendsAcks = false
    }

    /** Leest berichten die al binnen zijn, zonder te wachten. */
    private fun drainAvailable() {
        val inp = input ?: return
        while (inp.available() > 0) handlePayload(receiveFrame())
    }

    private fun receiveFrame(timeoutMs: Int = readTimeoutMs): Frame {
        val inp = input ?: throw TuyaException("Niet verbonden")
        return try {
            socket?.soTimeout = timeoutMs
            FrameCodec.read(inp, sessionKey, hmac = ver == 3.4)
        } catch (e: SocketTimeoutException) {
            throw TuyaException("Strip reageert niet", e)
        } catch (e: EOFException) {
            throw TuyaException("Strip verbrak de verbinding: verkeerde sleutel of protocolversie?", e)
        }
    }

    /** Ontsleutelt de inhoud, werkt [dps] bij en geeft de JSON terug (of null bij een lege bevestiging). */
    private fun handlePayload(frame: Frame): JsonObject? {
        var p = frame.payload
        if (p.isEmpty()) return null
        if (ver == 3.4) p = decryptOrThrow(sessionKey, p)
        if (p.startsWithVersion()) p = p.copyOfRange(15, p.size)
        if (ver == 3.3 && p.firstOrNull() != '{'.code.toByte()) p = decryptOrThrow(realKey, p)
        val text = p.toString(Charsets.UTF_8).trim { it <= ' ' || it == '\u0000' }
        if (!text.startsWith("{")) {
            if ("data unvalid" in text) throw TuyaException("Dit apparaattype wordt niet ondersteund (device22)")
            return null
        }
        val json = try { Json.parseToJsonElement(text).jsonObject } catch (e: Exception) { return null }
        val dpsObj = (json["dps"] ?: (json["data"] as? JsonObject)?.get("dps")) as? JsonObject
        if (dpsObj != null) {
            val update = dpsObj.mapValues { fromJson(it.value) }
            update.forEach { (k, v) -> dps[k] = v }
            onDps?.invoke(update)
            return JsonObject(json + ("dps" to dpsObj))
        }
        return json
    }

    private fun decryptOrThrow(key: ByteArray, data: ByteArray): ByteArray = try {
        Crypto.ecbDecrypt(key, data)
    } catch (e: Exception) {
        throw TuyaException("Ontsleutelen mislukt: verkeerde sleutel of protocolversie", e)
    }

    private fun ByteArray.startsWithVersion() =
        size >= 15 && this[0] == '3'.code.toByte() && this[1] == '.'.code.toByte() && this[2] in '1'.code.toByte()..'5'.code.toByte()

    private fun send(cmd: Int, payload: ByteArray) {
        val out = output ?: throw TuyaException("Niet verbonden")
        out.write(encode(cmd, payload))
        out.flush()
    }

    private fun encode(cmd: Int, payload: ByteArray): ByteArray {
        val s = seq++
        return when {
            ver >= 3.5 -> {
                val body = if (cmd in Cmd.NO_HEADER) payload else versionHeader + payload
                FrameCodec.pack6699(s, cmd, body, sessionKey)
            }
            ver >= 3.4 -> {
                val body = if (cmd in Cmd.NO_HEADER) payload else versionHeader + payload
                FrameCodec.pack55aa(s, cmd, Crypto.ecbEncrypt(sessionKey, body), sessionKey)
            }
            else -> {
                val enc = Crypto.ecbEncrypt(realKey, payload)
                FrameCodec.pack55aa(s, cmd, if (cmd in Cmd.NO_HEADER) enc else versionHeader + enc, null)
            }
        }
    }

    /** Sessiesleutel afspreken (3.4 en 3.5). */
    private fun negotiateSessionKey() {
        val localNonce = Crypto.randomBytes(16)
        send(Cmd.SESS_KEY_NEG_START, localNonce)
        var resp = receiveFrame()
        repeat(2) { if (resp.cmd != Cmd.SESS_KEY_NEG_RESP) resp = receiveFrame() }
        if (resp.cmd != Cmd.SESS_KEY_NEG_RESP) throw TuyaException("Strip antwoordde niet op de sleutelafspraak")
        var p = resp.payload
        if (ver == 3.4) p = decryptOrThrow(realKey, p)
        if (p.size < 48) throw TuyaException("Ongeldig antwoord op sleutelafspraak: verkeerde sleutel of versie?")
        val remoteNonce = p.copyOfRange(0, 16)
        if (!Crypto.hmacSha256(realKey, localNonce).contentEquals(p.copyOfRange(16, 48))) {
            throw TuyaException("Verkeerde lokale sleutel")
        }
        send(Cmd.SESS_KEY_NEG_FINISH, Crypto.hmacSha256(realKey, remoteNonce))
        val xor = ByteArray(16) { (localNonce[it].toInt() xor remoteNonce[it].toInt()).toByte() }
        sessionKey = if (ver == 3.4) {
            Crypto.ecbEncrypt(realKey, xor, pad = false)
        } else {
            Crypto.gcmEncrypt(realKey, localNonce.copyOfRange(0, 12), null, xor).copyOfRange(0, 16)
        }
    }

    private fun now() = System.currentTimeMillis() / 1000

    companion object {
        private fun jsonString(obj: JsonObject) = obj.toString()

        internal fun toJson(values: Map<String, Any?>): JsonObject = JsonObject(values.mapValues { (_, v) ->
            when (v) {
                null -> JsonNull
                is Boolean -> JsonPrimitive(v)
                is Number -> JsonPrimitive(v)
                is String -> JsonPrimitive(v)
                else -> JsonPrimitive(v.toString())
            }
        })

        internal fun fromJson(e: JsonElement): Any? = when (e) {
            is JsonNull -> null
            is JsonPrimitive -> when {
                e.isString -> e.content
                e.booleanOrNull != null -> e.booleanOrNull
                e.intOrNull != null -> e.intOrNull
                else -> e.doubleOrNull ?: e.content
            }
            else -> e.toString()
        }
    }
}
