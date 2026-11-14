// Zet icon.svg om naar Android-launcherpictogrammen (alle dichtheden).
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const svg = fs.readFileSync(path.join(__dirname, '..', 'gezichtwissel', 'icon.svg'), 'utf8');
const RES = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage();
  const shot = async (html, size, file) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    await page.screenshot({ path: file, omitBackground: true });
  };
  for (const [d, s] of Object.entries(sizes)) {
    const dir = path.join(RES, `mipmap-${d}`);
    const full = svg.replace('<svg ', `<svg width="${s}" height="${s}" `);
    await shot(full, s, path.join(dir, 'ic_launcher.png'));
    await shot(`<div style="width:${s}px;height:${s}px;border-radius:50%;overflow:hidden">${full}</div>`, s, path.join(dir, 'ic_launcher_round.png'));
    // Adaptieve voorgrond: 108dp vlak, pictogram binnen de veilige zone.
    const f = Math.round(s * 108 / 48), inner = Math.round(f * 0.62);
    const fg = svg.replace('<rect width="512" height="512" rx="112" fill="url(#g)"/>', '').replace('<svg ', `<svg width="${inner}" height="${inner}" `);
    await shot(`<div style="width:${f}px;height:${f}px;display:flex;align-items:center;justify-content:center">${fg}</div>`, f, path.join(dir, 'ic_launcher_foreground.png'));
  }
  await b.close();
})();
