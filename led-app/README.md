# LED Bediening – Android-app voor Tuya LED-strips

Een eigen Android-app (APK) om je Tuya-, Smart Life- en RGBIC-ledstrips te bedienen via je
**eigen wifi**, zonder de Smart Life-app en zonder cloud.

- **Meerdere strips**: los aan/uit, kleur, helderheid en wit licht (warm ↔ koel)
- **Thema's maken**: kies je kleuren, effect, snelheid, richting en helderheid
- **Effecten**: statisch, overvloeien, springen, ademen, flitsen, stromen, regenboog, achtervolgen
- **Richting en beweging**: vooruit/achteruit, heen en weer, per segment, of verdeeld over strips
- **Reeksen**: speel thema's na elkaar af (elk zo lang als je wilt), zacht in elkaar overvloeiend, eindeloos herhalen
- **Live voorbeeld** van je thema in de app, ook zonder strips
- Blijft doorspelen met het scherm uit (melding met stopknop)

## 1. App installeren

1. Open op je telefoon de pagina **Releases** van deze repository op GitHub
   (`https://github.com/edwinvanhelden1-crypto/App-nieuw/releases`).
2. Download bij de nieuwste "LED Bediening" het bestand **LED-Bediening.apk**.
3. Open het bestand. Android vraagt of je apps uit deze bron wilt toestaan: kies
   **Instellingen → Toestaan** en daarna **Installeren**.

Een nieuwe versie installeer je op dezelfde manier; je strips en thema's blijven bewaard.

## 2. Je strips toevoegen (eenmalig)

Tuya-strips versleutelen hun verkeer met een eigen sleutel per apparaat. Die sleutel
haal je één keer op via een gratis Tuya-ontwikkelaarsaccount. Daarna praat de app
rechtstreeks met de strips.

1. Zorg dat je strips werken in de **Smart Life**- (of Tuya Smart-)app.
2. Maak een account op **iot.tuya.com** en kies als regio *Central Europe*.
3. Ga naar **Cloud → Development → Create Cloud Project**
   - Industry: *Smart Home*, Development Method: *Smart Home*
   - Data Center: **Central Europe Data Center**
   - Sta bij de API-services in ieder geval **IoT Core** toe.
4. Open het project → tabblad **Devices** → **Link App Account** → **Add App Account**.
   Scan de QR-code met de Smart Life-app (tabblad *Ik* → scanicoon rechtsboven).
   Je strips verschijnen nu in de lijst.
5. Kopieer op het tabblad **Overview** de **Access ID/Client ID** en **Access Secret/Client Secret**.
6. Open LED Bediening → **Strip toevoegen** → **Uit Tuya-cloud**, vul beide in, kies regio
   *Centraal-Europa* en tik op **Apparaten ophalen**.
7. Vink je strips aan en tik op **toevoegen en zoeken op wifi**. De app zoekt dan zelf
   het IP-adres en de protocolversie van elke strip.

> Koppel je een strip later opnieuw in Smart Life, dan krijgt hij een nieuwe sleutel.
> Doe dan stap 6–7 nog een keer.

Heb je de apparaat-ID en lokale sleutel al (bijvoorbeeld via `python -m tinytuya wizard`)?
Kies dan **Handmatig**.

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
