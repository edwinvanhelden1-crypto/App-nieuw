<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

const TYPES = ['Website', 'Webapplicatie / backend', 'Android-app', 'Combinatie'];
const BUDGETS = ['Weet ik nog niet', 'Tot € 2.500', '€ 2.500 – € 7.500', '€ 7.500 – € 15.000', 'Meer dan € 15.000'];

$error = '';
$old = ['naam' => '', 'email' => '', 'type' => TYPES[0], 'budget' => BUDGETS[0], 'bericht' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    foreach ($old as $k => $_) $old[$k] = trim((string)($_POST[$k] ?? ''));
    $recent = array_filter($_SESSION['sent'] ?? [], fn($t) => $t > time() - 3600);

    if (($_POST['website'] ?? '') !== '' || time() - (int)($_SESSION['form_shown'] ?? 0) < 3) {
        // Spam: onzichtbaar veld ingevuld of binnen 3 seconden verstuurd. Doe alsof het gelukt is.
        header('Location: contact.php?verzonden=1#formulier');
        exit;
    } elseif (count($recent) >= 5) {
        $error = 'Je hebt net al een paar berichten gestuurd. Probeer het over een uur nog eens.';
    } elseif ($old['naam'] === '' || mb_strlen($old['naam']) > 100 || preg_match('/[\r\n]/', $old['naam'])) {
        $error = 'Vul je naam in.';
    } elseif (!filter_var($old['email'], FILTER_VALIDATE_EMAIL) || mb_strlen($old['email']) > 150) {
        $error = 'Dit e-mailadres klopt niet helemaal. Ik heb het nodig om je te antwoorden.';
    } elseif (!in_array($old['type'], TYPES, true) || !in_array($old['budget'], BUDGETS, true)) {
        $error = 'Kies wat je wilt laten bouwen en een budget.';
    } elseif (mb_strlen($old['bericht']) < 10 || mb_strlen($old['bericht']) > 5000) {
        $error = 'Je bericht is wel erg kort. Vertel iets meer over wat je wilt laten maken.';
    } else {
        $host = preg_replace('/[^a-z0-9.-]/i', '', explode(':', $_SERVER['HTTP_HOST'] ?? 'localhost')[0]);
        $host = preg_replace('/^www\./i', '', $host);
        $headers = implode("\r\n", [
            'From: Website Edwin Molenaar <noreply@' . $host . '>',
            'Reply-To: ' . $old['email'],
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ]);
        $body = "Naam: {$old['naam']}\nE-mail: {$old['email']}\nWat: {$old['type']}\nBudget: {$old['budget']}\n\n{$old['bericht']}\n";
        $subject = mb_encode_mimeheader('Nieuw bericht via de website: ' . $old['type'], 'UTF-8');
        $mailed = @mail(c('contact_email'), $subject, $body, $headers) ? 1 : 0;

        db()->prepare('INSERT INTO messages (name, email, type, budget, body, mailed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$old['naam'], $old['email'], $old['type'], $old['budget'], $old['bericht'], $mailed, date('c')]);
        $_SESSION['sent'] = [...$recent, time()];
        header('Location: contact.php?verzonden=1#formulier');
        exit;
    }
}
$_SESSION['form_shown'] = time();
$sent = isset($_GET['verzonden']);

layout_head('Contact – Edwin Molenaar', 'Neem contact op met Edwin Molenaar voor een website, backend of Android-app.', 'contact');
?>
  <main>
<?php page_hero('Contact', 'Neem contact op', c('contact_intro')); ?>

    <section class="section">
      <div class="container contact">
        <div>
          <h2>Goed om te weten</h2>
          <p class="muted">Je bericht komt rechtstreeks bij mij binnen, niet bij een helpdesk.</p>
          <ul class="contact-cards">
            <li>
              <svg viewBox="0 0 24 24"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/></svg>
              <div><strong>Overleg</strong><span><?= e(c('contact_meeting')) ?></span></div>
            </li>
            <li>
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              <div><strong>Reactietijd</strong><span><?= e(c('contact_response')) ?></span></div>
            </li>
          </ul>
        </div>
        <?php if ($sent): ?>
        <div class="form" id="formulier" role="status">
          <h3>Bedankt voor je bericht</h3>
          <p class="muted">Ik heb je bericht ontvangen. Je krijgt binnen een werkdag antwoord op het e-mailadres dat je hebt ingevuld.</p>
          <a class="btn btn-outline" href="contact.php#formulier">Nog een bericht sturen</a>
        </div>
        <?php else: ?>
        <form class="form" id="formulier" method="post" action="contact.php#formulier">
          <?= csrf_field() ?>
          <h3>Stuur een bericht</h3>
          <?php if ($error): ?><p class="notice notice-error" role="alert"><?= e($error) ?></p><?php endif; ?>
          <div class="field-row">
            <label>Naam<input id="naam" name="naam" required maxlength="100" autocomplete="name" value="<?= e($old['naam']) ?>"></label>
            <label>E-mail<input id="email" name="email" type="email" required maxlength="150" autocomplete="email" value="<?= e($old['email']) ?>"></label>
          </div>
          <div class="field-row">
            <label>Wat wil je laten bouwen?
              <select id="type" name="type">
                <?php foreach (TYPES as $t): ?><option<?= $t === $old['type'] ? ' selected' : '' ?>><?= e($t) ?></option><?php endforeach; ?>
              </select>
            </label>
            <label>Budget (indicatie)
              <select id="budget" name="budget">
                <?php foreach (BUDGETS as $b): ?><option<?= $b === $old['budget'] ? ' selected' : '' ?>><?= e($b) ?></option><?php endforeach; ?>
              </select>
            </label>
          </div>
          <label>Bericht<textarea id="bericht" name="bericht" rows="6" required minlength="10" maxlength="5000" placeholder="Wat wil je laten maken, en wanneer moet het klaar zijn?"><?= e($old['bericht']) ?></textarea></label>
          <div class="hp" aria-hidden="true"><label>Laat dit veld leeg<input name="website" tabindex="-1" autocomplete="off"></label></div>
          <button class="btn" type="submit">Versturen</button>
        </form>
        <?php endif; ?>
      </div>
    </section>

    <section class="section section-dark">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">Vragen</p>
          <h2>Veelgestelde vragen</h2>
        </div>
        <div class="faq">
          <?php for ($i = 1; $i <= 4; $i++): ?>
          <details><summary><?= e(c("faq{$i}_q")) ?></summary><p><?= e(c("faq{$i}_a")) ?></p></details>
          <?php endfor; ?>
        </div>
      </div>
    </section>
  </main>
<?php layout_foot();
