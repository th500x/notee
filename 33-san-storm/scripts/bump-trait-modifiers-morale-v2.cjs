/**
 * 将 brave / timid 的 trait_modifier 对齐 21 性格表（勇猛底数 6、怯懦底数 -6），
 * 以便「初始士气 = 70 + trait_modifier×2」与策划表一致（旧 brave=5 会得到 80 而非 82）。
 */
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../public/data/shared/characters.json');
const j = JSON.parse(fs.readFileSync(target, 'utf8'));
if (!Array.isArray(j.characters)) {
  console.error('unexpected JSON shape');
  process.exit(1);
}
let brave = 0;
let timid = 0;
for (const c of j.characters) {
  if (c.trait === 'brave' && c.trait_modifier === 5) {
    c.trait_modifier = 6;
    brave += 1;
  }
  if (c.trait === 'timid' && c.trait_modifier === -5) {
    c.trait_modifier = -6;
    timid += 1;
  }
}
fs.writeFileSync(target, `${JSON.stringify(j, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ file: target, braveBumped: brave, timidBumped: timid }));
