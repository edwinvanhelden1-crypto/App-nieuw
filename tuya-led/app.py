"""LED Bediening: bedien Tuya LED-strips lokaal via je eigen netwerk.

Start met:  python app.py   en open http://<ip-van-deze-computer>:5000
"""

import colorsys
import json
import os
import threading

import tinytuya
from flask import Flask, jsonify, request, send_from_directory

HERE = os.path.dirname(os.path.abspath(__file__))
DEVICES_FILE = os.path.join(HERE, "devices.json")
SNAPSHOT_FILE = os.path.join(HERE, "snapshot.json")

# Tuya-categorieën voor verlichting (dj = lamp, dd = ledstrip, ...)
LIGHT_CATEGORIES = {"dj", "dd", "dc", "fwd", "xdd", "fsd", "tgq", "tyndj"}

# Standaardscènes van de Tuya-app voor strips met DP 20-28 ("Type B").
# Opbouw: scènenummer + per stap snelheid, wachttijd, modus (00 vast, 01 springen,
# 02 ademen), kleur (HSV) en wit (helderheid, temperatuur).
SCENES_B = [
    ("Nacht", "000e0d0000000000000000c80000"),
    ("Lezen", "010e0d0000000000000003e801f4"),
    ("Werken", "020e0d0000000000000003e803e8"),
    ("Ontspannen", "030e0d0000000000000001f401f4"),
    ("Zacht", "04464602007803e803e800000000464602007803e8000a00000000"),
    ("Kleurrijk", "05464601000003e803e800000000464601007803e803e80000000046460100f003e803e800000000"
                  "464601003d03e803e80000000046460100ae03e803e800000000464601011303e803e800000000"),
    ("Flitsend", "06464601000003e803e800000000464601007803e803e80000000046460100f003e803e800000000"),
    ("Prachtig", "07464602000003e803e800000000464602007803e803e80000000046460200f003e803e800000000"
                 "464602003d03e803e80000000046460200ae03e803e800000000464602011303e803e800000000"),
]
SCENES_A = [("Scène 1", 1), ("Scène 2", 2), ("Scène 3", 3), ("Scène 4", 4)]

app = Flask(__name__, static_folder="static", static_url_path="")


def _read_json(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_config():
    """Leest devices.json (eigen formaat of de uitvoer van `tinytuya wizard`).

    IP-adres en protocolversie worden aangevuld uit snapshot.json als die er is.
    """
    devices = _read_json(DEVICES_FILE) or []
    snapshot = _read_json(SNAPSHOT_FILE) or {}
    found = {d.get("id"): d for d in snapshot.get("devices", [])}

    result = []
    for d in devices:
        if not d.get("id") or not d.get("key"):
            continue
        if d.get("category") and d["category"] not in LIGHT_CATEGORIES:
            continue
        snap = found.get(d["id"], {})
        result.append({
            "id": d["id"],
            "name": d.get("name") or d["id"],
            "key": d["key"],
            "ip": d.get("ip") or snap.get("ip") or "Auto",
            "version": float(d.get("version") or snap.get("ver") or 3.3),
        })
    return result


CONFIG = {d["id"]: d for d in load_config()}
_bulbs = {}
_locks = {d: threading.Lock() for d in CONFIG}


def bulb(dev_id):
    if dev_id not in _bulbs:
        cfg = CONFIG[dev_id]
        b = tinytuya.BulbDevice(cfg["id"], cfg["ip"], cfg["key"], version=cfg["version"])
        b.set_socketTimeout(3)
        b.set_socketRetryLimit(1)
        _bulbs[dev_id] = b
    return _bulbs[dev_id]


def read_state(b):
    state = b.state()
    if not state or "Error" in state:
        raise RuntimeError((state or {}).get("Error", "Geen antwoord van apparaat"))
    mode = b.get_mode(state=state)
    brightness = b.get_brightness_percentage(state=state) or 0
    colour = "#ffffff"
    if state.get("colour"):
        h, s, v = b.colour_hsv(state=state)
        # De kleur zelf altijd op vol licht tonen; de helderheid zit in V.
        colour = "#%02x%02x%02x" % tuple(round(c * 255) for c in colorsys.hsv_to_rgb(h, s, 1))
        if mode == "colour":
            brightness = v * 100
    scenes = SCENES_B if b.bulb_type == "B" else SCENES_A
    return {
        "online": True,
        "on": bool(state.get("is_on")),
        "mode": mode,
        "brightness": max(1, round(brightness)),
        "colourtemp": round(b.get_colourtemp_percentage(state=state) or 0),
        "colour": colour,
        "scenes": [name for name, _ in scenes] if b.bulb_has_capability("scene") else [],
    }


def check(result):
    """tinytuya geeft fouten terug als dict met 'Error' in plaats van een exceptie."""
    if isinstance(result, dict) and "Error" in result:
        raise RuntimeError(result["Error"])


def apply(b, data):
    if "on" in data:
        check(b.turn_on() if data["on"] else b.turn_off())
    if "colour" in data:
        h = data["colour"].lstrip("#")
        check(b.set_colour(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)))
    if "white" in data:
        w = data["white"]
        check(b.set_white_percentage(int(w.get("brightness", 100)), int(w.get("colourtemp", 50))))
    if "brightness" in data:
        check(b.set_brightness_percentage(max(1, min(100, int(data["brightness"])))))
    if "colourtemp" in data:
        check(b.set_colourtemp_percentage(max(0, min(100, int(data["colourtemp"])))))
    if "scene" in data:
        idx = int(data["scene"])
        if b.bulb_type == "B":
            check(b.set_multiple_values({b.dpset["mode"]: "scene", b.dpset["scene"]: SCENES_B[idx][1]}))
        else:
            check(b.set_scene(SCENES_A[idx][1]))


def error(dev_id, exc, code=502):
    _bulbs.pop(dev_id, None)  # volgende keer opnieuw verbinden
    return jsonify({"online": False, "error": str(exc)}), code


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/devices")
def devices():
    return jsonify([{"id": d["id"], "name": d["name"]} for d in CONFIG.values()])


@app.get("/api/devices/<dev_id>")
def get_device(dev_id):
    if dev_id not in CONFIG:
        return jsonify({"error": "Onbekend apparaat"}), 404
    with _locks[dev_id]:
        try:
            return jsonify(read_state(bulb(dev_id)))
        except Exception as exc:
            return error(dev_id, exc)


@app.post("/api/devices/<dev_id>")
def set_device(dev_id):
    if dev_id not in CONFIG:
        return jsonify({"error": "Onbekend apparaat"}), 404
    data = request.get_json(silent=True) or {}
    with _locks[dev_id]:
        try:
            apply(bulb(dev_id), data)
            return jsonify({"ok": True})
        except (ValueError, IndexError, KeyError) as exc:
            return error(dev_id, exc, 400)
        except Exception as exc:
            return error(dev_id, exc)


if __name__ == "__main__":
    if not CONFIG:
        print("Geen apparaten gevonden. Maak devices.json aan (zie README.md).")
    else:
        for d in CONFIG.values():
            print(f"  {d['name']:<20} {d['ip']:<15} v{d['version']}")
    port = int(os.environ.get("PORT", 5000))
    print(f"\nOpen http://<ip-van-deze-computer>:{port} op je telefoon.")
    app.run(host="0.0.0.0", port=port, threaded=True)
