@file:OptIn(ExperimentalMaterial3Api::class)

package nl.ledbediening.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import nl.ledbediening.control.StripState
import nl.ledbediening.data.Strip
import nl.ledbediening.data.Theme
import nl.ledbediening.tuya.Effect
import nl.ledbediening.tuya.Hsv

@Composable
fun AppTopBar(title: String, nav: Nav? = null, actions: @Composable () -> Unit = {}) {
    TopAppBar(
        title = { Text(title, fontWeight = FontWeight.SemiBold) },
        navigationIcon = {
            if (nav != null) IconButton(onClick = nav.pop) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Terug") }
        },
        actions = { actions() },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

fun StripState?.statusText(strip: Strip): String {
    if (!strip.isConfigured) return "Niet gevonden op het netwerk"
    val s = this ?: return "Verbinden…"
    return when {
        s.online == null || s.busy -> "Verbinden…"
        s.online == false -> s.error ?: "Niet bereikbaar"
        !s.on -> "Uit"
        s.mode == "scene" -> "Aan · effect"
        s.mode == "white" -> "Aan · wit"
        else -> "Aan"
    }
}

fun StripState?.displayColor(): Color {
    val s = this ?: return Color(0xFF2A2E38)
    val c = s.colour
    return when {
        !s.on -> Color(0xFF2A2E38)
        s.mode == "white" -> Color(0xFFFFE2B8)
        c != null -> c.copy(v = 1f).toColor()
        else -> Color.White
    }
}

@Composable
fun StripsScreen(nav: Nav) {
    val app = app()
    val data by app.repo.data.collectAsState()
    val states by app.devices.states.collectAsState()
    Box(Modifier.fillMaxSize()) {
        Column {
            AppTopBar("Mijn lampen") {
                IconButton(onClick = { nav.push(Screen.Diagnose) }) { Icon(Icons.Filled.Search, contentDescription = "Netwerk-diagnose") }
                IconButton(onClick = { app.devices.refreshAll() }) { Icon(Icons.Filled.Refresh, contentDescription = "Vernieuwen") }
            }
            AccountBanner(nav)
            if (data.strips.any { !it.isConfigured }) {
                SectionCard(modifier = Modifier.padding(horizontal = 16.dp)) {
                    Text("Niet alle lampen zijn op je wifi gevonden.")
                    VSpace(6)
                    Button(onClick = { nav.push(Screen.Diagnose) }) { Text("Zoeken en diagnose") }
                }
            }
            if (data.strips.isEmpty()) {
                SectionCard(modifier = Modifier.padding(horizontal = 16.dp)) {
                    Text("Nog geen strips", style = MaterialTheme.typography.titleMedium)
                    VSpace(6)
                    Text(
                        "Tik op ‘Strip toevoegen’. Je kunt je strips in één keer importeren uit je Tuya-cloudproject, of er zelf een toevoegen.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 96.dp)) {
                if (data.strips.any { it.isConfigured }) {
                    item(key = "snel") { QuickControls() }
                }
                items(data.strips, key = { it.id }) { strip ->
                    StripCard(strip, states[strip.id], onClick = { nav.push(Screen.StripDetail(strip.id)) }) { on ->
                        app.devices.setPower(strip, on)
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { nav.push(Screen.AddStrip) },
            icon = { Icon(Icons.Filled.Add, contentDescription = null) },
            text = { Text("Strip toevoegen") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
}

/** Alles tegelijk: aan/uit, discomodus en thema's met één tik op alle lampen. */
@Composable
private fun QuickControls() {
    val app = app()
    val data by app.repo.data.collectAsState()
    val playing by app.player.state.collectAsState()
    val strips = data.strips.filter { it.isConfigured }
    val disco = data.themes.firstOrNull { it.name.equals("Disco", ignoreCase = true) }
        ?: Theme(name = "Disco", colors = listOf(0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF), effect = Effect.JUMP.name, speed = 85)
    SectionCard("Alle lampen tegelijk") {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { app.player.stop(restoreLamps = false); strips.forEach { app.devices.setPower(it, true) } }, modifier = Modifier.weight(1f)) { Text("Alles aan") }
            OutlinedButton(onClick = { app.player.stop(restoreLamps = false); strips.forEach { app.devices.setPower(it, false) } }, modifier = Modifier.weight(1f)) { Text("Alles uit") }
        }
        VSpace(8)
        val discoOn = playing?.themeId == disco.id
        Button(
            onClick = { if (discoOn) app.player.stop() else app.player.play(disco.copy(stripIds = emptyList())) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (discoOn) "Discomodus stoppen" else "🎉 Discomodus") }
        VSpace(8)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            data.themes.filter { it.id != disco.id }.forEach { t ->
                val on = playing?.themeId == t.id
                FilledTonalButton(onClick = { if (on) app.player.stop() else app.player.play(t.copy(stripIds = emptyList())) }) {
                    ColorDot(rgbColor(t.colors.firstOrNull() ?: 0xFFFFFF), size = 14)
                    HSpace(6)
                    Text(if (on) "■ ${t.name}" else t.name)
                }
            }
        }
        VSpace(6)
        Text(
            "Stop je, dan gaan de lampen terug naar hoe ze waren.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun StripCard(strip: Strip, state: StripState?, onClick: () -> Unit, onPower: (Boolean) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        shape = RoundedCornerShape(20.dp),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            ColorDot(state.displayColor(), size = 40)
            HSpace(14)
            Column(Modifier.weight(1f)) {
                Text(strip.name, style = MaterialTheme.typography.titleMedium)
                Text(
                    state.statusText(strip),
                    style = MaterialTheme.typography.bodySmall,
                    color = if (state?.online == false) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                )
            }
            if (strip.hasDreamScenes) {
                Pill("RGBIC")
                HSpace(8)
            }
            Switch(checked = state?.on == true, onCheckedChange = onPower, enabled = strip.isConfigured)
        }
    }
}

@Composable
fun StripDetailScreen(id: String, nav: Nav) {
    val app = app()
    val data by app.repo.data.collectAsState()
    val states by app.devices.states.collectAsState()
    val strip = data.strips.find { it.id == id } ?: return
    val state = states[id]
    val scope = rememberCoroutineScope()

    var tab by remember { mutableIntStateOf(if (state?.mode == "white") 1 else 0) }
    var colour by remember { mutableStateOf(state?.colour?.copy(v = 1f) ?: Hsv(0f, 1f)) }
    var bri by remember { mutableFloatStateOf(((state?.colour?.v ?: 1f) * 100f).coerceIn(1f, 100f)) }
    var whiteBri by remember { mutableFloatStateOf((state?.whiteBrightness ?: 1000) / 10f) }
    var temp by remember { mutableFloatStateOf((state?.temperature ?: 500) / 10f) }
    var showSettings by remember { mutableStateOf(!strip.isConfigured) }
    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(id) { app.devices.refresh(strip) }

    fun sendColour() = app.devices.setColour(strip, colour.copy(v = bri / 100f))
    fun sendWhite() = app.devices.setWhite(strip, (whiteBri * 10).toInt(), (temp * 10).toInt())

    Column {
        AppTopBar(strip.name, nav)
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
            SectionCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(state.statusText(strip), color = if (state?.online == false) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
                        if (strip.isConfigured) {
                            Text("${strip.ip} · protocol ${strip.version}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    if (state?.busy == true) CircularProgressIndicator(Modifier.size(24.dp)) else Switch(
                        checked = state?.on == true,
                        onCheckedChange = { app.devices.setPower(strip, it) },
                        enabled = strip.isConfigured,
                    )
                }
            }

            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                listOf("Kleur", "Wit").forEachIndexed { i, label ->
                    SegmentedButton(selected = tab == i, onClick = { tab = i }, shape = SegmentedButtonDefaults.itemShape(i, 2)) { Text(label) }
                }
            }

            if (tab == 0) {
                SectionCard {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                        ColorWheel(colour, { colour = it; sendColour() })
                        VSpace(14)
                        PresetRow { colour = Hsv.fromRgb(it).copy(v = 1f); sendColour() }
                        VSpace(8)
                        LabeledSlider("Helderheid", bri, { bri = it; sendColour() }, 1f..100f)
                    }
                }
            } else {
                SectionCard {
                    LabeledSlider("Helderheid", whiteBri, { whiteBri = it; sendWhite() }, 1f..100f)
                    LabeledSlider("Kleurtemperatuur (warm → koel)", temp, { temp = it; sendWhite() })
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("Nacht" to (10f to 0f), "Warm" to (70f to 10f), "Neutraal" to (100f to 50f), "Koel" to (100f to 100f)).forEach { (n, v) ->
                            OutlinedButton(onClick = { whiteBri = v.first; temp = v.second; sendWhite() }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(4.dp)) {
                                Text(n, style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                }
            }

            TextButton(onClick = { showSettings = !showSettings }) { Text(if (showSettings) "Instellingen verbergen" else "Instellingen") }
            if (showSettings) {
                StripSettings(
                    strip,
                    onSave = { updated ->
                        app.repo.saveStrip(updated)
                        scope.launch { app.devices.refresh(updated) }
                    },
                    onLocate = {
                        scope.launch {
                            val found = app.setup.locate(listOf(strip)) {}.first()
                            app.repo.saveStrip(found)
                            app.devices.refresh(found)
                        }
                    },
                    onMove = { app.repo.moveStrip(id, it) },
                    onDelete = { confirmDelete = true },
                )
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("${strip.name} verwijderen?") },
            confirmButton = {
                TextButton(onClick = {
                    app.devices.forget(id)
                    app.repo.deleteStrip(id)
                    nav.pop()
                }) { Text("Verwijderen", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Annuleren") } },
        )
    }
}

@Composable
private fun StripSettings(strip: Strip, onSave: (Strip) -> Unit, onLocate: () -> Unit, onMove: (Int) -> Unit, onDelete: () -> Unit) {
    var name by remember(strip.id) { mutableStateOf(strip.name) }
    var ip by remember(strip.id) { mutableStateOf(strip.ip) }
    var key by remember(strip.id) { mutableStateOf(strip.localKey) }
    var version by remember(strip.id) { mutableStateOf(strip.version) }
    SectionCard("Instellingen") {
        OutlinedTextField(name, { name = it }, label = { Text("Naam") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(ip, { ip = it.trim() }, label = { Text("IP-adres") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        OutlinedTextField(key, { key = it.trim() }, label = { Text("Lokale sleutel (16 tekens)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        VSpace(8)
        Dropdown("Protocol", listOf("3.3", "3.4", "3.5"), version, { it }, { version = it })
        VSpace(8)
        Text("Apparaat-ID: ${strip.id}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (strip.dps.isNotEmpty()) {
            Text("Datapunten: ${strip.dps.joinToString(", ")}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        VSpace(10)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { onSave(strip.copy(name = name.ifBlank { strip.name }, ip = ip, localKey = key, version = version)) }) { Text("Opslaan") }
            OutlinedButton(onClick = onLocate) { Text("Zoek op netwerk") }
        }
        VSpace(6)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Volgorde", modifier = Modifier.weight(1f))
            IconButton(onClick = { onMove(-1) }) { Icon(Icons.Filled.KeyboardArrowUp, contentDescription = "Omhoog") }
            IconButton(onClick = { onMove(1) }) { Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Omlaag") }
            IconButton(onClick = onDelete) { Icon(Icons.Filled.Delete, contentDescription = "Verwijderen", tint = MaterialTheme.colorScheme.error) }
        }
    }
}
