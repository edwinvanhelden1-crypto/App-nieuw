# LED Bediening – Android-app voor Tuya LED-strips

Een eigen Android-app (APK) om je Tuya-, Smart Life- en RGBIC-ledstrips te bedienen via je
**eigen wifi**, zonder de Smart Life-app en zonder cloud.

- **Meerdere strips**: los aan/uit, kleur, helderheid en wit licht (warm ↔ koel)
- **Thema's maken**: kies je kleuren, effect, snelheid, richting en helderheid
- **Effecten**: statisch, overvloeien, springen, ademen, flitsen, stromen, regenboog, achtervolgen
- **Richting en beweging**: vooruit/achteruit, heen en weer, per segment, of verdeeld over strips
- **Reeksen**: speel thema's na elkaar af (elk zo lang als je wilt), zacht in elkaar overvloeiend, eindeloos herhalen
- **Live voorbeeld** van je thema in de app, ook zonder strips
- **Discomodus** en snelle thema's voor alle lampen tegelijk; na stoppen gaan de lampen terug naar hoe ze waren
- Blijft doorspelen met het scherm uit (melding met stopknop)

## 1. App installeren

1. Open op je telefoon de pagina **Releases** van deze repository op GitHub
   (`https://github.com/edwinvanhelden1-crypto/App-nieuw/releases`).
2. Download bij de nieuwste "LED Bediening" het bestand **LED-Bediening.apk**.
3. Open het bestand. Android vraagt of je apps uit deze bron wilt toestaan: kies
   **Instellingen → Toestaan** en daarna **Installeren**.

Een nieuwe versie installeer je op dezelfde manier; je strips en thema's blijven bewaard.

## 2. Je lampen toevoegen (eenmalig)

1. Zoek in de **Smart Life**-app je gebruikerscode op:
   **Ik → ⚙ Instellingen → Account en beveiliging → Gebruikerscode**.
2. Open LED Bediening → **Strip toevoegen** → **Smart Life**, vul de code in en tik op **Inloggen**.
3. Er verschijnt een QR-code. Scan die met de Smart Life-app (scan-icoon rechtsboven) en tik op **Bevestigen**.
   Gebruik je dezelfde telefoon? Tik op **Opslaan als foto** en kies de foto in de scanner van Smart Life.
4. Al je lampen uit al je huizen verschijnen. Vink aan wat je wilt en tik op **toevoegen en zoeken op wifi**.

Er verandert niets in je Smart Life-app: LED Bediening leest alleen welke lampen je hebt en hun
sleutels. Daarna praat de app rechtstreeks via je wifi met de lampen.

> Deze inlogmanier is dezelfde die Home Assistant gebruikt. Werkt hij ooit niet meer, dan kun je
> de sleutels nog ophalen via **Ontwikkelaar** (een gratis project op iot.tuya.com, zie hieronder) of **Handmatig**.

<details>
<summary>Alternatief: via een Tuya-ontwikkelaarsproject</summary>

1. Maak een account op **iot.tuya.com** (regio *Central Europe*).
2. **Cloud → Development → Create Cloud Project** (Smart Home, Central Europe Data Center, API-service **IoT Core**).
3. **Devices → Link App Account → Add App Account** en scan de QR-code met de Smart Life-app.
4. Kopieer bij **Overview** de Access ID en Access Secret en vul ze in bij **Strip toevoegen → Ontwikkelaar**.
</details>

### IKEA-lampen (DIRIGERA-hub)

**Strip toevoegen → IKEA**: de app zoekt de hub zelf (of vul het IP-adres in), tik op
**Koppelen** en druk binnen 90 seconden op de knop aan de onderkant van de hub. Alle
IKEA-lampen verschijnen dan naast je andere lampen en doen mee met thema's, reeksen en het
feest. IKEA-lampen lopen via de hub (Zigbee) en verwerken ongeveer 4 wijzigingen per seconde.

**Tip:** geef je strips in je router een vast IP-adres, dan blijft alles werken als de
router opnieuw opstart. Verandert het adres toch, tik dan bij de strip op
**Instellingen → Zoek op netwerk**.

## 3. Thema's en loops maken

Tabblad **Thema's** → **Nieuw thema**:

| Instelling | Wat het doet |
| --- | --- |
| Kleuren | Tik op **+** om een kleur toe te voegen, op een kleur om hem te wijzigen of te verwijderen |
| Effect | Statisch, Overvloeien, Springen, Ademen, Flitsen, Stromen, Regenboog of Achtervolgen |
| Snelheid | Van traag (1) tot snel (100) |
| Richting | Vooruit of achteruit (over de strip, of van strip naar strip) |
| Heen en weer | Kleuren gaan vooruit en daarna terug in plaats van rond |
| Zachte overgang | Kleuren vloeien in elkaar over |
| Per segment | Kleuren verdeeld over de lengte van een RGBIC-strip |
| Verdeel over strips | Het effect loopt van de ene strip naar de volgende |
| Strips | Op welke strips het thema speelt (de volgorde stel je in bij elke strip) |

Bovenaan zie je direct een bewegend voorbeeld. Met **Probeer op strips** zie je het echt.

### Op de strip of via de app?

- **Op de strip**: RGBIC-strips kunnen effecten zelf afspelen. Dat is het soepelst en
  blijft doorlopen als je telefoon uit staat.
- **Via de app**: de app berekent ±10 keer per seconde de kleur van elke strip en stuurt
  die live. Hiermee kan alles: effecten over meerdere strips, heen en weer, en
  overvloeien tussen thema's. De telefoon moet dan wel aan blijven en op hetzelfde wifi zitten.

Op **Automatisch** kiest de app per strip de beste manier.

### Reeksen

Tabblad **Reeksen** → **Nieuwe reeks**: zet thema's achter elkaar, kies per stap hoeveel
seconden hij duurt, en hoe lang thema's in elkaar overvloeien. Zet **Herhalen** aan voor
een eindeloze loop.

## Problemen oplossen

| Probleem | Oplossing |
| --- | --- |
| *Niet gevonden op het netwerk* | Staan telefoon en strips op hetzelfde wifi (niet het gastnetwerk)? Vul anders het IP-adres zelf in bij de instellingen van de strip. |
| *Verkeerde sleutel of protocolversie* | Haal de sleutels opnieuw op (stap 2.6) of kies een ander protocol (3.3 / 3.4 / 3.5) bij de instellingen. |
| Strip reageert traag of soms niet | Sluit de Smart Life-app: sommige strips accepteren maar één lokale verbinding tegelijk. |
| Smart Life: *inloggen mislukt* | Controleer de gebruikerscode (hoofdlettergevoelig) en probeer opnieuw; de QR-code is een paar minuten geldig. |
| Cloud: *geen toegang* of *not authorized* | Controleer de regio, en dat het project de API-service **IoT Core** heeft en je Smart Life-account gekoppeld is. |
| Een effect ziet er anders uit dan verwacht | Niet elke strip heeft dezelfde ingebouwde effecten. Zet *Afspelen* op **Via de app**. |
| Loop stopt als het scherm uit gaat | Sta meldingen toe voor de app en zet batterijoptimalisatie voor LED Bediening uit. |

## Voor ontwikkelaars

- `tuya/` – het Tuya LAN-protocol (3.3/3.4/3.5), zoeken op het netwerk, cloud-import,
  kleur- en RGBIC-effectcodering en de effectmotor. Puur Kotlin, getest zonder telefoon.
- `app/` – de Android-app (Jetpack Compose).
- `tools/fake_device.py` – een nagebootste strip (gebouwd op tinytuya) waartegen de tests draaien.

```bash
# protocoltests (Python met tinytuya nodig voor de verbindingstests)
FAKE_DEVICE_PYTHON=python3 ONLY_TUYA=1 ./gradlew :tuya:test
# APK bouwen (Android SDK nodig)
./gradlew :app:assembleRelease
```

GitHub Actions (`.github/workflows/led-app.yml`) draait de tests, bouwt de APK en zet
hem bij elke wijziging als release online.
