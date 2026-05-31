require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../database/connection');
const configService = require('../services/configService');

function cardMatchesRecruitPool(cardId, poolType, san0Band) {
  const band = String(san0Band ?? '').trim();
  if (!band) return false;
  const id = String(cardId || '');
  if (!id.startsWith('san_0_')) return false;
  const re = poolType === 'troop' ? /_troop_(\d)/i : /_char_(\d)/i;
  const m = id.match(re);
  const d = m ? m[1] : '';
  return d === band;
}

(async () => {
  const [r] = await pool.query(
    "SELECT COUNT(*) AS c FROM config_characters WHERE season = 'san_0'",
  );
  console.log('DB san_0 count:', r[0].c);

  const [band2] = await pool.query(
    "SELECT character_id FROM config_characters WHERE character_id LIKE 'san_0_char_2%' LIMIT 5",
  );
  console.log('DB band2 sample:', band2.map((x) => x.character_id));

  const api = await configService.getCharacters({ season: 'san_0' });
  console.log('API san_0 count:', api.length);

  const filtered = api.filter((c) => cardMatchesRecruitPool(c.id, 'character', '2'));
  console.log('Filtered band2 for Han:', filtered.length);
  console.log(
    'Sample match 2001:',
    cardMatchesRecruitPool('san_0_char_2001', 'character', '2'),
  );
  if (filtered[0]) console.log('First filtered id:', filtered[0].id);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
