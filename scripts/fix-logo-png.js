/**
 * Ricodifica logo_ansmi.png in PNG 8-bit RGBA compatibile con AAPT2.
 * Eseguire: node scripts/fix-logo-png.js
 */
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, '..', 'src', 'assets', 'logo_ansmi.png');
if (!fs.existsSync(logoPath)) {
  console.error('File non trovato:', logoPath);
  process.exit(1);
}

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('Installa sharp: npm install --save-dev sharp');
    process.exit(1);
  }
  const buf = fs.readFileSync(logoPath);
  const out = await sharp(buf)
    .ensureAlpha()
    .png({ compressionLevel: 6, palette: false })
    .toBuffer();
  fs.writeFileSync(logoPath, out);
  console.log('Logo ricodificato:', logoPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
