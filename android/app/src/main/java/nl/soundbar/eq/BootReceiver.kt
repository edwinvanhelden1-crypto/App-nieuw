package nl.soundbar.eq

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Turns the equalizer back on after a restart if it was on before. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        EqEngine.init(context)
        if (EqEngine.enabled) EqService.start(context)
    }
}
