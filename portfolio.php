<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

layout_head('Portfolio – Molenaar Design', 'Websites, backends en Android-apps gebouwd door Edwin Molenaar.', 'portfolio');
?>
  <main>
<?php page_hero('Portfolio', c('portfolio_title'), c('portfolio_intro')); ?>

    <section class="section">
      <div class="container">
        <div class="cases">
          <?php foreach (projects() as $i => $p): ?>
          <article class="case<?= $i % 2 ? ' case-flip' : '' ?>">
            <div class="case-media">
              <?php if ($p['url'] !== ''): ?><a href="<?= e($p['url']) ?>" target="_blank" rel="noopener" tabindex="-1"><?php endif; ?>
              <img src="<?= e($p['image']) ?>" alt="" loading="lazy">
              <?php if ($p['url'] !== ''): ?></a><?php endif; ?>
            </div>
            <div class="case-body">
              <span class="tag"><?= e($p['tag']) ?></span>
              <h2><?= e($p['title']) ?></h2>
              <p><?= e($p['description']) ?></p>
              <?php $tech = array_filter(array_map('trim', explode(',', $p['tech'])), 'strlen'); ?>
              <?php if ($tech): ?>
              <div class="tech-tags"><?php foreach ($tech as $t): ?><span><?= e($t) ?></span><?php endforeach; ?></div>
              <?php endif; ?>
              <?php if ($p['url'] !== ''): ?>
              <a class="btn case-btn" href="<?= e($p['url']) ?>" target="_blank" rel="noopener">Bekijk de website <span aria-hidden="true">&#8599;</span></a>
              <?php endif; ?>
            </div>
          </article>
          <?php endforeach; ?>
        </div>
      </div>
    </section>

<?php cta(); ?>
  </main>
<?php layout_foot();
