/**
 * data/ -> web/ kopyalama.
 * Arayuz data/ okumaz; sunucu web/ servis eder. Bu yuzden uretim sonrasi
 * kopyalama gerekir. Elle yapmayi unutmayalim diye build'e baglandi.
 *
 *   node tools/web_eksle.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const KOK = path.join(import.meta.dirname, '..');
const DOSYALAR = ['fiyat_kitabi.json', 'normlar.json'];

for (const ad of DOSYALAR) {
  const kaynak = path.join(KOK, 'data', ad);
  const hedef = path.join(KOK, 'web', ad);
  if (!fs.existsSync(kaynak)) {
    console.log(`  ATLANDI  data/${ad} yok`);
    continue;
  }
  fs.copyFileSync(kaynak, hedef);
  const { size } = fs.statSync(hedef);
  console.log(`  web/${ad.padEnd(20)} ${size.toLocaleString('tr-TR')} bayt`);
}
console.log('Tamam.');