package nl.soundbar.eq

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.media.audiofx.AudioEffect
import android.os.Build
import android.os.IBinder

/** Keeps the equalizer running in the background while other apps play. */
class EqService : Service() {

    private val sessionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val session = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, -1)
            when (intent.action) {
                AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION ->
                    EqEngine.openSession(session, intent.getStringExtra(AudioEffect.EXTRA_PACKAGE_NAME))
                AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION -> EqEngine.closeSession(session)
            }
        }
    }

    private val engineListener: () -> Unit = {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
    }

    override fun onCreate() {
        super.onCreate()
        EqEngine.init(this)
        val channel = NotificationChannel(CHANNEL_ID, "Equalizer", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, buildNotification())
        }

        val filter = IntentFilter().apply {
            addAction(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION)
            addAction(AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION)
        }
        // Players send these broadcasts to every app, so the receiver must be exported.
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(sessionReceiver, filter, RECEIVER_EXPORTED)
        } else {
            registerReceiver(sessionReceiver, filter)
        }

        EqEngine.start()
        EqEngine.addListener(engineListener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            EqEngine.enabled = false
            stopSelf()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    override fun onDestroy() {
        EqEngine.removeListener(engineListener)
        unregisterReceiver(sessionReceiver)
        EqEngine.stop()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, EqService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_eq)
            .setContentTitle("Equalizer actief")
            .setContentText("Uitvoer: ${EqEngine.output.name}")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_eq), "Uitzetten", stop).build())
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "equalizer"
        private const val NOTIFICATION_ID = 1
        private const val ACTION_STOP = "nl.soundbar.eq.STOP"

        fun start(context: Context) {
            context.startForegroundService(Intent(context, EqService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, EqService::class.java))
        }
    }
}
