package nl.ledbediening.tuya

import java.io.File
import java.net.Socket
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * Test de verbinding tegen tools/fake_device.py (gebouwd op tinytuya).
 * Draait alleen als FAKE_DEVICE_PYTHON naar een Python met tinytuya wijst.
 */
class DeviceTest {
    private val python = System.getenv("FAKE_DEVICE_PYTHON").orEmpty()
    private val procs = mutableListOf<Process>()

    private fun startFake(version: String, port: Int, vararg extra: String): Boolean {
        if (python.isEmpty()) {
            println("FAKE_DEVICE_PYTHON niet gezet: test overgeslagen")
            return false
        }
        val script = File("../tools/fake_device.py").absoluteFile
        val p = ProcessBuilder(listOf(python, script.path, "--version", version, "--port", "$port") + extra)
            .redirectErrorStream(true).redirectOutput(File("build/fake_$version.log")).start()
        procs += p
        repeat(50) {
            try { Socket("127.0.0.1", port).close(); return true } catch (_: Exception) { Thread.sleep(100) }
        }
        error("nagebootste strip start niet")
    }

    @AfterTest
    fun stop() = procs.forEach { it.destroy() }

    private fun exercise(version: String, port: Int) {
        if (!startFake(version, port)) return
        TuyaDevice("bf0123456789abcdefgh", "127.0.0.1", "0123456789abcdef", version, port = port).use { dev ->
            val st = dev.status()
            assertEquals(false, st["20"])
            assertEquals(30, st["53"])
            assertTrue(st.containsKey("51"), "RGBIC-datapunt 51 ontbreekt")

            val scene = LightCodec.dreamSceneBase64(LightCodec.DreamScene(mode = 10, colors = listOf(Hsv(0f, 1f), Hsv(120f, 1f))))
            dev.set(mapOf("20" to true, "21" to "scene", "51" to scene))
            // Snel achter elkaar, zoals bij een animatie.
            for (h in 0 until 360 step 30) dev.set(mapOf("28" to LightCodec.control(Hsv(h.toFloat(), 1f), true)))
            dev.heartbeat()
            val st2 = dev.status()
            assertEquals(true, st2["20"])
            assertEquals("scene", st2["21"])
            assertEquals(scene, st2["51"])
            assertEquals(LightCodec.control(Hsv(330f, 1f), true), st2["28"])
        }
        // Nieuwe verbinding na sluiten werkt ook.
        TuyaDevice("bf0123456789abcdefgh", "127.0.0.1", "0123456789abcdef", version, port = port).use {
            assertEquals(true, it.status()["20"])
        }
        // Verkeerde sleutel geeft een nette foutmelding.
        assertFailsWith<TuyaException> {
            TuyaDevice("bf0123456789abcdefgh", "127.0.0.1", "ffffffffffffffff", version, port = port, readTimeoutMs = 1500).use { it.status() }
        }
    }

    @Test fun protocol33() = exercise("3.3", 18033)
    @Test fun protocol34() = exercise("3.4", 18034)
    @Test fun protocol35() = exercise("3.5", 18035)

    @Test
    fun probeFindsVersion() {
        if (!startFake("3.4", 18134)) return
        assertEquals("3.4", TuyaDiscovery.probe("bf0123456789abcdefgh", "127.0.0.1", "0123456789abcdef", port = 18134))
        assertEquals(null, TuyaDiscovery.probe("bf0123456789abcdefgh", "127.0.0.1", "ffffffffffffffff", port = 18134))
    }

    @Test
    fun lampWithoutAcksStaysFast() {
        if (!startFake("3.3", 18233, "--no-ack")) return
        TuyaDevice("bf0123456789abcdefgh", "127.0.0.1", "0123456789abcdef", "3.3", port = 18233).use { dev ->
            dev.status()
            val start = System.currentTimeMillis()
            repeat(20) { dev.set(mapOf("28" to LightCodec.control(Hsv(it * 18f, 1f), true))) }
            val ms = System.currentTimeMillis() - start
            assertTrue(ms < 2500, "20 opdrachten zonder bevestiging duurden $ms ms")
            // De verbinding werkt daarna nog steeds.
            assertEquals(LightCodec.control(Hsv(342f, 1f), true), dev.status()["28"])
        }
    }
}
