package nl.ledbediening.control

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import nl.ledbediening.data.HubInfo
import nl.ledbediening.data.Repository
import nl.ledbediening.data.Strip
import nl.ledbediening.ikea.DirigeraHub
import nl.ledbediening.ikea.DirigeraLight
import nl.ledbediening.tuya.Dp
import nl.ledbediening.tuya.Hsv
import nl.ledbediening.tuya.LightCodec
import nl.ledbediening.tuya.LightDevice
import nl.ledbediening.tuya.TuyaDevice
import nl.ledbediening.tuya.TuyaException

/** Wat we van een strip weten. */
data class StripState(
    val online: Boolean? = null,      // null = nog niet geprobeerd
    val busy: Boolean = false,
    val on: Boolean = false,
    val mode: String = "",
    val colour: Hsv? = null,
    val whiteBrightness: Int = 1000,  // 10–1000
    val temperature: Int = 500,       // 0–1000
    val error: String? = null,
)

/**
 * Houdt per strip een verbinding en een eigen werkthread bij. Opdrachten die sneller
 * binnenkomen dan de strip aankan worden samengevoegd (nieuwste waarde wint), zodat
 * animaties nooit achter gaan lopen.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DeviceManager(private val repo: Repository, private val scope: CoroutineScope) {
    private val _states = MutableStateFlow<Map<String, StripState>>(emptyMap())
    val states: StateFlow<Map<String, StripState>> = _states.asStateFlow()

    private inner class Worker(val strip: Strip, val device: LightDevice) {
        private val pending = LinkedHashMap<String, Any?>()
        private val signal = Channel<Unit>(Channel.CONFLATED)
        private val dispatcher = Dispatchers.IO.limitedParallelism(1)
        val job: Job

        init {
            device.onDps = { applyDps(strip.id, it) }
            job = scope.launch(dispatcher) { loop() }
        }

        fun send(values: Map<String, Any?>) {
            synchronized(pending) { pending.putAll(values) }
            signal.trySend(Unit)
        }

        suspend fun <T> onDevice(block: (LightDevice) -> T): T = withContext(dispatcher) { block(device) }

        private var lastSent = 0L

        private suspend fun loop() {
            var idleSince = System.currentTimeMillis()
            while (true) {
                val got = withTimeoutOrNull(10_000) { signal.receive() }
                if (got == null) {
                    // Stil: verbinding levend houden, of na 2 minuten sluiten.
                    if (device.isConnected) {
                        if (System.currentTimeMillis() - idleSince > 120_000) device.close()
                        else runCatching { device.heartbeat() }
                    }
                    continue
                }
                // Sommige lampen (IKEA via de hub) kunnen niet onbeperkt snel: even wachten
                // zodat tussentijdse waarden worden samengevoegd.
                val wait = device.minIntervalMs - (System.currentTimeMillis() - lastSent)
                if (wait > 0) kotlinx.coroutines.delay(wait)
                val batch = synchronized(pending) { LinkedHashMap(pending).also { pending.clear() } }
                if (batch.isEmpty()) continue
                lastSent = System.currentTimeMillis()
                try {
                    device.set(batch)
                    setState(strip.id) { it.copy(online = true, error = null) }
                } catch (e: Exception) {
                    Log.w(TAG, "Versturen naar ${strip.name} mislukt", e)
                    setState(strip.id) { it.copy(online = false, error = e.message) }
                }
                idleSince = System.currentTimeMillis()
            }
        }

        fun close() {
            job.cancel()
            Thread { device.close() }.start()
        }
    }

    private val workers = HashMap<String, Worker>()
    private val hubs = HashMap<String, DirigeraHub>()

    /** Eén verbinding per IKEA-hub, gedeeld door de lampen eraan. */
    private fun hub(info: HubInfo): DirigeraHub = synchronized(hubs) {
        val h = hubs[info.id]
        if (h != null && h.host == info.host && h.token == info.token) return h
        h?.close()
        DirigeraHub(info.host, info.token, info.certSha256).also { hubs[info.id] = it }
    }

    private fun createDevice(strip: Strip): LightDevice = if (strip.isIkea) {
        val info = repo.data.value.hubs.find { it.id == strip.hubId } ?: throw TuyaException("IKEA-hub niet gevonden: koppel de hub opnieuw")
        DirigeraLight(hub(info), strip.id)
    } else {
        TuyaDevice(strip.id, strip.ip, strip.localKey, strip.version)
    }

    private fun worker(strip: Strip): Worker? = synchronized(workers) {
        if (!strip.isConfigured) return null
        val w = workers[strip.id]
        if (w != null && w.strip.ip == strip.ip && w.strip.localKey == strip.localKey && w.strip.version == strip.version &&
            w.strip.kind == strip.kind && w.strip.hubId == strip.hubId
        ) return w
        w?.close()
        return try {
            Worker(strip, createDevice(strip)).also { workers[strip.id] = it }
        } catch (e: Exception) {
            setState(strip.id) { it.copy(online = false, error = e.message) }
            null
        }
    }

    /** Na opnieuw koppelen van een hub: verbindingen vernieuwen. */
    fun resetHub(hubId: String) {
        synchronized(hubs) { hubs.remove(hubId)?.close() }
        synchronized(workers) {
            workers.values.filter { it.strip.hubId == hubId }.map { it.strip.id }.forEach { workers.remove(it)?.close() }
        }
    }

    /** Huidige stand van een strip, om later terug te kunnen zetten. */
    fun snapshot(strip: Strip): Map<String, Any?> {
        val dps = synchronized(workers) { workers[strip.id]?.device?.dps } ?: return emptyMap()
        return RESTORE_KEYS.mapNotNull { k -> dps[k]?.let { k to it } }.toMap()
    }

    fun forget(stripId: String) = synchronized(workers) { workers.remove(stripId)?.close() }

    /** Vraagt de actuele status op en onthoudt welke datapunten de strip heeft. */
    suspend fun refresh(strip: Strip) {
        val w = worker(strip) ?: run {
            setState(strip.id) { it.copy(online = false, error = "Geen IP-adres bekend") }
            return
        }
        setState(strip.id) { it.copy(busy = true) }
        try {
            val dps = w.onDevice { it.status() }
            applyDps(strip.id, dps)
            setState(strip.id) { it.copy(online = true, busy = false, error = null) }
            val keys = dps.keys.sortedBy { it.toIntOrNull() ?: 0 }
            if (keys != strip.dps) repo.strip(strip.id)?.let { repo.saveStrip(it.copy(dps = keys)) }
        } catch (e: Exception) {
            setState(strip.id) { it.copy(online = false, busy = false, error = e.message) }
            relocateIfUnreachable(strip, e)
        }
    }

    /** Zoekt de strip opnieuw op het netwerk (wordt door de app ingesteld). */
    var relocate: (suspend (Strip) -> Strip?)? = null
    private val lastRelocate = java.util.concurrent.ConcurrentHashMap<String, Long>()

    /** Onbereikbaar? Misschien heeft de lamp een nieuw IP-adres gekregen: zoek hem opnieuw. */
    private suspend fun relocateIfUnreachable(strip: Strip, e: Exception) {
        val msg = e.message ?: ""
        val network = listOf("onbereikbaar", "Geen antwoord", "verbinding maken", "reageert niet").any { it in msg }
        if (!strip.isTuya) return
        val find = relocate ?: return
        val now = System.currentTimeMillis()
        if (!network || now - (lastRelocate[strip.id] ?: 0L) < 3 * 60_000) return
        lastRelocate[strip.id] = now
        setState(strip.id) { it.copy(busy = true, error = "Lamp opnieuw zoeken op je wifi…") }
        val found = try { find(strip) } catch (_: Exception) { null }
        if (found != null && (found.ip != strip.ip || found.version != strip.version)) {
            val cur = repo.strip(strip.id) ?: return
            val updated = cur.copy(ip = found.ip, version = found.version, dps = found.dps.ifEmpty { cur.dps })
            repo.saveStrip(updated)
            refresh(updated)
        } else {
            setState(strip.id) { it.copy(busy = false, error = msg) }
        }
    }

    fun refreshAll() {
        repo.data.value.strips.forEach { s -> scope.launch { refresh(s) } }
    }

    /** Zet datapunten; snel opeenvolgende opdrachten worden samengevoegd. */
    fun send(strip: Strip, values: Map<String, Any?>) {
        applyDps(strip.id, values)
        worker(strip)?.send(values)
    }

    fun setPower(strip: Strip, on: Boolean) = send(strip, mapOf(Dp.SWITCH to on))

    fun setColour(strip: Strip, c: Hsv) =
        send(strip, mapOf(Dp.SWITCH to true, Dp.MODE to "colour", Dp.COLOUR to LightCodec.colour(c)))

    fun setWhite(strip: Strip, brightness: Int, temperature: Int) = send(
        strip,
        mapOf(Dp.SWITCH to true, Dp.MODE to "white", Dp.BRIGHTNESS to brightness.coerceIn(10, 1000), Dp.TEMPERATURE to temperature.coerceIn(0, 1000)),
    )

    private fun applyDps(id: String, dps: Map<String, Any?>) = setState(id) { s ->
        var n = s
        (dps[Dp.SWITCH] as? Boolean)?.let { n = n.copy(on = it) }
        (dps[Dp.MODE] as? String)?.let { n = n.copy(mode = it) }
        (dps[Dp.COLOUR] as? String)?.let { hex -> LightCodec.parseColour(hex)?.let { n = n.copy(colour = it) } }
        (dps[Dp.BRIGHTNESS] as? Number)?.let { n = n.copy(whiteBrightness = it.toInt()) }
        (dps[Dp.TEMPERATURE] as? Number)?.let { n = n.copy(temperature = it.toInt()) }
        n
    }

    private fun setState(id: String, f: (StripState) -> StripState) =
        _states.update { m -> m + (id to f(m[id] ?: StripState())) }

    companion object {
        private const val TAG = "DeviceManager"
        /** Datapunten die samen de stand van een lamp bepalen (modus eerst). */
        val RESTORE_KEYS = listOf(Dp.MODE, Dp.BRIGHTNESS, Dp.TEMPERATURE, Dp.COLOUR, Dp.SCENE, Dp.DREAM_SCENE, Dp.SWITCH)
    }
}
