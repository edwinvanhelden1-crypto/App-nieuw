package nl.ledbediening.ui

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import nl.ledbediening.LedApp

sealed class Screen {
    data object Strips : Screen()
    data object Themes : Screen()
    data object Sequences : Screen()
    data class StripDetail(val id: String) : Screen()
    data object AddStrip : Screen()
    data class ThemeEditor(val id: String?) : Screen()
    data class SequenceEditor(val id: String?) : Screen()
    data object Diagnose : Screen()
}

class Nav(val push: (Screen) -> Unit, val pop: () -> Unit)

@Composable
fun app(): LedApp = LocalContext.current.applicationContext as LedApp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { AppTheme { Root() } }
    }

    override fun onResume() {
        super.onResume()
        (application as LedApp).devices.refreshAll()
    }
}

@Composable
private fun Root() {
    var stack by remember { mutableStateOf(listOf<Screen>(Screen.Strips)) }
    val nav = remember { Nav(push = { stack = stack + it }, pop = { if (stack.size > 1) stack = stack.dropLast(1) }) }
    BackHandler(enabled = stack.size > 1) { nav.pop() }

    val notifyPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) notifyPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    val current = stack.last()
    val tab = stack.first()
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            Column {
                NowPlayingBar()
                if (stack.size == 1) {
                    NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                        NavItem("Strips", Icons.Filled.Home, tab == Screen.Strips) { stack = listOf(Screen.Strips) }
                        NavItem("Thema's", Icons.Filled.Star, tab == Screen.Themes) { stack = listOf(Screen.Themes) }
                        NavItem("Reeksen", Icons.AutoMirrored.Filled.List, tab == Screen.Sequences) { stack = listOf(Screen.Sequences) }
                    }
                }
            }
        },
    ) { pad ->
        Column(Modifier.fillMaxSize().padding(pad)) {
            when (current) {
                Screen.Strips -> StripsScreen(nav)
                Screen.Themes -> ThemesScreen(nav)
                Screen.Sequences -> SequencesScreen(nav)
                is Screen.StripDetail -> StripDetailScreen(current.id, nav)
                Screen.AddStrip -> AddStripScreen(nav)
                is Screen.ThemeEditor -> ThemeEditorScreen(current.id, nav)
                is Screen.SequenceEditor -> SequenceEditorScreen(current.id, nav)
                Screen.Diagnose -> DiagnoseScreen(nav)
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.NavItem(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
) = NavigationBarItem(
    selected = selected,
    onClick = onClick,
    icon = { Icon(icon, contentDescription = null) },
    label = { Text(label) },
)

@Composable
private fun NowPlayingBar() {
    val player = app().player
    val st by player.state.collectAsState()
    val s = st ?: return
    Row(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.18f))
            .padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
        HSpace(10)
        Column(Modifier.weight(1f)) {
            Text(s.title, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (s.subtitle.isNotEmpty()) {
                Text(s.subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        IconButton(onClick = { player.stop() }) { Icon(Icons.Filled.Close, contentDescription = "Stoppen") }
    }
}
