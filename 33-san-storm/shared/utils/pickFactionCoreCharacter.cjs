/**
 * 按势力挑选 rarity=core 的将领（须与 .js 同步）。
 * 用于城池 initial_lord、关卡等「自动配核心将」场景。
 */

const AUTO_INITIAL_LORD_CITY_TYPES = Object.freeze(['city_major', 'city_medium']);

function cityTypeUsesAutoInitialLord(cityType) {
  return AUTO_INITIAL_LORD_CITY_TYPES.includes(String(cityType || '').trim());
}

function characterIdOf(row) {
  const id = row?.characterId ?? row?.character_id ?? row?.id;
  if (id == null) return null;
  const s = String(id).trim();
  return s === '' ? null : s;
}

function characterFactionKeys(row) {
  const keys = [];
  for (const k of [row?.faction, row?.factionId, row?.faction_id]) {
    if (k == null) continue;
    const s = String(k).trim();
    if (s) keys.push(s);
  }
  return keys;
}

function characterRarity(row) {
  return String(row?.rarity || '').trim().toLowerCase();
}

function characterSeason(row) {
  const s = row?.season;
  if (s == null || String(s).trim() === '') return null;
  return String(s).trim();
}

function listFactionCoreCharacters(characters, opts = {}) {
  const factionKey = opts.factionKey != null ? String(opts.factionKey).trim() : '';
  if (!factionKey || !Array.isArray(characters) || !characters.length) return [];
  const season = opts.season != null && String(opts.season).trim() !== '' ? String(opts.season).trim() : null;

  return characters.filter((row) => {
    if (characterRarity(row) !== 'core') return false;
    if (!characterFactionKeys(row).includes(factionKey)) return false;
    if (season) {
      const rs = characterSeason(row);
      if (rs && rs !== season) return false;
    }
    return characterIdOf(row) != null;
  });
}

function pickFactionCoreCharacterId(characters, opts = {}) {
  const pool = listFactionCoreCharacters(characters, opts);
  if (!pool.length) return null;
  const rnd = typeof opts.random === 'function' ? opts.random : Math.random;
  const u = Number(rnd());
  const r = Number.isFinite(u) ? Math.min(Math.max(u, 0), 0.999999999) : Math.random();
  const idx = Math.floor(r * pool.length);
  return characterIdOf(pool[idx]);
}

module.exports = {
  AUTO_INITIAL_LORD_CITY_TYPES,
  cityTypeUsesAutoInitialLord,
  listFactionCoreCharacters,
  pickFactionCoreCharacterId,
};
