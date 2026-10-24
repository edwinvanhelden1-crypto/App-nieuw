package nl.ledbediening.tuya

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.zip.CRC32
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/** De versleuteling die het Tuya LAN-protocol gebruikt. */
internal object Crypto {
    private val random = SecureRandom()

    fun randomBytes(n: Int) = ByteArray(n).also { random.nextBytes(it) }

    fun ecbEncrypt(key: ByteArray, data: ByteArray, pad: Boolean = true): ByteArray {
        val cipher = Cipher.getInstance("AES/ECB/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"))
        return cipher.doFinal(if (pad) pkcs7Pad(data) else data)
    }

    fun ecbDecrypt(key: ByteArray, data: ByteArray): ByteArray {
        require(data.isNotEmpty() && data.size % 16 == 0) { "Ongeldige versleutelde gegevens" }
        val cipher = Cipher.getInstance("AES/ECB/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"))
        return pkcs7Unpad(cipher.doFinal(data))
    }

    /** Geeft versleutelde tekst + 16 bytes tag terug. */
    fun gcmEncrypt(key: ByteArray, iv: ByteArray, aad: ByteArray?, plain: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
        if (aad != null) cipher.updateAAD(aad)
        return cipher.doFinal(plain)
    }

    fun gcmDecrypt(key: ByteArray, iv: ByteArray, aad: ByteArray?, cipherAndTag: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
        if (aad != null) cipher.updateAAD(aad)
        return cipher.doFinal(cipherAndTag)
    }

    fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }

    fun sha256Hex(data: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(data).toHex()

    fun md5(data: ByteArray): ByteArray = MessageDigest.getInstance("MD5").digest(data)

    fun crc32(data: ByteArray, len: Int = data.size): Long =
        CRC32().apply { update(data, 0, len) }.value

    private fun pkcs7Pad(data: ByteArray): ByteArray {
        val n = 16 - data.size % 16
        return data + ByteArray(n) { n.toByte() }
    }

    /** Verwijdert opvulling; laat de gegevens ongemoeid als die niet geldig is (zoals tinytuya). */
    private fun pkcs7Unpad(data: ByteArray): ByteArray {
        if (data.isEmpty()) return data
        val n = data.last().toInt() and 0xff
        if (n !in 1..16 || n > data.size) return data
        for (i in data.size - n until data.size) if ((data[i].toInt() and 0xff) != n) return data
        return data.copyOfRange(0, data.size - n)
    }
}

internal fun ByteArray.toHex(upper: Boolean = false): String {
    val digits = if (upper) "0123456789ABCDEF" else "0123456789abcdef"
    val sb = StringBuilder(size * 2)
    for (b in this) {
        sb.append(digits[(b.toInt() shr 4) and 0xf]).append(digits[b.toInt() and 0xf])
    }
    return sb.toString()
}

internal fun String.hexToBytes(): ByteArray {
    require(length % 2 == 0) { "Oneven aantal hex-tekens" }
    return ByteArray(length / 2) { substring(it * 2, it * 2 + 2).toInt(16).toByte() }
}
