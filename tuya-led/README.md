# LED Bediening (Tuya)

Een eigen app om je **Tuya LED-strips** (ook Smart Life, Lidl, Action/LSC, Calex,
enz.) te bedienen, **zonder cloud**: de app praat rechtstreeks via je wifi met de
strips. Te gebruiken op je telefoon, tablet of computer.

- Aan/uit, per strip of wisselen tussen meerdere strips
- Kleurenwiel en snelkeuzekleuren
- Helderheid
- Wit licht met kleurtemperatuur (warm ↔ koel) en voorinstellingen
- Scènes / effecten (Nacht, Lezen, Kleurrijk, Flitsend, …)
- Licht en donker thema, toe te voegen aan je beginscherm

## Hoe het werkt

```
telefoon (browser) ──wifi──> app.py op je computer/Raspberry Pi ──wifi──> LED-strip
```

`app.py` draait op een apparaat in je thuisnetwerk dat aan blijft staan
(een Raspberry Pi is ideaal, een gewone pc kan ook). Je telefoon opent de app
in de browser.

## 1. Installeren

Je hebt Python 3.8 of nieuwer nodig.

```bash
cd tuya-led
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 2. De sleutels van je strips ophalen (eenmalig)

Tuya-apparaten versleutelen hun verkeer met een *local key*. Die haal je één keer
op via een gratis Tuya-ontwikkelaarsaccount:

1. Maak een account op <https://iot.tuya.com> (kies regio **Central Europe**).
2. Ga naar **Cloud → Development → Create Cloud Project**
   (Industry: *Smart Home*, Data Center: *Central Europe*).
3. Open het project → **Devices → Link App Account → Add App Account** en scan
   de QR-code met de **Smart Life** of **Tuya Smart**-app (Ik → scanicoon
   rechtsboven). Je strips verschijnen nu in de lijst.
4. Noteer op het tabblad **Overview** de *Access ID* en *Access Secret*.
5. Start in de map `tuya-led` de wizard en vul die gegevens in:

   ```bash
   python -m tinytuya wizard
   ```

   Beantwoord de vraag om je netwerk te scannen met **Y**. De wizard maakt
   `devices.json` en `snapshot.json` aan; de app leest die direct in en toont
   alleen de verlichting.

> De sleutel verandert als je een strip opnieuw koppelt in de Smart Life-app.
> Draai dan de wizard nog een keer.

### Liever handmatig?

Maak zelf `devices.json` aan (zie `devices.example.json`):

```json
[
  { "name": "Woonkamer", "id": "bf12…", "ip": "192.168.1.50", "key": "a1b2…", "version": 3.3 }
]
```

`version` is de protocolversie (meestal 3.3, nieuwere strips 3.4 of 3.5).
Laat je `ip` weg, dan zoekt de app de strip zelf op het netwerk (iets trager).
Geef je strips in je router bij voorkeur een vast IP-adres.

## 3. Starten

```bash
python app.py
```

Open op je telefoon `http://<ip-van-de-computer>:5000`, bijvoorbeeld
`http://192.168.1.10:5000`. Tip: kies in de browser **Toevoegen aan
beginscherm**, dan staat de app tussen je andere apps.

Andere poort? `PORT=8080 python app.py`

### Automatisch starten op een Raspberry Pi

```bash
sudo tee /etc/systemd/system/led.service >/dev/null <<EOT
[Unit]
Description=LED Bediening
After=network-online.target

[Service]
WorkingDirectory=$PWD
ExecStart=$PWD/.venv/bin/python app.py
Restart=always
User=$USER

[Install]
WantedBy=multi-user.target
EOT
sudo systemctl enable --now led
```

## Problemen oplossen

| Melding | Oplossing |
| --- | --- |
| *Niet bereikbaar* / timeout | Klopt het IP-adres? Staan telefoon, server en strip op hetzelfde netwerk (niet het gastnetwerk)? |
| *Check device key or version* | Verkeerde `key` of `version`. Draai de wizard opnieuw of probeer 3.4 / 3.5. |
| Strip reageert soms niet | Sluit de Smart Life-app: sommige strips accepteren maar één lokale verbinding tegelijk. |
| Scènes doen niets | Niet elke strip heeft dezelfde ingebouwde effecten; dat verschilt per model. |

## Veiligheid

`devices.json` bevat de sleutels van je apparaten en staat daarom in
`.gitignore`. De app heeft geen wachtwoord: zet hem alleen open in je eigen
thuisnetwerk, niet op internet.

## Bestanden

- `app.py` – server die de strips bedient (Flask + [tinytuya](https://github.com/jasonacox/tinytuya))
- `static/` – de app zelf (HTML, CSS, JavaScript)
- `devices.example.json` – voorbeeld van de configuratie
