# AR Tekenen

> **Android-app (APK):** download de nieuwste versie bij
> [Releases → AR Tekenen – nieuwste APK](../../releases/tag/ar-tekenen-apk).
> De APK wordt automatisch gebouwd door de workflow *Android APK* (map `android/`).

Een gratis web-app (PWA) om tekeningen na te tekenen met augmented reality.
Zet je telefoon op een glas of andere verhoging boven je papier, kijk door het
scherm en trek de doorschijnende afbeelding over. Geen advertenties, geen account.

## Schermen

- **Start** – AI-tekening, AR Tekenen, Tekenen vanaf camera / galerij, Teken object, Leer tekenen, Mijn schetsen.
- **Teken objecten** – rijen per categorie met *Alles bekijken*, plus zoeken, Favorieten en Recent.
- **Leer tekenen** – elke tekening stap voor stap; de stappen kun je ook in AR volgen.
- **Tekenen (AR)** – cameraweergave met de tekening erover:
  - slepen, knijpen om te vergroten en draaien; slot om alles vast te zetten
  - doorzichtigheid, lijndikte, lijnkleur (zwart, rood, blauw, groen, wit)
  - weergave als lijn, stippel, streep of schets
  - spiegelen, 90° draaien, passend maken, raster, knipperen (om je eigen lijnen te zien)
  - zaklamp (als de telefoon het ondersteunt), scherm blijft aan
  - **Lichtbak**: wit scherm zonder camera, leg dun papier op het scherm
  - **Foto**: bewaar een foto van je tekening in *Mijn schetsen*
- **Foto voorbereiden** – eigen foto als origineel, lijnen, randen (randdetectie) of zwart-wit.
- **AI-tekening** – maakt een lijntekening van een beschrijving via de gratis
  [Pollinations](https://pollinations.ai)-dienst (internet nodig), of een eigen lettering.

## Tekeningen

Bijna 1000 ingebouwde lijntekeningen in 26 categorieën: Anime, Cartoon, Muziek,
Dieren, Vogels, Portret, Aesthetic, Anatomie, Natuur, Voorwerpen, Mensen & poses,
Architectuur, One Line, Eten & café, Voertuigen, Basis, Kawaii, Bloemen & planten,
Zee & oceaan, Mandala's, Patronen, Geometrie, Letters & woorden, Ruimte, Fantasie
en Feestdagen.

Alle tekeningen zijn vectorafbeeldingen die de app zelf opbouwt (`js/draw-*.js`):
een deel is met de hand getekend, de rest komt uit generatoren met een vaste
*seed* (mandala's, vlinders, huizen, monsters, robots, landschappen…), zodat
elke tekening altijd hetzelfde blijft. Daardoor werkt de bibliotheek ook offline.

Een nieuwe tekening toevoegen: voeg in een van de `draw-*.js`-bestanden een
`['Titel', () => svgMarkup]` toe aan een lijst. Teken in een vlak van 200×200;
gebruik `W` als vulling voor vormen die lijnen erachter moeten verbergen.

## AI-illustraties

Naast de vectortekeningen bevat de app een bibliotheek met AI-illustraties
(gedetailleerde inkt-schetsen, kleurplaten, gekleurde cartoons, anime, retro
cartoons). De onderwerpen staan in `tools/library-prompts.json`; de workflow
*Tekeningen genereren* maakt ze met de gratis Pollinations-dienst, zet ze in
`ar-tekenen/library/` en bouwt daarna een nieuwe APK. Onderwerpen toevoegen:
voeg ze toe aan het JSON-bestand en push. Lukt het genereren niet zonder
sleutel, maak dan een gratis token op pollinations.ai en zet die als secret
`POLLINATIONS_TOKEN` in de repository.

## Starten

De app gebruikt ES-modules en de camera, dus open hem via een webserver:

```bash
cd ar-tekenen
python3 -m http.server 8000
# open http://localhost:8000
```

Op een telefoon werkt de camera alleen via **https** (bijv. GitHub Pages). Via
*Toevoegen aan startscherm* installeer je hem als app; daarna werkt hij offline.
