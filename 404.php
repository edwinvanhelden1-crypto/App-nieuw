<?php
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

http_response_code(404);
header('X-Robots-Tag: noindex');
layout_head('Pagina niet gevonden – Molenaar Design', 'Deze pagina bestaat niet (meer).', '', true);
?>
  <main class="review-page">
    <div class="container review-box">
      <p class="eyebrow">404</p>
      <h1>Deze pagina bestaat niet</h1>
      <p>Misschien is de link verouderd, of zit er een typfout in het adres.</p>
      <div class="hero-actions">
        <a class="btn" href="/index.php">Naar de homepage</a>
        <a class="btn btn-ghost" href="/contact.php">Contact</a>
      </div>
    </div>
  </main>
<?php layout_foot();
