@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package nl.ledbediening.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import nl.ledbediening.data.Engine
import nl.ledbediening.data.Theme
import nl.ledbediening.data.description
import nl.ledbediening.data.label
import nl.ledbediening.tuya.Effect
import nl.ledbediening.tuya.LightCodec

@Composable
fun ThemesScreen(nav: Nav) {
    val app = app()
    val data by app.repo.data.collectAsState()
    val playing by app.player.state.collectAsState()
    Box(Modifier.fillMaxSize()) {
        Column {
            AppTopBar("Thema's")
            LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 96.dp)) {
                items(data.themes, key = { it.id }) { theme ->
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable { nav.push(Screen.ThemeEditor(theme.id)) },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
                        shape = RoundedCornerShape(20.dp),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(theme.name, style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        "${theme.effectEnum.label} · snelheid ${theme.speed}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                FilledIconButton(onClick = { app.player.play(theme) }) {
                                    Icon(Icons.Filled.PlayArrow, contentDescription = "Afspelen")
                                }
                            }
                            VSpace(10)
                            if (playing?.themeId == theme.id) EffectPreview(theme.spec(), theme.segmented) else GradientBar(theme.colors)
                        }
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { nav.push(Screen.ThemeEditor(null)) },
            icon = { Icon(Icons.Filled.Add, contentDescription = null) },
            text = { Text("Nieuw thema") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
}

@Composable
fun ThemeEditorScreen(id: String?, nav: Nav) {
    val app = app()
    val data by app.repo.data.collectAsState()
    val original = remember(id) { id?.let { app.repo.theme(it) } ?: Theme() }
    var t by remember(id) { mutableStateOf(original) }
    var editColor by remember { mutableStateOf<Int?>(null) }   // index, of -1 voor een nieuwe kleur
    var confirmDelete by remember { mutableStateOf(false) }
    val effect = t.effectEnum
    val strips = data.strips
    val targets = if (t.stripIds.isEmpty()) strips else strips.filter { it.id in t.stripIds }
    val allRgbic = targets.isNotEmpty() && targets.all { it.hasDreamScenes }

    Column {
        AppTopBar(if (id == null) "Nieuw thema" else "Thema bewerken", nav) {
            if (id != null) IconButton(onClick = { confirmDelete = true }) { Icon(Icons.Filled.Delete, contentDescription = "Verwijderen") }
        }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp)) {
            OutlinedTextField(t.name, { t = t.copy(name = it) }, label = { Text("Naam") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            VSpace(8)

            SectionCard("Voorbeeld") {
                EffectPreview(t.spec(), t.segmented)
                VSpace(10)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { app.repo.saveTheme(t); app.player.play(t) }) {
                        Icon(Icons.Filled.PlayArrow, contentDescription = null)
                        HSpace(6)
                        Text("Probeer op strips")
                    }
                    OutlinedButton(onClick = { app.player.stop() }) { Text("Stop") }
                }
            }

            SectionCard("Kleuren (${t.colors.size})") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    t.colors.forEachIndexed { i, c -> ColorDot(rgbColor(c), size = 44) { editColor = i } }
                    if (t.colors.size < LightCodec.MAX_DREAM_COLORS * 2) {
                        Box(
                            Modifier.size(44.dp).clip(CircleShape).clickable { editColor = -1 },
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Filled.Add, contentDescription = "Kleur toevoegen") }
                    }
                }
                VSpace(6)
                Text(
                    "Tik op een kleur om hem te wijzigen of te verwijderen." +
                        if (t.colors.size > LightCodec.MAX_DREAM_COLORS) " Op de strip zelf worden maximaal ${LightCodec.MAX_DREAM_COLORS} kleuren gebruikt." else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            SectionCard("Effect") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Effect.entries.forEach { e ->
                        FilterChip(selected = effect == e, onClick = { t = t.copy(effect = e.name) }, label = { Text(e.label) })
                    }
                }
                Text(effect.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            SectionCard("Beweging") {
                LabeledSlider(
                    "Snelheid", t.speed.toFloat(), { t = t.copy(speed = it.toInt()) }, 1f..100f,
                    valueText = when {
                        t.speed < 25 -> "traag (${t.speed})"
                        t.speed < 70 -> "gemiddeld (${t.speed})"
                        else -> "snel (${t.speed})"
                    },
                )
                LabeledSlider("Helderheid", t.brightness.toFloat(), { t = t.copy(brightness = it.toInt()) }, 1f..100f)
                Text("Richting", style = MaterialTheme.typography.bodyMedium)
                VSpace(4)
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    SegmentedButton(selected = !t.reverse, onClick = { t = t.copy(reverse = false) }, shape = SegmentedButtonDefaults.itemShape(0, 2)) { Text("Vooruit →") }
                    SegmentedButton(selected = t.reverse, onClick = { t = t.copy(reverse = true) }, shape = SegmentedButtonDefaults.itemShape(1, 2)) { Text("← Achteruit") }
                }
                VSpace(8)
                OptionRow("Heen en weer", "Kleuren gaan vooruit en daarna terug, in plaats van rond", t.pingPong) { t = t.copy(pingPong = it) }
                OptionRow("Zachte overgang", "Kleuren vloeien in elkaar over", t.smooth) { t = t.copy(smooth = it) }
                OptionRow("Per segment", "Kleuren verdeeld over de lengte van de strip (RGBIC)", t.segmented) { t = t.copy(segmented = it) }
                OptionRow("Verdeel over strips", "Het effect loopt van de ene strip naar de volgende", t.spread) { t = t.copy(spread = it) }
            }

            SectionCard("Strips") {
                if (strips.isEmpty()) Text("Nog geen strips toegevoegd.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                strips.forEach { s ->
                    val checked = t.stripIds.isEmpty() || s.id in t.stripIds
                    Row(
                        Modifier.fillMaxWidth().clickable {
                            val current = if (t.stripIds.isEmpty()) strips.map { it.id } else t.stripIds
                            val next = if (s.id in current) current - s.id else current + s.id
                            t = t.copy(stripIds = if (next.size == strips.size) emptyList() else strips.map { it.id }.filter { it in next })
                        },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(checked, null)
                        Text(s.name, modifier = Modifier.weight(1f))
                        if (s.hasDreamScenes) Pill("RGBIC")
                    }
                }
                VSpace(4)
                Text(
                    "De volgorde van de strips (in te stellen bij elke strip) bepaalt de richting van ‘Verdeel over strips’ en ‘Achtervolgen’.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            SectionCard("Afspelen") {
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    Engine.entries.forEachIndexed { i, e ->
                        SegmentedButton(selected = t.engine == e, onClick = { t = t.copy(engine = e) }, shape = SegmentedButtonDefaults.itemShape(i, Engine.entries.size)) {
                            Text(e.label, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
                VSpace(6)
                Text(
                    engineHelp(t, allRgbic),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Button(
                onClick = { app.repo.saveTheme(t); nav.pop() },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) { Text("Opslaan") }
        }
    }

    editColor?.let { idx ->
        ColorPickerDialog(
            initial = if (idx >= 0) t.colors[idx] else 0xFF0000,
            onDismiss = { editColor = null },
            onPick = { c ->
                t = t.copy(colors = if (idx >= 0) t.colors.toMutableList().also { it[idx] = c } else t.colors + c)
                editColor = null
            },
            onDelete = if (idx >= 0 && t.colors.size > 1) ({
                t = t.copy(colors = t.colors.filterIndexed { i, _ -> i != idx })
                editColor = null
            }) else null,
        )
    }

    if (confirmDelete && id != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("${t.name} verwijderen?") },
            confirmButton = {
                TextButton(onClick = { app.repo.deleteTheme(id); nav.pop() }) { Text("Verwijderen", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Annuleren") } },
        )
    }
}

private fun engineHelp(t: Theme, allRgbic: Boolean): String {
    val e = t.effectEnum
    return when {
        e.dreamMode == null -> "‘${e.label}’ wordt altijd door de app aangestuurd: houd de app open of op de achtergrond."
        t.engine == Engine.APP -> "De app stuurt de kleuren live (±10× per seconde). Werkt over strips heen; de telefoon moet aan blijven."
        t.engine == Engine.STRIP -> "De strip speelt het effect zelf af, soepel en ook als je telefoon uit is. Strips zonder RGBIC-effecten worden door de app aangestuurd."
        allRgbic && !t.spread && !t.pingPong -> "Automatisch: je strips spelen dit effect zelf af (soepel, telefoon mag uit)."
        else -> "Automatisch: de app stuurt de kleuren live, omdat " +
            (if (t.spread) "het effect over strips verdeeld wordt." else if (t.pingPong) "‘heen en weer’ aan staat." else "niet alle strips RGBIC-effecten hebben.")
    }
}

@Composable
private fun OptionRow(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked, onChange)
    }
}
