package nl.soundbar.eq

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import kotlin.math.log10

/** Draws the equalizer settings as a smooth curve over a frequency/dB grid. */
class CurveView(context: Context) : View(context) {

    var profile: EqProfile = EqProfile.FLAT
        set(value) {
            field = value
            invalidate()
        }

    private val density = resources.displayMetrics.density
    private val gridPaint = Paint().apply {
        color = context.getColor(R.color.grid)
        strokeWidth = density
    }
    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = context.getColor(R.color.muted)
        textSize = 10 * density
    }
    private val curvePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = context.getColor(R.color.accent)
        style = Paint.Style.STROKE
        strokeWidth = 3 * density
        strokeJoin = Paint.Join.ROUND
    }
    private val path = Path()

    private fun xOf(freq: Float) = (log10(freq / 20f) / 3f) * width
    private fun yOf(db: Float) = height / 2f - db / RANGE * (height / 2f - 8 * density)

    override fun onDraw(canvas: Canvas) {
        for (f in intArrayOf(50, 100, 200, 500, 1000, 2000, 5000, 10000)) {
            val x = xOf(f.toFloat())
            canvas.drawLine(x, 0f, x, height.toFloat(), gridPaint)
            canvas.drawText(if (f >= 1000) "${f / 1000}k" else "$f", x + 3 * density, height - 4 * density, labelPaint)
        }
        for (db in intArrayOf(-12, -6, 0, 6, 12)) {
            val y = yOf(db.toFloat())
            canvas.drawLine(0f, y, width.toFloat(), y, gridPaint)
            canvas.drawText(if (db > 0) "+$db dB" else "$db dB", 4 * density, y - 3 * density, labelPaint)
        }

        // Catmull-Rom style smoothing through the band points, extended flat to the edges.
        val freqs = EqProfile.FREQUENCIES
        val points = buildList {
            add(0f to yOf(profile.gains.first() + profile.preamp))
            freqs.forEachIndexed { i, f -> add(xOf(f.toFloat()) to yOf(profile.gains[i] + profile.preamp)) }
            add(width.toFloat() to yOf(profile.gains.last() + profile.preamp))
        }
        path.reset()
        path.moveTo(points[0].first, points[0].second)
        for (i in 0 until points.size - 1) {
            val p0 = points[maxOf(i - 1, 0)]
            val p1 = points[i]
            val p2 = points[i + 1]
            val p3 = points[minOf(i + 2, points.size - 1)]
            path.cubicTo(
                p1.first + (p2.first - p0.first) / 6f, p1.second + (p2.second - p0.second) / 6f,
                p2.first - (p3.first - p1.first) / 6f, p2.second - (p3.second - p1.second) / 6f,
                p2.first, p2.second,
            )
        }
        canvas.drawPath(path, curvePaint)
    }

    private companion object {
        const val RANGE = 15f
    }
}
