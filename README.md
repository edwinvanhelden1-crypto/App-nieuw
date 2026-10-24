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

# Soundbar Equalizer

In de map [`soundbar-eq/`](soundbar-eq/) staat een tweede app: een 10-bands
equalizer die geluid naar je Bluetooth-soundbar stuurt.
Open hem via `http://localhost:8000/soundbar-eq/` (of `/soundbar-eq/` op GitHub Pages).

1. Koppel de soundbar in de Bluetooth-instellingen van je telefoon of computer.
2. Kies hem in de app onder **Soundbar** (Chrome, Edge en Firefox op de computer).
   Kan je browser dat niet (bijv. Safari/iPhone), dan speelt de app af via de
   uitvoer die je in je toestel hebt gekozen.
3. Kies een geluidsbron:
   - **Muziekbestanden** van je apparaat (afspeellijst), of
   - **Ander tabblad**: het geluid van bijv. Spotify, YouTube of Netflix in een ander
     browsertabblad gaat door de equalizer (Chrome/Edge op de computer).
4. Stel de 10 banden (32 Hz – 16 kHz, ±12 dB) in, of kies een voorinstelling
   (Bas boost, Dialoog, Film, Muziek, Nacht…). Eigen instellingen kun je opslaan.

Een gewone Bluetooth-soundbar heeft geen standaardmanier waarop een app zijn
ingebouwde equalizer kan bedienen. Deze app past daarom het geluid aan
vóórdat het naar de soundbar gaat. Geluid van andere apps op je telefoon
(bijv. de Spotify-app) kan een browser-app niet aanpassen.
