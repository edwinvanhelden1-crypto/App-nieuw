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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import nl.ledbediening.data.Sequence
import nl.ledbediening.data.SequenceStep

@Composable
fun SequencesScreen(nav: Nav) {
    val app = app()
    val data by app.repo.data.collectAsState()
    Box(Modifier.fillMaxSize()) {
        Column {
            AppTopBar("Reeksen")
            if (data.sequences.isEmpty()) {
                SectionCard(modifier = Modifier.padding(horizontal = 16.dp)) {
                    Text("Wat is een reeks?", style = MaterialTheme.typography.titleMedium)
                    VSpace(6)
                    Text(
                        "Een reeks speelt je thema's na elkaar af, elk zo lang als jij wilt, en laat ze zacht in elkaar overvloeien. " +
                            "Bijvoorbeeld: 1 minuut Oceaan → 30 seconden Disco → 2 minuten Zonsondergang, en dan opnieuw.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 96.dp)) {
                items(data.sequences, key = { it.id }) { seq ->
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable { nav.push(Screen.SequenceEditor(seq.id)) },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
                        shape = RoundedCornerShape(20.dp),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(seq.name, style = MaterialTheme.typography.titleMedium)
                                    val total = seq.steps.sumOf { it.seconds }
                                    Text(
                                        "${seq.steps.size} stappen · ${formatDuration(total)}" + if (seq.repeat) " · herhalen" else "",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                FilledIconButton(onClick = { app.player.play(seq) }, enabled = seq.steps.isNotEmpty()) {
                                    Icon(Icons.Filled.PlayArrow, contentDescription = "Afspelen")
                                }
                            }
                            VSpace(10)
                            GradientBar(seq.steps.mapNotNull { st -> data.themes.find { it.id == st.themeId }?.colors?.firstOrNull() })
                        }
                    }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { nav.push(Screen.SequenceEditor(null)) },
            icon = { Icon(Icons.Filled.Add, contentDescription = null) },
            text = { Text("Nieuwe reeks") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
}

fun formatDuration(seconds: Int): String = when {
    seconds < 60 -> "$seconds s"
    seconds % 60 == 0 -> "${seconds / 60} min"
    else -> "${seconds / 60} min ${seconds % 60} s"
}

@Composable
fun SequenceEditorScreen(id: String?, nav: Nav) {
    val app = app()
    val data by app.repo.data.collectAsState()
    val original = remember(id) { id?.let { app.repo.sequence(it) } ?: Sequence() }
    var s by remember(id) { mutableStateOf(original) }
    var confirmDelete by remember { mutableStateOf(false) }
    val themes = data.themes

    fun setStep(i: Int, step: SequenceStep) {
        s = s.copy(steps = s.steps.toMutableList().also { it[i] = step })
    }

    fun move(i: Int, d: Int) {
        val j = i + d
        if (j !in s.steps.indices) return
        s = s.copy(steps = s.steps.toMutableList().also { it.add(j, it.removeAt(i)) })
    }

    Column {
        AppTopBar(if (id == null) "Nieuwe reeks" else "Reeks bewerken", nav) {
            if (id != null) IconButton(onClick = { confirmDelete = true }) { Icon(Icons.Filled.Delete, contentDescription = "Verwijderen") }
        }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp)) {
            OutlinedTextField(s.name, { s = s.copy(name = it) }, label = { Text("Naam") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            VSpace(8)

            SectionCard("Stappen") {
                if (s.steps.isEmpty()) {
                    Text("Voeg thema's toe die na elkaar spelen.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                s.steps.forEachIndexed { i, step ->
                    val theme = themes.find { it.id == step.themeId }
                    Column(Modifier.padding(vertical = 6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("${i + 1}.", modifier = Modifier.width(28.dp))
                            Dropdown("Thema", themes, theme ?: themes.firstOrNull() ?: return@Row, { it.name }, { setStep(i, step.copy(themeId = it.id)) }, Modifier.weight(1f))
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            HSpace(28)
                            var text by remember(step.themeId, i) { mutableStateOf(step.seconds.toString()) }
                            OutlinedTextField(
                                text,
                                { v ->
                                    text = v.filter { it.isDigit() }.take(5)
                                    text.toIntOrNull()?.let { setStep(i, step.copy(seconds = it.coerceAtLeast(2))) }
                                },
                                label = { Text("Seconden") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.width(120.dp),
                            )
                            HSpace(4)
                            Text(formatDuration(step.seconds), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                            IconButton(onClick = { move(i, -1) }) { Icon(Icons.Filled.KeyboardArrowUp, contentDescription = "Omhoog") }
                            IconButton(onClick = { move(i, 1) }) { Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Omlaag") }
                            IconButton(onClick = { s = s.copy(steps = s.steps.filterIndexed { k, _ -> k != i }) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Verwijderen")
                            }
                        }
                        theme?.let { GradientBar(it.colors, Modifier.padding(start = 28.dp, top = 4.dp)) }
                    }
                }
                VSpace(6)
                OutlinedButton(
                    enabled = themes.isNotEmpty(),
                    onClick = { s = s.copy(steps = s.steps + SequenceStep(themes.first().id, 30)) },
                ) {
                    Icon(Icons.Filled.Add, contentDescription = null)
                    HSpace(6)
                    Text("Stap toevoegen")
                }
            }

            SectionCard("Overgang") {
                LabeledSlider(
                    "Overvloeien tussen thema's", s.crossfadeSeconds.toFloat(), { s = s.copy(crossfadeSeconds = it.toInt()) }, 0f..15f,
                    valueText = if (s.crossfadeSeconds == 0) "direct" else "${s.crossfadeSeconds} s",
                )
                Text(
                    "Thema's die de app aanstuurt vloeien zacht in elkaar over. Effecten die de strip zelf afspeelt wisselen direct.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                VSpace(8)
                Row(Modifier.fillMaxWidth().clickable { s = s.copy(repeat = !s.repeat) }, verticalAlignment = Alignment.CenterVertically) {
                    Text("Herhalen", modifier = Modifier.weight(1f))
                    Switch(s.repeat, { s = s.copy(repeat = it) })
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                OutlinedButton(enabled = s.steps.isNotEmpty(), onClick = { app.repo.saveSequence(s); app.player.play(s) }) {
                    Icon(Icons.Filled.PlayArrow, contentDescription = null)
                    HSpace(6)
                    Text("Afspelen")
                }
                Button(onClick = { app.repo.saveSequence(s); nav.pop() }, modifier = Modifier.weight(1f)) { Text("Opslaan") }
            }
        }
    }

    if (confirmDelete && id != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("${s.name} verwijderen?") },
            confirmButton = {
                TextButton(onClick = { app.repo.deleteSequence(id); nav.pop() }) { Text("Verwijderen", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Annuleren") } },
        )
    }
}
