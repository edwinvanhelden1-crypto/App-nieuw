package nl.ledbediening.control

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import nl.ledbediening.data.PendingLogin
import nl.ledbediening.data.Repository
import nl.ledbediening.data.Strip
import nl.ledbediening.tuya.CloudDevice
import nl.ledbediening.tuya.SmartLifeApi
import nl.ledbediening.tuya.SmartLifeLogin
import nl.ledbediening.tuya.SmartLifeSession

/**
 * Inloggen met Smart Life en lampen ophalen, in de achtergrond. Loopt door als de app
 * even naar de achtergrond gaat (bijv. om de QR-code te scannen in de Smart Life-app),
 * en gaat verder na het opnieuw openen van de app.
 */
class AccountSync(
    private val repo: Repository,
    private val devices: DeviceManager,
    private val setup: Setup,
    private val scope: CoroutineScope,
) {
    sealed interface State {
        data object Idle : State
        data class WaitingForScan(val qrToken: String, val userCode: String, val lastMessage: String? = null) : State
        data class Working(val message: String) : State
        data class Done(val message: String) : State
        data class Failed(val message: String) : State
    }

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    /** Alle apparaten van de laatste keer ophalen (ook niet-lampen), om zelf te kiezen. */
    private val _lastDevices = MutableStateFlow<List<CloudDevice>>(emptyList())
    val lastDevices: StateFlow<List<CloudDevice>> = _lastDevices.asStateFlow()

    private var job: Job? = null

    fun startLogin(userCode: String) {
        job?.cancel()
        _state.value = State.Working("Inloggen…")
        job = scope.launch {
            try {
                val token = withContext(Dispatchers.IO) { SmartLifeLogin().requestQr(userCode) }
                repo.update { it.copy(pendingLogin = PendingLogin(token, userCode, System.currentTimeMillis())) }
                waitForScan(token, userCode)
            } catch (e: Exception) {
                _state.value = State.Failed(e.message ?: "Inloggen mislukt")
            }
        }
    }

    /** Hervat een inlogpoging die nog liep toen de app werd afgesloten. */
    fun resume() {
        val p = repo.data.value.pendingLogin ?: return
        if (job?.isActive == true) return
        if (System.currentTimeMillis() - p.createdAt > QR_VALID_MS) {
            repo.update { it.copy(pendingLogin = null) }
            return
        }
        job = scope.launch { waitForScan(p.qrToken, p.userCode) }
    }

    fun cancel() {
        job?.cancel()
        repo.update { it.copy(pendingLogin = null) }
        _state.value = State.Idle
    }

    fun dismiss() {
        if (_state.value is State.Done || _state.value is State.Failed) _state.value = State.Idle
    }

    private suspend fun waitForScan(token: String, userCode: String) {
        val login = SmartLifeLogin()
        _state.value = State.WaitingForScan(token, userCode)
        val started = repo.data.value.pendingLogin?.createdAt ?: System.currentTimeMillis()
        while (System.currentTimeMillis() - started < QR_VALID_MS) {
            delay(2000)
            val session = withContext(Dispatchers.IO) {
                try {
                    login.poll(token, userCode)
                } catch (e: Exception) {
                    Log.w(TAG, "Wachten op QR mislukt", e)
                    null
                }
            }
            if (session != null) {
                repo.update { it.copy(smartLife = session, pendingLogin = null) }
                sync(session)
                return
            }
            _state.value = State.WaitingForScan(token, userCode, login.lastMessage)
        }
        repo.update { it.copy(pendingLogin = null) }
        _state.value = State.Failed("De QR-code is verlopen voordat hij werd bevestigd. Probeer het opnieuw.")
    }

    /** Lampen ophalen met een bestaande inlog. */
    fun refresh() {
        val s = repo.data.value.smartLife ?: return
        job?.cancel()
        job = scope.launch { sync(s) }
    }

    /**
     * Haalt alle apparaten op, voegt alle lampen toe (of werkt hun sleutel bij) en zoekt ze
     * op het wifi-netwerk.
     */
    private suspend fun sync(session: SmartLifeSession) {
        try {
            _state.value = State.Working("Lampen ophalen uit je Smart Life-account…")
            val all = withContext(Dispatchers.IO) {
                SmartLifeApi(session, onSessionChanged = { s -> repo.update { it.copy(smartLife = s) } }).allDevices()
            }
            _lastDevices.value = all
            if (all.isEmpty()) {
                _state.value = State.Failed("Ingelogd, maar er staan geen apparaten in je Smart Life-account (of ze zijn niet gedeeld met dit account).")
                return
            }
            val withKey = all.filter { it.localKey.isNotBlank() }
            // Herkent de app niets als lamp, neem dan alles met een sleutel; de gebruiker kan zelf verwijderen.
            val lights = withKey.filter { it.isLight }.ifEmpty { withKey }
            if (lights.isEmpty()) {
                _state.value = State.Failed("Er zijn ${all.size} apparaten gevonden, maar Tuya gaf geen sleutels mee.")
                return
            }
            val strips = lights.map { d ->
                repo.strip(d.id)?.copy(localKey = d.localKey) ?: Strip(id = d.id, name = d.name, localKey = d.localKey)
            }
            strips.forEach { repo.saveStrip(it) }
            add(strips, "${strips.size} lamp(en) toegevoegd")
        } catch (e: Exception) {
            Log.w(TAG, "Ophalen mislukt", e)
            _state.value = State.Failed("Lampen ophalen mislukt: ${e.message}")
        }
    }

    /** Zelf gekozen apparaten toevoegen en zoeken. */
    fun addDevices(chosen: List<CloudDevice>) {
        val strips = chosen.filter { it.localKey.isNotBlank() }.map { d ->
            repo.strip(d.id)?.copy(localKey = d.localKey) ?: Strip(id = d.id, name = d.name, localKey = d.localKey)
        }
        if (strips.isEmpty()) return
        strips.forEach { repo.saveStrip(it) }
        job?.cancel()
        job = scope.launch { add(strips, "${strips.size} apparaat/apparaten toegevoegd") }
    }

    private suspend fun add(strips: List<Strip>, prefix: String) {
        _state.value = State.Working("$prefix. Zoeken op je wifi…")
        val located = try {
            setup.locate(strips) { msg -> _state.value = State.Working(msg) }
        } catch (e: Exception) {
            _state.value = State.Failed("$prefix, maar zoeken op wifi mislukte: ${e.message}")
            return
        }
        located.forEach { f ->
            val cur = repo.strip(f.id) ?: return@forEach
            if (f.isConfigured) repo.saveStrip(cur.copy(ip = f.ip, version = f.version, dps = f.dps.ifEmpty { cur.dps }))
        }
        devices.refreshAll()
        val found = located.count { it.isConfigured }
        val missing = located.filter { !it.isConfigured }.map { it.name }
        _state.value = State.Done(
            "$prefix, $found gevonden op je wifi." +
                if (missing.isNotEmpty()) "\nNog niet gevonden: ${missing.joinToString()}. Staan ze aan en op hetzelfde wifi? Probeer ‘Netwerk-diagnose’ (vergrootglas)." else "",
        )
    }

    companion object {
        private const val TAG = "AccountSync"
        private const val QR_VALID_MS = 5 * 60 * 1000L
    }
}
