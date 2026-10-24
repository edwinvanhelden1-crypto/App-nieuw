package nl.ledbediening.tuya

import kotlin.random.Random

/**
 * Feestmodus: stelt steeds een nieuwe, afwisselende scène samen (effect, kleuren, snelheid,
 * richting), zodat het niet steeds hetzelfde patroon wordt.
 */
object Party {
    /** Kleurstijlen; null = elke scène nieuwe willekeurige kleuren. */
    val palettes: Map<String, List<Int>?> = linkedMapOf(
        "Willekeurig" to null,
        "Neon" to listOf(0xFF00CC, 0x00FFEE, 0x7700FF, 0xCCFF00, 0xFF0055, 0x0066FF),
        "Regenboog" to listOf(0xFF0000, 0xFF8800, 0xFFEE00, 0x00FF00, 0x00CCFF, 0x0000FF, 0xAA00FF),
        "Warm" to listOf(0xFF2200, 0xFF6600, 0xFFAA00, 0xFF0044, 0xFFDD55),
        "IJs" to listOf(0x0044FF, 0x00CCFF, 0xFFFFFF, 0x6600FF, 0x00FFCC),
        "Tropisch" to listOf(0xFF3366, 0xFFCC00, 0x00FF99, 0x00CCFF, 0xFF6600),
    )

    data class Scene(val spec: EffectSpec, val durationMs: Long, val beats: Int)

    /** Effecten met hun kans; flitsen en rustige momenten komen minder vaak. */
    private val pool = listOf(
        Effect.RANDOM to 4, Effect.JUMP to 3, Effect.CHASE to 3, Effect.FLOW to 3,
        Effect.RAINBOW to 2, Effect.STROBE to 1, Effect.FADE to 1, Effect.BREATHE to 1,
    )

    /**
     * Volgende scène. [tempo] 1–100. [stripCount] bepaalt of achtervolgen zin heeft.
     * [previous] voorkomt twee keer hetzelfde effect achter elkaar.
     */
    fun next(rnd: Random, palette: String, tempo: Int, stripCount: Int, previous: Effect?): Scene {
        val candidates = pool.filter { (e, _) -> e != previous && !(e == Effect.CHASE && stripCount < 2) }
        val effect = weighted(rnd, candidates)
        val colors = colorsFor(rnd, palette)
        val t = tempo.coerceIn(1, 100)
        val speed = when (effect) {
            Effect.STROBE -> (t + 25).coerceAtMost(100)
            Effect.FADE, Effect.BREATHE -> (t - 25).coerceAtLeast(10)
            Effect.RAINBOW, Effect.FLOW -> (t - 10 + rnd.nextInt(-10, 11)).coerceIn(10, 100)
            else -> (t + rnd.nextInt(-12, 13)).coerceIn(5, 100)
        }
        val spec = EffectSpec(
            effect = effect,
            colors = colors,
            speed = speed,
            brightness = 1f,
            reverse = rnd.nextBoolean(),
            pingPong = effect == Effect.JUMP && rnd.nextInt(4) == 0,
            spread = effect in setOf(Effect.JUMP, Effect.FADE, Effect.BREATHE, Effect.STROBE) && stripCount > 1 && rnd.nextBoolean(),
        )
        // Flitsen kort, rustige effecten wat langer; sneller tempo = vaker wisselen.
        val base = when (effect) {
            Effect.STROBE -> 3000L
            Effect.FADE, Effect.BREATHE -> 12000L
            else -> 9000L
        }
        val duration = (base * (1.6 - t / 100.0) * (0.8 + rnd.nextDouble() * 0.5)).toLong().coerceAtLeast(2500)
        val beats = when (effect) {
            Effect.STROBE -> 8
            Effect.FADE, Effect.BREATHE -> 16
            else -> listOf(16, 16, 32).random(rnd)
        }
        return Scene(spec, duration, beats)
    }

    fun colorsFor(rnd: Random, palette: String): List<Hsv> {
        val base = palettes[palette]
        if (base == null) {
            // Willekeurig: 3–5 goed van elkaar verschillende, verzadigde kleuren.
            val n = rnd.nextInt(3, 6)
            val start = rnd.nextFloat() * 360f
            val stepDeg = 360f / n
            return List(n) { i -> Hsv((start + i * stepDeg + rnd.nextFloat() * stepDeg * 0.4f) % 360f, 1f) }.shuffled(rnd)
        }
        val n = rnd.nextInt(3, base.size + 1)
        return base.shuffled(rnd).take(n).map { Hsv.fromRgb(it) }
    }

    private fun weighted(rnd: Random, items: List<Pair<Effect, Int>>): Effect {
        var r = rnd.nextInt(items.sumOf { it.second })
        for ((e, w) in items) {
            if (r < w) return e
            r -= w
        }
        return items.last().first
    }
}

/**
 * Herkent beats in het geluidsniveau: een beat is een piek die duidelijk boven het
 * gemiddelde van de laatste ±1 seconde uitkomt. Voed [feed] met het RMS-niveau van elk
 * stukje geluid (bijv. elke 23 ms).
 */
class BeatDetector(private val minGapMs: Long = 260) {
    private val history = ArrayDeque<Double>()
    private var lastBeat = 0L
    private var peak = 0.02

    /** Geluidssterkte 0–1, aangepast aan hoe hard het in de kamer is. */
    var level = 0f
        private set

    /** Geeft true bij een beat. */
    fun feed(rms: Double, nowMs: Long): Boolean {
        history.addLast(rms)
        if (history.size > 43) history.removeFirst()
        val avg = history.average()
        peak = maxOf(rms, peak * 0.995, 0.02)
        level = (rms / peak).toFloat().coerceIn(0f, 1f)
        val beat = history.size > 10 && rms > avg * 1.35 && rms > 0.015 && nowMs - lastBeat > minGapMs
        if (beat) lastBeat = nowMs
        return beat
    }
}
