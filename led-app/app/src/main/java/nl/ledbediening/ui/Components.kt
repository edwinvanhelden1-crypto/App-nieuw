package nl.ledbediening.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import nl.ledbediening.tuya.Effect
import nl.ledbediening.tuya.EffectEngine
import nl.ledbediening.tuya.EffectSpec
import nl.ledbediening.tuya.Hsv
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.sin

val AppColors: ColorScheme = darkColorScheme(
    primary = Color(0xFF8B7BFF),
    onPrimary = Color(0xFF15102E),
    secondary = Color(0xFF22D3EE),
    background = Color(0xFF111318),
    surface = Color(0xFF111318),
    surfaceVariant = Color(0xFF1C1F27),
    surfaceContainer = Color(0xFF1B1E25),
    surfaceContainerHigh = Color(0xFF22252E),
    surfaceContainerHighest = Color(0xFF2A2E38),
    onSurface = Color(0xFFEEF0F4),
    onSurfaceVariant = Color(0xFF9AA0AE),
    outline = Color(0xFF3A3F4B),
    outlineVariant = Color(0xFF2B2F39),
    error = Color(0xFFFF6B7D),
)

@Composable
fun AppTheme(content: @Composable () -> Unit) = MaterialTheme(colorScheme = AppColors, content = content)

fun Hsv.toColor(): Color = Color(0xFF000000.toInt() or toRgb())
fun rgbColor(rgb: Int): Color = Color(0xFF000000.toInt() or rgb)

@Composable
fun SectionCard(title: String? = null, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Card(
        modifier = modifier.fillMaxWidth().padding(vertical = 6.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            if (title != null) {
                Text(title, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(10.dp))
            }
            content()
        }
    }
}

@Composable
fun LabeledSlider(
    label: String,
    value: Float,
    onChange: (Float) -> Unit,
    range: ClosedFloatingPointRange<Float> = 0f..100f,
    valueText: String = "${value.toInt()}%",
    onDone: () -> Unit = {},
) {
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.bodyMedium)
            Text(valueText, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Slider(value = value, onValueChange = onChange, valueRange = range, onValueChangeFinished = onDone)
    }
}

/** Keuzelijst als knop met uitklapmenu. */
@Composable
fun <T> Dropdown(label: String, options: List<T>, selected: T, text: (T) -> String, onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth()) {
            Text("$label: ${text(selected)}", modifier = Modifier.weight(1f))
            Text("▾")
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            options.forEach { o ->
                DropdownMenuItem(text = { Text(text(o)) }, onClick = { onSelect(o); open = false })
            }
        }
    }
}

@Composable
fun ColorDot(color: Color, size: Int = 36, selected: Boolean = false, onClick: (() -> Unit)? = null) {
    Box(
        Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(color)
            .border(
                if (selected) BorderStroke(3.dp, Color.White) else BorderStroke(1.dp, Color(0x33FFFFFF)),
                CircleShape,
            )
            .let { if (onClick != null) it.clickable(onClick = onClick) else it },
    )
}

/** Kleurenwiel: tint rondom, verzadiging vanuit het midden. */
@Composable
fun ColorWheel(color: Hsv, onChange: (Hsv) -> Unit, modifier: Modifier = Modifier, onDone: () -> Unit = {}) {
    val hues = remember { (0..12).map { Hsv(it * 30f, 1f).toColor() } }
    fun pick(pos: Offset, size: Size) {
        val r = min(size.width, size.height) / 2
        val dx = pos.x - size.width / 2
        val dy = pos.y - size.height / 2
        val s = (hypot(dx, dy) / r).coerceIn(0f, 1f)
        val h = ((Math.toDegrees(atan2(dy, dx).toDouble()) + 360) % 360).toFloat()
        onChange(Hsv(h, s, color.v))
    }
    Canvas(
        modifier
            .widthIn(max = 300.dp)
            .fillMaxWidth()
            .aspectRatio(1f)
            .pointerInput(color.v) {
                detectTapGestures { pick(it, Size(size.width.toFloat(), size.height.toFloat())); onDone() }
            }
            .pointerInput(color.v) {
                detectDragGestures(
                    onDragStart = { pick(it, Size(size.width.toFloat(), size.height.toFloat())) },
                    onDragEnd = onDone,
                ) { change, _ -> pick(change.position, Size(size.width.toFloat(), size.height.toFloat())) }
            },
    ) {
        val r = min(size.width, size.height) / 2
        drawCircle(Brush.sweepGradient(hues, center), r)
        drawCircle(Brush.radialGradient(listOf(Color.White, Color.White.copy(alpha = 0f)), center, r), r)
        val a = Math.toRadians(color.h.toDouble())
        val p = Offset(center.x + (cos(a) * color.s * r).toFloat(), center.y + (sin(a) * color.s * r).toFloat())
        drawCircle(Hsv(color.h, color.s).toColor(), 14.dp.toPx(), p)
        drawCircle(Color.White, 14.dp.toPx(), p, style = Stroke(3.dp.toPx()))
    }
}

val PresetColors = listOf(
    0xFF0000, 0xFF5500, 0xFFAA00, 0xFFFF00, 0x88FF00, 0x00FF00, 0x00FF88, 0x00FFFF,
    0x0088FF, 0x0000FF, 0x5500FF, 0xAA00FF, 0xFF00FF, 0xFF0088, 0xFFFFFF, 0xFFB46B,
)

@Composable
fun PresetRow(onPick: (Int) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PresetColors.chunked(8).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                row.forEach { c -> ColorDot(rgbColor(c), size = 30) { onPick(c) } }
            }
        }
    }
}

/** Dialoog om één kleur te kiezen. */
@Composable
fun ColorPickerDialog(initial: Int, onDismiss: () -> Unit, onPick: (Int) -> Unit, onDelete: (() -> Unit)? = null) {
    var hsv by remember { mutableStateOf(Hsv.fromRgb(initial).let { if (it.v < 0.05f) it.copy(v = 1f) else it }) }
    var value by remember { mutableFloatStateOf(hsv.v) }
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = { onPick(hsv.copy(v = value).toRgb()) }) { Text("OK") } },
        dismissButton = {
            Row {
                if (onDelete != null) TextButton(onClick = onDelete) { Text("Verwijderen", color = MaterialTheme.colorScheme.error) }
                TextButton(onClick = onDismiss) { Text("Annuleren") }
            }
        },
        title = { Text("Kies een kleur") },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                ColorWheel(hsv, { hsv = it })
                Spacer(Modifier.height(12.dp))
                Box(Modifier.fillMaxWidth().height(28.dp).clip(RoundedCornerShape(14.dp)).background(hsv.copy(v = value).toColor()))
                LabeledSlider("Helderheid van deze kleur", value * 100, { value = it / 100f })
                PresetRow { hsv = Hsv.fromRgb(it); value = 1f }
            }
        },
    )
}

/** Balk met de kleuren van een thema naast elkaar. */
@Composable
fun GradientBar(colors: List<Int>, modifier: Modifier = Modifier) {
    val cs = colors.ifEmpty { listOf(0x444444) }.map { rgbColor(it) }
    Box(
        modifier
            .fillMaxWidth()
            .height(10.dp)
            .clip(RoundedCornerShape(5.dp))
            .background(if (cs.size == 1) Brush.horizontalGradient(listOf(cs[0], cs[0])) else Brush.horizontalGradient(cs)),
    )
}

/**
 * Bewegend voorbeeld van een effect. Elk vakje is een segment van de strip, berekend met
 * dezelfde motor die de strips aanstuurt.
 */
@Composable
fun EffectPreview(spec: EffectSpec, segmented: Boolean = true, segments: Int = 24, modifier: Modifier = Modifier) {
    var t by remember { mutableLongStateOf(0L) }
    LaunchedEffect(Unit) {
        val start = withFrameMillis { it }
        while (true) t = withFrameMillis { it } - start
    }
    // Stromen en Regenboog lopen over de segmenten; Statisch verdeelt de kleuren als "per segment" aan staat.
    val overSegments = spec.spread || spec.effect == Effect.FLOW || spec.effect == Effect.RAINBOW ||
        (spec.effect == Effect.STATIC && segmented)
    val preview = spec.copy(spread = overSegments)
    Row(modifier.fillMaxWidth().height(34.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        for (i in 0 until segments) {
            val c = EffectEngine.frame(preview, t, i, segments)
            Box(Modifier.weight(1f).height(34.dp).clip(RoundedCornerShape(4.dp)).background(c.toColor()))
        }
    }
}

@Composable
fun Pill(text: String, color: Color = MaterialTheme.colorScheme.surfaceContainerHighest) {
    Box(Modifier.clip(RoundedCornerShape(50)).background(color).padding(horizontal = 10.dp, vertical = 4.dp)) {
        Text(text, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun HSpace(w: Int) = Spacer(Modifier.width(w.dp))

@Composable
fun VSpace(h: Int) = Spacer(Modifier.height(h.dp))
