# Edwin Molenaar – portfoliowebsite

Professionele website voor Edwin Molenaar: websites, backend en Android-apps.
Statische HTML/CSS/JS, zonder build-stap.

## Pagina's

- `index.html` – home met diensten, werkwijze en recent werk
- `portfolio.html` – alle projecten, te filteren op soort
- `over-mij.html` – introductie, kernwaarden en vaardigheden
- `contact.html` – contactformulier, contactgegevens en veelgestelde vragen

`style.css` bevat de opmaak; alle kleuren staan als variabelen bovenaan.
`script.js` regelt het mobiele menu, de portfoliofilter en het contactformulier.

## Bekijken

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Aanpassen

- Vervang `info@jouwdomein.nl` in de HTML-bestanden en in `script.js`.
- Foto's komen van [Unsplash](https://unsplash.com).
- Screenshots staan in `screenshots/` (foto's daarin zijn placeholders).

## Online zetten (GitHub Pages)

Ga in de repository naar **Settings → Pages**, kies *Deploy from a branch* en
selecteer deze branch met map `/ (root)`.
