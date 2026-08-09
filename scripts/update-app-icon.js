/**
 * Genera l'icona dell'app (launcher) dal logo Nucleo Volontari (logo_ansmi.png).
 * Crea ic_launcher.png e ic_launcher_round.png in ogni mipmap-*.
 * Eseguire: node scripts/update-app-icon.js
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const logoPath = path.join(projectRoot, 'src', 'assets', 'logo_ansmi.png');
const resPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

const SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

if (!fs.existsSync(logoPath)) {
  console.error('File non trovato:', logoPath);
  process.exit(1);
}

async function main() {
  const sharp = require('sharp');
  const buf = fs.readFileSync(logoPath);

  for (const [folder, size] of Object.entries(SIZES)) {
    const dir = path.join(resPath, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const png = await sharp(buf)
      .resize(size, size)
      .png({ compressionLevel: 6 })
      .toBuffer();

    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), png);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), png);
    console.log(`${folder}: ${size}x${size} ok`);
  }
  console.log('Icone app aggiornate con il logo Nucleo Volontari.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
