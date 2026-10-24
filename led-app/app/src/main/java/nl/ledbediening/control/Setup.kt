package nl.ledbediening.control

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import nl.ledbediening.data.Strip
import nl.ledbediening.tuya.FoundDevice
import nl.ledbediening.tuya.TuyaDevice
import nl.ledbediening.tuya.TuyaDiscovery
import java.net.Inet4Address
import java.net.InetAddress

/** Zoekt strips op het wifi-netwerk en bepaalt hun IP-adres en protocolversie. */
class Setup(private val context: Context) {

    data class Local(val ip: String, val broadcast: InetAddress?)

    fun localNetwork(): Local? {
        val cm = context.getSystemService(ConnectivityManager::class.java)
        // Altijd het wifi-netwerk, ook als Android mobiele data als hoofdverbinding gebruikt.
        @Suppress("DEPRECATION")
        val wifi = cm.allNetworks.firstOrNull { n ->
            cm.getNetworkCapabilities(n)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
        } ?: cm.activeNetwork
        val props = cm.getLinkProperties(wifi) ?: return null
        val la = props.linkAddresses.firstOrNull { it.address is Inet4Address } ?: return null
        val ip = la.address.address
        val prefix = la.prefixLength
        val mask = if (prefix == 0) 0 else -1 shl (32 - prefix)
        val ipInt = ((ip[0].toInt() and 0xff) shl 24) or ((ip[1].toInt() and 0xff) shl 16) or
            ((ip[2].toInt() and 0xff) shl 8) or (ip[3].toInt() and 0xff)
        val b = ipInt or mask.inv()
        val bcast = InetAddress.getByAddress(byteArrayOf((b shr 24).toByte(), (b shr 16).toByte(), (b shr 8).toByte(), b.toByte()))
        return Local(la.address.hostAddress ?: return null, bcast)
    }

    /** Luistert naar meldingen van Tuya-apparaten. */
    suspend fun listen(durationMs: Long, onFound: (FoundDevice) -> Unit = {}): Map<String, FoundDevice> = withContext(Dispatchers.IO) {
        val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val lock = wm.createMulticastLock("led:zoeken").apply { setReferenceCounted(false); acquire() }
        val found = java.util.concurrent.ConcurrentHashMap<String, FoundDevice>()
        try {
            val local = localNetwork()
            TuyaDiscovery.listen(durationMs, local?.ip, local?.broadcast) { d ->
                found[d.id] = d
                onFound(d)
            }
        } finally {
            lock.release()
        }
        found
    }

    /**
     * Vult IP-adres, versie en datapunten aan voor de gegeven strips.
     * 1. luisteren naar broadcasts; 2. bekend IP proberen; 3. netwerk afzoeken en de sleutel testen.
     */
    suspend fun locate(strips: List<Strip>, progress: (String) -> Unit): List<Strip> = withContext(Dispatchers.IO) {
        val result = strips.associateBy { it.id }.toMutableMap()
        progress("Luisteren naar strips op het netwerk…")
        val heard = listen(8000) { d ->
            result[d.id]?.let { progress("Gevonden: ${it.name} (${d.ip})") }
        }
        for ((id, s) in result) {
            val d = heard[id] ?: continue
            val v = if (d.version in SUPPORTED) d.version else "3.3"
            result[id] = s.copy(ip = d.ip, version = v)
        }

        // Strips met een (handmatig) IP-adres maar zonder melding: versie uitproberen.
        for ((id, s) in result) {
            if (heard.containsKey(id) || s.ip.isBlank()) continue
            progress("${s.name}: verbinding testen op ${s.ip}…")
            TuyaDiscovery.probe(id, s.ip, s.localKey)?.let { v -> result[id] = s.copy(version = v) }
        }

        // Nog steeds onbekend: netwerk afzoeken naar apparaten met poort 6668 en de sleutel proberen.
        val missing = result.values.filter { it.ip.isBlank() }
        if (missing.isNotEmpty()) {
            val local = localNetwork()
            if (local != null) {
                progress("Netwerk afzoeken…")
                val taken = result.values.map { it.ip }.toSet()
                val candidates = TuyaDiscovery.scanSubnet(local.ip).filter { it !in taken }.toMutableList()
                for (s in missing) {
                    progress("${s.name}: zoeken tussen ${candidates.size} apparaten…")
                    for (ip in candidates) {
                        val v = TuyaDiscovery.probe(s.id, ip, s.localKey) ?: continue
                        result[s.id] = s.copy(ip = ip, version = v)
                        candidates.remove(ip)
                        break
                    }
                }
            }
        }

        // Datapunten ophalen (welke functies de strip heeft).
        for ((id, s) in result) {
            if (s.ip.isBlank()) continue
            progress("${s.name}: functies ophalen…")
            try {
                TuyaDevice(s.id, s.ip, s.localKey, s.version).use { dev ->
                    val keys = dev.status().keys.sortedBy { it.toIntOrNull() ?: 0 }
                    result[id] = s.copy(dps = keys)
                }
            } catch (_: Exception) {
            }
        }
        strips.map { result[it.id]!! }
    }

    companion object {
        val SUPPORTED = listOf("3.3", "3.4", "3.5")
    }
}
