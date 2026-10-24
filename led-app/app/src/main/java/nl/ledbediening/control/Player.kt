package nl.ledbediening.control

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import nl.ledbediening.data.Engine
import nl.ledbediening.data.PartySettings
import nl.ledbediening.data.Repository
import nl.ledbediening.data.Sequence
import nl.ledbediening.data.Strip
import nl.ledbediening.data.Theme
import nl.ledbediening.data.label
import nl.ledbediening.tuya.Dp
import nl.ledbediening.tuya.EffectEngine
import nl.ledbediening.tuya.Hsv
import nl.ledbediening.tuya.LightCodec
import nl.ledbediening.tuya.Party
import kotlin.coroutines.coroutineContext
import kotlin.random.Random

data class PlayState(val title: String, val subtitle: String, val themeId: String? = null, val sequenceId: String? = null)

/**
 * Speelt thema's en reeksen af. Per strip wordt gekozen:
 *  - "op de strip": de RGBIC-strip speelt het effect zelf af (één opdracht, telefoon mag uit);
 *  - "via de app": de app berekent ±10× per seconde de kleur en stuurt die live.
 */
class Player(
    private val context: Context,
    private val repo: Repository,
    private val devices: DeviceManager,
    private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow<PlayState?>(null)
    val state: StateFlow<PlayState?> = _state.asStateFlow()
    private var job: Job? = null

    /** Stand van de lampen vóór het afspelen; wordt bij stoppen teruggezet. */
    private var saved: Map<String, Map<String, Any?>>? = null

    fun play(theme: Theme) {
        usesMic = false
        currentParty = null
        start(PlayState(theme.name, theme.effectEnum.label, themeId = theme.id)) {
            runSteps(listOf(theme to null), crossfadeMs = 0, repeat = true) {}
        }
    }

    /** Of de huidige weergave de microfoon gebruikt (voor het type voorgrondservice). */
    @Volatile var usesMic = false
        private set

    /**
     * Feestmodus op alle lampen: wisselt steeds van effect en kleuren. Met [PartySettings.music]
     * en microfoontoestemming gaan de lampen mee op de beat van de muziek.
     */
    /** Instellingen van het feest dat nu speelt (null als er geen feest speelt). */
    @Volatile var currentParty: PartySettings? = null
        private set

    fun playParty(settings: PartySettings) {
        currentParty = settings
        usesMic = settings.music &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        start(PlayState("🎉 Feest", if (usesMic) "Op de muziek" else settings.palette, themeId = PARTY_ID), partyStrips(settings)) {
            runParty(settings)
        }
    }

    /** Doelstrips van het feest: de gekozen lampen, of alle. */
    private fun partyStrips(settings: PartySettings): List<Strip> {
        val all = repo.data.value.strips.filter { it.isConfigured }
        val chosen = all.filter { it.id in settings.stripIds }
        return chosen.ifEmpty { all }
    }

    /**
     * Eén "baan" van het feest: een groep lampen die samen hetzelfde effect doet. Bij
     * "elke lamp zijn eigen disco" heeft elke lamp een eigen baan met eigen toevalsgetallen.
     */
    private inner class Lane(val strips: List<Strip>, val rnd: Random, val settings: PartySettings, now: Long) {
        var scene = Party.next(rnd, settings.palette, settings.tempo, strips.size, null)
        var sceneStart = now
        var beatsInScene = 0
        var stepIndex = 0L
        var lastBeats = 0L
        var tv = 0.0 // "muziektijd": loopt alleen een stap verder op een beat

        fun tick(now: Long, dt: Double, beats: Long?, beatMode: Boolean, level: Float, sent: HashMap<String, Sent>) {
            val step = EffectEngine.stepMs(scene.spec.speed)
            if (beats != null) {
                if (beats > lastBeats) {
                    stepIndex += beats - lastBeats
                    beatsInScene += (beats - lastBeats).toInt()
                    lastBeats = beats
                    tv = stepIndex * step
                } else {
                    // Tussen beats loopt de tijd door, maar nooit voorbij de huidige stap.
                    tv = minOf(tv + dt, (stepIndex + 0.97) * step)
                }
            }
            val over = if (beatMode) beatsInScene >= scene.beats else now - sceneStart >= scene.durationMs
            if (over) {
                scene = Party.next(rnd, settings.palette, settings.tempo, strips.size, scene.spec.effect)
                sceneStart = now
                beatsInScene = 0
                stepIndex = 0
                tv = 0.0
            }
            val t = if (beatMode) tv.toLong() else now - sceneStart
            val smooth = EffectEngine.isSmooth(scene.spec.effect) && !beatMode
            strips.forEachIndexed { i, strip ->
                val c = EffectEngine.frame(scene.spec, t, i, strips.size)
                sendColour(strip, sent.getOrPut(strip.id) { Sent() }, c.withV(c.v * level), smooth, now)
            }
        }
    }

    private suspend fun runParty(settings: PartySettings) {
        val strips = partyStrips(settings)
        if (strips.isEmpty()) {
            takeSaved()
            return
        }
        val seed = System.nanoTime()
        val sent = HashMap<String, Sent>()
        val audio = if (usesMic) AudioBeat().takeIf { it.start() } else null
        try {
            var now = System.currentTimeMillis()
            val lanes = if (settings.independent && strips.size > 1) {
                strips.mapIndexed { i, s -> Lane(listOf(s), Random(seed + i * 7919), settings, now) }
            } else {
                listOf(Lane(strips, Random(seed), settings, now))
            }
            var last = now
            var lastBeatAt = now
            var lastBeats = 0L
            var shown: String? = null
            while (coroutineContext.isActive) {
                now = System.currentTimeMillis()
                val dt = (now - last).toDouble()
                last = now
                val beats = audio?.beats?.get()
                if (beats != null && beats > lastBeats) {
                    lastBeats = beats
                    lastBeatAt = now
                }
                val beatMode = audio != null && now - lastBeatAt < 4000
                val level = if (audio != null) 0.4f + 0.6f * audio.level else 1f
                lanes.forEach { it.tick(now, dt, beats, beatMode, level, sent) }
                val subtitle = (if (lanes.size > 1) "Elke lamp eigen disco" else lanes[0].scene.spec.effect.label) +
                    if (audio != null) " · op de muziek" else " · ${settings.palette}"
                if (subtitle != shown) {
                    shown = subtitle
                    _state.value = PlayState("🎉 Feest (${strips.size} lamp${if (strips.size == 1) "" else "en"})", subtitle, themeId = PARTY_ID)
                }
                delay(if (audio != null) 40 else 70)
            }
        } finally {
            audio?.stop()
        }
    }

    fun play(seq: Sequence) {
        usesMic = false
        currentParty = null
        val steps = seq.steps.mapNotNull { st -> repo.theme(st.themeId)?.let { it to st.seconds.coerceAtLeast(2) * 1000L } }
        if (steps.isEmpty()) return
        start(PlayState(seq.name, "Reeks", sequenceId = seq.id)) {
            runSteps(steps, seq.crossfadeSeconds * 1000L, seq.repeat) { i ->
                _state.value = PlayState(seq.name, "Stap ${i + 1}/${steps.size}: ${steps[i].first.name}", sequenceId = seq.id)
            }
            restore(takeSaved())
        }
    }

    /** Stopt en zet de lampen (als [restoreLamps]) terug zoals ze vóór het afspelen waren. */
    fun stop(restoreLamps: Boolean = true) {
        val j = job
        job = null
        val snap = takeSaved()
        scope.launch {
            j?.cancelAndJoin()
            if (restoreLamps) restore(snap)
        }
    }

    @Synchronized
    private fun takeSaved(): Map<String, Map<String, Any?>>? {
        _state.value = null
        return saved.also { saved = null }
    }

    private fun restore(snap: Map<String, Map<String, Any?>>?) {
        for ((id, dps) in snap ?: return) {
            val strip = repo.strip(id) ?: continue
            if (dps.isNotEmpty()) devices.send(strip, dps)
        }
    }

    @Synchronized
    private fun start(state: PlayState, targets: List<Strip>? = null, block: suspend () -> Unit) {
        job?.cancel()
        if (saved == null) {
            saved = (targets ?: repo.data.value.strips.filter { it.isConfigured }).associate { it.id to devices.snapshot(it) }
        }
        _state.value = state
        ContextCompat.startForegroundService(context, Intent(context, PlayerService::class.java))
        job = scope.launch(Dispatchers.Default) { block() }
    }

    /** Wat we per strip het laatst hebben verstuurd. */
    private class Sent(var mode: String? = null, var value: String? = null, var at: Long = 0)

    private fun targets(theme: Theme): List<Strip> {
        val all = repo.data.value.strips.filter { it.isConfigured }
        return if (theme.stripIds.isEmpty()) all else all.filter { it.id in theme.stripIds }
    }

    private fun onStrip(theme: Theme, strip: Strip): Boolean {
        if (theme.effectEnum.dreamMode == null || !strip.hasDreamScenes) return false
        return when (theme.engine) {
            Engine.STRIP -> true
            Engine.APP -> false
            Engine.AUTO -> !theme.spread && !theme.pingPong
        }
    }

    private fun dreamScene(theme: Theme) = LightCodec.dreamSceneBase64(
        LightCodec.DreamScene(
            mode = theme.effectEnum.dreamMode ?: 0,
            colors = theme.hsvColors,
            speed = theme.speed,
            brightness = theme.brightness / 100f,
            segmented = theme.segmented,
            smooth = theme.smooth,
            reverse = theme.reverse,
        ),
    )

    /**
     * Speelt de stappen af. Stap k+1 begint [crossfadeMs] vóór het einde van stap k;
     * in die tijd vloeien de kleuren van beide thema's in elkaar over.
     * Een stap zonder duur (null) duurt oneindig.
     */
    private suspend fun runSteps(steps: List<Pair<Theme, Long?>>, crossfadeMs: Long, repeat: Boolean, onStep: (Int) -> Unit) {
        val sent = HashMap<String, Sent>()
        var k = 0
        var stepStart = System.currentTimeMillis()
        onStep(0)
        while (coroutineContext.isActive) {
            val now = System.currentTimeMillis()
            val (theme, dur) = steps[k]
            val fade = if (dur == null) 0L else crossfadeMs.coerceAtMost(dur / 2)
            if (dur != null && now - stepStart >= dur) {
                stepStart += dur - fade
                k++
                if (k >= steps.size) {
                    if (!repeat) return
                    k = 0
                }
                onStep(k)
                continue
            }
            val next = if (dur != null && fade > 0 && now - stepStart >= dur - fade) {
                steps.getOrNull(k + 1)?.first ?: if (repeat) steps[0].first else null
            } else null
            val nextStart = stepStart + (dur ?: 0L) - fade
            val blend = if (next != null) ((now - nextStart).toFloat() / fade).coerceIn(0f, 1f) else 0f

            val list = targets(theme)
            val nextList = next?.let { targets(it) } ?: emptyList()
            list.forEachIndexed { i, strip ->
                val s = sent.getOrPut(strip.id) { Sent() }
                if (onStrip(theme, strip)) {
                    val scene = dreamScene(theme)
                    if (s.mode != "scene" || s.value != scene) {
                        devices.send(strip, mapOf(Dp.SWITCH to true, Dp.MODE to "scene", Dp.DREAM_SCENE to scene))
                        s.mode = "scene"; s.value = scene
                    }
                    return@forEachIndexed
                }
                var c = EffectEngine.frame(theme.spec(), now - stepStart, i, list.size)
                val j = nextList.indexOfFirst { it.id == strip.id }
                if (next != null && j >= 0 && !onStrip(next, strip)) {
                    c = Hsv.lerp(c, EffectEngine.frame(next.spec(), now - nextStart, j, nextList.size), blend)
                }
                sendColour(strip, s, c, theme.smooth && EffectEngine.isSmooth(theme.effectEnum), now)
            }
            delay(FRAME_MS)
        }
    }

    private fun sendColour(strip: Strip, s: Sent, c: Hsv, smooth: Boolean, now: Long) {
        if (s.mode != "colour") {
            devices.send(strip, mapOf(Dp.SWITCH to true, Dp.MODE to "colour"))
            s.mode = "colour"; s.value = null
        }
        val colour = LightCodec.colour(c)
        if (colour == s.value) return
        // Zonder live-datapunt (28) slaat de strip elke kleur op: dan wat rustiger aan.
        if (!strip.hasLiveControl && now - s.at < 200) return
        s.value = colour
        s.at = now
        devices.send(strip, if (strip.hasLiveControl) mapOf(Dp.CONTROL to LightCodec.control(c, smooth)) else mapOf(Dp.COLOUR to colour))
    }

    companion object {
        const val FRAME_MS = 100L
        const val PARTY_ID = "feest"
    }
}
