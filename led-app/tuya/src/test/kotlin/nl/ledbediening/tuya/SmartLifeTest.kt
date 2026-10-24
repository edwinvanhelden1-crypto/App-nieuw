package nl.ledbediening.tuya

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URI
import java.net.URLDecoder
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SmartLifeTest {
    private val rid = "11111111-2222-3333-4444-555555555555"

    @Test
    fun cryptoMatchesTuyaSharingSdk() {
        // Waarden berekend met tuya-device-sharing-sdk 0.2.15 (customerapi.py).
        val hashKey = SmartLifeCrypto.hashKey(rid, "refreshTok")
        assertEquals("6aaa981d8c0100d4ce4d7d1448b4b0d9", hashKey)
        val secret = SmartLifeCrypto.secret(rid, hashKey)
        assertEquals("5e48a27e6a2fb4dd", secret)
        val enc = SmartLifeCrypto.encrypt("""{"homeId":"12345"}""", secret, nonce = "ABCDEFGHJKMN")
        assertEquals("QUJDREVGR0hKS01OzwFGoRGoQXS5/896qrVuJNMAIsGZIqral0U6W31hs99pEA==", enc)
        val headers = mapOf("X-appKey" to "HA_3y9q4ak7g4ephrvke", "X-requestId" to rid, "X-sid" to "", "X-time" to "1700000000000", "X-token" to "accessTok")
        assertEquals("e6e58e218ce4baf51cf8896bc7794f4de4a5b6296cf92a9f7293a0811d62e0b8", SmartLifeCrypto.sign(hashKey, enc, "", headers))
        assertEquals("4344b064963b136897de0244824c46b464eaf8c33d5f89c2ba1eb25068a8ea81", SmartLifeCrypto.sign(hashKey, "", "", headers))
        assertEquals(
            """[{"ownerId": 42, "name": "Thuis"}]""",
            SmartLifeCrypto.decrypt("Tk9OQ0UxMjM0NTY3Tg2fRCCzjPc44rLVafzk5wXK+9YOh4nelzYzcNCB989R68NhPwYTQQ1XAEFq+MfwLqk=", secret),
        )
    }

    @Test
    fun loginFlow() {
        var scanned = false
        val login = SmartLifeLogin { method, url ->
            when {
                method == "POST" && "usercode=ABC123" in url -> """{"success":true,"result":{"qrcode":"QRTOKEN"},"t":1}"""
                method == "POST" -> """{"success":false,"code":1106,"msg":"permission deny"}"""
                !scanned -> """{"success":false,"code":1,"msg":"not scanned"}"""
                else -> """{"success":true,"t":1700000000000,"result":{"uid":"u1","access_token":"at","refresh_token":"rt","expire_time":7200,"endpoint":"https://apigw.tuyaeu.com","terminal_id":"term","username":"edwin"}}"""
            }
        }
        val token = login.requestQr("ABC123")
        assertEquals("QRTOKEN", token)
        assertEquals("tuyaSmart--qrLogin?token=QRTOKEN", SmartLifeLogin.qrContent(token))
        assertNull(login.poll(token, "ABC123"))
        scanned = true
        val s = login.poll(token, "ABC123")!!
        assertEquals("https://apigw.tuyaeu.com", s.endpoint)
        assertEquals(1700000000000 + 7200_000, s.expiresAt)
        assertEquals("rt", s.refreshToken)
        assertFailsWith<TuyaException> { login.requestQr("FOUT") }
    }

    /** Nagebootste Tuya-server: controleert handtekening, ontsleutelt de vraag en versleutelt het antwoord. */
    @Test
    fun devicesFromAllHomes() {
        val session = SmartLifeSession("ABC123", "u1", "at", "rt", System.currentTimeMillis() + 3_600_000, "https://apigw.tuyaeu.com")
        val seenHomes = mutableListOf<String>()
        val api = SmartLifeApi(session, http = { method, url, h ->
            assertEquals("GET", method)
            val rid = h.getValue("X-requestId")
            val hashKey = SmartLifeCrypto.hashKey(rid, "rt")
            val secret = SmartLifeCrypto.secret(rid, hashKey)
            val uri = URI(url)
            val enc = uri.rawQuery?.removePrefix("encdata=")?.let { URLDecoder.decode(it, "UTF-8") } ?: ""
            assertEquals(SmartLifeCrypto.sign(hashKey, enc, "", h), h["X-sign"], "handtekening klopt niet")
            assertEquals("at", h["X-token"])
            val result = when (uri.path) {
                "/v1.0/m/life/users/homes" -> """[{"ownerId":"111","name":"Thuis"},{"ownerId":222,"name":"Zomerhuis"}]"""
                "/v1.0/m/life/ha/home/devices" -> {
                    val homeId = Json.parseToJsonElement(SmartLifeCrypto.decrypt(enc, secret)).jsonObject["homeId"]!!.jsonPrimitive.content
                    seenHomes += homeId
                    if (homeId == "111") {
                        """[{"id":"bf1","name":"Hoeklamp","local_key":"0123456789abcdef","category":"dd","product_name":"RGBIC Corner","online":true},
                           {"id":"bf2","name":"Stekker","local_key":"fedcba9876543210","category":"cz","online":false}]"""
                    } else {
                        """[{"id":"bf3","name":"Lamp zomerhuis","local_key":"aaaaaaaaaaaaaaaa","category":"dj","online":true},
                           {"id":"bf4","name":"Hoek","local_key":"bbbbbbbbbbbbbbbb","category":"xyz","online":true,"status":[{"code":"switch_led","value":true}]}]"""
                    }
                }
                else -> error("onverwacht pad ${uri.path}")
            }
            """{"success":true,"t":1,"result":"${SmartLifeCrypto.encrypt(result, secret)}"}"""
        })
        val devices = api.allDevices()
        assertEquals(listOf("111", "222"), seenHomes)
        assertEquals(listOf("bf1", "bf2", "bf3", "bf4"), devices.map { it.id })
        assertTrue(devices[3].isLight, "lamp met onbekende categorie maar switch_led moet herkend worden")
        assertEquals("0123456789abcdef", devices[0].localKey)
        assertTrue(devices[0].isLight)
        assertTrue(!devices[1].isLight)
        assertTrue(devices[2].isLight)
    }

    @Test
    fun refreshesExpiredToken() {
        val expired = SmartLifeSession("ABC123", "u1", "old", "rt", System.currentTimeMillis() - 1000, "https://apigw.tuyaeu.com")
        var saved: SmartLifeSession? = null
        val api = SmartLifeApi(expired, http = { _, url, h ->
            val rid = h.getValue("X-requestId")
            val refresh = if ("/v1.0/m/token/" in url) "rt" else "rt2"
            val secret = SmartLifeCrypto.secret(rid, SmartLifeCrypto.hashKey(rid, refresh))
            val result = if ("/v1.0/m/token/rt" in url) {
                assertEquals("old", h["X-token"])
                """{"uid":"u1","accessToken":"new","refreshToken":"rt2","expireTime":7200}"""
            } else {
                assertEquals("new", h["X-token"])
                "[]"
            }
            """{"success":true,"t":1,"result":"${SmartLifeCrypto.encrypt(result, secret)}"}"""
        }, onSessionChanged = { saved = it })
        assertEquals(emptyList(), api.homes())
        assertEquals("new", saved?.accessToken)
        assertEquals("rt2", api.session.refreshToken)
    }
}
