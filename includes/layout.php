<?php
function layout_head(string $title, string $description, string $active): void
{
    $link = function (string $href, string $label, string $key) use ($active): string {
        $cur = $key === $active ? ' class="active" aria-current="page"' : '';
        return '<a href="' . $href . '"' . $cur . '>' . $label . '</a>';
    };
    ?>
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title) ?></title>
  <meta name="description" content="<?= e($description) ?>">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%232f80ff'/%3E%3Ctext x='16' y='22' font-family='Arial' font-weight='700' font-size='15' text-anchor='middle' fill='%23ffffff'%3EEM%3C/text%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="nav" id="nav">
    <div class="container nav-inner">
      <a href="index.php" class="logo"><span class="logo-mark">EM</span> Edwin Molenaar</a>
      <button class="nav-toggle" id="nav-toggle" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <nav class="nav-links" id="nav-links">
        <?= $link('index.php', 'Home', 'home') ?>
        <?= $link('index.php#diensten', 'Diensten', 'diensten') ?>
        <?= $link('portfolio.php', 'Portfolio', 'portfolio') ?>
        <?= $link('over-mij.php', 'Over mij', 'over') ?>
        <a href="contact.php" class="btn btn-sm<?= $active === 'contact' ? ' active' : '' ?>">Contact</a>
      </nav>
    </div>
  </header>
<?php
}

function page_hero(string $eyebrow, string $title, string $lead): void
{
    ?>
    <section class="page-hero">
      <img class="hero-bg" src="<?= e(c('page_bg')) ?>" alt="" aria-hidden="true">
      <div class="container hero-content">
        <p class="eyebrow"><?= e($eyebrow) ?></p>
        <h1><?= e($title) ?></h1>
        <p class="lead"><?= e($lead) ?></p>
      </div>
    </section>
<?php
}

function cta(): void
{
    ?>
    <section class="cta">
      <div class="container cta-inner">
        <div>
          <h2><?= e(c('cta_title')) ?></h2>
          <p><?= e(c('cta_text')) ?></p>
        </div>
        <a href="contact.php" class="btn">Neem contact op</a>
      </div>
    </section>
<?php
}

function layout_foot(): void
{
    $email = c('contact_email');
    ?>
  <footer class="footer">
    <div class="container footer-grid">
      <div>
        <a href="index.php" class="logo"><span class="logo-mark">EM</span> Edwin Molenaar</a>
        <p><?= e(c('footer_text')) ?></p>
      </div>
      <div>
        <h4>Pagina's</h4>
        <a href="index.php">Home</a>
        <a href="portfolio.php">Portfolio</a>
        <a href="over-mij.php">Over mij</a>
        <a href="contact.php">Contact</a>
      </div>
      <div>
        <h4>Diensten</h4>
        <?php for ($i = 1; $i <= 3; $i++): ?>
        <a href="index.php#diensten"><?= e(c("service{$i}_title")) ?></a>
        <?php endfor; ?>
      </div>
      <div>
        <h4>Contact</h4>
        <a href="mailto:<?= e($email) ?>"><?= e($email) ?></a>
        <span>Nederland</span>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>&copy; <?= date('Y') ?> Edwin Molenaar</span>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>
<?php
}

/** Projectkaart voor de homepage; met een URL wordt de hele kaart een link. */
function project_card(array $p): void
{
    $tagOpen = $p['url'] !== ''
        ? '<a class="project project-link" href="' . e($p['url']) . '" target="_blank" rel="noopener">'
        : '<article class="project">';
    $tagClose = $p['url'] !== '' ? '</a>' : '</article>';
    echo $tagOpen;
    ?>
            <img src="<?= e($p['image']) ?>" alt="" loading="lazy">
            <div class="project-body">
              <span class="tag"><?= e($p['tag']) ?></span>
              <h3><?= e($p['title']) ?></h3>
              <p><?= e($p['description']) ?></p>
              <?php if ($p['url'] !== ''): ?><span class="visit">Bekijk de website <span aria-hidden="true">&#8599;</span></span><?php endif; ?>
            </div>
<?php
    echo $tagClose . "\n";
}

function stars(int $rating): string
{
    $rating = max(1, min(5, $rating));
    return '<span class="stars" aria-label="' . $rating . ' van 5 sterren">'
        . str_repeat('<span class="star on">&#9733;</span>', $rating)
        . str_repeat('<span class="star">&#9733;</span>', 5 - $rating) . '</span>';
}

function projects(bool $homeOnly = false): array
{
    $sql = 'SELECT * FROM projects' . ($homeOnly ? ' WHERE show_home = 1' : '') . ' ORDER BY sort, id';
    return db()->query($sql)->fetchAll();
}

function approved_reviews(int $limit = 6): array
{
    $st = db()->prepare('SELECT * FROM reviews WHERE status = "approved" ORDER BY created_at DESC LIMIT ?');
    $st->execute([$limit]);
    return $st->fetchAll();
}
