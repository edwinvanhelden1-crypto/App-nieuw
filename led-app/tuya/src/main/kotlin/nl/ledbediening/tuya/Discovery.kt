package nl.ledbediening.tuya

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

data class FoundDevice(val id: String, val ip: String, val version: String)

/**
 * Tuya-apparaten melden zich elke paar seconden via UDP-broadcast op poort 6666, 6667
 * (versleuteld) of 7000 (3.5). Hier luisteren we naar die meldingen.
 */
object TuyaDiscovery {
    private val udpKey = Crypto.md5("yGAdlopoPVldABfn".toByteArray())

    /** Ontcijfert één broadcast, of null als het geen Tuya-melding is. */
    fun decode(packet: ByteArray): FoundDevice? {
        val text = try {
            decodeText(packet)
        } catch (_: Exception) {
            return null
        } ?: return null
        return try {
            val json = Json.parseToJsonElement(text.trim { it <= ' ' || it == '\u0000' }).jsonObject
            val id = json["gwId"]?.jsonPrimitive?.content ?: json["devId"]?.jsonPrimitive?.content ?: return null
            val ip = json["ip"]?.jsonPrimitive?.content ?: return null
            val version = json["version"]?.jsonPrimitive?.content ?: "3.3"
            FoundDevice(id, ip, version)
        } catch (_: Exception) {
            null
        }
    }

    private fun decodeText(packet: ByteArray): String? {
        if (packet.size < 4) return null
        val prefix = ((packet[0].toInt() and 0xff) shl 24) or ((packet[1].toInt() and 0xff) shl 16) or
            ((packet[2].toInt() and 0xff) shl 8) or (packet[3].toInt() and 0xff)
        return when (prefix) {
            FrameCodec.PREFIX_55AA -> {
                val payload = FrameCodec.decode(packet, null, hmac = false).payload
                if (payload.firstOrNull() == '{'.code.toByte()) payload.toString(Charsets.UTF_8)
                else Crypto.ecbDecrypt(udpKey, payload).toString(Charsets.UTF_8)
            }
            FrameCodec.PREFIX_6699 -> FrameCodec.decode(packet, udpKey, hmac = false).payload.toString(Charsets.UTF_8)
            else -> Crypto.ecbDecrypt(udpKey, packet).toString(Charsets.UTF_8)
        }
    }

    /** Verzoek op poort 7000 waarmee 3.5-apparaten zich direct melden. */
    fun requestPacket(localIp: String): ByteArray =
        FrameCodec.pack6699(0, Cmd.REQ_DEVINFO, """{"from":"app","ip":"$localIp"}""".toByteArray(), udpKey)

    /**
     * Luistert [durationMs] lang en meldt elk gevonden apparaat één keer via [onFound].
     * Op Android moet de app hiervoor een MulticastLock vasthouden.
     */
    fun listen(durationMs: Long, localIp: String? = null, broadcast: InetAddress? = null, onFound: (FoundDevice) -> Unit) {
        val seen = ConcurrentHashMap.newKeySet<String>()
        val sockets = listOf(6666, 6667, 7000).mapNotNull { port ->
            try {
                DatagramSocket(null).apply {
                    reuseAddress = true
                    this.broadcast = true
                    soTimeout = 500
                    bind(InetSocketAddress(port))
                }
            } catch (_: Exception) {
                null
            }
        }
        if (sockets.isEmpty()) throw TuyaException("Kan niet luisteren naar het netwerk")
        val end = System.currentTimeMillis() + durationMs
        val threads = sockets.map { sock ->
            thread(isDaemon = true) {
                val buf = ByteArray(2048)
                while (System.currentTimeMillis() < end) {
                    try {
                        val p = DatagramPacket(buf, buf.size)
                        sock.receive(p)
                        val dev = decode(buf.copyOf(p.length)) ?: continue
                        if (seen.add(dev.id)) onFound(dev)
                    } catch (_: SocketTimeoutException) {
                    } catch (_: Exception) {
                        break
                    }
                }
            }
        }
        // Vraag 3.5-apparaten om zich te melden.
        if (localIp != null && broadcast != null) {
            thread(isDaemon = true) {
                val req = requestPacket(localIp)
                while (System.currentTimeMillis() < end) {
                    try {
                        sockets.first().send(DatagramPacket(req, req.size, broadcast, 7000))
                    } catch (_: Exception) {
                    }
                    Thread.sleep(2000)
                }
            }
        }
        threads.forEach { it.join(durationMs + 1000) }
        sockets.forEach { it.close() }
    }

    /**
     * Noodoplossing als broadcasts niet doorkomen: zoekt in het /24-netwerk van [localIp]
     * naar adressen met poort 6668 open.
     */
    fun scanSubnet(localIp: String, timeoutMs: Int = 400): List<String> {
        val base = localIp.substringBeforeLast('.')
        val pool = Executors.newFixedThreadPool(48)
        val found = ConcurrentHashMap.newKeySet<String>()
        for (i in 1..254) {
            val ip = "$base.$i"
            if (ip == localIp) continue
            pool.execute {
                try {
                    Socket().use { it.connect(InetSocketAddress(ip, 6668), timeoutMs) }
                    found.add(ip)
                } catch (_: Exception) {
                }
            }
        }
        pool.shutdown()
        pool.awaitTermination(30, TimeUnit.SECONDS)
        return found.sorted()
    }

    /**
     * Probeert met [localKey] verbinding te maken op [ip] in elke protocolversie en geeft
     * de eerste versie terug die werkt (of null).
     */
    fun probe(id: String, ip: String, localKey: String, versions: List<String> = listOf("3.3", "3.5", "3.4"), port: Int = 6668): String? {
        for (v in versions) {
            try {
                TuyaDevice(id, ip, localKey, v, port = port, connectTimeoutMs = 1500, readTimeoutMs = 2000).use { dev ->
                    if (dev.status().isNotEmpty()) return v
                }
            } catch (_: Exception) {
            }
        }
        return null
    }
}
