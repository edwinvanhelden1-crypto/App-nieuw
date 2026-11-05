<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

$email = c('contact_email');
layout_head('Contact – Edwin Molenaar', 'Neem contact op met Edwin Molenaar voor een website, backend of Android-app.', 'contact');
?>
  <main>
<?php page_hero('Contact', 'Neem contact op', c('contact_intro')); ?>

    <section class="section">
      <div class="container contact">
        <div>
          <h2>Gegevens</h2>
          <p class="muted">Vul het formulier in of mail me direct.</p>
          <ul class="contact-cards">
            <li>
              <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
              <div><strong>E-mail</strong><a href="mailto:<?= e($email) ?>"><?= e($email) ?></a></div>
            </li>
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
        <form class="form" id="contact-form" data-email="<?= e($email) ?>">
          <h3>Stuur een bericht</h3>
          <div class="field-row">
            <label>Naam<input name="naam" required autocomplete="name"></label>
            <label>E-mail<input name="email" type="email" required autocomplete="email"></label>
          </div>
          <div class="field-row">
            <label>Wat wil je laten bouwen?
              <select name="type">
                <option>Website</option>
                <option>Webapplicatie / backend</option>
                <option>Android-app</option>
                <option>Combinatie</option>
              </select>
            </label>
            <label>Budget (indicatie)
              <select name="budget">
                <option>Weet ik nog niet</option>
                <option>Tot &euro; 2.500</option>
                <option>&euro; 2.500 – &euro; 7.500</option>
                <option>&euro; 7.500 – &euro; 15.000</option>
                <option>Meer dan &euro; 15.000</option>
              </select>
            </label>
          </div>
          <label>Bericht<textarea name="bericht" rows="6" required placeholder="Wat wil je laten maken, en wanneer moet het klaar zijn?"></textarea></label>
          <button class="btn" type="submit">Versturen</button>
        </form>
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
