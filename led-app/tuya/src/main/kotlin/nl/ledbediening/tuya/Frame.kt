package nl.ledbediening.tuya

import java.io.EOFException
import java.io.InputStream
import java.nio.ByteBuffer

/** Commando's van het Tuya LAN-protocol. */
object Cmd {
    const val SESS_KEY_NEG_START = 3
    const val SESS_KEY_NEG_RESP = 4
    const val SESS_KEY_NEG_FINISH = 5
    const val CONTROL = 7
    const val STATUS = 8
    const val HEART_BEAT = 9
    const val DP_QUERY = 10
    const val CONTROL_NEW = 13
    const val DP_QUERY_NEW = 16
    const val REQ_DEVINFO = 0x25

    /** Commando's waarbij geen "3.x"-kop voor de inhoud staat. */
    val NO_HEADER = setOf(DP_QUERY, DP_QUERY_NEW, 18, HEART_BEAT, SESS_KEY_NEG_START, SESS_KEY_NEG_RESP, SESS_KEY_NEG_FINISH, 0x40)
}

/** Eén ontvangen bericht. [payload] is al ontdaan van CRC/HMAC, en bij 6699-berichten ontsleuteld. */
class Frame(val seq: Int, val cmd: Int, val retcode: Int?, val payload: ByteArray)

class TuyaException(message: String, cause: Throwable? = null) : Exception(message, cause)

/** In- en uitpakken van de twee berichtformaten: 0x55AA (3.1–3.4) en 0x6699 (3.5). */
internal object FrameCodec {
    const val PREFIX_55AA = 0x000055AA
    const val SUFFIX_55AA = 0x0000AA55
    const val PREFIX_6699 = 0x00006699
    const val SUFFIX_6699 = 0x00009966
    private const val MAX_LEN = 4096

    /** 55AA-bericht. Met [hmacKey] een HMAC-SHA256 (3.4), anders CRC32 (3.1–3.3). */
    fun pack55aa(seq: Int, cmd: Int, payload: ByteArray, hmacKey: ByteArray?): ByteArray {
        val endLen = if (hmacKey != null) 32 + 4 else 4 + 4
        val buf = ByteBuffer.allocate(16 + payload.size + endLen)
        buf.putInt(PREFIX_55AA).putInt(seq).putInt(cmd).putInt(payload.size + endLen).put(payload)
        val signed = buf.array().copyOfRange(0, 16 + payload.size)
        if (hmacKey != null) buf.put(Crypto.hmacSha256(hmacKey, signed)) else buf.putInt(Crypto.crc32(signed).toInt())
        buf.putInt(SUFFIX_55AA)
        return buf.array()
    }

    /** 6699-bericht (3.5): AES-GCM met de kop als extra geauthenticeerde gegevens. */
    fun pack6699(seq: Int, cmd: Int, payload: ByteArray, key: ByteArray, iv: ByteArray = Crypto.randomBytes(12)): ByteArray {
        val header = ByteBuffer.allocate(18)
            .putInt(PREFIX_6699).putShort(0).putInt(seq).putInt(cmd).putInt(12 + payload.size + 16)
            .array()
        val enc = Crypto.gcmEncrypt(key, iv, header.copyOfRange(4, 18), payload)
        return header + iv + enc + ByteBuffer.allocate(4).putInt(SUFFIX_6699).array()
    }

    /** Leest één bericht uit de stroom. [key] is nodig voor HMAC (3.4) en 6699 (3.5). */
    fun read(input: InputStream, key: ByteArray?, hmac: Boolean): Frame {
        // Synchroniseer op het begin van een bericht.
        var prefix = readInt(input)
        while (prefix != PREFIX_55AA && prefix != PREFIX_6699) {
            prefix = (prefix shl 8) or readByte(input)
        }
        return if (prefix == PREFIX_55AA) read55aa(input, key, hmac) else read6699(input, key)
    }

    fun decode(data: ByteArray, key: ByteArray?, hmac: Boolean): Frame =
        read(data.inputStream(), key, hmac)

    private fun read55aa(input: InputStream, key: ByteArray?, hmac: Boolean): Frame {
        val head = readFully(input, 12)
        val hb = ByteBuffer.wrap(head)
        val seq = hb.int
        val cmd = hb.int
        val len = hb.int
        if (len < 8 || len > MAX_LEN) throw TuyaException("Ongeldige berichtlengte $len")
        val rest = readFully(input, len)
        val endLen = if (hmac) 36 else 8
        if (len < endLen) throw TuyaException("Bericht te kort")
        // CRC/HMAC worden net als in tinytuya niet afgedwongen: een verkeerde sleutel
        // blijkt vanzelf bij het ontsleutelen.
        val body = rest.copyOfRange(0, len - endLen)
        val (retcode, payload) = splitRetcode(body)
        return Frame(seq, cmd, retcode, payload)
    }

    private fun read6699(input: InputStream, key: ByteArray?): Frame {
        val head = readFully(input, 14)
        val hb = ByteBuffer.wrap(head)
        hb.short
        val seq = hb.int
        val cmd = hb.int
        val len = hb.int
        if (len < 28 || len > MAX_LEN) throw TuyaException("Ongeldige berichtlengte $len")
        val rest = readFully(input, len + 4)
        val k = key ?: throw TuyaException("Sleutel nodig")
        val plain = try {
            Crypto.gcmDecrypt(k, rest.copyOfRange(0, 12), head, rest.copyOfRange(12, len))
        } catch (e: Exception) {
            throw TuyaException("Ontsleutelen mislukt: verkeerde sleutel of versie", e)
        }
        val (retcode, payload) = splitRetcode(plain)
        return Frame(seq, cmd, retcode, payload)
    }

    /**
     * Berichten van een apparaat beginnen meestal met een 4-byte returncode.
     * Die herkennen we aan een kleine waarde; gewone inhoud begint met "{", "3.x" of
     * versleutelde (willekeurige) bytes.
     */
    private fun splitRetcode(body: ByteArray): Pair<Int?, ByteArray> {
        if (body.size >= 4) {
            val code = ByteBuffer.wrap(body, 0, 4).int
            if (code in 0..255) return code to body.copyOfRange(4, body.size)
        }
        return null to body
    }

    private fun readByte(input: InputStream): Int {
        val b = input.read()
        if (b < 0) throw EOFException("Verbinding gesloten door apparaat")
        return b
    }

    private fun readInt(input: InputStream): Int = ByteBuffer.wrap(readFully(input, 4)).int

    private fun readFully(input: InputStream, n: Int): ByteArray {
        val out = ByteArray(n)
        var off = 0
        while (off < n) {
            val r = input.read(out, off, n - off)
            if (r < 0) throw EOFException("Verbinding gesloten door apparaat")
            off += r
        }
        return out
    }
}
