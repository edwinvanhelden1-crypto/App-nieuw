package nl.soundbar.eq

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView

class MainActivity : Activity() {

    private val density by lazy { resources.displayMetrics.density }
    private fun dp(v: Int) = (v * density).toInt()

    private lateinit var outputName: TextView
    private lateinit var outputKind: TextView
    private lateinit var powerSwitch: Switch
    private lateinit var statusText: TextView
    private lateinit var curve: CurveView
    private lateinit var presetSpinner: Spinner
    private lateinit var deleteButton: Button
    private lateinit var limiterSwitch: Switch
    private lateinit var preampBar: SeekBar
    private lateinit var preampValue: TextView
    private val bandBars = mutableListOf<SeekBar>()
    private val bandValues = mutableListOf<TextView>()

    private var presetNames = listOf<String>()
    private var updatingUi = false
    private val engineListener: () -> Unit = { refresh() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        EqEngine.init(this)
        setContentView(buildUi())
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
    }

    override fun onStart() {
        super.onStart()
        EqEngine.addListener(engineListener)
        // The service is stopped by the system or the notification; keep the switch truthful.
        if (EqEngine.enabled && !EqEngine.running) EqService.start(this)
        refresh()
    }

    override fun onStop() {
        EqEngine.removeListener(engineListener)
        super.onStop()
    }

    // ---------- UI ----------

    private fun buildUi(): View {
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(20), dp(16), dp(24))
        }

        column.addView(text("Soundbar Equalizer", 26f, bold = true))
        column.addView(text("Past al het geluid van je toestel realtime aan, voor elke soundbar.", 14f, muted = true).apply {
            setPadding(0, dp(2), 0, dp(16))
        })

        // Output device
        column.addView(card().apply {
            addView(text("Uitvoer", 13f, muted = true))
            outputName = text("", 20f, bold = true)
            outputKind = text("", 14f, muted = true)
            addView(outputName)
            addView(outputKind)
            addView(Button(this@MainActivity).apply {
                text = "Bluetooth-instellingen"
                setOnClickListener { startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) }
            }, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(8) })
        })

        // Power
        column.addView(card().apply {
            powerSwitch = Switch(this@MainActivity).apply {
                text = "Equalizer aan"
                textSize = 18f
                setTypeface(typeface, Typeface.BOLD)
                setOnCheckedChangeListener { _, on ->
                    if (updatingUi) return@setOnCheckedChangeListener
                    EqEngine.enabled = on
                    if (on) EqService.start(this@MainActivity) else EqService.stop(this@MainActivity)
                }
            }
            addView(powerSwitch)
            statusText = text("", 14f, muted = true).apply { setPadding(0, dp(6), 0, 0) }
            addView(statusText)
        })

        // Equalizer
        column.addView(card().apply {
            curve = CurveView(this@MainActivity)
            addView(curve, LinearLayout.LayoutParams(MATCH_PARENT, dp(150)))

            val presetRow = LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(12), 0, dp(4))
            }
            presetSpinner = Spinner(this@MainActivity).apply {
                onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                    override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                        presetFor(position)?.let(EqEngine::setProfile)
                        deleteButton.visibility = if (isCustom(position)) View.VISIBLE else View.GONE
                    }
                    override fun onNothingSelected(parent: AdapterView<*>?) {}
                }
            }
            presetRow.addView(presetSpinner, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
            presetRow.addView(Button(this@MainActivity).apply {
                text = "Opslaan"
                setOnClickListener { askPresetName() }
            })
            deleteButton = Button(this@MainActivity).apply {
                text = "Wis"
                visibility = View.GONE
                setOnClickListener { confirmDelete() }
            }
            presetRow.addView(deleteButton)
            addView(presetRow)

            EqProfile.FREQUENCIES.forEachIndexed { i, freq ->
                val label = if (freq >= 1000) "${freq / 1000} kHz" else "$freq Hz"
                val (bar, value) = sliderRow(this, label, steps = (EqProfile.MAX_DB * 4).toInt()) { progress ->
                    EqEngine.setBand(i, progress / 2f - EqProfile.MAX_DB)
                }
                bandBars += bar
                bandValues += value
            }

            val preampSteps = ((EqProfile.MAX_PREAMP - EqProfile.MIN_PREAMP) * 2).toInt()
            sliderRow(this, "Versterking", preampSteps) { progress ->
                EqEngine.setPreamp(progress / 2f + EqProfile.MIN_PREAMP)
            }.let { (bar, value) -> preampBar = bar; preampValue = value }

            limiterSwitch = Switch(this@MainActivity).apply {
                text = "Begrenzer (voorkomt vervorming bij veel versterking)"
                setOnCheckedChangeListener { _, on -> if (!updatingUi) EqEngine.limiterOn = on }
                setPadding(0, dp(10), 0, 0)
            }
            addView(limiterSwitch)

            addView(Button(this@MainActivity).apply {
                text = "Alles op 0"
                setOnClickListener { EqEngine.setProfile(EqProfile.FLAT) }
            }, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply { topMargin = dp(8) })
        })

        column.addView(text(
            "Werkt met elke soundbar en speaker (Bluetooth, HDMI of USB), omdat het geluid op je toestel wordt " +
                "aangepast voordat het naar de soundbar gaat. Elke soundbar onthoudt zijn eigen instellingen. " +
                "Hoor je geen verschil? Zet dan andere geluidseffecten uit (bijv. Dolby Atmos of de equalizer " +
                "in Instellingen › Geluid), want die kunnen deze app overschrijven.",
            13f, muted = true,
        ).apply { setPadding(dp(4), dp(4), dp(4), 0) })

        return ScrollView(this).apply {
            fitsSystemWindows = true
            addView(column)
        }
    }

    /** Adds "label  [-----o-----]  value" to [parent]; [onChange] receives the progress set by the user. */
    private fun sliderRow(parent: LinearLayout, label: String, steps: Int, onChange: (Int) -> Unit): Pair<SeekBar, TextView> {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = dp(44)
        }
        row.addView(text(label, 14f, muted = true), LinearLayout.LayoutParams(dp(88), WRAP_CONTENT))
        val bar = SeekBar(this).apply {
            max = steps
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar, progress: Int, fromUser: Boolean) {
                    if (fromUser) onChange(progress)
                }
                override fun onStartTrackingTouch(seekBar: SeekBar) {}
                override fun onStopTrackingTouch(seekBar: SeekBar) {}
            })
        }
        row.addView(bar, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        val value = text("", 14f).apply { gravity = Gravity.END }
        row.addView(value, LinearLayout.LayoutParams(dp(64), WRAP_CONTENT))
        parent.addView(row)
        return bar to value
    }

    private fun text(value: String, sizeSp: Float, bold: Boolean = false, muted: Boolean = false) = TextView(this).apply {
        text = value
        textSize = sizeSp
        setTextColor(getColor(if (muted) R.color.muted else R.color.text))
        if (bold) setTypeface(typeface, Typeface.BOLD)
    }

    private fun card() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(16), dp(16), dp(16))
        background = GradientDrawable().apply {
            setColor(getColor(R.color.card))
            cornerRadius = dp(14).toFloat()
            setStroke(dp(1), getColor(R.color.grid))
        }
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(14) }
    }

    private fun formatDb(db: Float): String {
        val rounded = if (db % 1f == 0f) "${db.toInt()}" else "%.1f".format(db)
        return (if (db > 0) "+" else "") + rounded + " dB"
    }

    private fun refresh() {
        updatingUi = true
        val profile = EqEngine.profile

        outputName.text = EqEngine.output.name
        outputKind.text = EqEngine.output.kind
        powerSwitch.isChecked = EqEngine.enabled
        statusText.text = when {
            EqEngine.running -> EqEngine.status
            EqEngine.enabled -> "Equalizer wordt gestart…"
            else -> "Uit: het geluid gaat onbewerkt naar je soundbar."
        }
        curve.profile = profile

        profile.gains.forEachIndexed { i, db ->
            bandBars[i].progress = ((db + EqProfile.MAX_DB) * 2).toInt()
            bandValues[i].text = formatDb(db)
        }
        preampBar.progress = ((profile.preamp - EqProfile.MIN_PREAMP) * 2).toInt()
        preampValue.text = formatDb(profile.preamp)
        limiterSwitch.isChecked = EqEngine.limiterOn

        val custom = EqEngine.customPresets
        val names = listOf("Eigen instelling") + EqProfile.PRESETS.keys + custom.keys.map { "★ $it" }
        if (names != presetNames) {
            presetNames = names
            presetSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, names)
        }
        val match = names.indices.drop(1).firstOrNull { presetFor(it)?.sameAs(profile) == true } ?: 0
        presetSpinner.setSelection(match)
        deleteButton.visibility = if (isCustom(match)) View.VISIBLE else View.GONE
        updatingUi = false
    }

    // ---------- Presets ----------

    private fun isCustom(position: Int) = position > EqProfile.PRESETS.size

    private fun customName(position: Int) = presetNames[position].removePrefix("★ ")

    private fun presetFor(position: Int): EqProfile? = when {
        position <= 0 || position >= presetNames.size -> null
        isCustom(position) -> EqEngine.customPresets[customName(position)]
        else -> EqProfile.PRESETS[presetNames[position]]
    }

    private fun askPresetName() {
        val input = EditText(this).apply {
            hint = "Bijv. Avond film"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        }
        val wrap = LinearLayout(this).apply {
            setPadding(dp(20), dp(8), dp(20), 0)
            addView(input, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        }
        AlertDialog.Builder(this)
            .setTitle("Instelling opslaan")
            .setView(wrap)
            .setPositiveButton("Opslaan") { _, _ ->
                input.text.toString().trim().takeIf { it.isNotEmpty() }?.let(EqEngine::savePreset)
            }
            .setNegativeButton("Annuleren", null)
            .show()
    }

    private fun confirmDelete() {
        val position = presetSpinner.selectedItemPosition
        if (!isCustom(position)) return
        val name = customName(position)
        AlertDialog.Builder(this)
            .setMessage("\"$name\" verwijderen?")
            .setPositiveButton("Verwijderen") { _, _ -> EqEngine.deletePreset(name) }
            .setNegativeButton("Annuleren", null)
            .show()
    }
}
