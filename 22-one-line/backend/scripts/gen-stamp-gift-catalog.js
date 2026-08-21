/**
 * One-shot: read notee-go StampCatalog.kt → lib/stampGiftCatalog.js
 * Usage: node scripts/gen-stamp-gift-catalog.js
 */
const fs = require('fs');
const path = require('path');

const catalogKt = path.resolve(
  __dirname,
  '../../../../notee-go/app/src/main/java/com/notee/go/stamp/StampCatalog.kt'
);
const outFile = path.join(__dirname, '../lib/stampGiftCatalog.js');

const COUNTRY = {
  Thailand: 'th',
  Malaysia: 'my',
  Vietnam: 'vn',
  Indonesia: 'id',
  China: 'cn',
  Korea: 'kr',
  Japan: 'jp',
  France: 'fr',
  Germany: 'de',
  Netherlands: 'nl',
  Austria: 'at',
  Italy: 'it',
  UnitedKingdom: 'uk',
  Greece: 'gr',
  Spain: 'es',
  Portugal: 'pt',
  Turkey: 'tr',
  UnitedStates: 'us',
  Mexico: 'mx',
  Canada: 'ca',
};

const FN_TO_CC = {
  th: 'th',
  my: 'my',
  vn: 'vn',
  idn: 'id',
  cn: 'cn',
  kr: 'kr',
  jp: 'jp',
  fr: 'fr',
  de: 'de',
  nl: 'nl',
  at: 'at',
  ita: 'it',
  uk: 'uk',
  gr: 'gr',
  es: 'es',
  pt: 'pt',
  tr: 'tr',
  us: 'us',
  mx: 'mx',
  ca: 'ca',
};

const src = fs.readFileSync(catalogKt, 'utf8');
const region = {};
const re = /\b(th|my|vn|idn|cn|kr|jp|fr|de|nl|at|ita|uk|gr|es|pt|tr|us|mx|ca)\(\s*"([^"]+)"/g;
let m;
while ((m = re.exec(src))) {
  const cc = FN_TO_CC[m[1]];
  const id = `${cc}_${m[2]}`;
  region[cc] = region[cc] || [];
  if (!region[cc].includes(id)) region[cc].push(id);
}

const limited = {};
const lim = /limited\(\s*"([^"]+)"[\s\S]*?StampCountry\.(\w+)/g;
while ((m = lim.exec(src))) {
  const cc = COUNTRY[m[2]];
  if (!cc) throw new Error(`unknown origin ${m[2]}`);
  const id = `${cc}_${m[1]}`;
  limited[cc] = limited[cc] || [];
  if (!limited[cc].includes(id)) limited[cc].push(id);
}

const header =
  '/**\n' +
  ' * Stamp ids for gift:create --series / --country.\n' +
  ' * Generated from sibling notee-go StampCatalog.kt; do not invent ids here.\n' +
  ' */\n';
fs.writeFileSync(outFile, `${header}module.exports = ${JSON.stringify({ region, limited }, null, 2)};\n`);
const rCount = Object.values(region).reduce((n, a) => n + a.length, 0);
const lCount = Object.values(limited).reduce((n, a) => n + a.length, 0);
console.log(`wrote ${outFile}`);
console.log(`region=${rCount} limited=${lCount} th.region=${region.th.length} th.limited=${limited.th}`);
