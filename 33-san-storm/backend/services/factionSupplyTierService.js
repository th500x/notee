/**
 * 势力五大属性 → 军需档位 S～D（与 11-1-FACTION_SYSTEM.md 阈值表一致）
 * 输入为势力层五维标量（`factions.total_*` 或与 01 §3.2.10 / 12-2 §2.4.1 一致的实时值：大中小城均值×(1+0.05n)，不含关隘/据点）。
 */

const TIERS = [
  { tier: 'S', population: 50_000, stat: 500 },
  { tier: 'A', population: 30_000, stat: 300 },
  { tier: 'B', population: 10_000, stat: 100 },
  { tier: 'C', population: 3000, stat: 30 },
  { tier: 'D', population: 1000, stat: 10 },
];

/**
 * @param {{ population: number, trading: number, farming: number, military: number, culture: number }} five
 * @returns {{ tier: string | null, matched: typeof TIERS[0] | null }}
 */
function computeSupplyTier(five) {
  const pop = Number(five.population) || 0;
  const tr = Number(five.trading) || 0;
  const fa = Number(five.farming) || 0;
  const mi = Number(five.military) || 0;
  const cu = Number(five.culture) || 0;
  for (const row of TIERS) {
    if (
      pop >= row.population &&
      tr >= row.stat &&
      fa >= row.stat &&
      mi >= row.stat &&
      cu >= row.stat
    ) {
      return { tier: row.tier, matched: row };
    }
  }
  return { tier: null, matched: null };
}

module.exports = {
  computeSupplyTier,
  TIERS,
};
