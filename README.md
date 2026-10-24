# AI Foto Studio

Een foto-app met AI die volledig **gratis** is en in je **browser** draait.
Er is geen server, account of API-sleutel nodig: de open-source modellen worden
via [Transformers.js](https://huggingface.co/docs/transformers.js) van Hugging Face
gedownload en lokaal uitgevoerd. Je foto's verlaten je apparaat niet.

## Functies

| Functie | Gratis model |
| --- | --- |
| Foto beschrijven (vertaald naar Nederlands) | `Xenova/vit-gpt2-image-captioning` + `Xenova/opus-mt-en-nl` |
| Objecten herkennen (met kaders) | `Xenova/detr-resnet-50` |
| Labels / categorie (strand, portret, eten…) | `Xenova/clip-vit-base-patch32` |
| Achtergrond verwijderen | `Xenova/modnet` |

Daarnaast: foto kiezen, slepen, plakken of met de camera maken; filters
(helderheid, contrast, verzadiging, zwart-wit, sepia, vervaging) en downloaden als PNG.

Een model wordt pas gedownload als je de functie voor het eerst gebruikt
(±25–170 MB) en daarna door de browser bewaard.

## Starten

Omdat de app een Web Worker als module gebruikt, moet hij via een webserver
geopend worden (niet door `index.html` dubbel te klikken):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Online zetten (GitHub Pages)

Ga in de repository naar **Settings → Pages**, kies *Deploy from a branch* en
selecteer de branch met deze bestanden. De app staat daarna op
`https://<gebruikersnaam>.github.io/<repository>/`. De camera werkt alleen via
HTTPS of `localhost`.

## Bestanden

- `index.html` – pagina-opbouw
- `style.css` – opmaak (licht en donker thema)
- `app.js` – foto laden, camera, filters, tekenen en downloaden
- `worker.js` – laadt en draait de AI-modellen buiten de hoofdthread

---

# Soundbar EQ (Android-app)

In de map [`android/`](android/) staat een Android-app met een **10-bands equalizer
die al het geluid van je telefoon realtime aanpast** (Spotify, YouTube, Netflix,
games…). Hij werkt met **elke soundbar of speaker**, ongeacht het merk: Bluetooth,
HDMI (ARC/eARC) of USB. Het geluid wordt namelijk op de telefoon aangepast voordat
het naar de soundbar gaat.

## Installeren

1. Open op je Android-telefoon (Android 9 of nieuwer) de pagina **Releases** van
   deze repository en download `SoundbarEQ.apk` bij *Soundbar EQ (nieuwste versie)*.
   (Ook te vinden onder **Actions › Android app** als artifact.)
2. Open het bestand en sta *installeren uit onbekende bronnen* toe als daarom gevraagd wordt.
3. Open **Soundbar EQ**, sta meldingen toe en zet **Equalizer aan**.

## Functies

- 10 banden van 32 Hz tot 16 kHz (±12 dB), versterking en een begrenzer tegen vervorming.
- Voorinstellingen (Bas boost, Dialoog, Film, Muziek, Pop, Rock, Nacht, Hoge tonen)
  en je eigen instellingen opslaan.
- **Elke soundbar onthoudt zijn eigen instellingen**: zodra hij verbindt, worden die
  automatisch geladen.
- Blijft op de achtergrond werken (melding met knop *Uitzetten*) en start na een
  herstart van de telefoon weer op als hij aan stond.

## Hoe het werkt

De app gebruikt Android's `DynamicsProcessing`-effect op de gezamenlijke audio-uitvoer,
dus de aanpassing gebeurt live, zonder merkbare vertraging. Sommige telefoons staan dat
niet toe; dan koppelt de app zich aan elke app die zijn geluid aanmeldt (Spotify,
YouTube Music, VLC en andere). De app toont welke modus actief is.

Een gewone Bluetooth-soundbar heeft geen standaardmanier waarop een app zijn ingebouwde
equalizer kan bedienen. Daarom werkt deze app via de telefoon. Een iPhone staat geen
systeembrede equalizer toe; de app is daarom alleen voor Android.

Bouwen: `cd android && ./gradlew assembleRelease` (met Android SDK), of automatisch
via GitHub Actions bij elke push.

## Browserversie

De map [`soundbar-eq/`](soundbar-eq/) bevat een eenvoudigere browserversie die alleen
muziekbestanden en geluid uit een ander tabblad kan aanpassen
(`http://localhost:8000/soundbar-eq/`).
