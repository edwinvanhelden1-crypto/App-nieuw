# Edwin Molenaar – portfoliowebsite

Website van Edwin Molenaar: websites, backend en Android-apps. Gebouwd in PHP
met een SQLite-database, zodat alles via een beheerpagina aan te passen is.

## Pagina's

- `index.php` – home met diensten, recent werk, reviews, werkwijze en samenwerken
- `portfolio.php` – alle projecten; projecten met een link zijn aanklikbaar
- `over-mij.php` – introductie, afspraken en technieken
- `contact.php` – contactformulier (opent het mailprogramma) en veelgestelde vragen
- `review.php` – formulier voor klanten, alleen bereikbaar via een persoonlijke reviewlink
- `beheer/` – beheerpagina met wachtwoord (bereikbaar via het slotje in de footer van de homepage, `noindex`)

## Beheerpagina

Ga naar `/beheer/`. Daar pas je aan:

- **Teksten & foto's**: alle teksten en afbeeldingen per pagina-onderdeel,
  het e-mailadres en het label "Beschikbaar voor nieuwe projecten".
- **Portfolio**: projecten toevoegen, wijzigen, verwijderen, een afbeelding
  uploaden, een website-link invullen en kiezen of ze op de homepage staan.
- **Reviews**: nieuwe reviews goedkeuren, verbergen of verwijderen. Alleen
  goedgekeurde reviews staan op de homepage. Zonder goedgekeurde reviews is
  de reviewsectie verborgen.
- **Reviewlinks**: per klant een link maken die één keer werkt. Kopieer de link
  en stuur hem zelf op (mail, WhatsApp). De link staat nergens op de site.
- **Account**: wachtwoord wijzigen.

## Online zetten (PHP-hosting)

1. Hosting met PHP 8.1 of nieuwer en de extensie `pdo_sqlite` (standaard bij
   bijna alle hostingpartijen).
2. Upload alle bestanden naar de webmap, inclusief de verborgen `.htaccess`-bestanden.
3. Zorg dat de mappen `data/` en `uploads/` schrijfbaar zijn voor PHP.
4. Log in via het slotje rechtsonder in de footer van de homepage, of ga naar
   `https://jouwdomein.nl/beheer/`. Gebruik het startwachtwoord dat je van
   Claude hebt gekregen (in `includes/config.php` staat alleen een versleutelde
   versie). Kies daarna bij Account meteen een eigen wachtwoord; vanaf dan geldt
   alleen dat wachtwoord.
5. Vul bij Teksten & foto's → Algemeen je echte e-mailadres in.

Hernoem je de map `beheer` (bijvoorbeeld naar `beheer-k7q2`), pas dan ook de
link van het slotje aan in `includes/layout.php`.

De `.htaccess`-bestanden blokkeren de database en de PHP-onderdelen op Apache-
hosting. Gebruik je nginx, blokkeer dan zelf de mappen `data/` en `includes/`
en zet PHP uit in `uploads/`.

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
- `screenshots/` – screenshots van de site en de beheerpagina (met testreviews)
