<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

$icons = [
    1 => '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    2 => '<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 6.5h.01M7 17.5h.01"/>',
    3 => '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
];
$homeProjects = projects(true);
$reviews = approved_reviews();

layout_head('Molenaar Design – websites, backend en Android-apps', 'Molenaar Design: Edwin Molenaar bouwt websites, backends en Android-apps voor ondernemers.', 'home');
?>
  <main>
    <section class="hero">
      <img class="hero-bg" src="<?= e(c('page_bg')) ?>" alt="" aria-hidden="true">
      <div class="container hero-content hero-grid">
        <div>
          <?php if (c('available') === '1'): ?>
          <p class="status"><span class="dot"></span><?= e(c('available_text')) ?></p>
          <?php endif; ?>
          <p class="eyebrow"><?= e(c('hero_eyebrow')) ?></p>
          <h1><?= e(c('hero_title')) ?> <span class="accent"><?= e(c('hero_title_accent')) ?></span></h1>
          <p class="lead"><?= e(c('hero_intro')) ?></p>
          <div class="hero-actions">
            <a href="contact.php" class="btn">Neem contact op</a>
            <a href="portfolio.php" class="btn btn-ghost">Bekijk mijn werk</a>
          </div>
          <ul class="hero-facts">
            <?php foreach (lines('hero_facts') as $fact): ?>
            <li><?= e($fact) ?></li>
            <?php endforeach; ?>
          </ul>
        </div>
        <img class="hero-art" src="<?= e(c('hero_image')) ?>" alt="">
      </div>
    </section>

    <section class="section" id="diensten">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">Diensten</p>
          <h2><?= e(c('services_title')) ?></h2>
          <p><?= e(c('services_intro')) ?></p>
        </div>
        <div class="services">
          <?php for ($i = 1; $i <= 3; $i++): ?>
          <article class="service">
            <div class="service-img"><img src="<?= e(c("service{$i}_image")) ?>" alt="" loading="lazy"></div>
            <div class="service-body">
              <div class="icon"><svg viewBox="0 0 24 24"><?= $icons[$i] ?></svg></div>
              <h3><?= e(c("service{$i}_title")) ?></h3>
              <p><?= e(c("service{$i}_text")) ?></p>
              <ul class="checks">
                <?php foreach (lines("service{$i}_items") as $item): ?>
                <li><?= e($item) ?></li>
                <?php endforeach; ?>
              </ul>
            </div>
          </article>
          <?php endfor; ?>
        </div>
      </div>
    </section>

    <section class="tech-band">
      <div class="container tech-inner">
        <?php foreach (lines('tech_band') as $t): ?><span><?= e($t) ?></span><?php endforeach; ?>
      </div>
    </section>

    <?php if ($homeProjects): ?>
    <section class="section">
      <div class="container">
        <div class="section-head section-head-row">
          <div>
            <p class="eyebrow">Portfolio</p>
            <h2>Recent werk</h2>
          </div>
          <a href="portfolio.php" class="link-arrow">Alle projecten &rarr;</a>
        </div>
        <div class="projects<?= count($homeProjects) === 2 ? ' projects-duo' : '' ?>">
          <?php foreach ($homeProjects as $p) project_card($p); ?>
        </div>
      </div>
    </section>
    <?php endif; ?>

    <?php if ($reviews): ?>
    <section class="section section-dark" id="reviews">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">Reviews</p>
          <h2><?= e(c('reviews_title')) ?></h2>
          <p><?= e(c('reviews_intro')) ?></p>
        </div>
        <div class="reviews">
          <?php foreach ($reviews as $r): ?>
          <figure class="review">
            <?= stars((int)$r['rating']) ?>
            <blockquote><?= nl2br(e($r['body'])) ?></blockquote>
            <figcaption><strong><?= e($r['name']) ?></strong><?php if ($r['company'] !== ''): ?><span><?= e($r['company']) ?></span><?php endif; ?></figcaption>
          </figure>
          <?php endforeach; ?>
        </div>
      </div>
    </section>
    <?php endif; ?>

    <section class="section section-light" id="werkwijze">
      <div class="container split">
        <div class="split-media">
          <img src="<?= e(c('process_image')) ?>" alt="" loading="lazy">
        </div>
        <div>
          <p class="eyebrow">Werkwijze</p>
          <h2><?= e(c('process_title')) ?></h2>
          <ol class="steps">
            <?php for ($i = 1; $i <= 4; $i++): ?>
            <li><span class="num">0<?= $i ?></span><div><h3><?= e(c("step{$i}_title")) ?></h3><p><?= e(c("step{$i}_text")) ?></p></div></li>
            <?php endfor; ?>
          </ol>
        </div>
      </div>
    </section>

    <section class="section" id="samenwerken">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">Samenwerken</p>
          <h2><?= e(c('plans_title')) ?></h2>
          <p><?= e(c('plans_intro')) ?></p>
        </div>
        <div class="plans">
          <?php for ($i = 1; $i <= 3; $i++): ?>
          <article class="plan<?= $i === 2 ? ' plan-featured' : '' ?>">
            <h3><?= e(c("plan{$i}_title")) ?></h3>
            <p class="plan-sub"><?= e(c("plan{$i}_sub")) ?></p>
            <p><?= e(c("plan{$i}_text")) ?></p>
            <ul class="checks">
              <?php foreach (lines("plan{$i}_items") as $item): ?>
              <li><?= e($item) ?></li>
              <?php endforeach; ?>
            </ul>
          </article>
          <?php endfor; ?>
        </div>
      </div>
    </section>

<?php cta(); ?>
  </main>
<?php layout_foot(true);
