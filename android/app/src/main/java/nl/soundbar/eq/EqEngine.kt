package nl.soundbar.eq

import android.content.Context
import android.content.SharedPreferences
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.audiofx.DynamicsProcessing
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.json.JSONObject

/**
 * Applies the equalizer to the audio in realtime with Android's DynamicsProcessing effect.
 *
 * Preferably the effect is attached to the global output mix (session 0), so every app's
 * sound is equalized before it reaches the soundbar, whatever brand or connection it uses.
 * When a device does not allow that, the effect is attached to each app's audio session
 * instead, for players that announce their sessions (Spotify, YouTube Music, VLC, ...).
 *
 * Each output device (soundbar, headphones, speaker) keeps its own settings, which are
 * loaded automatically when it connects.
 */
object EqEngine {
    private const val TAG = "EqEngine"
    private const val CHANNELS = 2
    private const val SPEAKER_KEY = "speaker"

    // DynamicsProcessing bands are defined by their upper edge: half an octave above each centre.
    private val CUTOFFS = FloatArray(EqProfile.FREQUENCIES.size) { i ->
        if (i == EqProfile.FREQUENCIES.lastIndex) 20000f else EqProfile.FREQUENCIES[i] * 1.4142f
    }

    // Outputs in order of preference when several are connected; the built-in speaker is the fallback.
    private val EXTERNAL_TYPES = intArrayOf(
        AudioDeviceInfo.TYPE_BLE_SPEAKER,
        AudioDeviceInfo.TYPE_BLE_HEADSET,
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_HDMI_EARC,
        AudioDeviceInfo.TYPE_HDMI_ARC,
        AudioDeviceInfo.TYPE_HDMI,
        AudioDeviceInfo.TYPE_USB_DEVICE,
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_LINE_ANALOG,
        AudioDeviceInfo.TYPE_LINE_DIGITAL,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
    )

    data class Output(val key: String, val name: String, val kind: String)

    private lateinit var prefs: SharedPreferences
    private lateinit var audioManager: AudioManager
    private var global: DynamicsProcessing? = null
    private val sessions = mutableMapOf<Int, DynamicsProcessing>()
    private val announced = mutableMapOf<Int, String>()
    private val listeners = mutableSetOf<() -> Unit>()

    var running = false
        private set
    var status = ""
        private set
    var output = Output(SPEAKER_KEY, "Ingebouwde luidspreker", "Luidspreker")
        private set
    var profile = EqProfile.FLAT
        private set

    /** Whether the user switched the equalizer on; restored after a reboot. */
    var enabled: Boolean
        get() = prefs.getBoolean("enabled", false)
        set(value) = prefs.edit().putBoolean("enabled", value).apply()

    var limiterOn: Boolean
        get() = prefs.getBoolean("limiter", true)
        set(value) {
            prefs.edit().putBoolean("limiter", value).apply()
            applyAll()
            notifyChanged()
        }

    /** Equalize the global output mix (all apps) rather than only the apps that announce their audio. */
    var systemWide: Boolean
        get() = prefs.getBoolean("systemWide", true)
        set(value) {
            prefs.edit().putBoolean("systemWide", value).apply()
            if (running) {
                detach()
                attach()
            }
            notifyChanged()
        }

    /** Packages whose own audio session is equalized (only in the per-app mode). */
    val attachedApps: List<String>
        get() = sessions.keys.mapNotNull { announced[it] }.filter { it.isNotEmpty() }.distinct()

    val customPresets: Map<String, EqProfile>
        get() {
            val json = JSONObject(prefs.getString("presets", "{}")!!)
            return json.keys().asSequence().sorted().associateWith { EqProfile.fromJson(json.getJSONObject(it)) }
        }

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        val app = context.applicationContext
        prefs = app.getSharedPreferences("eq", Context.MODE_PRIVATE)
        audioManager = app.getSystemService(AudioManager::class.java)
        output = detectOutput()
        profile = loadProfile(output.key) ?: loadProfile("last") ?: EqProfile.FLAT
        audioManager.registerAudioDeviceCallback(object : AudioDeviceCallback() {
            override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>) = onOutputsChanged()
            override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>) = onOutputsChanged()
        }, Handler(Looper.getMainLooper()))
    }

    fun addListener(listener: () -> Unit) { listeners += listener }
    fun removeListener(listener: () -> Unit) { listeners -= listener }
    private fun notifyChanged() = listeners.toList().forEach { it() }

    // ---------- Effect lifecycle ----------

    fun start() {
        if (running) return
        running = true
        attach()
        notifyChanged()
    }

    fun stop() {
        if (!running) return
        running = false
        detach()
        status = ""
        notifyChanged()
    }

    private fun attach() {
        if (systemWide) {
            try {
                global = create(0)
                status = "Actief: al het geluid op dit toestel wordt realtime aangepast " +
                    "(Spotify, YouTube, Netflix, games…)."
                return
            } catch (e: Exception) {
                Log.w(TAG, "Global output mix not available", e)
                global = null
            }
        }
        announced.keys.forEach(::attachSession)
        status = (if (systemWide) "Dit toestel staat systeembreed aanpassen niet toe. " else "") +
            "De equalizer werkt voor apps die hun geluid aanmelden, zoals Spotify, YouTube Music, " +
            "Deezer en VLC. Start het afspelen opnieuw als je nog geen verschil hoort."
    }

    private fun detach() {
        global?.release()
        global = null
        sessions.values.forEach { it.release() }
        sessions.clear()
    }

    /**
     * A player (e.g. Spotify) announced its audio session. Sessions are remembered even while the
     * system-wide mode is active, so switching to the per-app mode takes effect immediately.
     */
    fun openSession(sessionId: Int, packageName: String?) {
        if (sessionId <= 0) return
        announced[sessionId] = packageName ?: ""
        attachSession(sessionId)
        notifyChanged()
    }

    fun closeSession(sessionId: Int) {
        announced.remove(sessionId)
        sessions.remove(sessionId)?.release()
        notifyChanged()
    }

    private fun attachSession(sessionId: Int) {
        if (!running || global != null || sessionId in sessions) return
        try {
            sessions[sessionId] = create(sessionId)
        } catch (e: Exception) {
            Log.w(TAG, "Cannot attach to session $sessionId", e)
        }
    }

    private fun create(sessionId: Int): DynamicsProcessing {
        val config = DynamicsProcessing.Config.Builder(
            DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
            CHANNELS,
            true, CUTOFFS.size,  // pre-EQ: the equalizer bands
            false, 0,            // multi-band compressor
            false, 0,            // post-EQ
            true,                // limiter
        ).build()
        val dp = DynamicsProcessing(Int.MAX_VALUE, sessionId, config)
        dp.setControlStatusListener { effect, granted ->
            // Another audio app may take over the effect for a while; restore ours when we get it back.
            if (granted) apply(effect as DynamicsProcessing)
        }
        apply(dp)
        dp.enabled = true
        return dp
    }

    private fun applyAll() {
        global?.let(::apply)
        sessions.values.forEach(::apply)
    }

    private fun apply(dp: DynamicsProcessing) {
        try {
            val eq = DynamicsProcessing.Eq(true, true, CUTOFFS.size)
            CUTOFFS.forEachIndexed { i, cutoff -> eq.setBand(i, DynamicsProcessing.EqBand(true, cutoff, profile.gains[i])) }
            dp.setPreEqAllChannelsTo(eq)
            dp.setInputGainAllChannelsTo(profile.preamp)
            // A fast limiter just below 0 dBFS keeps boosted bands from clipping on the soundbar.
            dp.setLimiterAllChannelsTo(DynamicsProcessing.Limiter(true, limiterOn, 0, 1f, 60f, 10f, -2f, 0f))
        } catch (e: Exception) {
            Log.w(TAG, "Applying settings failed", e)
        }
    }

    // ---------- Settings ----------

    fun setBand(index: Int, db: Float) = setProfile(profile.withBand(index, db))

    fun setPreamp(db: Float) = setProfile(profile.copy(preamp = db))

    fun setProfile(newProfile: EqProfile) {
        if (newProfile == profile) return
        profile = newProfile
        saveProfile(output.key, profile)
        saveProfile("last", profile)
        applyAll()
        notifyChanged()
    }

    fun savePreset(name: String) {
        val json = JSONObject(prefs.getString("presets", "{}")!!).put(name, profile.toJson())
        prefs.edit().putString("presets", json.toString()).apply()
        notifyChanged()
    }

    fun deletePreset(name: String) {
        val json = JSONObject(prefs.getString("presets", "{}")!!)
        json.remove(name)
        prefs.edit().putString("presets", json.toString()).apply()
        notifyChanged()
    }

    private fun loadProfile(key: String): EqProfile? =
        prefs.getString("profile:$key", null)?.let { runCatching { EqProfile.fromJson(JSONObject(it)) }.getOrNull() }

    private fun saveProfile(key: String, p: EqProfile) =
        prefs.edit().putString("profile:$key", p.toJson().toString()).apply()

    // ---------- Output devices ----------

    private fun onOutputsChanged() {
        val newOutput = detectOutput()
        if (newOutput == output) return
        output = newOutput
        // A soundbar that was used before gets its own settings back; a new one starts from the current sound.
        loadProfile(output.key)?.let { profile = it } ?: saveProfile(output.key, profile)
        applyAll()
        notifyChanged()
    }

    private fun detectOutput(): Output {
        val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        for (type in EXTERNAL_TYPES) {
            val device = devices.firstOrNull { it.type == type } ?: continue
            val kind = kindOf(type)
            val name = device.productName?.toString()?.trim().takeUnless { it.isNullOrEmpty() } ?: kind
            return Output("$type:$name", name, kind)
        }
        return Output(SPEAKER_KEY, "Ingebouwde luidspreker", "Luidspreker")
    }

    private fun kindOf(type: Int) = when (type) {
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "Bluetooth"
        AudioDeviceInfo.TYPE_BLE_SPEAKER, AudioDeviceInfo.TYPE_BLE_HEADSET -> "Bluetooth LE"
        AudioDeviceInfo.TYPE_HDMI, AudioDeviceInfo.TYPE_HDMI_ARC, AudioDeviceInfo.TYPE_HDMI_EARC -> "HDMI"
        AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_HEADSET -> "USB"
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Koptelefoon"
        else -> "Kabel"
    }
}
