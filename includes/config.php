<?php
/**
 * Startwachtwoord voor de beheerpagina (alleen de hash staat hier, niet het wachtwoord).
 * Zodra je in de beheerpagina bij Account een nieuw wachtwoord kiest, geldt dat nieuwe
 * wachtwoord en wordt deze hash niet meer gebruikt.
 */
const ADMIN_PASSWORD_HASH = '$2y$10$ZfTB15Px0/UkIjQVw8n5eO.b9tueochwh/FA6XGbM0fRFm/kxaNCO';

/** Vaste adres van de site, voor zoekmachines en social media. */
const SITE_URL = 'https://www.molenaar-design.nl';

/** Afzender van de mails van het contactformulier (antwoorden gaan naar de bezoeker). */
const MAIL_FROM = 'noreply@molenaar-design.nl';
