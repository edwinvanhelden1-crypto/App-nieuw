package nl.ledbediening.control

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import nl.ledbediening.LedApp
import nl.ledbediening.R
import nl.ledbediening.ui.MainActivity

/** Houdt de app actief (ook met het scherm uit) zolang er iets speelt. */
class PlayerService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var wifiLock: WifiManager.WifiLock? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var foreground = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Afspelen", NotificationManager.IMPORTANCE_LOW))
        val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        @Suppress("DEPRECATION")
        wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "led:speler").apply { acquire() }
        val pm = getSystemService(PowerManager::class.java)
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "led:speler").apply { acquire(6 * 60 * 60 * 1000L) }

        val player = (application as LedApp).player
        scope.launch {
            player.state.collect { st ->
                if (st == null) {
                    // Pas stoppen na startForeground, anders sluit Android de app af.
                    if (foreground) stopSelf()
                } else if (foreground) {
                    nm.notify(NOTIFICATION_ID, notification(st))
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val player = (application as LedApp).player
        if (intent?.action == ACTION_STOP) {
            player.stop()
            if (!foreground) stopSelf()
            return START_NOT_STICKY
        }
        val st = player.state.value ?: PlayState("LED Bediening", "")
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(st), ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        foreground = true
        if (player.state.value == null) stopSelf()
        return START_NOT_STICKY
    }

    private fun notification(st: PlayState) = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(st.title)
        .setContentText(st.subtitle)
        .setOngoing(true)
        .setSilent(true)
        .setContentIntent(
            PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE),
        )
        .addAction(
            0, "Stoppen",
            PendingIntent.getService(this, 1, Intent(this, PlayerService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE),
        )
        .build()

    override fun onDestroy() {
        scope.cancel()
        wifiLock?.let { if (it.isHeld) it.release() }
        wakeLock?.let { if (it.isHeld) it.release() }
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL = "afspelen"
        private const val NOTIFICATION_ID = 1
        const val ACTION_STOP = "nl.ledbediening.STOP"
    }
}
