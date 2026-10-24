package nl.ledbediening.tuya

import java.io.Closeable

/**
 * Een lamp die de app kan aansturen. Waarden gaan als Tuya-datapunten ([Dp]); andere merken
 * (zoals IKEA DIRIGERA) vertalen die zelf, zodat thema's, reeksen en feest overal werken.
 */
interface LightDevice : Closeable {
    /** Laatst bekende waarden, als Tuya-datapunten. */
    val dps: Map<String, Any?>

    /** Wordt aangeroepen als de lamp nieuwe waarden meldt. */
    var onDps: ((Map<String, Any?>) -> Unit)?

    val isConnected: Boolean

    /** Minimale tijd tussen twee opdrachten (sommige lampen kunnen niet sneller). */
    val minIntervalMs: Long get() = 0

    fun status(): Map<String, Any?>

    fun set(values: Map<String, Any?>, waitAck: Boolean = true)

    fun heartbeat()
}
