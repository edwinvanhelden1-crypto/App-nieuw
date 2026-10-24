package nl.ledbediening.ikea

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import nl.ledbediening.tuya.Dp
import nl.ledbediening.tuya.Hsv
import nl.ledbediening.tuya.LightCodec
import nl.ledbediening.tuya.TuyaException
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.ServerSocket
import java.net.Socket
import java.security.KeyStore
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import kotlin.concurrent.thread
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Nagebootste DIRIGERA-hub (HTTP/1.1 met keep-alive). */
class FakeHub(private val server: ServerSocket) {
    val buttonPressed = AtomicBoolean(false)
    val patches = CopyOnWriteArrayList<Pair<String, String>>()
    val connections = AtomicInteger()
    var lampOn = false

    private val lamps get() = """[
      {"id":"lamp-1","type":"light","deviceType":"light","isReachable":true,"room":{"name":"Woonkamer"},
       "attributes":{"customName":"Bank","isOn":$lampOn,"lightLevel":60,"colorHue":240.0,"colorSaturation":1.0,
         "colorTemperature":2700,"colorTemperatureMin":4000,"colorTemperatureMax":2202,"colorMode":"color"},
       "capabilities":{"canReceive":["isOn","lightLevel","colorHue","colorSaturation","colorTemperature"]}},
      {"id":"lamp-2","type":"light","isReachable":true,
       "attributes":{"customName":"Hal","isOn":true,"lightLevel":30,"colorTemperature":370,"colorTemperatureMin":454,"colorTemperatureMax":250},
       "capabilities":{"canReceive":["isOn","lightLevel","colorTemperature"]}},
      {"id":"sensor-1","type":"sensor","attributes":{}}
    ]"""

    val port get() = server.localPort

    fun start() = thread(isDaemon = true) {
        while (!server.isClosed) {
            val s = try { server.accept() } catch (_: Exception) { break }
            connections.incrementAndGet()
            thread(isDaemon = true) { handle(s) }
        }
    }

    private fun handle(s: Socket) = s.use {
        val inp = BufferedReader(InputStreamReader(s.getInputStream()))
        val out = s.getOutputStream()
        while (true) {
            val request = inp.readLine() ?: return
            if (request.isEmpty()) continue
            val (method, path) = request.split(" ").let { it[0] to it[1] }
            var length = 0
            var auth: String? = null
            while (true) {
                val h = inp.readLine() ?: return
                if (h.isEmpty()) break
                if (h.startsWith("Content-Length:", true)) length = h.substringAfter(':').trim().toInt()
                if (h.startsWith("Authorization:", true)) auth = h.substringAfter(':').trim()
            }
            val body = CharArray(length).also { var o = 0; while (o < length) o += inp.read(it, o, length - o) }.concatToString()
            fun reply(status: Int, text: String, chunked: Boolean = false) {
                val bytes = text.toByteArray()
                val head = "HTTP/1.1 $status X\r\nContent-Type: application/json\r\n" +
                    if (chunked) "Transfer-Encoding: chunked\r\n\r\n" else "Content-Length: ${bytes.size}\r\n\r\n"
                out.write(head.toByteArray())
                if (chunked) {
                    // In twee stukken, zoals een echte server soms doet.
                    val half = bytes.size / 2
                    out.write("${Integer.toHexString(half)}\r\n".toByteArray()); out.write(bytes, 0, half); out.write("\r\n".toByteArray())
                    out.write("${Integer.toHexString(bytes.size - half)}\r\n".toByteArray()); out.write(bytes, half, bytes.size - half); out.write("\r\n0\r\n\r\n".toByteArray())
                } else out.write(bytes)
                out.flush()
            }
            when {
                method == "GET" && path.startsWith("/v1/oauth/authorize") -> {
                    check("code_challenge_method=S256" in path && "audience=homesmart.local" in path)
                    reply(200, """{"code":"CODE123"}""")
                }
                method == "POST" && path == "/v1/oauth/token" -> {
                    check("code=CODE123" in body && "grant_type=authorization_code" in body && "code_verifier=" in body)
                    if (buttonPressed.get()) reply(200, """{"access_token":"TOKEN-XYZ"}""") else reply(403, """{"error":"Button not pressed"}""")
                }
                auth != "Bearer TOKEN-XYZ" -> reply(401, """{"error":"unauthorized"}""")
                method == "GET" && path == "/v1/devices" -> reply(200, lamps, chunked = true)
                method == "GET" && path.startsWith("/v1/devices/") -> {
                    val id = path.removePrefix("/v1/devices/")
                    val o = Json.parseToJsonElement(lamps).jsonArray.first { it.jsonObject["id"].toString().trim('"') == id }
                    reply(200, o.toString())
                }
                method == "PATCH" && path.startsWith("/v1/devices/") -> {
                    patches += path.removePrefix("/v1/devices/") to body
                    if ("\"isOn\":true" in body) lampOn = true
                    reply(202, "")
                }
                else -> reply(404, "{}")
            }
        }
    }
}

class DirigeraTest {
    private val servers = mutableListOf<ServerSocket>()

    @AfterTest
    fun stop() = servers.forEach { it.close() }

    private fun plainHub(): FakeHub = FakeHub(ServerSocket(0).also { servers += it }).also { it.start() }

    @Test
    fun pairingNeedsButton() {
        val fake = plainHub()
        val hub = DirigeraHub("127.0.0.1", port = fake.port, useTls = false)
        val pairing = hub.startPairing()
        assertEquals("CODE123", pairing.code)
        assertEquals(128, pairing.verifier.length)
        assertNull(hub.finishPairing(pairing), "zonder knop geen sleutel")
        fake.buttonPressed.set(true)
        assertEquals("TOKEN-XYZ", hub.finishPairing(pairing))
        assertEquals("TOKEN-XYZ", hub.token)
    }

    @Test
    fun lightsAndCommandsOverOneConnection() {
        val fake = plainHub()
        val hub = DirigeraHub("127.0.0.1", token = "TOKEN-XYZ", port = fake.port, useTls = false)
        val lights = hub.lights()
        assertEquals(listOf("Bank", "Hal"), lights.map { it.name })
        val bank = lights[0]
        assertEquals("Woonkamer", bank.room)
        assertTrue(bank.canColor && bank.canTemperature)
        assertEquals(2202, bank.tempWarm)
        assertEquals(4000, bank.tempCool)
        val hal = lights[1]
        assertTrue(!hal.canColor)
        assertEquals(2203, hal.tempWarm) // 454 mired
        assertEquals(4000, hal.tempCool) // 250 mired

        val lamp = DirigeraLight(hub, "lamp-1")
        val st = lamp.status()
        assertEquals("colour", st[Dp.MODE])
        assertEquals(600, st[Dp.BRIGHTNESS])
        lamp.set(mapOf(Dp.SWITCH to true, Dp.MODE to "colour", Dp.COLOUR to LightCodec.colour(Hsv(120f, 0.5f, 0.8f))))
        lamp.set(mapOf(Dp.CONTROL to LightCodec.control(Hsv(300f, 1f, 1f), true)))
        lamp.set(mapOf(Dp.SWITCH to true, Dp.MODE to "white", Dp.BRIGHTNESS to 500, Dp.TEMPERATURE to 1000))
        val bodies = fake.patches.map { it.second }
        assertEquals("""[{"attributes":{"isOn":true}}]""", bodies[0])
        assertEquals("""[{"attributes":{"colorHue":120.0,"colorSaturation":0.5,"lightLevel":80}}]""", bodies[1])
        assertEquals("""[{"attributes":{"colorHue":300.0,"colorSaturation":1.0,"lightLevel":100}}]""", bodies[2])
        assertEquals("""[{"attributes":{"lightLevel":50,"colorTemperature":4000}}]""", bodies[4])
        assertEquals(1, fake.connections.get(), "alles hoort over één verbinding te gaan (keep-alive)")
    }

    @Test
    fun wrongTokenGivesClearError() {
        val fake = plainHub()
        val hub = DirigeraHub("127.0.0.1", token = "OUD", port = fake.port, useTls = false)
        val e = assertFailsWith<TuyaException> { hub.lights() }
        assertTrue("koppel opnieuw" in e.message!!)
    }

    @Test
    fun mappingRoundTrip() {
        val light = IkeaLight("x", "x", "", true, 40, 200f, 0.7f, 3100, 2200, 4000, "color", true, true, true, true)
        val dps = IkeaMapping.toDps(light)
        val back = IkeaMapping.toAttributes(dps, light)
        assertEquals(200.0, back["colorHue"])
        assertEquals(0.7, back["colorSaturation"])
        assertEquals(40, back["lightLevel"])
        assertEquals(true, back["isOn"])
        val white = IkeaMapping.toAttributes(mapOf(Dp.MODE to "white", Dp.BRIGHTNESS to 10, Dp.TEMPERATURE to 0), light)
        assertEquals(mapOf<String, Any>("lightLevel" to 1, "colorTemperature" to 2200), white)
        // Lamp zonder kleur: kleur wordt alleen helderheid.
        val noColor = light.copy(canColor = false)
        assertEquals(mapOf<String, Any>("lightLevel" to 50), IkeaMapping.toAttributes(mapOf(Dp.COLOUR to LightCodec.colour(Hsv(10f, 1f, 0.5f))), noColor))
    }

    /** Echte TLS met een zelfondertekend certificaat, zoals de hub heeft; daarna vastgepind. */
    @Test
    fun tlsWithCertificatePinning() {
        val dir = File("build/tmp/hubcert").apply { mkdirs() }
        val ks = File(dir, "hub.p12")
        if (!ks.exists()) {
            val p = ProcessBuilder(
                File(System.getProperty("java.home"), "bin/keytool").path, "-genkeypair", "-keystore", ks.path, "-storetype", "PKCS12",
                "-storepass", "geheim", "-keypass", "geheim", "-alias", "hub", "-keyalg", "EC", "-groupname", "secp256r1",
                "-dname", "CN=DIRIGERA", "-validity", "3650",
            ).redirectErrorStream(true).start()
            assertEquals(0, p.waitFor(), p.inputStream.bufferedReader().readText())
        }
        val store = KeyStore.getInstance("PKCS12").apply { ks.inputStream().use { load(it, "geheim".toCharArray()) } }
        val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply { init(store, "geheim".toCharArray()) }
        val ctx = SSLContext.getInstance("TLS").apply { init(kmf.keyManagers, null, null) }
        val fake = FakeHub(ctx.serverSocketFactory.createServerSocket(0).also { servers += it }).also { it.start() }

        val first = DirigeraHub("127.0.0.1", token = "TOKEN-XYZ", port = fake.port)
        assertEquals(2, first.lights().size)
        val pin = assertNotNull(first.certSha256)
        // Met de juiste vingerafdruk werkt het; met een andere niet.
        assertEquals(2, DirigeraHub("127.0.0.1", "TOKEN-XYZ", pin, fake.port).lights().size)
        val e = assertFailsWith<TuyaException> { DirigeraHub("127.0.0.1", "TOKEN-XYZ", "00".repeat(32), fake.port).lights() }
        assertTrue("certificaat" in e.message!!, e.message)
    }
}
