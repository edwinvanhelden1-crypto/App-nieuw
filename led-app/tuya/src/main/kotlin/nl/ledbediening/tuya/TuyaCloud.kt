package nl.ledbediening.tuya

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class CloudDevice(
    val id: String,
    val name: String,
    val localKey: String,
    val category: String,
    val productName: String,
    val online: Boolean,
    /** Functies (datapuntcodes) van het apparaat, als de cloud die meestuurt. */
    val codes: Set<String> = emptySet(),
) {
    /** Verlichting: herkend aan categorie (dd = ledstrip, dj = lamp, ...), functies of productnaam. */
    val isLight: Boolean
        get() = category in LIGHT_CATEGORIES ||
            codes.any { it in LIGHT_CODES } ||
            LIGHT_WORDS.any { productName.contains(it, ignoreCase = true) || name.contains(it, ignoreCase = true) }

    companion object {
        val LIGHT_CATEGORIES = setOf("dd", "dj", "dc", "fwd", "xdd", "fsd", "tgq", "tyndj", "gyd", "mbd", "sxd", "fwl", "tgkg", "dsd", "ykq")
        val LIGHT_CODES = setOf("switch_led", "work_mode", "colour_data", "colour_data_v2", "bright_value", "bright_value_v2", "dreamlight_scene_mode", "paint_colour_data")
        val LIGHT_WORDS = listOf("led", "light", "lamp", "strip", "licht", "rgb", "bulb")
    }
}

/**
 * Haalt eenmalig de lokale sleutels op via een (gratis) Tuya IoT-cloudproject.
 * Daarna is de cloud niet meer nodig.
 */
class TuyaCloud(private val host: String, private val accessId: String, private val secret: String) {
    private var token: String? = null

    enum class Region(val label: String, val host: String) {
        EU("Centraal-Europa", "openapi.tuyaeu.com"),
        EU_WEST("West-Europa", "openapi-weaz.tuyaeu.com"),
        US("West-Amerika", "openapi.tuyaus.com"),
        US_EAST("Oost-Amerika", "openapi-ueaz.tuyaus.com"),
        CN("China", "openapi.tuyacn.com"),
        IN("India", "openapi.tuyain.com"),
        SG("Singapore", "openapi-sg.iotbing.com"),
    }

    fun devices(): List<CloudDevice> {
        if (token == null) login()
        val result = ArrayList<CloudDevice>()
        var lastRowKey: String? = null
        do {
            val query = sortedMapOf("size" to "50")
            if (lastRowKey != null) query["last_row_key"] = lastRowKey
            val res = get("/v1.0/iot-01/associated-users/devices", query)["result"]?.jsonObject
                ?: throw TuyaException("Leeg antwoord van de Tuya-cloud")
            res["devices"]?.jsonArray?.forEach { e ->
                val d = e.jsonObject
                fun s(k: String) = d[k]?.jsonPrimitive?.content ?: ""
                result += CloudDevice(
                    id = s("id"),
                    name = s("name").ifEmpty { s("id") },
                    localKey = s("local_key"),
                    category = s("category"),
                    productName = s("product_name"),
                    online = d["online"]?.jsonPrimitive?.booleanOrNull ?: false,
                )
            }
            val hasMore = res["has_more"]?.jsonPrimitive?.booleanOrNull ?: false
            lastRowKey = res["last_row_key"]?.jsonPrimitive?.content
        } while (hasMore && lastRowKey != null && result.size < 1000)
        return result
    }

    private fun login() {
        val res = get("/v1.0/token", sortedMapOf("grant_type" to "1"))
        token = res["result"]?.jsonObject?.get("access_token")?.jsonPrimitive?.content
            ?: throw TuyaException("Inloggen bij Tuya mislukt")
    }

    private fun get(path: String, query: Map<String, String>): JsonObject {
        val qs = query.entries.joinToString("&") { "${it.key}=${it.value}" }
        val pathAndQuery = if (qs.isEmpty()) path else "$path?$qs"
        val t = System.currentTimeMillis().toString()
        val sign = sign(accessId, secret, token, t, "GET", pathAndQuery)
        val urlQs = query.entries.joinToString("&") { "${it.key}=${URLEncoder.encode(it.value, "UTF-8")}" }
        val conn = URL("https://$host$path" + if (urlQs.isEmpty()) "" else "?$urlQs").openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 10000
            conn.readTimeout = 15000
            conn.setRequestProperty("client_id", accessId)
            conn.setRequestProperty("sign", sign)
            conn.setRequestProperty("t", t)
            conn.setRequestProperty("sign_method", "HMAC-SHA256")
            token?.let { conn.setRequestProperty("access_token", it) }
            val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.readText() ?: ""
            val json = try {
                Json.parseToJsonElement(text).jsonObject
            } catch (e: Exception) {
                throw TuyaException("Onverwacht antwoord van de Tuya-cloud (HTTP ${conn.responseCode})")
            }
            if (json["success"]?.jsonPrimitive?.booleanOrNull != true) {
                val code = json["code"]?.jsonPrimitive?.content
                val msg = json["msg"]?.jsonPrimitive?.content ?: "onbekende fout"
                throw TuyaException(explain(code, msg))
            }
            return json
        } catch (e: TuyaException) {
            throw e
        } catch (e: Exception) {
            throw TuyaException("Geen verbinding met de Tuya-cloud: ${e.message}", e)
        } finally {
            conn.disconnect()
        }
    }

    private fun explain(code: String?, msg: String) = when (code) {
        "1004" -> "Ongeldige handtekening: controleer Access Secret"
        "1001", "1106", "2017" -> "Geen toegang ($msg). Controleer Access ID/Secret en de regio."
        "28841105", "28841107", "28841101" -> "Het cloudproject mag deze gegevens niet ophalen: abonneer het project op 'IoT Core' en koppel je Smart Life-account ($msg)"
        else -> "Tuya-cloud: $msg (code $code)"
    }

    companion object {
        /** Tuya's HMAC-SHA256-handtekening (nieuwe methode, zonder ondertekende extra headers). */
        internal fun sign(clientId: String, secret: String, token: String?, t: String, method: String, pathAndQuery: String, body: String = ""): String {
            val stringToSign = "$method\n${Crypto.sha256Hex(body.toByteArray())}\n\n$pathAndQuery"
            val payload = clientId + (token ?: "") + t + stringToSign
            return Crypto.hmacSha256(secret.toByteArray(), payload.toByteArray()).toHex(upper = true)
        }
    }
}
