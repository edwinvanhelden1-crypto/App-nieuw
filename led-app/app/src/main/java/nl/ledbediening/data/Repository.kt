package nl.ledbediening.data

import android.content.Context
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.json.Json
import java.io.File

/** Bewaart strips, thema's en reeksen als JSON in de app-opslag. */
class Repository(context: Context) {
    private val file = File(context.filesDir, "data.json")
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true; prettyPrint = true }
    private val _data = MutableStateFlow(load())
    val data: StateFlow<AppData> = _data.asStateFlow()

    private fun load(): AppData = try {
        if (file.exists()) json.decodeFromString(AppData.serializer(), file.readText()) else AppData()
    } catch (e: Exception) {
        Log.e("Repository", "Kan gegevens niet lezen", e)
        file.copyTo(File(file.path + ".kapot"), overwrite = true)
        AppData()
    }

    @Synchronized
    fun update(transform: (AppData) -> AppData) {
        _data.update(transform)
        try {
            val tmp = File(file.path + ".tmp")
            tmp.writeText(json.encodeToString(AppData.serializer(), _data.value))
            tmp.renameTo(file)
        } catch (e: Exception) {
            Log.e("Repository", "Kan gegevens niet opslaan", e)
        }
    }

    fun strip(id: String) = data.value.strips.find { it.id == id }
    fun theme(id: String) = data.value.themes.find { it.id == id }
    fun sequence(id: String) = data.value.sequences.find { it.id == id }

    fun saveStrip(strip: Strip) = update { d ->
        val exists = d.strips.any { it.id == strip.id }
        d.copy(strips = if (exists) d.strips.map { if (it.id == strip.id) strip else it } else d.strips + strip)
    }

    fun deleteStrip(id: String) = update { d ->
        d.copy(
            strips = d.strips.filter { it.id != id },
            themes = d.themes.map { t -> t.copy(stripIds = t.stripIds - id) },
        )
    }

    fun moveStrip(id: String, delta: Int) = update { d ->
        val list = d.strips.toMutableList()
        val i = list.indexOfFirst { it.id == id }
        val j = i + delta
        if (i < 0 || j !in list.indices) return@update d
        list.add(j, list.removeAt(i))
        d.copy(strips = list)
    }

    fun saveTheme(theme: Theme) = update { d ->
        val exists = d.themes.any { it.id == theme.id }
        d.copy(themes = if (exists) d.themes.map { if (it.id == theme.id) theme else it } else d.themes + theme)
    }

    fun deleteTheme(id: String) = update { d ->
        d.copy(
            themes = d.themes.filter { it.id != id },
            sequences = d.sequences.map { s -> s.copy(steps = s.steps.filter { it.themeId != id }) },
        )
    }

    fun saveSequence(seq: Sequence) = update { d ->
        val exists = d.sequences.any { it.id == seq.id }
        d.copy(sequences = if (exists) d.sequences.map { if (it.id == seq.id) seq else it } else d.sequences + seq)
    }

    fun deleteSequence(id: String) = update { d -> d.copy(sequences = d.sequences.filter { it.id != id }) }
}
