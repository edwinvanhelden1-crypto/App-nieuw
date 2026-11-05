<?php
require __DIR__ . '/../includes/bootstrap.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

const TABS = ['teksten' => 'Teksten & foto\'s', 'portfolio' => 'Portfolio', 'reviews' => 'Reviews', 'links' => 'Reviewlinks', 'account' => 'Account'];

function flash(string $msg, string $type = 'ok'): void { $_SESSION['flash'] = [$msg, $type]; }
function back(string $query = ''): never
{
    header('Location: index.php' . ($query !== '' ? '?' . $query : ''));
    exit;
}
/** Wachtwoord uit Account als dat is gekozen, anders het startwachtwoord uit includes/config.php. */
function admin_hash(): ?string
{
    return settings()['_admin_hash'] ?? (ADMIN_PASSWORD_HASH !== '' ? ADMIN_PASSWORD_HASH : null);
}
function client_ip(): string { return $_SERVER['REMOTE_ADDR'] ?? 'onbekend'; }

function too_many_attempts(): bool
{
    db()->prepare('DELETE FROM login_attempts WHERE at < ?')->execute([time() - 900]);
    $st = db()->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ?');
    $st->execute([client_ip()]);
    return (int)$st->fetchColumn() >= 10;
}

/** Zet een ingevulde URL om naar een veilige http(s)-link, of '' als er niets is ingevuld. */
function clean_url(string $url): string
{
    $url = trim($url);
    if ($url === '') return '';
    if (!preg_match('#^https?://#i', $url)) $url = 'https://' . $url;
    if (!filter_var($url, FILTER_VALIDATE_URL)) throw new RuntimeException('De website-link is geen geldig adres.');
    return $url;
}

$action = $_POST['action'] ?? '';

// ---------- Eerste keer: wachtwoord instellen ----------
if (admin_hash() === null) {
    if ($action === 'setup') {
        check_csrf();
        $pw = (string)($_POST['password'] ?? '');
        if (mb_strlen($pw) < 10) { flash('Kies een wachtwoord van minimaal 10 tekens.', 'error'); back(); }
        if ($pw !== ($_POST['password2'] ?? '')) { flash('De twee wachtwoorden zijn niet gelijk.', 'error'); back(); }
        set_setting('_admin_hash', password_hash($pw, PASSWORD_DEFAULT));
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        flash('Je wachtwoord is ingesteld. Je bent ingelogd.');
        back();
    }
    render_page('setup');
    exit;
}

// ---------- Inloggen en uitloggen ----------
if ($action === 'login') {
    check_csrf();
    if (too_many_attempts()) { flash('Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw.', 'error'); back(); }
    if (password_verify((string)($_POST['password'] ?? ''), admin_hash())) {
        db()->prepare('DELETE FROM login_attempts WHERE ip = ?')->execute([client_ip()]);
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        back();
    }
    db()->prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)')->execute([client_ip(), time()]);
    flash('Het wachtwoord klopt niet.', 'error');
    back();
}
if (!is_admin()) { render_page('login'); exit; }
if ($action === 'logout') {
    check_csrf();
    $_SESSION = [];
    session_destroy();
    back();
}

// ---------- Acties binnen de beheerpagina ----------
if ($action !== '') {
    check_csrf();
    $pdo = db();
    try {
        switch ($action) {
            case 'save_group':
                $group = (string)($_POST['group'] ?? '');
                if (!isset(FIELD_GROUPS[$group])) back();
                foreach (FIELDS as $key => $f) {
                    if ($f['group'] !== $group) continue;
                    if ($f['type'] === 'image') {
                        $current = c($key);
                        if (!empty($_POST['reset'][$key])) {
                            delete_upload($current);
                            delete_setting($key);
                        } elseif ($path = store_upload($_FILES['img_' . $key] ?? [])) {
                            delete_upload($current);
                            set_setting($key, $path);
                        }
                        continue;
                    }
                    $value = $f['type'] === 'bool'
                        ? (!empty($_POST['f'][$key]) ? '1' : '0')
                        : str_replace("\r\n", "\n", trim((string)($_POST['f'][$key] ?? '')));
                    $value = mb_substr($value, 0, 5000);
                    // Gelijk aan de standaardtekst: niets opslaan, zodat de standaard blijft gelden.
                    $value === $f['default'] ? delete_setting($key) : set_setting($key, $value);
                }
                flash('Opgeslagen. De wijzigingen staan direct op de website.');
                back('tab=teksten&groep=' . urlencode($group));

            case 'project_save':
                $id = (int)($_POST['id'] ?? 0);
                $title = trim((string)($_POST['title'] ?? ''));
                if ($title === '') throw new RuntimeException('Geef het project een naam.');
                $row = [
                    'title' => mb_substr($title, 0, 120),
                    'tag' => mb_substr(trim((string)($_POST['tag'] ?? '')), 0, 80),
                    'description' => mb_substr(trim((string)($_POST['description'] ?? '')), 0, 2000),
                    'tech' => mb_substr(trim((string)($_POST['tech'] ?? '')), 0, 300),
                    'url' => clean_url((string)($_POST['url'] ?? '')),
                    'sort' => (int)($_POST['sort'] ?? 0),
                    'show_home' => !empty($_POST['show_home']) ? 1 : 0,
                ];
                $old = null;
                if ($id) {
                    $st = $pdo->prepare('SELECT * FROM projects WHERE id = ?');
                    $st->execute([$id]);
                    $old = $st->fetch() ?: null;
                    if (!$old) back('tab=portfolio');
                }
                $upload = store_upload($_FILES['image'] ?? []);
                $row['image'] = $upload ?? ($old['image'] ?? 'img/achtergrond.svg');
                if ($upload && $old) delete_upload($old['image']);
                if ($old) {
                    $pdo->prepare('UPDATE projects SET title=:title, tag=:tag, description=:description, tech=:tech, url=:url, sort=:sort, show_home=:show_home, image=:image WHERE id=:id')
                        ->execute($row + ['id' => $id]);
                    flash('Project "' . $row['title'] . '" is opgeslagen.');
                } else {
                    $pdo->prepare('INSERT INTO projects (title, tag, description, tech, url, sort, show_home, image) VALUES (:title, :tag, :description, :tech, :url, :sort, :show_home, :image)')
                        ->execute($row);
                    flash('Project "' . $row['title'] . '" is toegevoegd.');
                }
                back('tab=portfolio');

            case 'project_delete':
                $st = $pdo->prepare('SELECT * FROM projects WHERE id = ?');
                $st->execute([(int)($_POST['id'] ?? 0)]);
                if ($p = $st->fetch()) {
                    delete_upload($p['image']);
                    $pdo->prepare('DELETE FROM projects WHERE id = ?')->execute([$p['id']]);
                    flash('Project "' . $p['title'] . '" is verwijderd.');
                }
                back('tab=portfolio');

            case 'review_status':
                $status = ($_POST['status'] ?? '') === 'approved' ? 'approved' : 'hidden';
                $pdo->prepare('UPDATE reviews SET status = ? WHERE id = ?')->execute([$status, (int)($_POST['id'] ?? 0)]);
                flash($status === 'approved' ? 'De review staat nu op de homepage.' : 'De review is verborgen.');
                back('tab=reviews');

            case 'review_delete':
                $pdo->prepare('DELETE FROM reviews WHERE id = ?')->execute([(int)($_POST['id'] ?? 0)]);
                flash('De review is verwijderd.');
                back('tab=reviews');

            case 'invite_create':
                $client = mb_substr(trim((string)($_POST['client'] ?? '')), 0, 80);
                if ($client === '') throw new RuntimeException('Vul de naam van de klant in.');
                $token = bin2hex(random_bytes(16));
                $pdo->prepare('INSERT INTO invites (token, client, created_at) VALUES (?, ?, ?)')->execute([$token, $client, date('c')]);
                $_SESSION['new_link'] = site_url() . '/review.php?t=' . $token;
                flash('Reviewlink voor ' . $client . ' is aangemaakt. Kopieer hem hieronder en stuur hem op.');
                back('tab=links');

            case 'invite_delete':
                $pdo->prepare('DELETE FROM invites WHERE id = ?')->execute([(int)($_POST['id'] ?? 0)]);
                flash('De reviewlink is verwijderd en werkt niet meer.');
                back('tab=links');

            case 'password':
                if (!password_verify((string)($_POST['current'] ?? ''), admin_hash())) throw new RuntimeException('Je huidige wachtwoord klopt niet.');
                $pw = (string)($_POST['password'] ?? '');
                if (mb_strlen($pw) < 10) throw new RuntimeException('Kies een nieuw wachtwoord van minimaal 10 tekens.');
                if ($pw !== ($_POST['password2'] ?? '')) throw new RuntimeException('De twee nieuwe wachtwoorden zijn niet gelijk.');
                set_setting('_admin_hash', password_hash($pw, PASSWORD_DEFAULT));
                flash('Je wachtwoord is gewijzigd.');
                back('tab=account');
        }
    } catch (RuntimeException $ex) {
        flash($ex->getMessage(), 'error');
        back($_SERVER['QUERY_STRING'] ?? '');
    }
    back();
}

render_page($_GET['tab'] ?? 'teksten');

// ---------- Weergave ----------
function render_page(string $view): void
{
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    $tab = isset(TABS[$view]) ? $view : ($view === 'setup' || $view === 'login' ? $view : 'teksten');
    $pending = is_admin() ? (int)db()->query('SELECT COUNT(*) FROM reviews WHERE status = "pending"')->fetchColumn() : 0;
    ?>
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Beheer – Edwin Molenaar</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="beheer.css">
</head>
<body class="admin">
  <header class="admin-top">
    <div class="container admin-top-inner">
      <a href="index.php" class="logo"><span class="logo-mark">EM</span> Beheer</a>
      <?php if (is_admin()): ?>
      <div class="admin-top-actions">
        <a href="../index.php" target="_blank" rel="noopener">Website bekijken &#8599;</a>
        <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="logout"><button class="linkbtn" type="submit">Uitloggen</button></form>
      </div>
      <?php endif; ?>
    </div>
    <?php if (is_admin()): ?>
    <nav class="container admin-tabs" aria-label="Onderdelen">
      <?php foreach (TABS as $key => $label): ?>
      <a href="?tab=<?= $key ?>"<?= $key === $tab ? ' aria-current="page"' : '' ?>><?= e($label) ?><?php if ($key === 'reviews' && $pending): ?> <span class="badge"><?= $pending ?></span><?php endif; ?></a>
      <?php endforeach; ?>
    </nav>
    <?php endif; ?>
  </header>

  <main class="container admin-main">
    <?php if ($flash): ?><p class="notice<?= $flash[1] === 'error' ? ' notice-error' : ' notice-ok' ?>" role="status"><?= e($flash[0]) ?></p><?php endif; ?>
    <?php ('view_' . str_replace('-', '_', $tab))(); ?>
  </main>
  <script>
    document.querySelectorAll("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
      const input = document.getElementById(btn.dataset.copy);
      try { await navigator.clipboard.writeText(input.value); btn.textContent = "Gekopieerd"; }
      catch { input.select(); btn.textContent = "Selecteer en kopieer"; }
    }));
    document.querySelectorAll("form[data-confirm]").forEach((f) => f.addEventListener("submit", (e) => {
      if (!window.confirm(f.dataset.confirm)) e.preventDefault();
    }));
  </script>
</body>
</html>
<?php
}

function view_setup(): void
{ ?>
    <section class="admin-card narrow">
      <h1>Beheer instellen</h1>
      <p class="muted">Kies het wachtwoord waarmee je straks inlogt. Dit kan maar één keer; daarna is een wachtwoord nodig.</p>
      <form method="post" class="form-plain">
        <?= csrf_field() ?><input type="hidden" name="action" value="setup">
        <label>Wachtwoord (minimaal 10 tekens)<input type="password" id="password" name="password" required minlength="10" autocomplete="new-password"></label>
        <label>Herhaal wachtwoord<input type="password" id="password2" name="password2" required minlength="10" autocomplete="new-password"></label>
        <button class="btn" type="submit">Wachtwoord instellen</button>
      </form>
    </section>
<?php }

function view_login(): void
{ ?>
    <section class="admin-card narrow">
      <h1>Inloggen</h1>
      <form method="post" class="form-plain">
        <?= csrf_field() ?><input type="hidden" name="action" value="login">
        <label>Wachtwoord<input type="password" id="password" name="password" required autocomplete="current-password" autofocus></label>
        <button class="btn" type="submit">Inloggen</button>
      </form>
      <a class="muted small" href="../index.php">&larr; Terug naar de website</a>
    </section>
<?php }

function img_src(string $path): string
{
    return '../' . $path;
}

function view_teksten(): void
{
    $group = $_GET['groep'] ?? 'algemeen';
    if (!isset(FIELD_GROUPS[$group])) $group = 'algemeen';
    ?>
    <div class="admin-split">
      <nav class="admin-side" aria-label="Pagina-onderdelen">
        <?php foreach (FIELD_GROUPS as $key => $label): ?>
        <a href="?tab=teksten&amp;groep=<?= $key ?>"<?= $key === $group ? ' aria-current="page"' : '' ?>><?= e($label) ?></a>
        <?php endforeach; ?>
      </nav>
      <section class="admin-card">
        <h1><?= e(FIELD_GROUPS[$group]) ?></h1>
        <form method="post" enctype="multipart/form-data" class="form-plain">
          <?= csrf_field() ?><input type="hidden" name="action" value="save_group"><input type="hidden" name="group" value="<?= e($group) ?>">
          <?php foreach (FIELDS as $key => $f): if ($f['group'] !== $group) continue; $val = c($key); ?>
            <?php if ($f['type'] === 'bool'): ?>
              <label class="check"><input type="checkbox" id="f_<?= $key ?>" name="f[<?= $key ?>]" value="1"<?= $val === '1' ? ' checked' : '' ?>> <span><?= e($f['label']) ?></span></label>
            <?php elseif ($f['type'] === 'image'): ?>
              <div class="img-field">
                <span class="field-label"><?= e($f['label']) ?></span>
                <div class="img-row">
                  <img src="<?= e(img_src($val)) ?>" alt="">
                  <div class="img-controls">
                    <label>Nieuwe afbeelding (JPG, PNG of WebP, max. 5 MB)<input type="file" id="img_<?= $key ?>" name="img_<?= $key ?>" accept="image/jpeg,image/png,image/webp,image/gif"></label>
                    <?php if ($val !== $f['default']): ?>
                    <label class="check"><input type="checkbox" id="reset_<?= $key ?>" name="reset[<?= $key ?>]" value="1"> <span>Standaardafbeelding terugzetten</span></label>
                    <?php endif; ?>
                  </div>
                </div>
              </div>
            <?php elseif ($f['type'] === 'text'): ?>
              <label><?= e($f['label']) ?><input id="f_<?= $key ?>" name="f[<?= $key ?>]" value="<?= e($val) ?>"></label>
            <?php else: ?>
              <label><?= e($f['label']) ?><textarea id="f_<?= $key ?>" name="f[<?= $key ?>]" rows="<?= $f['type'] === 'textarea' ? 3 : max(3, substr_count($val, "\n") + 2) ?>"><?= e($val) ?></textarea></label>
            <?php endif; ?>
          <?php endforeach; ?>
          <div class="form-actions"><button class="btn" type="submit">Opslaan</button></div>
        </form>
      </section>
    </div>
<?php }

function project_form(?array $p): void
{
    $p ??= ['id' => 0, 'title' => '', 'tag' => '', 'description' => '', 'tech' => '', 'url' => '', 'image' => '', 'sort' => 100, 'show_home' => 1];
    $id = (int)$p['id'];
    ?>
      <form method="post" enctype="multipart/form-data" class="form-plain project-form">
        <?= csrf_field() ?><input type="hidden" name="action" value="project_save"><input type="hidden" name="id" value="<?= $id ?>">
        <div class="img-row">
          <?php if ($p['image']): ?><img src="<?= e(img_src($p['image'])) ?>" alt=""><?php endif; ?>
          <div class="img-controls grow">
            <div class="field-row">
              <label>Naam<input id="title_<?= $id ?>" name="title" required value="<?= e($p['title']) ?>"></label>
              <label>Label (bijv. Android · Meldingen)<input id="tag_<?= $id ?>" name="tag" value="<?= e($p['tag']) ?>"></label>
            </div>
            <label>Website-link (laat leeg als er geen link is)<input id="url_<?= $id ?>" name="url" value="<?= e($p['url']) ?>" placeholder="https://www.voorbeeld.nl"></label>
          </div>
        </div>
        <label>Beschrijving<textarea id="description_<?= $id ?>" name="description" rows="3"><?= e($p['description']) ?></textarea></label>
        <div class="field-row">
          <label>Technieken (gescheiden door komma's)<input id="tech_<?= $id ?>" name="tech" value="<?= e($p['tech']) ?>"></label>
          <label>Volgorde (laag staat eerst)<input id="sort_<?= $id ?>" name="sort" type="number" value="<?= (int)$p['sort'] ?>"></label>
        </div>
        <label><?= $id ? 'Nieuwe afbeelding' : 'Afbeelding' ?> (JPG, PNG of WebP, max. 5 MB)<input type="file" id="image_<?= $id ?>" name="image" accept="image/jpeg,image/png,image/webp,image/gif"></label>
        <label class="check"><input type="checkbox" id="show_home_<?= $id ?>" name="show_home" value="1"<?= $p['show_home'] ? ' checked' : '' ?>> <span>Tonen op de homepage bij "Recent werk"</span></label>
        <div class="form-actions"><button class="btn" type="submit"><?= $id ? 'Opslaan' : 'Project toevoegen' ?></button></div>
      </form>
<?php }

function view_portfolio(): void
{
    $projects = db()->query('SELECT * FROM projects ORDER BY sort, id')->fetchAll();
    ?>
    <h1>Portfolio</h1>
    <p class="muted">Projecten verschijnen op de portfolio-pagina in de volgorde hieronder. Met een website-link wordt het project aanklikbaar.</p>
    <?php foreach ($projects as $p): ?>
    <section class="admin-card">
      <div class="card-head">
        <h2><?= e($p['title']) ?></h2>
        <form method="post" data-confirm="Project &quot;<?= e($p['title']) ?>&quot; verwijderen?"><?= csrf_field() ?><input type="hidden" name="action" value="project_delete"><input type="hidden" name="id" value="<?= (int)$p['id'] ?>"><button class="btn btn-danger btn-sm" type="submit">Verwijderen</button></form>
      </div>
      <?php project_form($p); ?>
    </section>
    <?php endforeach; ?>
    <section class="admin-card">
      <h2>Nieuw project</h2>
      <?php project_form(null); ?>
    </section>
<?php }

function view_reviews(): void
{
    $rows = db()->query('SELECT * FROM reviews ORDER BY CASE status WHEN "pending" THEN 0 WHEN "approved" THEN 1 ELSE 2 END, created_at DESC')->fetchAll();
    $labels = ['pending' => 'Wacht op goedkeuring', 'approved' => 'Op de homepage', 'hidden' => 'Verborgen'];
    ?>
    <h1>Reviews</h1>
    <p class="muted">Nieuwe reviews staan pas op de homepage als je ze goedkeurt. Stuur klanten een link via <a href="?tab=links">Reviewlinks</a>.</p>
    <?php if (!$rows): ?>
    <section class="admin-card"><p>Er zijn nog geen reviews. Maak bij Reviewlinks een link aan en stuur die naar een klant.</p></section>
    <?php endif; ?>
    <?php foreach ($rows as $r): ?>
    <section class="admin-card review-admin status-<?= e($r['status']) ?>">
      <div class="card-head">
        <div>
          <span class="pill pill-<?= e($r['status']) ?>"><?= e($labels[$r['status']] ?? $r['status']) ?></span>
          <h2><?= e($r['name']) ?><?php if ($r['company'] !== ''): ?> <span class="muted">· <?= e($r['company']) ?></span><?php endif; ?></h2>
        </div>
        <span class="muted small"><?= e(date('d-m-Y', strtotime($r['created_at']))) ?></span>
      </div>
      <p class="stars-admin"><?= str_repeat('&#9733;', (int)$r['rating']) . str_repeat('&#9734;', 5 - (int)$r['rating']) ?></p>
      <p><?= nl2br(e($r['body'])) ?></p>
      <div class="form-actions">
        <?php if ($r['status'] !== 'approved'): ?>
        <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="review_status"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><input type="hidden" name="status" value="approved"><button class="btn btn-sm" type="submit">Goedkeuren</button></form>
        <?php else: ?>
        <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="review_status"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><input type="hidden" name="status" value="hidden"><button class="btn btn-outline btn-sm" type="submit">Verbergen</button></form>
        <?php endif; ?>
        <form method="post" data-confirm="Deze review definitief verwijderen?"><?= csrf_field() ?><input type="hidden" name="action" value="review_delete"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><button class="btn btn-danger btn-sm" type="submit">Verwijderen</button></form>
      </div>
    </section>
    <?php endforeach; ?>
<?php }

function view_links(): void
{
    $newLink = $_SESSION['new_link'] ?? null;
    unset($_SESSION['new_link']);
    $rows = db()->query('SELECT * FROM invites ORDER BY created_at DESC')->fetchAll();
    ?>
    <h1>Reviewlinks</h1>
    <p class="muted">Maak per klant een link aan. De link werkt één keer en staat niet op Google of ergens op je website.</p>
    <section class="admin-card">
      <h2>Nieuwe link</h2>
      <form method="post" class="form-plain inline-form">
        <?= csrf_field() ?><input type="hidden" name="action" value="invite_create">
        <label>Naam van de klant<input id="client" name="client" required maxlength="80" placeholder="Bijvoorbeeld Jan de Vries"></label>
        <button class="btn" type="submit">Link maken</button>
      </form>
      <?php if ($newLink): ?>
      <div class="copy-row">
        <input id="new-link" value="<?= e($newLink) ?>" readonly onclick="this.select()">
        <button class="btn btn-sm" type="button" data-copy="new-link">Kopiëren</button>
      </div>
      <?php endif; ?>
    </section>
    <?php if ($rows): ?>
    <section class="admin-card">
      <h2>Verstuurde links</h2>
      <div class="table-wrap">
        <table class="admin-table">
          <thead><tr><th>Klant</th><th>Aangemaakt</th><th>Status</th><th>Link</th><th></th></tr></thead>
          <tbody>
          <?php foreach ($rows as $i => $r): $link = site_url() . '/review.php?t=' . $r['token']; ?>
            <tr>
              <td><?= e($r['client']) ?></td>
              <td><?= e(date('d-m-Y', strtotime($r['created_at']))) ?></td>
              <td><?= $r['used_at'] ? '<span class="pill pill-approved">Review ontvangen</span>' : '<span class="pill pill-pending">Nog open</span>' ?></td>
              <td><?php if (!$r['used_at']): ?><div class="copy-row compact"><input id="link-<?= $i ?>" value="<?= e($link) ?>" readonly onclick="this.select()"><button class="btn btn-sm btn-outline" type="button" data-copy="link-<?= $i ?>">Kopiëren</button></div><?php endif; ?></td>
              <td><form method="post" data-confirm="Deze link verwijderen? Hij werkt daarna niet meer."><?= csrf_field() ?><input type="hidden" name="action" value="invite_delete"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><button class="linkbtn danger" type="submit">Verwijderen</button></form></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </section>
    <?php endif; ?>
<?php }

function view_account(): void
{ ?>
    <h1>Account</h1>
    <section class="admin-card narrow-left">
      <h2>Wachtwoord wijzigen</h2>
      <form method="post" class="form-plain">
        <?= csrf_field() ?><input type="hidden" name="action" value="password">
        <label>Huidig wachtwoord<input type="password" id="current" name="current" required autocomplete="current-password"></label>
        <label>Nieuw wachtwoord (minimaal 10 tekens)<input type="password" id="new-password" name="password" required minlength="10" autocomplete="new-password"></label>
        <label>Herhaal nieuw wachtwoord<input type="password" id="new-password2" name="password2" required minlength="10" autocomplete="new-password"></label>
        <div class="form-actions"><button class="btn" type="submit">Wachtwoord wijzigen</button></div>
      </form>
    </section>
<?php }
