package nl.ledbediening.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import nl.ledbediening.tuya.FoundDevice
import nl.ledbediening.tuya.TuyaDiscovery

/** Laat zien wat de app op het wifi-netwerk vindt, en zoekt de lampen opnieuw. */
@Composable
fun DiagnoseScreen(nav: Nav) {
    val app = app()
    val data by app.repo.data.collectAsState()
    val scope = rememberCoroutineScope()
    val heard = remember { mutableStateListOf<FoundDevice>() }
    var openPorts by remember { mutableStateOf<List<String>?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<String?>(null) }
    val local = remember { app.setup.localNetwork() }

    fun runScan() {
        heard.clear()
        openPorts = null
        result = null
        scope.launch {
            status = "Luisteren naar meldingen van lampen (10 s)…"
            try {
                app.setup.listen(10_000) { d -> if (heard.none { it.id == d.id }) heard.add(d) }
            } catch (e: Exception) {
                result = "Luisteren mislukt: ${e.message}"
            }
            if (local != null) {
                status = "Netwerk afzoeken naar Tuya-apparaten…"
                openPorts = withContext(Dispatchers.IO) { TuyaDiscovery.scanSubnet(local.ip) }
            }
            status = null
        }
    }

    fun relocate() {
        val strips = data.strips
        if (strips.isEmpty()) return
        scope.launch {
            status = "Lampen opnieuw zoeken…"
            val located = try {
                app.setup.locate(strips) { status = it }
            } catch (e: Exception) {
                status = null
                result = "Zoeken mislukt: ${e.message}"
                return@launch
            }
            located.forEach { f ->
                val cur = app.repo.strip(f.id) ?: return@forEach
                if (f.isConfigured) app.repo.saveStrip(cur.copy(ip = f.ip, version = f.version, dps = f.dps.ifEmpty { cur.dps }))
            }
            app.devices.refreshAll()
            status = null
            val missing = located.filter { !it.isConfigured }.map { it.name }
            result = "${located.count { it.isConfigured }} van ${located.size} lampen gevonden." +
                if (missing.isNotEmpty()) "\nNiet gevonden: ${missing.joinToString()}" else ""
        }
    }

    Column {
        AppTopBar("Netwerk-diagnose", nav)
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp)) {
            SectionCard("Deze telefoon") {
                Text(if (local != null) "IP-adres: ${local.ip}" else "Geen wifi-verbinding gevonden!", color = if (local == null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
                Text(
                    "De lampen moeten op hetzelfde wifi-netwerk zitten (meestal 2,4 GHz, niet het gastnetwerk). " +
                        "Zet mobiele data even uit als de app de lampen niet vindt.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            status?.let {
                SectionCard {
                    Text(it)
                    VSpace(10)
                    LinearProgressIndicator(Modifier.fillMaxWidth())
                }
            }
            result?.let { SectionCard("Resultaat") { Text(it) } }

            if (status == null) {
                Button(onClick = ::runScan, modifier = Modifier.fillMaxWidth()) { Text("Netwerk onderzoeken") }
                OutlinedButton(onClick = ::relocate, enabled = data.strips.isNotEmpty(), modifier = Modifier.fillMaxWidth()) { Text("Alle lampen opnieuw zoeken") }
            }

            SectionCard("Mijn lampen (${data.strips.size})") {
                if (data.strips.isEmpty()) Text("Nog geen lampen toegevoegd.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                data.strips.forEach { s ->
                    val h = heard.find { it.id == s.id }
                    Text(s.name)
                    Text(
                        listOfNotNull(
                            if (s.isConfigured) "${s.ip} · v${s.version}" else "geen IP-adres",
                            if (h != null) "meldt zich op ${h.ip} (v${h.version})" else null,
                            if (s.localKey.length != 16) "sleutel ongeldig (${s.localKey.length} tekens)" else null,
                            if (s.dps.isNotEmpty()) "datapunten ${s.dps.joinToString(",")}" else null,
                        ).joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    VSpace(6)
                }
            }

            if (heard.isNotEmpty() || openPorts != null) {
                SectionCard("Gevonden op het netwerk") {
                    Text("Meldingen (${heard.size}):")
                    heard.forEach { d ->
                        val name = data.strips.find { it.id == d.id }?.name ?: "onbekend apparaat"
                        Text("${d.ip}  v${d.version}  $name", style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                    }
                    openPorts?.let { ports ->
                        VSpace(8)
                        Text("Apparaten met Tuya-poort 6668 open (${ports.size}):")
                        Text(ports.joinToString("  ").ifEmpty { "geen" }, style = MaterialTheme.typography.bodySmall, fontFamily = FontFamily.Monospace)
                    }
                }
            }
        }
    }
}
