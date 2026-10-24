package nl.soundbar.eq

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

/** Gain per band in dB plus an overall pre-gain in dB. */
data class EqProfile(val gains: List<Float>, val preamp: Float = 0f) {

    fun withBand(index: Int, db: Float) = copy(gains = gains.toMutableList().also { it[index] = db })

    fun sameAs(other: EqProfile) =
        abs(preamp - other.preamp) < 0.01f && gains.indices.all { abs(gains[it] - other.gains[it]) < 0.01f }

    fun toJson(): JSONObject = JSONObject()
        .put("gains", JSONArray(gains.map { it.toDouble() }))
        .put("preamp", preamp.toDouble())

    companion object {
        val FREQUENCIES = intArrayOf(32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000)
        const val MAX_DB = 12f
        const val MIN_PREAMP = -12f
        const val MAX_PREAMP = 6f

        val FLAT = of(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)

        val PRESETS: Map<String, EqProfile> = linkedMapOf(
            "Vlak" to FLAT,
            "Bas boost" to of(6, 5, 4, 2, 0, 0, 0, 0, 0, 0),
            "Dialoog" to of(-2, -2, -1, 0, 2, 4, 4, 3, 1, 0),
            "Film" to of(4, 3, 1, 0, -1, 0, 1, 2, 3, 3),
            "Muziek" to of(4, 3, 1, 0, -1, -1, 0, 2, 3, 4),
            "Pop" to of(-1, 1, 3, 4, 3, 0, -1, -1, 1, 2),
            "Rock" to of(5, 4, 2, -1, -2, -1, 2, 3, 4, 4),
            "Nacht (zacht)" to of(-6, -5, -3, -1, 0, 1, 2, 2, 1, 0),
            "Hoge tonen" to of(0, 0, 0, 0, 0, 1, 2, 4, 5, 6),
        )

        private fun of(vararg db: Int) = EqProfile(db.map { it.toFloat() })

        fun fromJson(json: JSONObject): EqProfile {
            val arr = json.getJSONArray("gains")
            val gains = FREQUENCIES.indices.map { if (it < arr.length()) arr.getDouble(it).toFloat() else 0f }
            return EqProfile(gains, json.optDouble("preamp", 0.0).toFloat())
        }
    }
}
