package nl.ledbediening.ui

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Build
import android.provider.MediaStore
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import nl.ledbediening.data.Strip
import nl.ledbediening.tuya.CloudDevice
import nl.ledbediening.tuya.SmartLifeApi
import nl.ledbediening.tuya.SmartLifeLogin
import nl.ledbediening.tuya.SmartLifeSession

/**
 * Inloggen met je Smart Life-account: gebruikerscode invullen, QR-code goedkeuren in de
 * Smart Life-app, en daarna alle lampen uit al je huizen ophalen. Er wordt niets veranderd
 * in de Smart Life-app; we lezen alleen de lampen en hun sleutels.
 */
@Composable
fun SmartLifeImport(onAdd: (List<Strip>) -> Unit) {
    val app = app()
    val data by app.repo.data.collectAsState()
    val scope = rememberCoroutineScope()
    val session = data.smartLife
    var userCode by remember { mutableStateOf(session?.userCode ?: "") }
    var qrToken by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var devices by remember { mutableStateOf<List<CloudDevice>?>(null) }

    fun saveSession(s: SmartLifeSession?) = app.repo.update { it.copy(smartLife = s) }

    fun fetch(s: SmartLifeSession) {
        busy = true
        error = null
        scope.launch {
            try {
                devices = withContext(Dispatchers.IO) { SmartLifeApi(s, onSessionChanged = ::saveSession).allDevices() }
                if (devices.isNullOrEmpty()) error = "Geen apparaten gevonden in je Smart Life-account."
            } catch (e: Exception) {
                error = "${e.message}\n\nLog eventueel opnieuw in."
            }
            busy = false
        }
    }

    // Wachten tot de QR-code in de Smart Life-app is goedgekeurd.
    qrToken?.let { token ->
        LaunchedEffect(token) {
            val login = SmartLifeLogin()
            repeat(150) {
                delay(2000)
                val s = withContext(Dispatchers.IO) { runCatching { login.poll(token, userCode) }.getOrNull() }
                if (s != null) {
                    saveSession(s)
                    qrToken = null
                    fetch(s)
                    return@LaunchedEffect
                }
            }
            qrToken = null
            error = "De QR-code is verlopen. Probeer het opnieuw."
        }
    }

    val token = qrToken
    when {
        token != null -> QrStep(token, onCancel = { qrToken = null })
        session != null && devices == null -> SectionCard("Smart Life") {
            Text("Ingelogd${if (session.username.isNotBlank()) " als ${session.username}" else ""}.")
            VSpace(10)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(enabled = !busy, onClick = { fetch(session) }) { Text(if (busy) "Bezig…" else "Lampen ophalen") }
                TextButton(onClick = { saveSession(null) }) { Text("Uitloggen") }
            }
            if (busy) {
                VSpace(10)
                CircularProgressIndicator(Modifier.size(28.dp))
            }
        }
        session == null -> SectionCard("Inloggen met Smart Life") {
            Text(
                "Zo vind je je gebruikerscode in de Smart Life- (of Tuya Smart-)app:\n" +
                    "Ik → ⚙ Instellingen (rechtsboven) → Account en beveiliging → Gebruikerscode.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            VSpace(10)
            OutlinedTextField(userCode, { userCode = it.trim() }, label = { Text("Gebruikerscode") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            VSpace(10)
            Button(
                enabled = userCode.isNotBlank() && !busy,
                onClick = {
                    busy = true
                    error = null
                    scope.launch {
                        try {
                            qrToken = withContext(Dispatchers.IO) { SmartLifeLogin().requestQr(userCode) }
                        } catch (e: Exception) {
                            error = e.message
                        }
                        busy = false
                    }
                },
            ) { Text(if (busy) "Bezig…" else "Inloggen") }
            VSpace(8)
            Text(
                "Er verandert niets in je Smart Life-app: LED Bediening leest alleen welke lampen je hebt en hun sleutels. " +
                    "Daarna praat de app rechtstreeks via je wifi met de lampen.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    error?.let {
        SectionCard {
            Text(it, color = MaterialTheme.colorScheme.error)
        }
    }

    devices?.let { list ->
        DevicePicker(list, onAdd)
        TextButton(onClick = { devices = null }) { Text("Terug") }
    }
}

@Composable
private fun QrStep(token: String, onCancel: () -> Unit) {
    val context = LocalContext.current
    val content = SmartLifeLogin.qrContent(token)
    val bitmap = remember(content) { qrBitmap(content) }
    var saved by remember { mutableStateOf(false) }
    SectionCard("Bevestig in de Smart Life-app") {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(Modifier.clip(RoundedCornerShape(12.dp)).background(Color.White).padding(10.dp)) {
                Image(bitmap.asImageBitmap(), contentDescription = "QR-code om in te loggen", modifier = Modifier.size(240.dp))
            }
        }
        VSpace(12)
        Text(
            "Open de Smart Life-app, tik op het scan-icoon (rechtsboven op het startscherm) en scan deze code. " +
                "Tik daarna op ‘Bevestigen’.",
        )
        VSpace(8)
        Text(
            "Gebruik je deze telefoon zelf? Sla de code dan op als foto en kies hem in de scanner van Smart Life via het fotopictogram. " +
                "Of laat deze code zien op een ander scherm.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        VSpace(10)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (Build.VERSION.SDK_INT >= 29) {
                OutlinedButton(onClick = { saved = saveToGallery(context, bitmap) }) { Text(if (saved) "Opgeslagen ✓" else "Opslaan als foto") }
            }
            OutlinedButton(onClick = {
                listOf("com.tuya.smartlife", "com.tuya.smart")
                    .firstNotNullOfOrNull { context.packageManager.getLaunchIntentForPackage(it) }
                    ?.let { context.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }) { Text("Open Smart Life") }
        }
        VSpace(10)
        Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            HSpace(10)
            Text("Wachten op bevestiging…", modifier = Modifier.weight(1f))
            TextButton(onClick = onCancel) { Text("Annuleren") }
        }
    }
}

private fun qrBitmap(text: String, size: Int = 720): Bitmap {
    val matrix = QRCodeWriter().encode(
        text, BarcodeFormat.QR_CODE, size, size,
        mapOf(EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.Q, EncodeHintType.MARGIN to 2),
    )
    val pixels = IntArray(size * size) { i -> if (matrix[i % size, i / size]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt() }
    return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
}

private fun saveToGallery(context: Context, bitmap: Bitmap): Boolean = try {
    val values = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, "smartlife-inloggen-${System.currentTimeMillis()}.png")
        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
        put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/LED Bediening")
    }
    val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)!!
    context.contentResolver.openOutputStream(uri)!!.use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    true
} catch (_: Exception) {
    false
}
