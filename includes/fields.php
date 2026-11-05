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
    'available_text' => ['group' => 'algemeen', 'label' => 'Tekst van het label', 'type' => 'text', 'default' => 'Ik heb ruimte voor nieuwe projecten'],
    'footer_text' => ['group' => 'algemeen', 'label' => 'Tekst in de footer', 'type' => 'text', 'default' => 'Webdeveloper en Android-ontwikkelaar uit Nederland.'],
    'cta_title' => ['group' => 'algemeen', 'label' => 'Blauwe balk: kop', 'type' => 'text', 'default' => 'Heb je een idee?'],
    'cta_text' => ['group' => 'algemeen', 'label' => 'Blauwe balk: tekst', 'type' => 'text', 'default' => 'Stuur me een bericht, dan hoor je binnen een werkdag van me.'],
    'page_bg' => ['group' => 'algemeen', 'label' => 'Achtergrond bovenaan elke pagina', 'type' => 'image', 'default' => 'img/achtergrond.svg'],

    // Home: bovenaan
    'hero_eyebrow' => ['group' => 'home', 'label' => 'Kleine tekst boven de kop', 'type' => 'text', 'default' => 'Webdeveloper en Android-ontwikkelaar'],
    'hero_title' => ['group' => 'home', 'label' => 'Kop (wit deel)', 'type' => 'text', 'default' => 'Ik bouw websites en'],
    'hero_title_accent' => ['group' => 'home', 'label' => 'Kop (blauw deel)', 'type' => 'text', 'default' => 'Android-apps.'],
    'hero_intro' => ['group' => 'home', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Ik ben Edwin. Ik bouw websites en apps voor ondernemers, en ook alles wat erachter zit: de database, het inloggen en de koppelingen met andere software. Je hebt de hele tijd met mij te maken, ook als alles al online staat.'],
    'hero_facts' => ['group' => 'home', 'label' => 'Punten onder de knoppen (één per regel)', 'type' => 'lines', 'default' => "Binnen een werkdag antwoord\nVooraf een vaste prijs\nOverleg online, via Teams als je wilt"],
    'hero_image' => ['group' => 'home', 'label' => 'Afbeelding naast de introductie', 'type' => 'image', 'default' => 'img/hero-devices.svg'],

    // Home: diensten
    'services_title' => ['group' => 'diensten', 'label' => 'Kop', 'type' => 'text', 'default' => 'Wat ik doe'],
    'services_intro' => ['group' => 'diensten', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Vaak is het een combinatie. Een website waar klanten op kunnen inloggen, of een app die dezelfde gegevens gebruikt als je site.'],
    'service1_title' => ['group' => 'diensten', 'label' => 'Dienst 1: titel', 'type' => 'text', 'default' => 'Websites'],
    'service1_text' => ['group' => 'diensten', 'label' => 'Dienst 1: tekst', 'type' => 'textarea', 'default' => 'Snel, prettig te lezen op je telefoon en te vinden in Google. Ik bouw hem zelf, dus zonder zwaar standaardthema vol plugins.'],
    'service1_items' => ['group' => 'diensten', 'label' => 'Dienst 1: punten (één per regel)', 'type' => 'lines', 'default' => "Bedrijfswebsites\nWebshops\nKlantportalen met inlog"],
    'service1_image' => ['group' => 'diensten', 'label' => 'Dienst 1: afbeelding', 'type' => 'image', 'default' => 'img/dienst-websites.svg'],
    'service2_title' => ['group' => 'diensten', 'label' => 'Dienst 2: titel', 'type' => 'text', 'default' => "Backend & API's"],
    'service2_text' => ['group' => 'diensten', 'label' => 'Dienst 2: tekst', 'type' => 'textarea', 'default' => 'Het deel dat je niet ziet: de database, accounts, betalingen en de koppeling met bijvoorbeeld je boekhouding of CRM.'],
    'service2_items' => ['group' => 'diensten', 'label' => 'Dienst 2: punten (één per regel)', 'type' => 'lines', 'default' => "API's voor websites en apps\nKoppelingen met andere software\nOnderhoud en updates"],
    'service2_image' => ['group' => 'diensten', 'label' => 'Dienst 2: afbeelding', 'type' => 'image', 'default' => 'img/dienst-backend.svg'],
    'service3_title' => ['group' => 'diensten', 'label' => 'Dienst 3: titel', 'type' => 'text', 'default' => 'Android-apps'],
    'service3_text' => ['group' => 'diensten', 'label' => 'Dienst 3: tekst', 'type' => 'textarea', 'default' => 'Ik schrijf apps in Kotlin. Moet je app ook werken waar geen bereik is? Dat kan, de gegevens worden later bijgewerkt.'],
    'service3_items' => ['group' => 'diensten', 'label' => 'Dienst 3: punten (één per regel)', 'type' => 'lines', 'default' => "Pushmeldingen\nOffline werken\nPublicatie in de Play Store"],
    'service3_image' => ['group' => 'diensten', 'label' => 'Dienst 3: afbeelding', 'type' => 'image', 'default' => 'img/dienst-android.svg'],
    'tech_band' => ['group' => 'diensten', 'label' => 'Technieken in de balk (één per regel)', 'type' => 'lines', 'default' => "HTML & CSS\nJavaScript\nTypeScript\nReact\nNode.js\nPHP\nPython\nPostgreSQL\nMySQL\nKotlin\nJetpack Compose\nFirebase\nDocker\nGit"],

    // Home: werkwijze
    'process_title' => ['group' => 'werkwijze', 'label' => 'Kop', 'type' => 'text', 'default' => 'Zo gaat het in de praktijk'],
    'process_image' => ['group' => 'werkwijze', 'label' => 'Afbeelding', 'type' => 'image', 'default' => 'img/werkwijze.svg'],
    'step1_title' => ['group' => 'werkwijze', 'label' => 'Stap 1: titel', 'type' => 'text', 'default' => 'Kennismaken'],
    'step1_text' => ['group' => 'werkwijze', 'label' => 'Stap 1: tekst', 'type' => 'textarea', 'default' => 'We spreken online af. Jij vertelt wat je wilt, ik stel vragen. Daarna krijg je een offerte met een vaste prijs.'],
    'step2_title' => ['group' => 'werkwijze', 'label' => 'Stap 2: titel', 'type' => 'text', 'default' => 'Plan'],
    'step2_text' => ['group' => 'werkwijze', 'label' => 'Stap 2: tekst', 'type' => 'textarea', 'default' => 'Ik maak een eerste opzet van de schermen en zet op een rij hoe ik het ga bouwen. Dan weet je waar je aan toe bent.'],
    'step3_title' => ['group' => 'werkwijze', 'label' => 'Stap 3: titel', 'type' => 'text', 'default' => 'Bouwen'],
    'step3_text' => ['group' => 'werkwijze', 'label' => 'Stap 3: tekst', 'type' => 'textarea', 'default' => 'Ik bouw in delen. Tussendoor krijg je een testversie, zodat je kunt zeggen wat je ervan vindt.'],
    'step4_title' => ['group' => 'werkwijze', 'label' => 'Stap 4: titel', 'type' => 'text', 'default' => 'Live'],
    'step4_text' => ['group' => 'werkwijze', 'label' => 'Stap 4: tekst', 'type' => 'textarea', 'default' => 'Als alles werkt, zetten we het online. Ook daarna kun je bij me terecht.'],

    // Home: samenwerken
    'plans_title' => ['group' => 'samenwerken', 'label' => 'Kop', 'type' => 'text', 'default' => 'Hoe we kunnen samenwerken'],
    'plans_intro' => ['group' => 'samenwerken', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Weet je nog niet wat bij je past? Dat bespreken we gewoon in het eerste gesprek.'],
    'plan1_title' => ['group' => 'samenwerken', 'label' => 'Vorm 1: titel', 'type' => 'text', 'default' => 'Project'],
    'plan1_sub' => ['group' => 'samenwerken', 'label' => 'Vorm 1: prijsvorm', 'type' => 'text', 'default' => 'Vaste prijs'],
    'plan1_text' => ['group' => 'samenwerken', 'label' => 'Vorm 1: tekst', 'type' => 'textarea', 'default' => 'Je wilt iets nieuws laten maken en weet ongeveer wat. Je krijgt vooraf een prijs en een planning.'],
    'plan1_items' => ['group' => 'samenwerken', 'label' => 'Vorm 1: punten (één per regel)', 'type' => 'lines', 'default' => "Offerte na een eerste gesprek\nOplevering in delen\nEen maand nazorg na de livegang"],
    'plan2_title' => ['group' => 'samenwerken', 'label' => 'Vorm 2: titel', 'type' => 'text', 'default' => 'Doorontwikkeling'],
    'plan2_sub' => ['group' => 'samenwerken', 'label' => 'Vorm 2: prijsvorm', 'type' => 'text', 'default' => 'Per uur of per maand'],
    'plan2_text' => ['group' => 'samenwerken', 'label' => 'Vorm 2: tekst', 'type' => 'textarea', 'default' => 'Je hebt al een website of app en wilt er meer mee. Ik bouw nieuwe functies of los op wat steeds blijft haperen.'],
    'plan2_items' => ['group' => 'samenwerken', 'label' => 'Vorm 2: punten (één per regel)', 'type' => 'lines', 'default' => "Vaste uren per maand kan ook\nJe hebt direct contact met mij\nOok als iemand anders het heeft gebouwd"],
    'plan3_title' => ['group' => 'samenwerken', 'label' => 'Vorm 3: titel', 'type' => 'text', 'default' => 'Onderhoud'],
    'plan3_sub' => ['group' => 'samenwerken', 'label' => 'Vorm 3: prijsvorm', 'type' => 'text', 'default' => 'Vast bedrag per maand'],
    'plan3_text' => ['group' => 'samenwerken', 'label' => 'Vorm 3: tekst', 'type' => 'textarea', 'default' => 'Je site of app draait al en je wilt er geen omkijken naar hebben. Ik houd hem voor je bij.'],
    'plan3_items' => ['group' => 'samenwerken', 'label' => 'Vorm 3: punten (één per regel)', 'type' => 'lines', 'default' => "Updates en back-ups\nHulp als er iets stuk gaat\nKleine aanpassingen"],

    // Home: reviews
    'reviews_title' => ['group' => 'reviews', 'label' => 'Kop', 'type' => 'text', 'default' => 'Ervaringen van klanten'],
    'reviews_intro' => ['group' => 'reviews', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Een paar reacties van mensen voor wie ik iets heb gebouwd.'],

    // Portfolio-pagina
    'portfolio_title' => ['group' => 'portfolio', 'label' => 'Kop', 'type' => 'text', 'default' => 'Projecten'],
    'portfolio_intro' => ['group' => 'portfolio', 'label' => 'Introductie', 'type' => 'textarea', 'default' => 'Een paar dingen die ik heb gemaakt. Staat een project online, dan kun je doorklikken naar de website.'],

    // Over mij
    'about_intro' => ['group' => 'over', 'label' => 'Tekst bovenaan', 'type' => 'text', 'default' => 'Even voorstellen.'],
    'about_heading' => ['group' => 'over', 'label' => 'Kop bij de introductie', 'type' => 'text', 'default' => 'Hoi, ik ben Edwin'],
    'about_lead' => ['group' => 'over', 'label' => 'Eerste alinea (groot)', 'type' => 'textarea', 'default' => 'Ik bouw websites, de backend die erachter zit en Android-apps.'],
    'about_text' => ['group' => 'over', 'label' => 'Overige alinea\'s (lege regel tussen alinea\'s)', 'type' => 'paragraphs', 'default' => "Ik doe alles zelf. Je hebt dus niet te maken met een ontwerper, een programmeur en een appbouwer die elk hun eigen ding doen. Omdat ik de website, de database en de app samen bouw, passen ze ook op elkaar.\n\nIk hou van software die het gewoon doet, en die je over een paar jaar nog steeds kunt gebruiken."],
    'about_photo' => ['group' => 'over', 'label' => 'Foto (bijvoorbeeld van jezelf)', 'type' => 'image', 'default' => 'img/over-mij.svg'],
    'value1_title' => ['group' => 'over', 'label' => 'Afspraak 1: titel', 'type' => 'text', 'default' => 'Vaste prijs'],
    'value1_text' => ['group' => 'over', 'label' => 'Afspraak 1: tekst', 'type' => 'textarea', 'default' => 'Je weet vooraf wat het kost. Komt er werk bij, dan overleggen we eerst.'],
    'value2_title' => ['group' => 'over', 'label' => 'Afspraak 2: titel', 'type' => 'text', 'default' => 'Snel antwoord'],
    'value2_text' => ['group' => 'over', 'label' => 'Afspraak 2: tekst', 'type' => 'textarea', 'default' => 'Je hebt contact met mij, niet met een helpdesk. Binnen een werkdag heb je antwoord.'],
    'value3_title' => ['group' => 'over', 'label' => 'Afspraak 3: titel', 'type' => 'text', 'default' => 'Updates'],
    'value3_text' => ['group' => 'over', 'label' => 'Afspraak 3: tekst', 'type' => 'textarea', 'default' => 'Ik houd je site en app bij, zodat ze veilig blijven en blijven werken.'],
    'value4_title' => ['group' => 'over', 'label' => 'Afspraak 4: titel', 'type' => 'text', 'default' => 'Eerlijk advies'],
    'value4_text' => ['group' => 'over', 'label' => 'Afspraak 4: tekst', 'type' => 'textarea', 'default' => 'Heb je iets niet nodig, of kan het goedkoper? Dan zeg ik dat.'],
    'skill1_title' => ['group' => 'over', 'label' => 'Techniek 1: titel', 'type' => 'text', 'default' => 'Frontend'],
    'skill1_items' => ['group' => 'over', 'label' => 'Techniek 1: onderdelen (één per regel)', 'type' => 'lines', 'default' => "HTML & CSS\nJavaScript\nTypeScript\nReact\nResponsive design\nSEO"],
    'skill2_title' => ['group' => 'over', 'label' => 'Techniek 2: titel', 'type' => 'text', 'default' => 'Backend'],
    'skill2_items' => ['group' => 'over', 'label' => 'Techniek 2: onderdelen (één per regel)', 'type' => 'lines', 'default' => "Node.js\nPHP\nPython\nREST & GraphQL\nPostgreSQL\nMySQL"],
    'skill3_title' => ['group' => 'over', 'label' => 'Techniek 3: titel', 'type' => 'text', 'default' => 'Android'],
    'skill3_items' => ['group' => 'over', 'label' => 'Techniek 3: onderdelen (één per regel)', 'type' => 'lines', 'default' => "Kotlin\nJetpack Compose\nRoom\nFirebase\nGoogle Play"],
    'skill4_title' => ['group' => 'over', 'label' => 'Techniek 4: titel', 'type' => 'text', 'default' => 'Tools'],
    'skill4_items' => ['group' => 'over', 'label' => 'Techniek 4: onderdelen (één per regel)', 'type' => 'lines', 'default' => "Git\nDocker\nLinux\nCI/CD\nDeployment"],

    // Contact
    'contact_intro' => ['group' => 'contact', 'label' => 'Tekst bovenaan', 'type' => 'textarea', 'default' => 'Vertel kort wat je wilt laten maken. Je hoort binnen een werkdag van me. Daarna spreken we online af, via Teams als je dat makkelijk vindt, en maak ik een offerte als je die wilt.'],
    'contact_meeting' => ['group' => 'contact', 'label' => 'Overleg', 'type' => 'text', 'default' => 'Online, via Teams als je wilt'],
    'contact_response' => ['group' => 'contact', 'label' => 'Reactietijd', 'type' => 'text', 'default' => 'Binnen een werkdag'],
    'faq1_q' => ['group' => 'contact', 'label' => 'Vraag 1', 'type' => 'text', 'default' => 'Wat kost een website of app?'],
    'faq1_a' => ['group' => 'contact', 'label' => 'Antwoord 1', 'type' => 'textarea', 'default' => 'Dat hangt echt af van wat je wilt. Na een kort gesprek krijg je een vaste prijs, zodat je niet voor verrassingen komt te staan.'],
    'faq2_q' => ['group' => 'contact', 'label' => 'Vraag 2', 'type' => 'text', 'default' => 'Hoe lang duurt een project?'],
    'faq2_a' => ['group' => 'contact', 'label' => 'Antwoord 2', 'type' => 'textarea', 'default' => 'Een gewone bedrijfswebsite staat meestal binnen een paar weken online. Een app of webapplicatie duurt langer. Die bouw ik in delen, dus je ziet onderweg al wat.'],
    'faq3_q' => ['group' => 'contact', 'label' => 'Vraag 3', 'type' => 'text', 'default' => 'Regel je ook hosting en een domeinnaam?'],
    'faq3_a' => ['group' => 'contact', 'label' => 'Antwoord 3', 'type' => 'textarea', 'default' => 'Nee, dat regel je zelf. Ik help je wel met kiezen en zet de site of backend daar voor je online. Onderhoud en updates kan ik daarna voor je doen.'],
    'faq4_q' => ['group' => 'contact', 'label' => 'Vraag 4', 'type' => 'text', 'default' => 'Kan ik later zelf content aanpassen?'],
    'faq4_a' => ['group' => 'contact', 'label' => 'Antwoord 4', 'type' => 'textarea', 'default' => 'Ja. Als je dat wilt, krijg je een eenvoudige beheeromgeving waarin je zelf teksten, foto\'s of producten aanpast.'],
];
