package nl.ledbediening.control

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import nl.ledbediening.tuya.BeatDetector
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.sqrt

/** Luistert via de microfoon naar muziek en telt de beats. Er wordt niets opgenomen of bewaard. */
class AudioBeat {
    /** Aantal beats sinds de start. */
    val beats = AtomicLong()

    /** Geluidssterkte 0–1. */
    @Volatile var level = 0f
        private set

    @Volatile private var running = false
    private var thread: Thread? = null

    /** Start het luisteren; geeft false als de microfoon niet beschikbaar is. */
    @SuppressLint("MissingPermission") // wordt door de aanroeper gecontroleerd
    fun start(): Boolean {
        val rate = 22050
        val minBuf = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        val rec = try {
            AudioRecord(MediaRecorder.AudioSource.MIC, rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minBuf, 8192))
        } catch (e: Exception) {
            Log.w(TAG, "Microfoon niet beschikbaar", e)
            return false
        }
        if (rec.state != AudioRecord.STATE_INITIALIZED) {
            rec.release()
            return false
        }
        running = true
        rec.startRecording()
        thread = Thread {
            val buf = ShortArray(512) // ±23 ms
            val detector = BeatDetector()
            try {
                while (running) {
                    val n = rec.read(buf, 0, buf.size)
                    if (n <= 0) continue
                    var sum = 0.0
                    for (i in 0 until n) {
                        val x = buf[i] / 32768.0
                        sum += x * x
                    }
                    if (detector.feed(sqrt(sum / n), System.currentTimeMillis())) beats.incrementAndGet()
                    level = detector.level
                }
            } finally {
                runCatching { rec.stop() }
                rec.release()
            }
        }.apply { isDaemon = true; name = "led-microfoon"; start() }
        return true
    }

    fun stop() {
        running = false
        thread?.join(500)
        thread = null
    }

    companion object {
        private const val TAG = "AudioBeat"
    }
}
