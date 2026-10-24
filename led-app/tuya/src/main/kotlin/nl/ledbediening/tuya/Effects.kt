package nl.ledbediening.tuya

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.pow

/**
 * Effecten. [dreamMode] is het nummer dat RGBIC-strips zelf kennen
 * (gevonden in Tuya's standaardscènes), of null als alleen de app het kan.
 */
enum class Effect(val dreamMode: Int?) {
    STATIC(0),
    FADE(1),
    JUMP(2),
    BREATHE(3),
    FLASH(4),
    FLOW(10),
    RAINBOW(11),
    CHASE(null),     // één kleur die van strip naar strip loopt
    RANDOM(null),    // elke strip elke stap een andere willekeurige kleur
    STROBE(null),    // korte felle flitsen
}

data class EffectSpec(
    val effect: Effect,
    val colors: List<Hsv>,
    val speed: Int = 50,            // 1 (traag) – 100 (snel)
    val brightness: Float = 1f,     // 0–1
    val reverse: Boolean = false,   // richting omdraaien
    val pingPong: Boolean = false,  // heen en terug in plaats van rondgaan
    val spread: Boolean = false,    // verloop over de strips verdelen
)

/** Rekent uit welke kleur elke strip op elk moment heeft (voor effecten die de app aanstuurt). */
object EffectEngine {
    /** Duur van één stap: snelheid 1 ≈ 12 s, 50 ≈ 1,7 s, 100 ≈ 0,25 s. */
    fun stepMs(speed: Int): Double = 12000.0 * (0.25 / 12.0).pow((speed.coerceIn(1, 100) - 1) / 99.0)

    /** Kleur voor strip [index] (van [count]) op tijdstip [tMs] sinds de start. */
    fun frame(spec: EffectSpec, tMs: Long, index: Int, count: Int): Hsv {
        val colors = spec.colors.ifEmpty { listOf(Hsv(0f, 0f)) }
        val n = colors.size
        val step = stepMs(spec.speed)
        val stripOrder = if (spec.reverse) count - 1 - index else index
        val spread = spec.spread || spec.effect == Effect.FLOW || spec.effect == Effect.CHASE
        // Faseverschuiving per strip: zo "loopt" het effect van strip naar strip.
        val offset = if (spread && count > 1) stripOrder.toDouble() * (if (spec.effect == Effect.CHASE) 1.0 else n.toDouble() / count) else 0.0
        val raw = tMs / step - offset
        val i = floor(raw).toLong()
        val frac = (raw - i).toFloat()
        fun col(k: Long) = colors[index(k, n, spec.pingPong)]
        val b = spec.brightness.coerceIn(0.01f, 1f)

        val c = when (spec.effect) {
            Effect.STATIC -> if (spread) col(stripOrder.toLong()) else colors[0]
            Effect.JUMP -> col(i)
            Effect.FADE, Effect.FLOW -> Hsv.lerp(col(i), col(i + 1), smooth(frac))
            Effect.BREATHE -> col(i).withV(col(i).v * breath(frac))
            Effect.FLASH -> if (frac < 0.5f) col(i) else col(i).withV(0f)
            Effect.RAINBOW -> {
                val cycle = step * 6
                val hue = ((tMs / cycle - offset / n) * 360.0).mod(360.0).toFloat()
                Hsv(if (spec.reverse) 360f - hue else hue, 1f)
            }
            Effect.RANDOM -> colors[randomIndex(i, stripOrder, n)]
            Effect.STROBE -> if (frac < 0.18f) col(i) else col(i).withV(0f)
            Effect.CHASE -> {
                // Strip die "aan de beurt" is krijgt de kleur, de rest dimt.
                val active = floor(tMs / step).toLong()
                val turn = ((active % count) + count) % count
                val color = col(active / count)
                if (stripOrder.toLong() == turn) color else color.withV(0.03f)
            }
        }
        return c.withV(c.v * b)
    }

    /** Of de strip zelf mag vervagen naar de volgende kleur (alleen bij vloeiende effecten). */
    fun isSmooth(effect: Effect) = effect == Effect.FADE || effect == Effect.FLOW || effect == Effect.RAINBOW || effect == Effect.BREATHE

    /** Stap [k] naar kleurnummer; bij heen-en-weer: 0,1,2,1,0,1,2,... */
    private fun index(k: Long, n: Int, pingPong: Boolean): Int {
        if (!pingPong || n <= 2) return (((k % n) + n) % n).toInt()
        val period = 2L * (n - 1)
        val p = ((k % period) + period) % period
        return (if (p <= n - 1) p else period - p).toInt()
    }

    /**
     * Herhaalbare willekeurige kleurkeuze voor stap [k] die nooit twee keer dezelfde kleur
     * achter elkaar geeft: elk blok van n stappen is een geschudde volgorde van alle kleuren,
     * waarbij het blok eindigt op kleur (blok mod n) en het volgende blok daar niet mee begint.
     */
    private fun randomIndex(k: Long, strip: Int, n: Int): Int {
        if (n <= 2) return Math.floorMod(k, n.toLong()).toInt()
        val block = Math.floorDiv(k, n.toLong())
        val pos = Math.floorMod(k, n.toLong()).toInt()
        val last = Math.floorMod(block, n.toLong()).toInt()
        val prevLast = Math.floorMod(block - 1, n.toLong()).toInt()
        val others = (0 until n).filter { it != last }.toMutableList()
        others.shuffle(kotlin.random.Random(scramble(block * 7919 + strip)))
        if (others[0] == prevLast) others[0] = others[1].also { others[1] = others[0] }
        return if (pos == n - 1) last else others[pos]
    }

    /** Snelle hash naar een niet-negatief getal (voor herhaalbare "willekeur"). */
    private fun scramble(x: Long): Long {
        var h = x * -0x61c8864680b583ebL
        h = h xor (h ushr 29)
        h *= -0x4b47d5b1ad7a5a65L
        h = h xor (h ushr 32)
        return h and Long.MAX_VALUE
    }

    private fun scramble(x: Int): Long = scramble(x.toLong())

    private fun smooth(t: Float) = t * t * (3 - 2 * t)

    private fun breath(t: Float) = (0.5 - 0.5 * cos(2 * PI * t)).toFloat().coerceAtLeast(0.02f)
}
