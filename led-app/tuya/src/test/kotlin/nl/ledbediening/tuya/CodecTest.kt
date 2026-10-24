package nl.ledbediening.tuya

import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class CodecTest {
    @Test
    fun dreamSceneMatchesTuyaSdkExample() {
        // Uit @ray-js/panel-sdk: id 1, modus 5, snelheid 42, richting 1, helderheid 1000,
        // kleuren (248, 530) en (104, 380). Wij zetten "expand" niet, dus vlaggen 0x10 i.p.v. 0x14.
        val bytes = LightCodec.dreamScene(
            LightCodec.DreamScene(
                id = 1, mode = 5, speed = 42, reverse = true, segmented = false, brightness = 1f,
                colors = listOf(Hsv(248f, 0.53f), Hsv(104f, 0.38f)),
            ),
        )
        assertEquals("0101052a2a1000006400f835006826", bytes.toHex())
    }

    @Test
    fun dreamSceneMatchesBuiltInRainbow() {
        // "Marquee - Rainbow" zoals een echte RGBIC-strip hem meldt.
        val rainbow = "AQgLMjKAAABkAABkAB5kADxkAHhkALRkAPBkASxk"
        val parsed = assertNotNull(LightCodec.parseDreamScene(rainbow))
        assertEquals(11, parsed.mode)
        assertEquals(50, parsed.speed)
        assertTrue(parsed.segmented)
        assertEquals(7, parsed.colors.size)
        assertEquals(rainbow, LightCodec.dreamSceneBase64(parsed))
    }

    @Test
    fun dreamSceneFlowingWaterRoundTrip() {
        val flow = "AQkKMjKgAABkAABkADxkAHhkALRkAPBkASxk"
        val parsed = assertNotNull(LightCodec.parseDreamScene(flow))
        assertEquals(10, parsed.mode)
        assertTrue(parsed.smooth)
        assertEquals(flow, LightCodec.dreamSceneBase64(parsed))
    }

    @Test
    fun colourData() {
        assertEquals("007803e803e8", LightCodec.colour(Hsv(120f, 1f, 1f)))
        assertEquals("00000000000a", LightCodec.colour(Hsv(0f, 0f, 0f))) // minimaal 1%
        val c = assertNotNull(LightCodec.parseColour("00f001f40064"))
        assertEquals(240f, c.h)
        assertEquals(0.5f, c.s)
        assertEquals(0.1f, c.v)
        assertEquals("1007803e803e800000000", LightCodec.control(Hsv(120f, 1f, 1f), smooth = true))
    }

    @Test
    fun rgbRoundTrip() {
        for (rgb in listOf(0xff0000, 0x00ff00, 0x0000ff, 0xffffff, 0x123456, 0xff8800)) {
            assertEquals(rgb, Hsv.fromRgb(rgb).toRgb())
        }
    }

    @Test
    fun hueLerpTakesShortestPath() {
        val mid = Hsv.lerp(Hsv(350f, 1f), Hsv(10f, 1f), 0.5f)
        assertTrue(mid.h < 1f || mid.h > 359f, "verwacht rood, kreeg ${mid.h}")
    }

    @Test
    fun cloudSignatureMatchesTinytuya() {
        val key = "abcdefghijklmnop"
        val sec = "0123456789abcdef0123456789abcdef"
        assertEquals(
            "D4D0C6009394EC06935461E6ED0E2EDE673F5F1ED0F2927C9644750BBF8F1FEB",
            TuyaCloud.sign(key, sec, "tok123", "1700000000000", "GET", "/v1.0/iot-01/associated-users/devices?size=50"),
        )
        assertEquals(
            "D53D2C4B3DD767A71639A0547ECC1C3AE5BC0431C5F3B9783D565E4B1B75D65E",
            TuyaCloud.sign(key, sec, null, "1700000000000", "GET", "/v1.0/token?grant_type=1"),
        )
    }

    @Test
    fun discoveryPackets() {
        // Gegenereerd met tinytuya (tools/fake_device.py-omgeving).
        val p33 = "000055aa00000000000000130000008c000000002a9f8305368a6a303dfe78a9cb5fc152e07429f8a2b88631a2cbdc39e950df833d4027049fd5182422ae34db59315351582c5f50c0ebb337798829bb0cf5104c375ea174ed80056d7cd86c5b8d8bca0ce9c471a96f1f255afa725fb9888aab9ce7676c8756c8f7fa9d2d25d628414cffe805a9e6fb9dbbf227c0f928969f0a5a89a4d0b90000aa55"
        assertEquals(FoundDevice("bf0123456789abcdefgh", "192.168.1.42", "3.3"), TuyaDiscovery.decode(p33.hexToBytes()))
        val p35 = "00006699000000000000000000130000006400000000000000000000000057582ddb17d121b6ca6569eefd273a030da30eafbadb987eface168aee07c5472e9c9786a3d4086d398cafdd6df6e7a9cf9eb48bcafefa2d68fd55d4826e20a7613279e390e9285c8e6e63bf502ce31ea4ff0a4d73ba640a00009966"
        assertEquals(FoundDevice("bf9999999999abcdefgh", "192.168.1.43", "3.5"), TuyaDiscovery.decode(p35.hexToBytes()))
        val p31 = "000055aa000000000000001200000044000000007b226970223a20223139322e3136382e312e3434222c202267774964223a202262663331222c202276657273696f6e223a2022332e31227dfbd400b70000aa55"
        assertEquals(FoundDevice("bf31", "192.168.1.44", "3.1"), TuyaDiscovery.decode(p31.hexToBytes()))
        // Eigen verzoekbericht moet weer te ontcijferen zijn.
        val req = TuyaDiscovery.requestPacket("192.168.1.10")
        val f = FrameCodec.decode(req, Crypto.md5("yGAdlopoPVldABfn".toByteArray()), hmac = false)
        assertEquals("""{"from":"app","ip":"192.168.1.10"}""", f.payload.toString(Charsets.UTF_8))
    }

    @Test
    fun effectEngine() {
        val red = Hsv(0f, 1f); val blue = Hsv(240f, 1f)
        val jump = EffectSpec(Effect.JUMP, listOf(red, blue), speed = 50)
        val step = EffectEngine.stepMs(50).toLong()
        assertEquals(0f, EffectEngine.frame(jump, 0, 0, 1).h)
        assertEquals(240f, EffectEngine.frame(jump, step + 1, 0, 1).h)
        // Achtervolging: op t=0 is strip 0 aan de beurt, strip 1 gedimd.
        val chase = EffectSpec(Effect.CHASE, listOf(red), speed = 50)
        assertEquals(1f, EffectEngine.frame(chase, 0, 0, 3).v)
        assertTrue(EffectEngine.frame(chase, 0, 1, 3).v < 0.1f)
        assertTrue(EffectEngine.frame(chase, step + 1, 1, 3).v > 0.9f)
        // Omgekeerde richting: nu begint de laatste strip.
        assertTrue(EffectEngine.frame(chase.copy(reverse = true), 0, 2, 3).v > 0.9f)
        // Heen en weer met 3 kleuren: 0,1,2,1,0,...
        val pp = EffectSpec(Effect.JUMP, listOf(red, Hsv(120f, 1f), blue), speed = 50, pingPong = true)
        val hues = (0..5).map { EffectEngine.frame(pp, ((it + 0.5) * EffectEngine.stepMs(50)).toLong(), 0, 1).h }
        assertEquals(listOf(0f, 120f, 240f, 120f, 0f, 120f), hues)
        assertTrue(EffectEngine.stepMs(1) > EffectEngine.stepMs(100))
    }
}
