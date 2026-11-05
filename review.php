<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

header('X-Robots-Tag: noindex');

$token = (string)($_GET['t'] ?? $_POST['t'] ?? '');
$invite = null;
if (preg_match('/^[a-f0-9]{32}$/', $token)) {
    $st = db()->prepare('SELECT * FROM invites WHERE token = ?');
    $st->execute([$token]);
    $invite = $st->fetch() ?: null;
}

$state = 'form';
$error = '';
$old = ['name' => $invite['client'] ?? '', 'company' => '', 'rating' => 0, 'body' => ''];

if (!$invite) {
    $state = 'invalid';
} elseif ($invite['used_at']) {
    $state = 'used';
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $old = [
        'name' => trim((string)($_POST['name'] ?? '')),
        'company' => trim((string)($_POST['company'] ?? '')),
        'rating' => (int)($_POST['rating'] ?? 0),
        'body' => trim((string)($_POST['body'] ?? '')),
    ];
    if ($old['name'] === '' || mb_strlen($old['name']) > 80) {
        $error = 'Vul je naam in (maximaal 80 tekens).';
    } elseif (mb_strlen($old['company']) > 80) {
        $error = 'De bedrijfsnaam mag maximaal 80 tekens zijn.';
    } elseif ($old['rating'] < 1 || $old['rating'] > 5) {
        $error = 'Kies een aantal sterren.';
    } elseif (mb_strlen($old['body']) < 10 || mb_strlen($old['body']) > 2000) {
        $error = 'Schrijf een review van minimaal 10 en maximaal 2000 tekens.';
    } elseif (empty($_POST['consent'])) {
        $error = 'Geef toestemming om je review op de website te zetten.';
    } else {
        $pdo = db();
        $pdo->beginTransaction();
        // Alleen een ongebruikte link mag een review opslaan, ook bij twee keer verzenden.
        $upd = $pdo->prepare('UPDATE invites SET used_at = ? WHERE id = ? AND used_at IS NULL');
        $upd->execute([date('c'), $invite['id']]);
        if ($upd->rowCount() === 1) {
            $pdo->prepare('INSERT INTO reviews (invite_id, name, company, rating, body, status, created_at) VALUES (?, ?, ?, ?, ?, "pending", ?)')
                ->execute([$invite['id'], $old['name'], $old['company'], $old['rating'], $old['body'], date('c')]);
            $state = 'thanks';
        } else {
            $state = 'used';
        }
        $pdo->commit();
    }
}

layout_head('Review schrijven – Edwin Molenaar', 'Schrijf een review over de samenwerking met Edwin Molenaar.', '');
?>
  <main class="review-page">
    <div class="container review-box">
      <?php if ($state === 'invalid'): ?>
        <h1>Deze link werkt niet</h1>
        <p>Controleer of je de hele link hebt gekopieerd. Werkt hij nog steeds niet? Vraag dan een nieuwe link aan Edwin.</p>
      <?php elseif ($state === 'used'): ?>
        <h1>Deze link is al gebruikt</h1>
        <p>Met deze link is al een review geplaatst. Bedankt daarvoor! Wil je iets aanpassen? Neem dan contact op met Edwin.</p>
      <?php elseif ($state === 'thanks'): ?>
        <h1>Bedankt voor je review</h1>
        <p>Je review is ontvangen. Hij verschijnt op de website zodra Edwin hem heeft bekeken.</p>
        <p><a class="btn" href="index.php">Naar de website</a></p>
      <?php else: ?>
        <p class="eyebrow">Review</p>
        <h1>Hoe was de samenwerking?</h1>
        <p>Je review komt op de website van Edwin te staan, nadat Edwin hem heeft bekeken. Deze link werkt één keer.</p>
        <form class="form" method="post" action="review.php">
          <input type="hidden" name="t" value="<?= e($token) ?>">
          <?php if ($error): ?><p class="notice notice-error" role="alert"><?= e($error) ?></p><?php endif; ?>
          <div class="field-row">
            <label>Naam<input id="name" name="name" required maxlength="80" value="<?= e($old['name']) ?>" autocomplete="name"></label>
            <label>Bedrijf (optioneel)<input id="company" name="company" maxlength="80" value="<?= e($old['company']) ?>" autocomplete="organization"></label>
          </div>
          <div>
            <p class="rating-label" id="rating-label">Aantal sterren</p>
            <div class="rating" role="radiogroup" aria-labelledby="rating-label">
              <?php for ($i = 5; $i >= 1; $i--): ?>
              <input type="radio" id="star<?= $i ?>" name="rating" value="<?= $i ?>"<?= $old['rating'] === $i ? ' checked' : '' ?> required>
              <label for="star<?= $i ?>" title="<?= $i ?> van 5">&#9733;<span class="sr-only"><?= $i ?> van 5</span></label>
              <?php endfor; ?>
            </div>
          </div>
          <label>Je review<textarea id="body" name="body" rows="6" required minlength="10" maxlength="2000" placeholder="Wat heeft Edwin voor je gemaakt en hoe beviel het?"><?= e($old['body']) ?></textarea></label>
          <label class="check"><input type="checkbox" id="consent" name="consent" value="1" required> <span>Mijn naam, bedrijfsnaam en review mogen op de website van Edwin Molenaar staan.</span></label>
          <button class="btn" type="submit">Review versturen</button>
        </form>
      <?php endif; ?>
    </div>
  </main>
<?php layout_foot();
