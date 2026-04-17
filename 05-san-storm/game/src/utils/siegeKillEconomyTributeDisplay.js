/**
 * 朝贡 UI 展示用（纯 ESM，供 Vite 开发/生产直接 import）。
 * 算法与数值须与 `shared/utils/siegeKillEconomyByRarity.cjs` 及后端 `sanGongTributeService` 一致；改经济时请同步两处。
 */

const KILL_SILVER_REWARD = {
  core: 50,
  legendary: 40,
  epic: 30,
  rare: 20,
  common: 10,
};

const WIN_CONTRIBUTION_REWARD_SIEGE_NPC = {
  core: 5,
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

const TRIBUTE_REWARD_MULTIPLIER = 1.5;

function normalizeSiegeRarity(r) {
  const x = String(r || '').toLowerCase();
  if (x === 'core' || x === 'legendary' || x === 'epic' || x === 'rare' || x === 'common') return x;
  return 'common';
}

/**
 * @param {string} rarity
 * @returns {{ silver: number, contribution: number }}
 */
export function tributeCompensationPerTroopCard(rarity) {
  const br = normalizeSiegeRarity(rarity);
  const baseSilver = KILL_SILVER_REWARD[br] ?? 10;
  const baseContrib = WIN_CONTRIBUTION_REWARD_SIEGE_NPC[br] ?? 1;
  return {
    silver: Math.floor(TRIBUTE_REWARD_MULTIPLIER * baseSilver),
    contribution: Math.floor(TRIBUTE_REWARD_MULTIPLIER * baseContrib),
  };
}
