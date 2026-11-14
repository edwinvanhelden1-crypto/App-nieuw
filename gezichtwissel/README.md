# Gezichtwissel – gratis face swap

Een gratis face-swap-app die volledig in je browser draait. Geen account, geen
abonnement, geen watermerk, geen server: je foto's en video's verlaten je apparaat niet.

## Functies

**Gezichten**
- Gezicht toevoegen via een foto of een selfie met de camera.
- Groepsfoto? Je kiest welke gezichten je bewaart.
- Bibliotheek met meerdere gezichten (naam wijzigen, verwijderen, één "actief" gezicht).
- Waarschuwing als het hoofd te veel gedraaid is.

**Foto**
- Foto kiezen, slepen, plakken (Ctrl+V) of met de camera maken.
- Alle gezichten worden herkend; per persoon kies je welk gezicht erop komt.
- "Onderling wisselen": de mensen in de foto ruilen van gezicht.
- Vergelijken (ingedrukt houden toont het origineel).
- Downloaden (JPEG), delen (op telefoon), opslaan als sjabloon om later te hergebruiken.

**Video**
- Video kiezen (mp4/webm/mov) of een opgeslagen sjabloon.
- Live voorbeeld tijdens het afspelen, met tracking en gladstrijken tegen trillen.
- 1, tot 2 of tot 4 gezichten tegelijk.
- "Video maken": exporteert met het originele geluid (mp4 of webm, afhankelijk van de browser).

**Live**
- Realtime face swap met de camera (voor- en achtercamera).
- Foto maken en video opnemen, optioneel met microfoon.

**Instellingen** (per onderdeel bewaard)
- Sterkte, huidskleur & licht aanpassen, contrast aanpassen, zachte rand, gezichtsvorm van het nieuwe gezicht.
- Expressie volgen: knippert het origineel of praat/lacht het met open mond, dan blijven die ogen/mond zichtbaar.
- Ogen en/of mond van het nieuwe gezicht, of van het origineel (behoudt blik, praten en lachen).
- Label "AI-bewerkt" op downloads (standaard aan).

Verder: installeerbaar als app (PWA), werkt offline na het eerste gebruik, licht en donker thema.

## Hoe het werkt

1. **Herkennen**: [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
   (gratis, Apache 2.0) vindt 478 punten per gezicht. Het model (±4 MB) wordt één keer gedownload.
2. **Vervormen**: het brongezicht wordt via de 852 driehoeken van het gezichtsnet met WebGL2 naar de positie
   en uitdrukking van het doelgezicht gewarpt. Bij een gedraaid hoofd worden weggedraaide driehoeken
   overgeslagen; kijkt de bron opzij, dan wordt de verborgen kant aangevuld met de gespiegelde zichtbare kant.
3. **Kleur**: met een genormaliseerde vervaging worden de lokale huidskleur, belichting en het contrast
   van het doel overgenomen (in halve-float-precisie waar de GPU dat ondersteunt).
4. **Overvloeien**: een vervaagd, iets ingekrompen masker zorgt voor een onzichtbare rand.

Alles draait op de GPU, dus ook video en camera gaan in realtime.

## Starten

```bash
cd gezichtwissel
python3 -m http.server 8000
# open http://localhost:8000
```

Camera en installeren als app werken alleen via HTTPS of `localhost`. Online zetten kan gratis met
GitHub Pages; de app staat dan op `https://<gebruikersnaam>.github.io/<repository>/gezichtwissel/`.

## Verantwoord gebruik

Gebruik alleen gezichten van mensen die daar toestemming voor geven. Maak er geen beelden mee om
iemand te misleiden, te kwetsen of in diskrediet te brengen, en geen intieme beelden van echte personen.

## Bestanden

- `index.html`, `style.css` – interface
- `js/app.js` – schermen: gezichten, foto, video, live
- `js/engine.js` – WebGL2-motor (warpen, kleur aanpassen, overvloeien)
- `js/mesh.js` – gezichtsnet, uitlijnen en gladstrijken
- `js/detector.js` – MediaPipe laden en gezichten zoeken
- `js/store.js` – opslag in IndexedDB (gezichten en sjablonen)
- `sw.js`, `manifest.webmanifest`, `icon.svg` – installeerbare app en offline gebruik
