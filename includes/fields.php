<?php
/**
 * Alle teksten en afbeeldingen die in de beheerpagina aan te passen zijn.
 * type: text, textarea, lines (één item per regel), paragraphs (alinea's gescheiden
 * door een lege regel), image of bool. De default is wat de site toont zolang er
 * niets is opgeslagen.
 */
const FIELD_GROUPS = [
    'algemeen' => 'Algemeen',
    'home' => 'Home: bovenaan',
    'diensten' => 'Home: diensten',
    'werkwijze' => 'Home: werkwijze',
    'samenwerken' => 'Home: samenwerken',
    'reviews' => 'Home: reviews',
    'portfolio' => 'Portfolio-pagina',
    'over' => 'Over mij',
    'contact' => 'Contact',
];

const FIELDS = [
    // Algemeen
    'contact_email' => ['group' => 'algemeen', 'label' => 'E-mailadres waar berichten van het contactformulier heen gaan (staat nergens op de site)', 'type' => 'text', 'default' => 'info@wendaro.nl'],
    'available' => ['group' => 'algemeen', 'label' => 'Label "beschikbaar" tonen', 'type' => 'bool', 'default' => '1'],
    'available_text' => ['group' => 'algemeen', 'label' => 'Tekst van het label', 'type' => 'text', 'default' => 'Beschikbaar voor nieuwe projecten'],
    'footer_text' => ['group' => 'algemeen', 'label' => 'Tekst in de footer', 'type' => 'text', 'default' => 'Webdeveloper en Android-ontwikkelaar uit Nederland.'],
    'cta_title' => ['group' => 'algemeen', 'label' => 'Blauwe balk: kop', 'type' => 'text', 'default' => 'Iets laten bouwen?'],
    'cta_text' => ['group' => 'algemeen', 'label' => 'Blauwe balk: tekst', 'type' => 'text', 'default' => 'Stuur me een bericht. Ik reageer binnen een werkdag.'],
    'page_bg' => ['group' => 'algemeen', 'label' => 'Achtergrond bovenaan elke pagina', 'type' => 'image', 'default' => 'img/achtergrond.svg'],

    // Home: bovenaan
    'hero_eyebrow' => ['group' => 'home', 'label' => 'Kleine tekst boven de kop', 'type' => 'text', 'default' => 'Webdeveloper & Android-ontwikkelaar'],
    'hero_title' => ['group' => 'home', 'label' => 'Kop (wit deel)', 'type' => 'text', 'default' => 'Ik maak websites, backends en'],
    'hero_title_accent' => ['group' => 'home', 'label' => 'Kop (blauw deel)', 'type' => 'text', 'default' => 'Android-apps.'],
    'hero_intro' => ['group' => 'home', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Ik ben Edwin Molenaar. Ik bouw websites voor ondernemers, de backend die erachter draait en Android-apps die erop aansluiten. Je hebt contact met mij, van het eerste gesprek tot na de lancering.'],
    'hero_facts' => ['group' => 'home', 'label' => 'Punten onder de knoppen (één per regel)', 'type' => 'lines', 'default' => "Reactie binnen een werkdag\nVaste prijs per project\nOverleg online, eventueel via Teams"],
    'hero_image' => ['group' => 'home', 'label' => 'Afbeelding naast de introductie', 'type' => 'image', 'default' => 'img/hero-devices.svg'],

    // Home: diensten
    'services_title' => ['group' => 'diensten', 'label' => 'Kop', 'type' => 'text', 'default' => 'Wat ik doe'],
    'services_intro' => ['group' => 'diensten', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Ik werk aan drie soorten projecten. Vaak hangen ze samen: een website met een klantomgeving, of een app die gegevens uit dezelfde database haalt.'],
    'service1_title' => ['group' => 'diensten', 'label' => 'Dienst 1: titel', 'type' => 'text', 'default' => 'Websites'],
    'service1_text' => ['group' => 'diensten', 'label' => 'Dienst 1: tekst', 'type' => 'textarea', 'default' => 'Een website die snel laadt, goed werkt op je telefoon en te vinden is in Google. Op maat gebouwd, zonder zwaar standaardthema.'],
    'service1_items' => ['group' => 'diensten', 'label' => 'Dienst 1: punten (één per regel)', 'type' => 'lines', 'default' => "Bedrijfswebsites\nWebshops\nKlantomgevingen met inlog"],
    'service1_image' => ['group' => 'diensten', 'label' => 'Dienst 1: afbeelding', 'type' => 'image', 'default' => 'img/dienst-websites.svg'],
    'service2_title' => ['group' => 'diensten', 'label' => 'Dienst 2: titel', 'type' => 'text', 'default' => "Backend & API's"],
    'service2_text' => ['group' => 'diensten', 'label' => 'Dienst 2: tekst', 'type' => 'textarea', 'default' => 'Alles wat achter de schermen gebeurt: de database, inloggen, betalingen en koppelingen met andere software.'],
    'service2_items' => ['group' => 'diensten', 'label' => 'Dienst 2: punten (één per regel)', 'type' => 'lines', 'default' => "API's voor websites en apps\nKoppelingen met boekhouding, CRM of webshop\nOnderhoud en updates"],
    'service2_image' => ['group' => 'diensten', 'label' => 'Dienst 2: afbeelding', 'type' => 'image', 'default' => 'img/dienst-backend.svg'],
    'service3_title' => ['group' => 'diensten', 'label' => 'Dienst 3: titel', 'type' => 'text', 'default' => 'Android-apps'],
    'service3_text' => ['group' => 'diensten', 'label' => 'Dienst 3: tekst', 'type' => 'textarea', 'default' => 'Apps in Kotlin voor Android. Ze werken ook zonder internet als dat nodig is, en gebruiken dezelfde backend als je website.'],
    'service3_items' => ['group' => 'diensten', 'label' => 'Dienst 3: punten (één per regel)', 'type' => 'lines', 'default' => "Pushmeldingen\nOffline werken\nPublicatie in de Play Store"],
    'service3_image' => ['group' => 'diensten', 'label' => 'Dienst 3: afbeelding', 'type' => 'image', 'default' => 'img/dienst-android.svg'],
    'tech_band' => ['group' => 'diensten', 'label' => 'Technieken in de balk (één per regel)', 'type' => 'lines', 'default' => "HTML & CSS\nJavaScript\nTypeScript\nReact\nNode.js\nPHP\nPython\nPostgreSQL\nMySQL\nKotlin\nJetpack Compose\nFirebase\nDocker\nGit"],

    // Home: werkwijze
    'process_title' => ['group' => 'werkwijze', 'label' => 'Kop', 'type' => 'text', 'default' => 'Hoe een project loopt'],
    'process_image' => ['group' => 'werkwijze', 'label' => 'Afbeelding', 'type' => 'image', 'default' => 'img/werkwijze.svg'],
    'step1_title' => ['group' => 'werkwijze', 'label' => 'Stap 1: titel', 'type' => 'text', 'default' => 'Gesprek'],
    'step1_text' => ['group' => 'werkwijze', 'label' => 'Stap 1: tekst', 'type' => 'textarea', 'default' => 'We bespreken wat je nodig hebt en wat het mag kosten. Daarna krijg je een offerte met een vaste prijs.'],
    'step2_title' => ['group' => 'werkwijze', 'label' => 'Stap 2: titel', 'type' => 'text', 'default' => 'Plan'],
    'step2_text' => ['group' => 'werkwijze', 'label' => 'Stap 2: tekst', 'type' => 'textarea', 'default' => 'Ik schets de schermen en schrijf op hoe het technisch in elkaar zit. Zo weet je vooraf wat je krijgt.'],
    'step3_title' => ['group' => 'werkwijze', 'label' => 'Stap 3: titel', 'type' => 'text', 'default' => 'Bouwen'],
    'step3_text' => ['group' => 'werkwijze', 'label' => 'Stap 3: tekst', 'type' => 'textarea', 'default' => 'Ik bouw in stappen. Tussendoor kun je meekijken en bijsturen.'],
    'step4_title' => ['group' => 'werkwijze', 'label' => 'Stap 4: titel', 'type' => 'text', 'default' => 'Online'],
    'step4_text' => ['group' => 'werkwijze', 'label' => 'Stap 4: tekst', 'type' => 'textarea', 'default' => 'Na het testen gaat het live. Daarna blijf ik beschikbaar voor updates en aanpassingen.'],

    // Home: samenwerken
    'plans_title' => ['group' => 'samenwerken', 'label' => 'Kop', 'type' => 'text', 'default' => 'Drie manieren om met mij te werken'],
    'plans_intro' => ['group' => 'samenwerken', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Kies wat bij je project past. Twijfel je? Dan kijken we er in het eerste gesprek samen naar.'],
    'plan1_title' => ['group' => 'samenwerken', 'label' => 'Vorm 1: titel', 'type' => 'text', 'default' => 'Project'],
    'plan1_sub' => ['group' => 'samenwerken', 'label' => 'Vorm 1: prijsvorm', 'type' => 'text', 'default' => 'Vaste prijs'],
    'plan1_text' => ['group' => 'samenwerken', 'label' => 'Vorm 1: tekst', 'type' => 'textarea', 'default' => 'Voor een nieuwe website, webapplicatie of app met een duidelijk doel. Je weet vooraf wat het kost en wanneer het klaar is.'],
    'plan1_items' => ['group' => 'samenwerken', 'label' => 'Vorm 1: punten (één per regel)', 'type' => 'lines', 'default' => "Offerte na een eerste gesprek\nOplevering in stappen\nNa livegang een maand nazorg"],
    'plan2_title' => ['group' => 'samenwerken', 'label' => 'Vorm 2: titel', 'type' => 'text', 'default' => 'Doorontwikkeling'],
    'plan2_sub' => ['group' => 'samenwerken', 'label' => 'Vorm 2: prijsvorm', 'type' => 'text', 'default' => 'Per uur of per maand'],
    'plan2_text' => ['group' => 'samenwerken', 'label' => 'Vorm 2: tekst', 'type' => 'textarea', 'default' => 'Voor een bestaand product dat verder moet groeien. Ik werk mee aan nieuwe functies, koppelingen en verbeteringen.'],
    'plan2_items' => ['group' => 'samenwerken', 'label' => 'Vorm 2: punten (één per regel)', 'type' => 'lines', 'default' => "Vaste uren per maand mogelijk\nKorte lijnen, direct contact\nOok voor bestaande code"],
    'plan3_title' => ['group' => 'samenwerken', 'label' => 'Vorm 3: titel', 'type' => 'text', 'default' => 'Onderhoud'],
    'plan3_sub' => ['group' => 'samenwerken', 'label' => 'Vorm 3: prijsvorm', 'type' => 'text', 'default' => 'Vast bedrag per maand'],
    'plan3_text' => ['group' => 'samenwerken', 'label' => 'Vorm 3: tekst', 'type' => 'textarea', 'default' => 'Voor websites en apps die al online staan. Ik zorg dat alles veilig blijft en blijft werken.'],
    'plan3_items' => ['group' => 'samenwerken', 'label' => 'Vorm 3: punten (één per regel)', 'type' => 'lines', 'default' => "Updates en back-ups\nHulp bij storingen\nKleine aanpassingen"],

    // Home: reviews
    'reviews_title' => ['group' => 'reviews', 'label' => 'Kop', 'type' => 'text', 'default' => 'Wat klanten zeggen'],
    'reviews_intro' => ['group' => 'reviews', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Reviews van klanten met wie ik heb samengewerkt.'],

    // Portfolio-pagina
    'portfolio_title' => ['group' => 'portfolio', 'label' => 'Kop', 'type' => 'text', 'default' => 'Projecten'],
    'portfolio_intro' => ['group' => 'portfolio', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Apps, systemen en websites die ik heb gebouwd.'],

    // Over mij
    'about_intro' => ['group' => 'over', 'label' => 'Tekst bovenaan', 'type' => 'text', 'default' => 'Wie ik ben en hoe ik werk.'],
    'about_heading' => ['group' => 'over', 'label' => 'Kop bij de introductie', 'type' => 'text', 'default' => 'Hoi, ik ben Edwin'],
    'about_lead' => ['group' => 'over', 'label' => 'Eerste alinea (groot)', 'type' => 'textarea', 'default' => 'Ik ben webdeveloper en Android-ontwikkelaar. Ik bouw websites, de backend die erachter zit en Android-apps.'],
    'about_text' => ['group' => 'over', 'label' => 'Overige alinea\'s (lege regel tussen alinea\'s)', 'type' => 'paragraphs', 'default' => "Ik doe het hele project zelf. Je hoeft dus niet apart te overleggen met een ontwerper, een programmeur en een app-bouwer. Website, database en app sluiten op elkaar aan, omdat ik ze samen bouw.\n\nIk houd van software die gewoon goed werkt en jaren meegaat."],
    'about_photo' => ['group' => 'over', 'label' => 'Foto (bijvoorbeeld van jezelf)', 'type' => 'image', 'default' => 'img/over-mij.svg'],
    'value1_title' => ['group' => 'over', 'label' => 'Afspraak 1: titel', 'type' => 'text', 'default' => 'Vaste prijs'],
    'value1_text' => ['group' => 'over', 'label' => 'Afspraak 1: tekst', 'type' => 'textarea', 'default' => 'Je weet vooraf wat het kost. Extra werk komt er alleen bij als jij dat wilt.'],
    'value2_title' => ['group' => 'over', 'label' => 'Afspraak 2: titel', 'type' => 'text', 'default' => 'Snel antwoord'],
    'value2_text' => ['group' => 'over', 'label' => 'Afspraak 2: tekst', 'type' => 'textarea', 'default' => 'Je hebt contact met mij, niet met een helpdesk. Binnen een werkdag hoor je iets.'],
    'value3_title' => ['group' => 'over', 'label' => 'Afspraak 3: titel', 'type' => 'text', 'default' => 'Updates'],
    'value3_text' => ['group' => 'over', 'label' => 'Afspraak 3: tekst', 'type' => 'textarea', 'default' => 'Ik houd je website en app bij, zodat ze veilig blijven en blijven werken.'],
    'value4_title' => ['group' => 'over', 'label' => 'Afspraak 4: titel', 'type' => 'text', 'default' => 'Eerlijk advies'],
    'value4_text' => ['group' => 'over', 'label' => 'Afspraak 4: tekst', 'type' => 'textarea', 'default' => 'Ik zeg het als iets niet nodig is, of als het goedkoper kan.'],
    'skill1_title' => ['group' => 'over', 'label' => 'Techniek 1: titel', 'type' => 'text', 'default' => 'Frontend'],
    'skill1_items' => ['group' => 'over', 'label' => 'Techniek 1: onderdelen (één per regel)', 'type' => 'lines', 'default' => "HTML & CSS\nJavaScript\nTypeScript\nReact\nResponsive design\nSEO"],
    'skill2_title' => ['group' => 'over', 'label' => 'Techniek 2: titel', 'type' => 'text', 'default' => 'Backend'],
    'skill2_items' => ['group' => 'over', 'label' => 'Techniek 2: onderdelen (één per regel)', 'type' => 'lines', 'default' => "Node.js\nPHP\nPython\nREST & GraphQL\nPostgreSQL\nMySQL"],
    'skill3_title' => ['group' => 'over', 'label' => 'Techniek 3: titel', 'type' => 'text', 'default' => 'Android'],
    'skill3_items' => ['group' => 'over', 'label' => 'Techniek 3: onderdelen (één per regel)', 'type' => 'lines', 'default' => "Kotlin\nJetpack Compose\nRoom\nFirebase\nGoogle Play"],
    'skill4_title' => ['group' => 'over', 'label' => 'Techniek 4: titel', 'type' => 'text', 'default' => 'Tools'],
    'skill4_items' => ['group' => 'over', 'label' => 'Techniek 4: onderdelen (één per regel)', 'type' => 'lines', 'default' => "Git\nDocker\nLinux\nCI/CD\nDeployment"],

    // Contact
    'contact_intro' => ['group' => 'contact', 'label' => 'Tekst bovenaan', 'type' => 'textarea', 'default' => 'Vertel kort wat je wilt laten maken. Ik reageer binnen een werkdag. Daarna plannen we een online gesprek, eventueel via Teams, en krijg je een offerte als je dat wilt.'],
    'contact_meeting' => ['group' => 'contact', 'label' => 'Overleg', 'type' => 'text', 'default' => 'Alleen online, eventueel via Teams'],
    'contact_response' => ['group' => 'contact', 'label' => 'Reactietijd', 'type' => 'text', 'default' => 'Binnen één werkdag'],
    'faq1_q' => ['group' => 'contact', 'label' => 'Vraag 1', 'type' => 'text', 'default' => 'Wat kost een website of app?'],
    'faq1_a' => ['group' => 'contact', 'label' => 'Antwoord 1', 'type' => 'textarea', 'default' => 'Dat hangt af van wat je nodig hebt. Na een eerste gesprek krijg je een offerte met een vaste prijs.'],
    'faq2_q' => ['group' => 'contact', 'label' => 'Vraag 2', 'type' => 'text', 'default' => 'Hoe lang duurt een project?'],
    'faq2_a' => ['group' => 'contact', 'label' => 'Antwoord 2', 'type' => 'textarea', 'default' => 'Een gewone bedrijfswebsite staat meestal binnen een paar weken online. Een webapplicatie of app duurt langer. Die bouw ik in delen, zodat je tussendoor al iets kunt zien.'],
    'faq3_q' => ['group' => 'contact', 'label' => 'Vraag 3', 'type' => 'text', 'default' => 'Regel je ook hosting en een domeinnaam?'],
    'faq3_a' => ['group' => 'contact', 'label' => 'Antwoord 3', 'type' => 'textarea', 'default' => 'Nee, die regel je zelf. Ik kan je wel adviseren welke partij past, en ik zet de website of backend daar voor je online. Onderhoud en updates kan ik daarna voor je doen.'],
    'faq4_q' => ['group' => 'contact', 'label' => 'Vraag 4', 'type' => 'text', 'default' => 'Kan ik later zelf content aanpassen?'],
    'faq4_a' => ['group' => 'contact', 'label' => 'Antwoord 4', 'type' => 'textarea', 'default' => "Ja. Als je dat wilt, maak ik een eenvoudige beheeromgeving waarin je zelf teksten, foto's of producten aanpast."],
];
