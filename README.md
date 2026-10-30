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

## Portfoliowebsite (`website/`)

In de map `website/` staat de portfoliowebsite van Edwin Molenaar
(websites, backend en Android-apps) met vier pagina's:

- `index.html` – home met diensten, werkwijze en recent werk
- `portfolio.html` – alle projecten, te filteren op soort
- `over-mij.html` – introductie, kernwaarden en vaardigheden
- `contact.html` – contactformulier, contactgegevens en veelgestelde vragen

Open `website/index.html` of start `python3 -m http.server` in die map.
Pas het e-mailadres `info@jouwdomein.nl` aan in de HTML-bestanden en in
`website/script.js`. Foto's komen van Unsplash. Screenshots staan in
`screenshots/`; daar zijn de foto's vervangen door placeholders.
