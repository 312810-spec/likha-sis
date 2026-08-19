const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync('final.svg', 'utf8');
const out = 'LIKHA-SIS-Session-Recap-2026-08-17.png';
sharp(Buffer.from(svg), { density: 300 })
  .resize(2480, 3520, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile(out)
  .then((i) => console.log('PNG written:', out, i.width + 'x' + i.height))
  .catch((e) => { console.error('RENDER FAIL:', e.message); process.exit(1); });
