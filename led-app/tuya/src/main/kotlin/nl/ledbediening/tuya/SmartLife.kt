package nl.ledbediening.tuya

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.SecureRandom
import java.util.Base64
import java.util.UUID

/** Inloggegevens na het scannen van de QR-code; bewaard zodat opnieuw inloggen niet nodig is. */
@Serializable
data class SmartLifeSession(
    val userCode: String,
    val uid: String,
    val accessToken: String,
    val refreshToken: String,
    /** Tijdstip (ms) waarop het toegangstoken verloopt. */
    val expiresAt: Long,
    val endpoint: String,
    val terminalId: String = "",
    val username: String = "",
)

/**
 * Inloggen met een Smart Life / Tuya Smart-account via dezelfde QR-route die de
 * Home Assistant-integratie gebruikt (tuya-device-sharing-sdk). Geen ontwikkelaarsaccount nodig.
 *
 * 1. [requestQr] met de gebruikerscode uit de Smart Life-app;
 * 2. de gebruiker scant de QR ([qrContent]) met de Smart Life-app;
 * 3. [poll] tot het inloggen gelukt is.
 */
class SmartLifeLogin(private val http: (String, String) -> String = ::defaultHttp) {

    /** Vraagt een QR-token aan. */
    fun requestQr(userCode: String): String {
        val url = "https://$LOGIN_HOST/v1.0/m/life/home-assistant/qrcode/tokens" +
            "?clientid=$CLIENT_ID&usercode=${enc(userCode)}&schema=$SCHEMA"
        val json = parse(http("POST", url))
        if (json["success"]?.jsonPrimitive?.booleanOrNull != true) throw TuyaException(loginError(json))
        return json["result"]?.jsonObject?.get("qrcode")?.jsonPrimitive?.content
            ?: throw TuyaException("Geen QR-code ontvangen van Tuya")
    }

    /** Geeft de sessie terug zodra de QR-code gescand en bevestigd is, anders null. */
    fun poll(qrToken: String, userCode: String): SmartLifeSession? {
        val url = "https://$LOGIN_HOST/v1.0/m/life/home-assistant/qrcode/tokens/${enc(qrToken)}" +
            "?clientid=$CLIENT_ID&usercode=${enc(userCode)}"
        val json = parse(http("GET", url))
        if (json["success"]?.jsonPrimitive?.booleanOrNull != true) return null
        val r = json["result"]?.jsonObject ?: return null
        fun s(k: String) = r[k]?.jsonPrimitive?.content ?: ""
        val t = json["t"]?.jsonPrimitive?.longOrNull ?: System.currentTimeMillis()
        val expire = r["expire_time"]?.jsonPrimitive?.longOrNull ?: 7200
        return SmartLifeSession(
            userCode = userCode,
            uid = s("uid"),
            accessToken = s("access_token"),
            refreshToken = s("refresh_token"),
            expiresAt = t + expire * 1000,
            endpoint = s("endpoint"),
            terminalId = s("terminal_id"),
            username = s("username"),
        )
    }

    companion object {
        const val LOGIN_HOST = "apigw.iotbing.com"
        const val CLIENT_ID = "HA_3y9q4ak7g4ephrvke"
        const val SCHEMA = "haauthorize"

        /** Inhoud van de QR-code die de Smart Life-app herkent. */
        fun qrContent(qrToken: String) = "tuyaSmart--qrLogin?token=$qrToken"

        private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")

        internal fun loginError(json: JsonObject): String {
            val msg = json["msg"]?.jsonPrimitive?.content ?: "onbekende fout"
            val code = json["code"]?.jsonPrimitive?.content
            return "Inloggen mislukt: $msg${if (code != null) " (code $code)" else ""}. Klopt de gebruikerscode?"
        }
    }
}

/** Een huis uit de Smart Life-app. */
data class SmartLifeHome(val id: String, val name: String)

/**
 * Versleutelde API van de Smart Life-koppeling. Alleen lezen: we vragen huizen en apparaten
 * (met lokale sleutels) op en veranderen niets in de Smart Life-app.
 */
class SmartLifeApi(
    session: SmartLifeSession,
    private val http: (method: String, url: String, headers: Map<String, String>) -> String = ::defaultHttpWithHeaders,
    /** Wordt aangeroepen als het token is vernieuwd, zodat de app het kan bewaren. */
    private val onSessionChanged: (SmartLifeSession) -> Unit = {},
) {
    var session: SmartLifeSession = session
        private set

    fun homes(): List<SmartLifeHome> {
        val result = get("/v1.0/m/life/users/homes") ?: return emptyList()
        return result.jsonArray.map { h ->
            val o = h.jsonObject
            SmartLifeHome(o["ownerId"]?.jsonPrimitive?.content ?: "", o["name"]?.jsonPrimitive?.content ?: "Thuis")
        }.filter { it.id.isNotEmpty() }
    }

    fun devices(home: SmartLifeHome): List<CloudDevice> {
        val result = get("/v1.0/m/life/ha/home/devices", mapOf("homeId" to home.id)) ?: return emptyList()
        return result.jsonArray.map { e ->
            val d = e.jsonObject
            fun s(k: String) = d[k]?.jsonPrimitive?.content ?: ""
            CloudDevice(
                id = s("id"),
                name = s("name").ifEmpty { s("id") },
                localKey = s("local_key"),
                category = s("category"),
                productName = s("product_name"),
                online = d["online"]?.jsonPrimitive?.booleanOrNull ?: false,
                codes = (d["status"] as? kotlinx.serialization.json.JsonArray)
                    ?.mapNotNull { (it as? JsonObject)?.get("code")?.jsonPrimitive?.content }?.toSet() ?: emptySet(),
            )
        }
    }

    /** Alle apparaten uit alle huizen. */
    fun allDevices(): List<CloudDevice> = homes().flatMap { devices(it) }.distinctBy { it.id }

    private fun refreshIfNeeded() {
        if (session.expiresAt - 60_000 > System.currentTimeMillis()) return
        val json = request("GET", "/v1.0/m/token/${session.refreshToken}", null, allowRefresh = false)
        val r = json?.jsonObject ?: throw TuyaException("Sessie verlopen: log opnieuw in")
        fun s(k: String) = r[k]?.jsonPrimitive?.content ?: ""
        val expire = r["expireTime"]?.jsonPrimitive?.longOrNull ?: 7200
        session = session.copy(
            uid = s("uid").ifEmpty { session.uid },
            accessToken = s("accessToken"),
            refreshToken = s("refreshToken"),
            expiresAt = System.currentTimeMillis() + expire * 1000,
        )
        onSessionChanged(session)
    }

    private fun get(path: String, params: Map<String, String>? = null): JsonElement? = request("GET", path, params)

    private fun request(method: String, path: String, params: Map<String, String>?, allowRefresh: Boolean = true): JsonElement? {
        if (allowRefresh) refreshIfNeeded()
        val rid = UUID.randomUUID().toString()
        val hashKey = SmartLifeCrypto.hashKey(rid, session.refreshToken)
        val secret = SmartLifeCrypto.secret(rid, hashKey)
        val query = params?.takeIf { it.isNotEmpty() }?.let { SmartLifeCrypto.encrypt(compactJson(it), secret) } ?: ""
        val headers = linkedMapOf(
            "X-appKey" to SmartLifeLogin.CLIENT_ID,
            "X-requestId" to rid,
            "X-sid" to "",
            "X-time" to System.currentTimeMillis().toString(),
        )
        if (session.accessToken.isNotEmpty()) headers["X-token"] = session.accessToken
        headers["X-sign"] = SmartLifeCrypto.sign(hashKey, query, "", headers)
        val url = session.endpoint.trimEnd('/') + path + if (query.isNotEmpty()) "?encdata=" + URLEncoder.encode(query, "UTF-8") else ""
        val json = try {
            Json.parseToJsonElement(http(method, url, headers)).jsonObject
        } catch (e: TuyaException) {
            throw e
        } catch (e: Exception) {
            throw TuyaException("Onverwacht antwoord van Tuya", e)
        }
        if (json["success"]?.jsonPrimitive?.booleanOrNull != true) {
            val msg = json["msg"]?.jsonPrimitive?.content ?: "onbekende fout"
            throw TuyaException("Tuya: $msg (code ${json["code"]?.jsonPrimitive?.content})")
        }
        val result = json["result"] ?: return null
        val text = (result as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return result
        val plain = SmartLifeCrypto.decrypt(text, secret)
        return try { Json.parseToJsonElement(plain) } catch (_: Exception) { JsonPrimitive(plain) }
    }

    private fun compactJson(m: Map<String, String>) = JsonObject(m.mapValues { JsonPrimitive(it.value) }).toString()
}

/** Versleuteling en ondertekening zoals in tuya-device-sharing-sdk (customerapi.py). */
internal object SmartLifeCrypto {
    private const val NONCE_CHARS = "ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678"
    private val random = SecureRandom()

    fun hashKey(rid: String, refreshToken: String) = Crypto.md5((rid + refreshToken).toByteArray()).toHex()

    fun secret(rid: String, hashKey: String) = Crypto.hmacSha256(rid.toByteArray(), hashKey.toByteArray()).toHex().substring(0, 16)

    fun randomNonce() = String(CharArray(12) { NONCE_CHARS[random.nextInt(NONCE_CHARS.length)] })

    /** base64(nonce) + base64(versleuteld + tag). */
    fun encrypt(plain: String, secret: String, nonce: String = randomNonce()): String {
        val n = nonce.toByteArray()
        val ct = Crypto.gcmEncrypt(secret.toByteArray(), n, null, plain.toByteArray())
        val b64 = Base64.getEncoder()
        return b64.encodeToString(n) + b64.encodeToString(ct)
    }

    fun decrypt(data: String, secret: String): String {
        val raw = Base64.getDecoder().decode(data)
        return String(Crypto.gcmDecrypt(secret.toByteArray(), raw.copyOfRange(0, 12), null, raw.copyOfRange(12, raw.size)), Charsets.UTF_8)
    }

    fun sign(hashKey: String, queryEnc: String, bodyEnc: String, headers: Map<String, String>): String {
        val parts = listOf("X-appKey", "X-requestId", "X-sid", "X-time", "X-token")
            .mapNotNull { k -> headers[k]?.takeIf { it.isNotEmpty() }?.let { "$k=$it" } }
        val str = parts.joinToString("||") + queryEnc + bodyEnc
        return Crypto.hmacSha256(hashKey.toByteArray(), str.toByteArray()).toHex()
    }
}

private fun readResponse(conn: HttpURLConnection): String {
    val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
    return stream?.bufferedReader()?.readText() ?: "{}"
}

internal fun defaultHttp(method: String, url: String): String = defaultHttpWithHeaders(method, url, emptyMap())

internal fun defaultHttpWithHeaders(method: String, url: String, headers: Map<String, String>): String {
    val conn = try {
        URL(url).openConnection() as HttpURLConnection
    } catch (e: Exception) {
        throw TuyaException("Ongeldig adres: $url", e)
    }
    try {
        conn.requestMethod = method
        conn.connectTimeout = 15000
        conn.readTimeout = 20000
        headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
        if (method == "POST") {
            conn.doOutput = true
            conn.setFixedLengthStreamingMode(0)
        }
        return readResponse(conn)
    } catch (e: Exception) {
        throw TuyaException("Geen verbinding met Tuya: ${e.message}", e)
    } finally {
        conn.disconnect()
    }
}

private fun parse(text: String): JsonObject = try {
    Json.parseToJsonElement(text).jsonObject
} catch (e: Exception) {
    throw TuyaException("Onverwacht antwoord van Tuya")
}
