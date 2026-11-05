# Molenaar Design – projectnotities voor Claude

Website van **Molenaar Design** (Edwin Molenaar): websites, backend en Android-apps.
Domein: **www.molenaar-design.nl** (geactiveerd, site moet nog geüpload worden naar de hosting).
Communiceer met Edwin in het Nederlands, kort en praktisch.

## Techniek
- PHP 8.1+ met SQLite (`data/site.sqlite`, niet in git), geen build-stap. Apache met `.htaccess`.
- Pagina's: `index.php`, `portfolio.php`, `over-mij.php`, `contact.php`, `review.php`, `404.php`.
- `includes/bootstrap.php` (database, sessies, CSRF, uploads), `includes/fields.php` (alle aanpasbare
  teksten met standaardwaarden), `includes/layout.php` (menu, footer), `includes/config.php`
  (hash van het startwachtwoord, `SITE_URL`, `MAIL_FROM`), `includes/websitecheck.php`.
- Beheerpagina `beheer/`: Berichten, Teksten & foto's, Portfolio, Reviews, Reviewlinks,
  Websitecheck, Account. Bereikbaar via het slotje in de footer van de homepage.
- Lokaal draaien: `php -S localhost:8000`.

## Afspraken en keuzes van Edwin
- Kleuren: donker marineblauw (#0f1724, vlakken #273446) met accent #4563ff; tekst-accent #8197ff.
  Alles haalt WCAG AA-contrast. Lettertypes: Space Grotesk (koppen) en Inter (tekst).
- Logo: geometrische molen in een blauw vlak + "Molenaar Design" (map `logo/`, SVG en PNG).
- Toon: menselijk, niet "AI-achtig", geen marketingclichés. Site in de ik-vorm met "je";
  Instagram-post zakelijker ("Molenaar Design ontwikkelt …").
- Het e-mailadres (info@wendaro.nl) mag **nergens** op de site staan; het contactformulier mailt
  via de server en bewaart berichten in de beheerpagina.
- Overleg alleen online, eventueel via Teams. Niet op locatie.
- Hosting en domeinnaam regelt Edwin **niet** voor klanten.
- Portfolio: alleen Edgeflow (Android-app voor meldingen), Wendaro Connect (www.wendaro.nl) en
  Wanyama Photo (www.wanyama-photo.nl). Teksten daarover zijn voorlopig; niets verzinnen.
- Reviews alleen via persoonlijke reviewlinks (één keer bruikbaar) en pas zichtbaar na goedkeuring.
- Instagram (map `instagram/`): vier reclamestories en een vierkante post, met
  www.molenaar-design.nl onderaan en zonder knoppen als "DM mij" of "vraag offerte aan".
- Huisstijl (map `huisstijl/`): e-mailhandtekening en drukklaar visitekaartje (85 × 55 mm, 3 mm afloop).

## Nog te doen
- Site uploaden naar de hosting, SSL aanzetten, inloggen en een eigen wachtwoord kiezen
  (het startwachtwoord heeft Edwin in de chat gekregen; alleen de hash staat in `config.php`).
- Contactformulier testen op de echte server (PHP `mail()`, eventueel SPF instellen).
- Visitekaartje en e-mailhandtekening eventueel aanpassen naar www.molenaar-design.nl.
- Eventueel: story "nu live", belscript voor de Websitecheck, foto van Edwin op Over mij.

## Testen
Na wijzigingen: `php -l` op gewijzigde bestanden, de site lokaal openen en het inloggen,
contactformulier, reviewlink en de Websitecheck doorlopen.
