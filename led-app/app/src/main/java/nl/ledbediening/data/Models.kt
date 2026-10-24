package nl.ledbediening.data

import kotlinx.serialization.Serializable
import nl.ledbediening.tuya.Dp
import nl.ledbediening.tuya.Effect
import nl.ledbediening.tuya.EffectSpec
import nl.ledbediening.tuya.Hsv
import nl.ledbediening.tuya.SmartLifeSession
import java.util.UUID

fun newId(): String = UUID.randomUUID().toString()

@Serializable
data class Strip(
    val id: String,
    val name: String,
    val localKey: String,
    val ip: String = "",
    val version: String = "3.3",
    /** Datapunten die de strip heeft (bekend na de eerste verbinding). */
    val dps: List<String> = emptyList(),
    /** "tuya" of "ikea" (lamp aan een IKEA DIRIGERA-hub). */
    val kind: String = KIND_TUYA,
    /** Bij IKEA: de hub waar de lamp aan hangt. */
    val hubId: String = "",
    /** Bij IKEA: de ruimte uit de IKEA-app. */
    val room: String = "",
) {
    val isIkea get() = kind == KIND_IKEA
    val isTuya get() = kind == KIND_TUYA

    val hasDreamScenes get() = Dp.DREAM_SCENE in dps
    val hasLiveControl get() = Dp.CONTROL in dps
    val isConfigured get() = isIkea || ip.isNotBlank()

    companion object {
        const val KIND_TUYA = "tuya"
        const val KIND_IKEA = "ikea"
    }
}

/** Een gekoppelde IKEA DIRIGERA-hub. */
@Serializable
data class HubInfo(
    val id: String,
    val host: String,
    val token: String,
    /** Vingerafdruk van het certificaat van de hub (alleen dat certificaat wordt vertrouwd). */
    val certSha256: String? = null,
    val name: String = "IKEA DIRIGERA",
)

/** Waar een thema wordt afgespeeld. */
enum class Engine(val label: String) {
    AUTO("Automatisch"),
    STRIP("Op de strip"),
    APP("Via de app"),
}

val Effect.label: String
    get() = when (this) {
        Effect.STATIC -> "Statisch"
        Effect.FADE -> "Overvloeien"
        Effect.JUMP -> "Springen"
        Effect.BREATHE -> "Ademen"
        Effect.FLASH -> "Flitsen"
        Effect.FLOW -> "Stromen"
        Effect.RAINBOW -> "Regenboog"
        Effect.CHASE -> "Achtervolgen"
        Effect.RANDOM -> "Willekeurig"
        Effect.STROBE -> "Stroboscoop"
    }

val Effect.description: String
    get() = when (this) {
        Effect.STATIC -> "Vaste kleuren, verdeeld over de strip"
        Effect.FADE -> "Kleuren vloeien zacht in elkaar over"
        Effect.JUMP -> "Springt van kleur naar kleur"
        Effect.BREATHE -> "Elke kleur licht langzaam op en dooft weer"
        Effect.FLASH -> "Kleuren flitsen aan en uit"
        Effect.FLOW -> "Kleuren stromen over de strip"
        Effect.RAINBOW -> "Een regenboog die over de strip loopt"
        Effect.CHASE -> "Kleur loopt van strip naar strip (meerdere strips)"
        Effect.RANDOM -> "Elke lamp springt naar een willekeurige kleur"
        Effect.STROBE -> "Korte felle flitsen"
    }

@Serializable
data class Theme(
    val id: String = newId(),
    val name: String = "Nieuw thema",
    /** Kleuren als 0xRRGGBB. */
    val colors: List<Int> = listOf(0xFF0000, 0x00FF00, 0x0000FF),
    val effect: String = Effect.FLOW.name,
    val speed: Int = 50,
    val brightness: Int = 100,
    val reverse: Boolean = false,
    val pingPong: Boolean = false,
    val spread: Boolean = false,
    val segmented: Boolean = true,
    val smooth: Boolean = true,
    val engine: Engine = Engine.AUTO,
    /** Leeg = alle strips. */
    val stripIds: List<String> = emptyList(),
) {
    val effectEnum: Effect get() = runCatching { Effect.valueOf(effect) }.getOrDefault(Effect.FLOW)
    val hsvColors: List<Hsv> get() = colors.map { Hsv.fromRgb(it) }

    fun spec() = EffectSpec(
        effect = effectEnum,
        colors = hsvColors,
        speed = speed,
        brightness = brightness / 100f,
        reverse = reverse,
        pingPong = pingPong,
        spread = spread,
    )
}

@Serializable
data class SequenceStep(val themeId: String, val seconds: Int = 30)

/** Een reeks thema's die na elkaar (en in elkaar overvloeiend) worden afgespeeld. */
@Serializable
data class Sequence(
    val id: String = newId(),
    val name: String = "Nieuwe reeks",
    val steps: List<SequenceStep> = emptyList(),
    val crossfadeSeconds: Int = 3,
    val repeat: Boolean = true,
)

@Serializable
data class CloudSettings(val accessId: String = "", val secret: String = "", val region: String = "EU")

@Serializable
data class AppData(
    val strips: List<Strip> = emptyList(),
    val themes: List<Theme> = DefaultThemes.all,
    val sequences: List<Sequence> = emptyList(),
    val cloud: CloudSettings = CloudSettings(),
    /** Inlog via de Smart Life-app (QR-code). */
    val smartLife: SmartLifeSession? = null,
    /** Lopende inlogpoging (QR-code nog niet bevestigd); overleeft het afsluiten van de app. */
    val pendingLogin: PendingLogin? = null,
    val party: PartySettings = PartySettings(),
    val hubs: List<HubInfo> = emptyList(),
)

@Serializable
data class PartySettings(
    val palette: String = "Willekeurig",
    val tempo: Int = 65,
    /** Reageren op muziek via de microfoon. */
    val music: Boolean = false,
)

@Serializable
data class PendingLogin(val qrToken: String, val userCode: String, val createdAt: Long)

object DefaultThemes {
    val all = listOf(
        Theme(name = "Regenboog", colors = listOf(0xFF0000, 0xFF8800, 0xFFFF00, 0x00FF00, 0x00FFFF, 0x0000FF, 0xFF00FF), effect = Effect.RAINBOW.name, speed = 50),
        Theme(name = "Oceaan", colors = listOf(0x0033FF, 0x00C8FF, 0x00FFB4, 0x0066FF), effect = Effect.FLOW.name, speed = 30),
        Theme(name = "Zonsondergang", colors = listOf(0xFF2200, 0xFF7700, 0xFFB000, 0xFF0066), effect = Effect.FADE.name, speed = 25),
        Theme(name = "Disco", colors = listOf(0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF), effect = Effect.JUMP.name, speed = 85),
        Theme(name = "Kerst", colors = listOf(0xFF0000, 0x00FF00, 0xFFFFFF), effect = Effect.STATIC.name, segmented = true),
        Theme(name = "Zwaailicht", colors = listOf(0xFF0000, 0x0000FF), effect = Effect.FLASH.name, speed = 80),
        Theme(name = "Rustig ademen", colors = listOf(0x8800FF, 0x0044FF), effect = Effect.BREATHE.name, speed = 20),
    )
}
