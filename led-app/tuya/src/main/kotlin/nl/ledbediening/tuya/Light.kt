package nl.ledbediening.tuya

import java.util.Base64
import kotlin.math.abs
import kotlin.math.roundToInt

/** Kleur als tint (0–360), verzadiging (0–1) en helderheid (0–1). */
data class Hsv(val h: Float, val s: Float, val v: Float = 1f) {
    fun withV(v: Float) = copy(v = v.coerceIn(0f, 1f))

    /** Als 0xRRGGBB. */
    fun toRgb(): Int {
        val hh = ((h % 360f) + 360f) % 360f / 60f
        val c = v * s
        val x = c * (1 - abs(hh % 2 - 1))
        val m = v - c
        val (r, g, b) = when (hh.toInt()) {
            0 -> Triple(c, x, 0f)
            1 -> Triple(x, c, 0f)
            2 -> Triple(0f, c, x)
            3 -> Triple(0f, x, c)
            4 -> Triple(x, 0f, c)
            else -> Triple(c, 0f, x)
        }
        fun ch(f: Float) = ((f + m) * 255).roundToInt().coerceIn(0, 255)
        return (ch(r) shl 16) or (ch(g) shl 8) or ch(b)
    }

    companion object {
        fun fromRgb(rgb: Int): Hsv {
            val r = (rgb shr 16 and 0xff) / 255f
            val g = (rgb shr 8 and 0xff) / 255f
            val b = (rgb and 0xff) / 255f
            val max = maxOf(r, g, b)
            val d = max - minOf(r, g, b)
            val h = when {
                d == 0f -> 0f
                max == r -> 60f * (((g - b) / d) % 6)
                max == g -> 60f * ((b - r) / d + 2)
                else -> 60f * ((r - g) / d + 4)
            }
            return Hsv((h + 360f) % 360f, if (max == 0f) 0f else d / max, max)
        }

        /** Mengt twee kleuren via de kortste weg over het kleurenwiel. */
        fun lerp(a: Hsv, b: Hsv, t: Float): Hsv {
            // Grijs/wit heeft geen tint: neem dan de tint van de andere kleur.
            val ha = if (a.s < 0.01f) b.h else a.h
            val hb = if (b.s < 0.01f) a.h else b.h
            var dh = hb - ha
            if (dh > 180) dh -= 360
            if (dh < -180) dh += 360
            return Hsv(((ha + dh * t) % 360f + 360f) % 360f, a.s + (b.s - a.s) * t, a.v + (b.v - a.v) * t)
        }
    }
}

/**
 * Datapunten van Tuya-verlichting ("type B", zoals ledstrips en RGBIC-strips).
 * Zie de Tuya-standaard voor categorie "dd" (light strip).
 */
object Dp {
    const val SWITCH = "20"
    const val MODE = "21"            // white / colour / scene / music
    const val BRIGHTNESS = "22"      // 10–1000
    const val TEMPERATURE = "23"     // 0–1000
    const val COLOUR = "24"          // HHHHSSSSVVVV
    const val SCENE = "25"
    const val CONTROL = "28"         // live aansturen zonder opslaan
    const val DREAM_SCENE = "51"     // RGBIC-effect (raw, base64)
    const val PIXELS = "53"          // aantal segmenten
}

object LightCodec {
    /** colour_data: tint 0–360, verzadiging en helderheid 0–1000, als 12 hex-tekens. */
    fun colour(c: Hsv): String {
        val h = c.h.roundToInt().mod(360)
        val s = (c.s * 1000).roundToInt().coerceIn(0, 1000)
        val v = (c.v * 1000).roundToInt().coerceIn(10, 1000)
        return "%04x%04x%04x".format(h, s, v)
    }

    fun parseColour(hex: String?): Hsv? {
        if (hex == null || hex.length < 12) return null
        return try {
            Hsv(
                hex.substring(0, 4).toInt(16).toFloat(),
                hex.substring(4, 8).toInt(16) / 1000f,
                hex.substring(8, 12).toInt(16) / 1000f,
            )
        } catch (_: NumberFormatException) {
            null
        }
    }

    /**
     * control_data: kleur live aanpassen zonder dat de strip het opslaat (bedoeld voor
     * vloeiende animaties). [smooth] laat de strip zelf zacht naar de kleur overgaan.
     * Opbouw: overgang (1 teken) + HSV (12) + helderheid wit (4) + temperatuur (4).
     */
    fun control(c: Hsv, smooth: Boolean): String =
        (if (smooth) "1" else "0") + colour(c) + "00000000"

    /** RGBIC-effect dat de strip zelf afspeelt (datapunt dreamlight_scene_mode). */
    data class DreamScene(
        val mode: Int,
        val colors: List<Hsv>,
        val speed: Int = 50,              // 0–100
        val brightness: Float = 1f,       // 0–1
        val segmented: Boolean = true,    // kleuren verdeeld over de strip
        val smooth: Boolean = false,      // zachte overgang tussen kleuren
        val reverse: Boolean = false,     // andere richting
        val loop: Boolean = false,
        val id: Int = 200,
    )

    /**
     * Codeert een RGBIC-effect volgens Tuya's DreamlightSceneModeTransformer:
     * versie, id, modus, snelheid (2×), vlaggen (segment/loop/overgang/richting/uitbreiding),
     * 2 reservebytes, helderheid (0–100) en per kleur tint (2 bytes) + verzadiging (0–100).
     */
    fun dreamScene(scene: DreamScene): ByteArray {
        val speed = scene.speed.coerceIn(1, 100)
        val flags = (if (scene.segmented) 0x80 else 0) or
            (if (scene.loop) 0x40 else 0) or
            (if (scene.smooth) 0x20 else 0) or
            (if (scene.reverse) 0x10 else 0)
        val out = ArrayList<Byte>()
        fun b(v: Int) = out.add(v.toByte())
        b(1); b(scene.id); b(scene.mode); b(speed); b(speed); b(flags); b(0); b(0)
        b((scene.brightness * 100).roundToInt().coerceIn(1, 100))
        val colors = scene.colors.ifEmpty { listOf(Hsv(0f, 1f)) }.take(MAX_DREAM_COLORS)
        for (c in colors) {
            val h = c.h.roundToInt().mod(360)
            b(h shr 8); b(h and 0xff)
            b((c.s * 100).roundToInt().coerceIn(0, 100))
        }
        return out.toByteArray()
    }

    fun dreamSceneBase64(scene: DreamScene): String = Base64.getEncoder().encodeToString(dreamScene(scene))

    fun parseDreamScene(base64: String): DreamScene? = try {
        val d = Base64.getDecoder().decode(base64)
        if (d.size < 9) null else {
            val f = d[5].toInt() and 0xff
            DreamScene(
                id = d[1].toInt() and 0xff,
                mode = d[2].toInt() and 0xff,
                speed = d[3].toInt() and 0xff,
                segmented = f and 0x80 != 0,
                loop = f and 0x40 != 0,
                smooth = f and 0x20 != 0,
                reverse = f and 0x10 != 0,
                brightness = (d[8].toInt() and 0xff) / 100f,
                colors = (9 until d.size - 2 step 3).map { i ->
                    Hsv((((d[i].toInt() and 0xff) shl 8) or (d[i + 1].toInt() and 0xff)).toFloat(), (d[i + 2].toInt() and 0xff) / 100f)
                },
            )
        }
    } catch (_: IllegalArgumentException) {
        null
    }

    const val MAX_DREAM_COLORS = 8
}
