<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

layout_head('Over mij – Edwin Molenaar', 'Maak kennis met Edwin Molenaar, webdeveloper en Android-ontwikkelaar.', 'over');
?>
  <main>
<?php page_hero('Edwin Molenaar', 'Over mij', c('about_intro')); ?>

    <section class="section">
      <div class="container split">
        <div class="split-media">
          <img src="<?= e(c('about_photo')) ?>" alt="" loading="lazy">
        </div>
        <div>
          <p class="eyebrow">Wie ik ben</p>
          <h2><?= e(c('about_heading')) ?></h2>
          <p class="body-lg"><?= e(c('about_lead')) ?></p>
          <?php foreach (paragraphs('about_text') as $para): ?>
          <p><?= e($para) ?></p>
          <?php endforeach; ?>
          <div class="hero-actions">
            <a href="contact.php" class="btn">Neem contact op</a>
            <a href="portfolio.php" class="btn btn-outline">Bekijk mijn werk</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section section-dark">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">Afspraken</p>
          <h2>Waar je op kunt rekenen</h2>
        </div>
        <div class="values">
          <?php for ($i = 1; $i <= 4; $i++): ?>
          <div class="value"><span class="num">0<?= $i ?></span><h3><?= e(c("value{$i}_title")) ?></h3><p><?= e(c("value{$i}_text")) ?></p></div>
          <?php endfor; ?>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">Techniek</p>
          <h2>Waar ik mee werk</h2>
          <p>De talen en tools die ik het meest gebruik.</p>
        </div>
        <div class="skills">
          <?php for ($i = 1; $i <= 4; $i++): ?>
          <div class="skill-group">
            <h3><?= e(c("skill{$i}_title")) ?></h3>
            <div class="tech-tags"><?php foreach (lines("skill{$i}_items") as $t): ?><span><?= e($t) ?></span><?php endforeach; ?></div>
          </div>
          <?php endfor; ?>
        </div>
      </div>
    </section>

<?php cta(); ?>
  </main>
<?php layout_foot();
