"""Nagebootste Tuya-ledstrip voor tests (protocol 3.3, 3.4 en 3.5).

Gebruikt de bericht- en versleutelfuncties van tinytuya, zodat de app wordt getest
tegen hetzelfde protocol dat tinytuya met echte apparaten spreekt.

    python fake_device.py --version 3.5 --port 16668
"""

import argparse
import hmac
import json
import os
import socket
import struct
import sys
import threading
import time
from hashlib import sha256

import tinytuya
from tinytuya.core import header as H
from tinytuya.core.crypto_helper import AESCipher
from tinytuya.core.message_helper import TuyaMessage, pack_message, parse_header, unpack_message

DEV_ID = "bf0123456789abcdefgh"
KEY = b"0123456789abcdef"

DPS = {
    "20": False, "21": "white", "22": 1000, "23": 500, "24": "000003e803e8",
    "25": "000e0d0000000000000000c80000", "26": 0, "51": "AQAAAAAAAABkAAAA", "53": 30,
}


class Conn:
    def __init__(self, sock, version, log, no_ack=False):
        self.no_ack = no_ack
        self.sock = sock
        self.version = version
        self.key = KEY
        self.seq = 100
        self.log = log
        self.buf = b""

    def recv_frame(self):
        data = self.buf
        while len(data) < 22:
            chunk = self.sock.recv(4096)
            if not chunk:
                return None
            data += chunk
        hdr = parse_header(data)
        while len(data) < hdr.total_length:
            chunk = self.sock.recv(4096)
            if not chunk:
                return None
            data += chunk
        self.buf = data[hdr.total_length:]
        frame = data[:hdr.total_length]
        hmac_key = self.key if self.version >= 3.4 else None
        msg = unpack_message(frame, hmac_key=hmac_key, no_retcode=True)
        if msg.prefix == H.PREFIX_55AA_VALUE and not msg.crc_good:
            raise RuntimeError("CRC/HMAC fout van client")
        if msg.prefix == H.PREFIX_6699_VALUE and not msg.crc_good:
            raise RuntimeError("GCM fout van client")
        return msg

    def decrypt(self, cmd, payload):
        if self.version == 3.3:
            if payload.startswith(b"3.3"):
                payload = payload[15:]
            return AESCipher(KEY).decrypt(payload, False, decode_text=False)
        if self.version == 3.4:
            payload = AESCipher(self.key).decrypt(payload, False, decode_text=False)
        if payload[:3] in (b"3.4", b"3.5"):
            payload = payload[15:]
        return payload

    def send(self, cmd, payload, header=False):
        self.seq += 1
        if self.version >= 3.5:
            if header:
                payload = H.PROTOCOL_35_HEADER + payload
            msg = TuyaMessage(self.seq, cmd, 0, payload, 0, True, H.PREFIX_6699_VALUE, True)
            data = pack_message(msg, hmac_key=self.key)
        elif self.version == 3.4:
            if header:
                payload = H.PROTOCOL_34_HEADER + payload
            if payload:
                payload = AESCipher(self.key).encrypt(payload, False)
            msg = TuyaMessage(self.seq, cmd, 0, struct.pack(">I", 0) + payload, 0, True, H.PREFIX_55AA_VALUE, False)
            data = pack_message(msg, hmac_key=self.key)
        else:
            if payload:
                payload = AESCipher(KEY).encrypt(payload, False)
                if header:
                    payload = H.PROTOCOL_33_HEADER + payload
            msg = TuyaMessage(self.seq, cmd, 0, struct.pack(">I", 0) + payload, 0, True, H.PREFIX_55AA_VALUE, False)
            data = pack_message(msg)
        self.sock.sendall(data)

    def run(self):
        while True:
            msg = self.recv_frame()
            if msg is None:
                return
            cmd = msg.cmd
            if cmd == 3:  # sessiesleutel stap 1
                local_nonce = msg.payload
                if self.version == 3.4:
                    local_nonce = AESCipher(KEY).decrypt(local_nonce, False, decode_text=False)
                self.local_nonce = local_nonce[:16]
                self.remote_nonce = os.urandom(16)
                resp = self.remote_nonce + hmac.new(KEY, self.local_nonce, sha256).digest()
                self.send(4, resp)
                continue
            if cmd == 5:
                p = msg.payload
                if self.version == 3.4:
                    p = AESCipher(KEY).decrypt(p, False, decode_text=False)
                if p[:32] != hmac.new(KEY, self.remote_nonce, sha256).digest():
                    raise RuntimeError("HMAC stap 3 klopt niet")
                xor = bytes(a ^ b for a, b in zip(self.local_nonce, self.remote_nonce))
                if self.version == 3.4:
                    self.key = AESCipher(KEY).encrypt(xor, False, pad=False)
                else:
                    self.key = AESCipher(KEY).encrypt(xor, use_base64=False, pad=False, iv=self.local_nonce[:12])[12:28]
                self.log("sessie", self.key.hex())
                continue
            body = self.decrypt(cmd, msg.payload) if msg.payload else b""
            if cmd in (10, 16):
                self.log("query", body.decode(errors="replace"))
                self.send(cmd, json.dumps({"devId": DEV_ID, "dps": DPS, "t": int(time.time())}).encode())
            elif cmd in (7, 13):
                j = json.loads(body)
                dps = j.get("dps") or j.get("data", {}).get("dps")
                self.log("control", json.dumps(dps, sort_keys=True))
                DPS.update(dps)
                if self.no_ack:
                    continue
                self.send(cmd, b"")
                self.send(8, json.dumps({"dps": dps, "t": int(time.time())}).encode(), header=True)
            elif cmd == 9:
                self.log("heartbeat", "")
                self.send(9, b"")
            else:
                self.log("onbekend", cmd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", type=float, default=3.3)
    ap.add_argument("--port", type=int, default=16668)
    ap.add_argument("--no-ack", action="store_true", help="bevestig opdrachten niet (zoals sommige lampen)")
    args = ap.parse_args()

    def log(*a):
        print(*a, flush=True)

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", args.port))
    srv.listen(5)
    log("klaar", args.version, args.port)
    while True:
        s, _ = srv.accept()

        def handle(s=s):
            try:
                Conn(s, args.version, log, args.no_ack).run()
            except Exception as e:  # noqa
                log("fout", repr(e))
            finally:
                s.close()
        threading.Thread(target=handle, daemon=True).start()


if __name__ == "__main__":
    main()
