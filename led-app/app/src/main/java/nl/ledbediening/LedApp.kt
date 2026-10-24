package nl.ledbediening

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import nl.ledbediening.control.DeviceManager
import nl.ledbediening.control.Player
import nl.ledbediening.control.Setup
import nl.ledbediening.data.Repository

class LedApp : Application() {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    lateinit var repo: Repository private set
    lateinit var devices: DeviceManager private set
    lateinit var player: Player private set
    lateinit var setup: Setup private set

    override fun onCreate() {
        super.onCreate()
        repo = Repository(this)
        devices = DeviceManager(repo, scope)
        player = Player(this, repo, devices, scope)
        setup = Setup(this)
    }
}
