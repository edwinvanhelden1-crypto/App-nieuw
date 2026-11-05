# Molenaar Design – website

Website van Molenaar Design (Edwin Molenaar), te vinden op molenaar-design.nl:
websites, backend en Android-apps. Gebouwd in PHP
met een SQLite-database, zodat alles via een beheerpagina aan te passen is.

## Pagina's

- `index.php` – home met diensten, recent werk, reviews, werkwijze en samenwerken
- `portfolio.php` – alle projecten; projecten met een link zijn aanklikbaar
- `over-mij.php` – introductie, afspraken en technieken
- `contact.php` – contactformulier en veelgestelde vragen. Berichten worden door de server naar het
  ingestelde e-mailadres gemaild en ook bewaard in de beheerpagina; het adres staat nergens op de site
- `review.php` – formulier voor klanten, alleen bereikbaar via een persoonlijke reviewlink
- `beheer/` – beheerpagina met wachtwoord (bereikbaar via het slotje in de footer van de homepage, `noindex`)

## Beheerpagina

Ga naar `/beheer/`. Daar pas je aan:

- **Berichten**: alles wat via het contactformulier binnenkomt, met een knop om te antwoorden.

- **Teksten & foto's**: alle teksten en afbeeldingen per pagina-onderdeel,
  het e-mailadres en het label "Beschikbaar voor nieuwe projecten".
- **Portfolio**: projecten toevoegen, wijzigen, verwijderen, een afbeelding
  uploaden, een website-link invullen en kiezen of ze op de homepage staan.
- **Reviews**: nieuwe reviews goedkeuren, verbergen of verwijderen. Alleen
  goedgekeurde reviews staan op de homepage. Zonder goedgekeurde reviews is
  de reviewsectie verborgen.
- **Reviewlinks**: per klant een link maken die één keer werkt. Kopieer de link
  en stuur hem zelf op (mail, WhatsApp). De link staat nergens op de site.
- **Websitecheck**: plak tot 25 websites van bedrijven (bijvoorbeeld uit Google Maps). De server
  controleert ze op tekenen van veroudering: geen https, niet geschikt voor mobiel, oud
  copyright-jaartal, verouderde techniek of software, traag, geen beschrijving voor Google, of
  helemaal niet bereikbaar. Elke site krijgt een score van 0 tot 10 en per probleem een zin die je
  in een gesprek kunt gebruiken. Per bedrijf houd je een status en notitie bij, en je kunt de lijst
  exporteren naar Excel. Interne adressen worden geweigerd. Let op: reclame mailen naar bedrijven
  zonder toestemming mag niet zomaar (bij eenmanszaken nooit); bel ze liever of gebruik hun
  eigen contactformulier.
- **Account**: wachtwoord wijzigen.

## Online zetten op www.molenaar-design.nl

1. **Hosting met PHP 8.1 of nieuwer** en de extensie `pdo_sqlite` (standaard bij bijna
   alle hostingpartijen, zoals TransIP, Hostinger, Strato of Vimexx).
2. **Domein koppelen:** zorg dat molenaar-design.nl en www.molenaar-design.nl naar je
   hosting wijzen. Heb je domein en hosting bij dezelfde partij, dan gaat dit vanzelf.
3. **SSL aanzetten:** zet in het hostingpaneel het gratis SSL-certificaat (Let's Encrypt)
   aan voor beide adressen. De site stuurt bezoekers daarna automatisch door naar
   `https://www.molenaar-design.nl`.
4. **Uploaden:** pak `molenaar-design-website.zip` uit en upload de inhoud naar de webmap
   (vaak `public_html` of `www`), inclusief de verborgen `.htaccess`-bestanden.
5. **Schrijfrechten:** zorg dat de mappen `data/` en `uploads/` schrijfbaar zijn voor PHP.
6. **Inloggen:** via het slotje rechtsonder op de homepage, of op
   `https://www.molenaar-design.nl/beheer/`, met het startwachtwoord. Kies daarna bij
   Account meteen een eigen wachtwoord.
7. **Testen:** stuur jezelf een bericht via het contactformulier. Het gaat naar
   info@wendaro.nl, met afzender noreply@molenaar-design.nl. Komt het niet aan of
   belandt het in de spam, vraag je hostingpartij dan om mail vanaf je domein toe te
   staan (SPF). Berichten staan altijd ook bij Berichten in de beheerpagina.
8. **Google:** meld de site aan bij Google Search Console en voeg de sitemap toe:
   `https://www.molenaar-design.nl/sitemap.xml`.

Het vaste adres van de site en de afzender van de mail staan in `includes/config.php`.

De `.htaccess`-bestanden blokkeren de database en de PHP-onderdelen op Apache-
hosting. Gebruik je nginx, blokkeer dan zelf de mappen `data/` en `includes/`,
zet PHP uit in `uploads/` en stel de doorverwijzing naar https://www. zelf in.

## Lokaal bekijken

```bash
php -S localhost:8000
# open http://localhost:8000 en http://localhost:8000/beheer/
```

De database (`data/site.sqlite`) en geüploade afbeeldingen (`uploads/`) worden
niet in git opgeslagen. Maak er op de server zelf back-ups van.

## Bestanden

- `includes/fields.php` – alle aanpasbare teksten en afbeeldingen met hun standaardwaarde
- `includes/bootstrap.php` – database, sessies, beveiliging en uploads
- `includes/layout.php` – menu, footer en herbruikbare onderdelen
- `style.css`, `script.js`, `img/` – opmaak, menu/formulier-script en illustraties
- `logo/` – logo van Molenaar Design als SVG en PNG (donkere en lichte achtergrond, liggend, staand en los beeldmerk)
- `screenshots/` – screenshots van de site en de beheerpagina (met testreviews)

## Instagram

In `instagram/` staan vier reclamestories (1080 × 1920):

- `story-01-reclame-website.png` – "Tijd voor een nieuwe website?"
- `story-02-reclame-app.png` – "Een eigen app voor je bedrijf?"
- `story-03-reclame-waarom.png` – "Eén aanspreekpunt, van idee tot online."
- `story-04-vraag-website.png` – "Is je website een beetje verouderd?" met de keuzes opfrisbeurt,
  compleet nieuwe website of nieuw met backend

Tekst en logo staan binnen de veilige zone, zodat de knoppen van Instagram niets afdekken.

Daarnaast staat er een vierkante post (1080 × 1080) met alle info: `post-vierkant-alle-info.png`.

## Huisstijl

In `huisstijl/` staan:

- `email-handtekening.html` – open in je browser, selecteer alles, kopieer en plak in
  de handtekening-instellingen van Gmail of Outlook. Het logo wordt geladen van
  molenaar-design.nl en is zichtbaar zodra de site online staat.
- `visitekaartje-drukklaar.pdf` – voor- en achterkant, 85 × 55 mm met 3 mm afloop,
  lettertypes ingesloten. Geschikt voor drukkerijen zoals Drukwerkdeal of Vistaprint.
- `visitekaartje-voorkant.png` / `-achterkant.png` – voorbeelden op ware grootte (300 dpi).
