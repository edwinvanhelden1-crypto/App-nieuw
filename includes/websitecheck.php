<?php
/**
 * Websitecheck: controleert websites van andere bedrijven op tekenen van veroudering,
 * zodat Edwin kan zien wie hij kan benaderen voor een nieuwe of opgefriste website.
 */

const WC_MAX_URLS = 25;
const WC_MAX_BYTES = 2 * 1024 * 1024;
const WC_STATUSES = ['nieuw' => 'Nieuw', 'benaderd' => 'Benaderd', 'interesse' => 'Interesse', 'geen' => 'Geen interesse', 'klant' => 'Klant'];

/** Maakt van wat er is ingeplakt een nette URL, of null als het geen website is. */
function wc_normalize(string $line): ?string
{
    $line = trim($line);
    if ($line === '') return null;
    if (!preg_match('#^https?://#i', $line)) $line = 'https://' . $line;
    $parts = parse_url($line);
    if (!$parts || empty($parts['host']) || !preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/i', $parts['host'])) return null;
    return strtolower($parts['scheme']) . '://' . strtolower($parts['host']) . ($parts['path'] ?? '/');
}

/** Alleen openbare adressen; zo kan de check niet gebruikt worden om de eigen server te bevragen. */
function wc_host_allowed(string $host): bool
{
    if (getenv('WEBSITECHECK_ALLOW_LOCAL') === '1') return true;
    $ips = gethostbynamel($host);
    if (!$ips) return false;
    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return false;
    }
    return true;
}

/** Haalt meerdere websites tegelijk op. Geeft per URL: html, status, eindadres, tijd en foutmelding. */
function wc_fetch_many(array $urls): array
{
    $mh = curl_multi_init();
    $handles = [];
    foreach ($urls as $url) {
        $ch = curl_init($url);
        $buffer = '';
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; MolenaarDesign-Websitecheck/1.0; +https://www.molenaar-design.nl)',
            CURLOPT_HTTPHEADER => ['Accept: text/html', 'Accept-Language: nl,en;q=0.8'],
            CURLOPT_ENCODING => '',
            CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$buffer) {
                $buffer .= $data;
                return strlen($buffer) > WC_MAX_BYTES ? 0 : strlen($data);
            },
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$url] = [$ch, &$buffer];
        unset($buffer);
    }
    do {
        $status = curl_multi_exec($mh, $running);
        if ($running) curl_multi_select($mh, 1);
    } while ($running && $status === CURLM_OK);

    $out = [];
    foreach ($handles as $url => [$ch, $html]) {
        $out[$url] = [
            'html' => (string)$html,
            'status' => (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE),
            'final' => (string)curl_getinfo($ch, CURLINFO_EFFECTIVE_URL),
            'time' => (float)curl_getinfo($ch, CURLINFO_TOTAL_TIME),
            // 23 = download afgebroken omdat de pagina te groot was; dat is geen fout
            'error' => curl_errno($ch) && curl_errno($ch) !== 23 ? curl_error($ch) : '',
            // 35, 51, 58, 60, 77: problemen met het https-certificaat
            'ssl_error' => in_array(curl_errno($ch), [35, 51, 58, 60, 77], true),
        ];
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    return $out;
}

/**
 * Beoordeelt een opgehaalde pagina. Hoe hoger de score (0-10), hoe meer de site
 * verouderd lijkt en hoe interessanter het bedrijf is om te benaderen.
 */
function wc_analyze(array $r, bool $httpsWorks): array
{
    $problems = [];
    $add = function (int $points, string $title, string $pitch) use (&$problems) {
        $problems[] = ['points' => $points, 'title' => $title, 'pitch' => $pitch];
    };
    $html = $r['html'];
    $lower = strtolower($html);

    if ($r['status'] === 0 || $r['status'] >= 400 || trim($html) === '') {
        $add(8, 'Website niet bereikbaar', 'Je website gaf een foutmelding toen ik hem bezocht. Klanten die je zoeken, zien nu niets.');
        return ['score' => 8, 'problems' => $problems, 'title' => '', 'year' => null];
    }

    if (!$httpsWorks || !str_starts_with(strtolower($r['final']), 'https://')) {
        $add(3, 'Niet beveiligd (geen https)', 'Browsers zetten "Niet beveiligd" naast je adres. Dat schrikt bezoekers af, en Google zet zulke sites lager.');
    }
    if (!preg_match('/<meta[^>]+name=["\']?viewport/i', $html)) {
        $add(3, 'Niet geschikt voor mobiel', 'Op een telefoon moet je inzoomen om iets te lezen. De meeste bezoekers komen juist via hun telefoon.');
    }

    $year = null;
    if (preg_match_all('/(?:&copy;|©|\(c\)|copyright)\s*(?:[^<\d]{0,40})?((?:19|20)\d\d)(?:\s*[-–]\s*((?:19|20)\d\d))?/iu', $html, $m, PREG_SET_ORDER)) {
        foreach ($m as $match) $year = max($year ?? 0, (int)($match[2] ?? 0) ?: (int)$match[1]);
    }
    $age = $year ? (int)date('Y') - $year : null;
    if ($age !== null && $age >= 6) {
        $add(2, "Copyright uit $year", "Onderaan staat nog $year. Bezoekers denken dan al snel dat het bedrijf niet meer actief is.");
    } elseif ($age !== null && $age >= 3) {
        $add(1, "Copyright uit $year", "Onderaan staat $year. Een kleine moeite om bij te werken, maar het valt op.");
    }

    $old = [];
    if (preg_match('/\.swf\b|application\/x-shockwave-flash/i', $html)) $old[] = 'Flash';
    if (preg_match('/<frameset|<frame\s/i', $html)) $old[] = 'frames';
    if (preg_match('/<(font|center|marquee)\b/i', $html)) $old[] = 'oude opmaakcodes';
    if (substr_count($lower, '<table') >= 4 && !str_contains($lower, 'display:flex') && !str_contains($lower, 'display: flex') && !preg_match('/grid|flex/i', $html)) $old[] = 'tabel-layout';
    if (preg_match('/internet explorer|best (?:te )?bekijk/i', $html)) $old[] = 'verwijzing naar Internet Explorer';
    if ($old) {
        $add(2, 'Verouderde techniek: ' . implode(', ', $old), 'De site is gebouwd met technieken van tien jaar of langer geleden. Dat werkt slecht op moderne telefoons en browsers.');
    }

    $cms = '';
    if (preg_match('/<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)/i', $html, $g)) $cms = trim($g[1]);
    $outdatedCms = false;
    if (preg_match('/wordpress\s*([0-9]+)\.([0-9]+)/i', $cms, $v) && ((int)$v[1] < 6)) $outdatedCms = true;
    if (preg_match('/joomla!?\s*(1\.|2\.|3\.)/i', $cms)) $outdatedCms = true;
    if (preg_match('/drupal\s*[1-7]\b/i', $cms)) $outdatedCms = true;
    if (preg_match('/jquery[.-]?(1\.[0-9]|2\.[0-9])[0-9.]*(?:\.min)?\.js/i', $html)) $outdatedCms = true;
    if ($outdatedCms) {
        $add(1, 'Verouderde software' . ($cms ? " ($cms)" : ''), 'De software achter de site krijgt geen updates meer. Dat is een veiligheidsrisico.');
    }

    if ($r['time'] > 3) {
        $add(1, 'Traag: ' . number_format($r['time'], 1, ',', '') . ' seconden', 'De site laadt traag. Veel bezoekers wachten dat niet af.');
    }
    if (!preg_match('/<meta[^>]+name=["\']description/i', $html)) {
        $add(1, 'Geen beschrijving voor Google', 'Google laat bij je site een willekeurig stukje tekst zien in plaats van een goede omschrijving.');
    }

    $title = '';
    if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $t)) {
        $title = trim(html_entity_decode(preg_replace('/\s+/', ' ', strip_tags($t[1])), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if (!mb_check_encoding($title, 'UTF-8')) $title = mb_convert_encoding($title, 'UTF-8', 'ISO-8859-1');
        $title = mb_substr($title, 0, 150);
    }
    $score = min(10, array_sum(array_column($problems, 'points')));
    return ['score' => $score, 'problems' => $problems, 'title' => $title, 'year' => $year];
}

/** Controleert een lijst websites en slaat de uitkomst op. Geeft het aantal gecontroleerde sites terug. */
function wc_run(array $lines): array
{
    $urls = [];
    $skipped = [];
    foreach ($lines as $line) {
        $url = wc_normalize($line);
        if ($url === null) { if (trim($line) !== '') $skipped[] = trim($line); continue; }
        $host = parse_url($url, PHP_URL_HOST);
        if (!wc_host_allowed($host)) { $skipped[] = trim($line); continue; }
        $urls[$host] = $url;
        if (count($urls) >= WC_MAX_URLS) break;
    }
    if (!$urls) return ['checked' => 0, 'skipped' => $skipped];

    // Eerst via https; lukt dat niet, dan nog een keer via http.
    $results = wc_fetch_many(array_values($urls));
    $retry = [];
    foreach ($results as $url => $r) {
        if (($r['status'] === 0 || $r['ssl_error']) && str_starts_with($url, 'https://')) $retry[$url] = 'http://' . substr($url, 8);
    }
    $httpResults = $retry ? wc_fetch_many(array_values($retry)) : [];

    $st = db()->prepare('INSERT INTO leads (url, title, score, problems, checked_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET title = excluded.title, score = excluded.score, problems = excluded.problems, checked_at = excluded.checked_at');
    foreach ($results as $url => $r) {
        $httpsWorks = !isset($retry[$url]);
        if (!$httpsWorks) $r = $httpResults[$retry[$url]];
        $a = wc_analyze($r, $httpsWorks);
        $key = parse_url($url, PHP_URL_HOST);
        $st->execute([$key, $a['title'], $a['score'], json_encode($a['problems'], JSON_UNESCAPED_UNICODE), date('c')]);
    }
    return ['checked' => count($results), 'skipped' => $skipped];
}
