/**
 * 朝贡 UI 展示用（纯 ESM，供 Vite 开发/生产直接 import）。
 * 算法与数值须与 `shared/utils/siegeKillEconomyByRarity.cjs` 及后端 `sanGongTributeService` 一致；改经济时请同步两处。
 */

/** 三公府朝贡：每张销毁部队卡固定贡献（13-1 §11.1） */
export const TRIBUTE_CONTRIBUTION_REWARD = {
  common: 5,
  rare: 15,
  epic: 25,
  legendary: 35,
  core: 50,
};

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
  return {
    silver: 0,
    contribution: TRIBUTE_CONTRIBUTION_REWARD[br] ?? TRIBUTE_CONTRIBUTION_REWARD.common,
  };
}
