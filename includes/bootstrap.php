<?php
declare(strict_types=1);

const ROOT = __DIR__ . '/..';
const DB_FILE = ROOT . '/data/site.sqlite';
const UPLOAD_DIR = ROOT . '/uploads';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

require __DIR__ . '/config.php';
require __DIR__ . '/fields.php';

$https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_name('em_sess');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => $https, 'path' => '/']);
session_start();

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $new = !file_exists(DB_FILE);
    $pdo = new PDO('sqlite:' . DB_FILE, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY, sort INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL, tag TEXT NOT NULL DEFAULT "",
        description TEXT NOT NULL DEFAULT "", tech TEXT NOT NULL DEFAULT "", image TEXT NOT NULL DEFAULT "",
        url TEXT NOT NULL DEFAULT "", show_home INTEGER NOT NULL DEFAULT 1)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS invites (
        id INTEGER PRIMARY KEY, token TEXT NOT NULL UNIQUE, client TEXT NOT NULL,
        created_at TEXT NOT NULL, used_at TEXT)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY, invite_id INTEGER REFERENCES invites(id) ON DELETE SET NULL,
        name TEXT NOT NULL, company TEXT NOT NULL DEFAULT "", rating INTEGER NOT NULL, body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT "pending", created_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT NOT NULL, at INTEGER NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, type TEXT NOT NULL, budget TEXT NOT NULL,
        body TEXT NOT NULL, mailed INTEGER NOT NULL DEFAULT 0, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT "", score INTEGER NOT NULL DEFAULT 0,
        problems TEXT NOT NULL DEFAULT "[]", status TEXT NOT NULL DEFAULT "nieuw", note TEXT NOT NULL DEFAULT "", checked_at TEXT NOT NULL)');
    if ($new) seed_projects($pdo);
    return $pdo;
}

function seed_projects(PDO $pdo): void
{
    $rows = [
        ['Edgeflow', 'Android · Meldingen', 'Een Android-app voor meldingen. Je meldt iets vanaf je telefoon, volgt wat ermee gebeurt en krijgt een pushbericht als er iets verandert.', 'Android, Pushmeldingen', 'img/project-edgeflow.svg', ''],
        ['Wendaro Connect', 'App · Platform', 'Een app die mensen en informatie bij elkaar brengt, met een eigen backend erachter.', 'Android, Backend', 'img/project-wendaro.svg', 'https://www.wendaro.nl'],
        ['Wanyama Photo', 'Website · Fotografie', 'De website van Wanyama Photo.', 'Website', 'img/project-wanyama.svg', 'https://www.wanyama-photo.nl'],
    ];
    $st = $pdo->prepare('INSERT INTO projects (sort, title, tag, description, tech, image, url) VALUES (?, ?, ?, ?, ?, ?, ?)');
    foreach ($rows as $i => $r) $st->execute([($i + 1) * 10, ...$r]);
}

function e(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Alle opgeslagen teksten, één keer per request geladen. */
function settings(): array
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach (db()->query('SELECT key, value FROM settings') as $row) $cache[$row['key']] = $row['value'];
    }
    return $cache;
}

/** Waarde van een contentveld: opgeslagen waarde, anders de standaardtekst. */
function c(string $key): string
{
    $s = settings();
    if (array_key_exists($key, $s)) return $s[$key];
    return FIELDS[$key]['default'] ?? '';
}

/** Contentveld als lijst, één item per regel. */
function lines(string $key): array
{
    return array_values(array_filter(array_map('trim', explode("\n", c($key))), 'strlen'));
}

/** Contentveld als alinea's, gescheiden door een lege regel. */
function paragraphs(string $key): array
{
    return array_values(array_filter(array_map('trim', preg_split('/\R\s*\R/', c($key))), 'strlen'));
}

function set_setting(string $key, string $value): void
{
    db()->prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        ->execute([$key, $value]);
}

function delete_setting(string $key): void
{
    db()->prepare('DELETE FROM settings WHERE key = ?')->execute([$key]);
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function check_csrf(): void
{
    if (!hash_equals(csrf_token(), (string)($_POST['csrf'] ?? ''))) {
        http_response_code(400);
        exit('Het formulier is verlopen. Ga terug en probeer het opnieuw.');
    }
}

/** Basis-URL van de site, ook als die in een submap staat. */
function site_url(): string
{
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    // De beheermap mag een andere naam krijgen; die map ligt altijd één niveau onder de site.
    if (realpath(dirname($_SERVER['SCRIPT_FILENAME'] ?? '')) !== realpath(ROOT)) $dir = rtrim(dirname($dir), '/');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
}

/**
 * Slaat een geüploade afbeelding op en geeft het pad terug (relatief aan de site),
 * null als er niets is geüpload. Gooit een RuntimeException met een leesbare melding.
 */
function store_upload(array $file): ?string
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    if ($file['error'] !== UPLOAD_ERR_OK) throw new RuntimeException('Uploaden is mislukt. Probeer het opnieuw.');
    if ($file['size'] > MAX_UPLOAD_BYTES) throw new RuntimeException('De afbeelding is groter dan 5 MB. Kies een kleinere.');
    $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset($types[$mime]) || @getimagesize($file['tmp_name']) === false) {
        throw new RuntimeException('Dit bestand is geen JPG, PNG, WebP of GIF.');
    }
    if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);
    $name = bin2hex(random_bytes(12)) . '.' . $types[$mime];
    if (!move_uploaded_file($file['tmp_name'], UPLOAD_DIR . '/' . $name)) {
        throw new RuntimeException('De afbeelding kon niet worden opgeslagen. Controleer de schrijfrechten van de map uploads.');
    }
    return 'uploads/' . $name;
}

/** Verwijdert een eerder geüploade afbeelding; standaardafbeeldingen in img/ blijven staan. */
function delete_upload(string $path): void
{
    if (preg_match('#^uploads/[a-f0-9]{24}\.(jpg|png|webp|gif)$#', $path) && is_file(ROOT . '/' . $path)) {
        unlink(ROOT . '/' . $path);
    }
}

function is_admin(): bool
{
    return !empty($_SESSION['admin']);
}
