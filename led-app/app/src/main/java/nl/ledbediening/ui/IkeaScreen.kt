package nl.ledbediening.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import nl.ledbediening.LedApp
import nl.ledbediening.data.HubInfo
import nl.ledbediening.data.Strip
import nl.ledbediening.ikea.DirigeraHub

/** Koppelen met de IKEA DIRIGERA-hub en alle IKEA-lampen toevoegen. */
@Composable
fun IkeaImport(nav: Nav) {
    val app = app()
    val data by app.repo.data.collectAsState()
    val scope = rememberCoroutineScope()
    val paired = data.hubs.firstOrNull()
    var host by remember { mutableStateOf(paired?.host ?: "") }
    var status by remember { mutableStateOf<String?>(null) }
    var waitingForButton by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    // Hub automatisch zoeken.
    LaunchedEffect(Unit) {
        if (host.isBlank()) {
            status = "IKEA-hub zoeken op je wifi…"
            app.setup.findDirigera()?.let { host = it }
            status = null
        }
    }

    fun pair() {
        error = null
        result = null
        scope.launch {
            try {
                val hub = DirigeraHub(host)
                status = "Verbinden met de hub…"
                val pairing = withContext(Dispatchers.IO) { hub.startPairing() }
                status = null
                waitingForButton = true
                var token: String? = null
                val until = System.currentTimeMillis() + 90_000
                while (token == null && System.currentTimeMillis() < until && waitingForButton) {
                    delay(1500)
                    token = withContext(Dispatchers.IO) { hub.finishPairing(pairing) }
                }
                waitingForButton = false
                if (token == null) {
                    error = "Er werd niet op de knop gedrukt. Probeer het opnieuw."
                    return@launch
                }
                val info = HubInfo(id = paired?.id ?: "hub-${System.currentTimeMillis()}", host = host, token = token, certSha256 = hub.certSha256)
                app.repo.update { d -> d.copy(hubs = d.hubs.filter { it.id != info.id } + info) }
                app.devices.resetHub(info.id)
                result = addLights(app, info) { status = it }
            } catch (e: Exception) {
                waitingForButton = false
                error = e.message
            }
            status = null
        }
    }

    status?.let {
        SectionCard {
            Text(it)
            VSpace(10)
            LinearProgressIndicator(Modifier.fillMaxWidth())
        }
    }

    when {
        waitingForButton -> SectionCard("Druk op de knop van de hub") {
            Text("Druk nu kort op de knop aan de onderkant van je DIRIGERA-hub (het gaatje met het streepje).")
            VSpace(10)
            LinearProgressIndicator(Modifier.fillMaxWidth())
            VSpace(6)
            TextButton(onClick = { waitingForButton = false }) { Text("Annuleren") }
        }
        result != null -> SectionCard("Klaar") {
            Text(result ?: "")
            VSpace(10)
            Button(onClick = nav.pop) { Text("Naar mijn lampen") }
        }
        else -> SectionCard(if (paired != null) "IKEA DIRIGERA (gekoppeld)" else "IKEA DIRIGERA koppelen") {
            Text(
                "De app praat via je eigen wifi met de hub. Er verandert niets in de IKEA Home smart-app.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            VSpace(10)
            OutlinedTextField(host, { host = it.trim() }, label = { Text("IP-adres van de hub") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            if (host.isBlank() && status == null) {
                Text(
                    "Niet automatisch gevonden. Het IP-adres staat in je router (FRITZ!Box: Heimnetz → Netzwerk), meestal als ‘DIRIGERA’.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            VSpace(10)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = host.isNotBlank() && status == null, onClick = ::pair) { Text(if (paired != null) "Opnieuw koppelen" else "Koppelen") }
                if (paired != null) {
                    OutlinedButton(enabled = status == null, onClick = {
                        scope.launch {
                            error = null
                            result = try { addLights(app, paired) { status = it } } catch (e: Exception) { error = e.message; null }
                            status = null
                        }
                    }) { Text("Lampen ophalen") }
                }
            }
        }
    }

    error?.let { SectionCard { Text(it, color = MaterialTheme.colorScheme.error) } }
}

/** Haalt alle lampen van de hub op en voegt ze toe (bestaande worden bijgewerkt). */
private suspend fun addLights(app: LedApp, info: HubInfo, progress: (String) -> Unit): String {
    progress("Lampen ophalen van de hub…")
    val lights = withContext(Dispatchers.IO) { DirigeraHub(info.host, info.token, info.certSha256).lights() }
    if (lights.isEmpty()) return "Gekoppeld, maar er staan geen lampen in de hub."
    lights.forEach { l ->
        val existing = app.repo.strip(l.id)
        app.repo.saveStrip(
            (existing ?: Strip(id = l.id, name = l.name, localKey = "", kind = Strip.KIND_IKEA))
                .copy(kind = Strip.KIND_IKEA, hubId = info.id, room = l.room, dps = listOf("20", "21", "22", "23") + if (l.canColor) listOf("24") else emptyList()),
        )
    }
    app.devices.refreshAll()
    val unreachable = lights.filter { !it.reachable }.map { it.name }
    return "${lights.size} IKEA-lamp(en) toegevoegd." +
        if (unreachable.isNotEmpty()) "\nDe hub kan deze nu niet bereiken: ${unreachable.joinToString()}." else ""
}
