@file:OptIn(ExperimentalMaterial3Api::class)

package nl.ledbediening.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import nl.ledbediening.data.CloudSettings
import nl.ledbediening.data.Strip
import nl.ledbediening.tuya.CloudDevice
import nl.ledbediening.tuya.TuyaCloud

@Composable
fun AddStripScreen(nav: Nav) {
    var tab by remember { mutableIntStateOf(0) }
    var progress by remember { mutableStateOf<String?>(null) }
    var result by remember { mutableStateOf<String?>(null) }
    val app = app()
    val scope = rememberCoroutineScope()

    /** Zoekt de strips op het netwerk, slaat ze op en meldt het resultaat. */
    fun addAndLocate(strips: List<Strip>) {
        scope.launch {
            strips.forEach { app.repo.saveStrip(it) }
            progress = "Strips zoeken…"
            val located = try {
                app.setup.locate(strips) { msg -> progress = msg }
            } catch (e: Exception) {
                progress = null
                result = "Zoeken mislukt: ${e.message}"
                return@launch
            }
            located.forEach { found ->
                // Bewaar wat de gebruiker intussen eventueel aanpaste (naam), plus de gevonden gegevens.
                val current = app.repo.strip(found.id) ?: found
                app.repo.saveStrip(current.copy(ip = found.ip, version = found.version, dps = found.dps))
            }
            app.devices.refreshAll()
            progress = null
            val ok = located.count { it.isConfigured }
            val missing = located.filter { !it.isConfigured }.map { it.name }
            result = buildString {
                append("$ok van ${located.size} strip(s) gevonden.")
                if (missing.isNotEmpty()) {
                    append("\n\nNiet gevonden: ${missing.joinToString()}. ")
                    append("Staan ze aan en op hetzelfde wifi-netwerk als je telefoon? Je kunt het IP-adres ook zelf invullen bij de instellingen van de strip.")
                }
            }
        }
    }

    Column {
        AppTopBar("Strip toevoegen", nav)
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp)) {
            val p = progress
            val r = result
            when {
                p != null -> SectionCard("Bezig") {
                    Text(p)
                    VSpace(12)
                    LinearProgressIndicator(Modifier.fillMaxWidth())
                }
                r != null -> SectionCard("Klaar") {
                    Text(r)
                    VSpace(12)
                    Button(onClick = nav.pop) { Text("Naar mijn strips") }
                }
                else -> {
                    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                        listOf("Smart Life", "IKEA", "Ontwikkelaar", "Handmatig").forEachIndexed { i, label ->
                            SegmentedButton(selected = tab == i, onClick = { tab = i }, shape = SegmentedButtonDefaults.itemShape(i, 4)) {
                                Text(label, style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                    when (tab) {
                        0 -> SmartLifeImport(nav)
                        1 -> IkeaImport(nav)
                        2 -> CloudImport(onAdd = ::addAndLocate)
                        else -> ManualAdd(onAdd = { addAndLocate(listOf(it)) })
                    }
                }
            }
        }
    }
}

@Composable
private fun CloudImport(onAdd: (List<Strip>) -> Unit) {
    val app = app()
    val scope = rememberCoroutineScope()
    val saved = app.repo.data.value.cloud
    var accessId by remember { mutableStateOf(saved.accessId) }
    var secret by remember { mutableStateOf(saved.secret) }
    var region by remember { mutableStateOf(runCatching { TuyaCloud.Region.valueOf(saved.region) }.getOrDefault(TuyaCloud.Region.EU)) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var devices by remember { mutableStateOf<List<CloudDevice>?>(null) }

    SectionCard("Sleutels ophalen") {
        Text(
            "Je strips versleutelen hun verkeer met een eigen sleutel. Die haal je één keer op via een gratis " +
                "Tuya-ontwikkelaarsproject (iot.tuya.com) waaraan je je Smart Life-account koppelt. Zie de handleiding voor de stappen.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        VSpace(10)
        OutlinedTextField(accessId, { accessId = it.trim() }, label = { Text("Access ID / Client ID") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(
            secret, { secret = it.trim() }, label = { Text("Access Secret / Client Secret") }, modifier = Modifier.fillMaxWidth(), singleLine = true,
            visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        )
        VSpace(8)
        Dropdown("Regio", TuyaCloud.Region.entries, region, { it.label }, { region = it })
        VSpace(10)
        Button(
            enabled = !loading && accessId.isNotBlank() && secret.isNotBlank(),
            onClick = {
                loading = true
                error = null
                app.repo.update { it.copy(cloud = CloudSettings(accessId, secret, region.name)) }
                scope.launch {
                    try {
                        val list = withContext(Dispatchers.IO) { TuyaCloud(region.host, accessId, secret).devices() }
                        devices = list
                        if (list.isEmpty()) error = "Geen apparaten gevonden. Is je Smart Life-account gekoppeld aan het project (Devices → Link App Account)?"
                    } catch (e: Exception) {
                        error = e.message
                    }
                    loading = false
                }
            },
        ) { Text(if (loading) "Bezig…" else "Apparaten ophalen") }
        error?.let {
            VSpace(8)
            Text(it, color = MaterialTheme.colorScheme.error)
        }
    }

    devices?.let { DevicePicker(it, onAdd) }
}

/** Lijst met gevonden apparaten om te kiezen; verlichting staat standaard aangevinkt. */
@Composable
fun DevicePicker(list: List<CloudDevice>, onAdd: (List<Strip>) -> Unit) {
    val app = app()
    val existing = remember { app.repo.data.value.strips.map { it.id }.toSet() }
    // Herkent de app niets als lamp, toon dan meteen alles.
    var showAll by remember(list) { mutableStateOf(list.none { it.isLight }) }
    val selected = remember(list) { mutableStateListOf<String>().apply { addAll(list.filter { it.isLight && it.id !in existing }.map { it.id }) } }
    val shown = if (showAll) list else list.filter { it.isLight }
    SectionCard("Kies je lampen (${shown.size} van ${list.size} apparaten)") {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Ook andere apparaten tonen", modifier = Modifier.weight(1f))
            Switch(showAll, { showAll = it })
        }
        shown.forEach { d ->
            Row(
                Modifier.fillMaxWidth().clickable { if (d.id in selected) selected.remove(d.id) else selected.add(d.id) }.padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(d.id in selected, { if (it) selected.add(d.id) else selected.remove(d.id) })
                Column(Modifier.weight(1f)) {
                    Text(d.name)
                    Text(
                        listOfNotNull(
                            d.productName.ifBlank { null },
                            d.category.ifBlank { null }?.let { "type $it" },
                            if (d.online) "online" else "offline",
                            if (d.localKey.isBlank()) "geen sleutel" else null,
                            if (d.id in existing) "al toegevoegd" else null,
                        ).joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        if (shown.isEmpty()) Text("Geen verlichting gevonden; zet ‘Ook andere apparaten tonen’ aan.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        VSpace(10)
        Button(
            enabled = selected.isNotEmpty(),
            onClick = {
                val chosen = list.filter { it.id in selected && it.localKey.isNotBlank() }
                    .map { d -> app.repo.strip(d.id)?.copy(localKey = d.localKey) ?: Strip(id = d.id, name = d.name, localKey = d.localKey) }
                onAdd(chosen)
            },
        ) { Text("${selected.size} toevoegen en zoeken op wifi") }
    }
}

@Composable
private fun ManualAdd(onAdd: (Strip) -> Unit) {
    var name by remember { mutableStateOf("") }
    var id by remember { mutableStateOf("") }
    var key by remember { mutableStateOf("") }
    var ip by remember { mutableStateOf("") }
    var version by remember { mutableStateOf("Automatisch") }
    SectionCard("Strip handmatig toevoegen") {
        Text(
            "Heb je de apparaat-ID en lokale sleutel al (bijvoorbeeld via tinytuya)? Vul ze hier in. " +
                "IP-adres en protocol mag je leeg laten; de app zoekt ze dan zelf.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        VSpace(8)
        OutlinedTextField(name, { name = it }, label = { Text("Naam (bijv. Woonkamer)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(id, { id = it.trim() }, label = { Text("Apparaat-ID") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(key, { key = it.trim() }, label = { Text("Lokale sleutel (16 tekens)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(ip, { ip = it.trim() }, label = { Text("IP-adres (optioneel)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        VSpace(8)
        Dropdown("Protocol", listOf("Automatisch", "3.3", "3.4", "3.5"), version, { it }, { version = it })
        if (key.isNotEmpty() && key.length != 16) {
            Text("De sleutel moet precies 16 tekens zijn (nu ${key.length}).", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        VSpace(10)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                enabled = id.isNotBlank() && key.length == 16,
                onClick = {
                    onAdd(Strip(id = id, name = name.ifBlank { "LED-strip" }, localKey = key, ip = ip, version = if (version == "Automatisch") "3.3" else version))
                },
            ) { Text("Toevoegen") }
        }
    }
}
