package nl.ledbediening.tuya

import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class PartyTest {
    @Test
    fun scenesVaryAndNeverRepeatBackToBack() {
        val rnd = Random(42)
        var prev: Effect? = null
        val effects = mutableListOf<Effect>()
        repeat(200) {
            val s = Party.next(rnd, "Willekeurig", 60, stripCount = 3, previous = prev)
            assertNotEquals(prev, s.spec.effect)
            assertTrue(s.spec.colors.size >= 3)
            assertTrue(s.durationMs >= 2500)
            prev = s.spec.effect
            effects += s.spec.effect
        }
        assertTrue(effects.toSet().size >= 7, "te weinig afwisseling: ${effects.toSet()}")
    }

    @Test
    fun noChaseWithOneLamp() {
        val rnd = Random(1)
        repeat(200) { assertNotEquals(Effect.CHASE, Party.next(rnd, "Neon", 50, stripCount = 1, previous = null).spec.effect) }
    }

    @Test
    fun paletteColoursComeFromPalette() {
        val neon = Party.palettes.getValue("Neon")!!.map { Hsv.fromRgb(it).toRgb() }.toSet()
        repeat(20) {
            Party.colorsFor(Random(it), "Neon").forEach { c -> assertTrue(c.toRgb() in neon) }
        }
    }

    @Test
    fun randomAndStrobeEffects() {
        val colors = listOf(Hsv(0f, 1f), Hsv(120f, 1f), Hsv(240f, 1f))
        val step = EffectEngine.stepMs(50)
        val random = EffectSpec(Effect.RANDOM, colors)
        // Opeenvolgende stappen op dezelfde strip krijgen een andere kleur.
        for (n in 3..6) for (strip in 0 until 4) {
            val cs = List(n) { Hsv(it * 360f / n, 1f) }
            val hs = (0..500).map { EffectEngine.frame(random.copy(colors = cs), ((it + 0.5) * step).toLong(), strip, 4).h }
            hs.zipWithNext().forEach { (a, b) -> assertNotEquals(a, b, "herhaling bij $n kleuren, strip $strip") }
            assertEquals(n, hs.toSet().size, "niet alle kleuren gebruikt")
        }
        // Strobe: kort aan, daarna uit.
        val strobe = EffectSpec(Effect.STROBE, colors)
        assertEquals(1f, EffectEngine.frame(strobe, (step * 0.05).toLong(), 0, 1).v)
        assertTrue(EffectEngine.frame(strobe, (step * 0.6).toLong(), 0, 1).v < 0.05f)
    }

    @Test
    fun beatDetectorFindsKicks() {
        val d = BeatDetector()
        var beats = 0
        var t = 0L
        val rnd = Random(3)
        // 10 s muziek op 120 BPM: elke 500 ms een harde kick, daartussen zachter geluid.
        while (t < 10_000) {
            val kick = t % 500 < 46
            val rms = if (kick) 0.5 + rnd.nextDouble() * 0.1 else 0.08 + rnd.nextDouble() * 0.04
            if (d.feed(rms, t)) beats++
            t += 23
        }
        assertTrue(beats in 17..21, "verwacht ±20 beats, kreeg $beats")
        // Stilte met wat ruis: geen beats.
        val quiet = BeatDetector()
        var false_ = 0
        for (i in 0 until 400) if (quiet.feed(0.003 + rnd.nextDouble() * 0.002, i * 23L)) false_++
        assertEquals(0, false_)
    }
}
