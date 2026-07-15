/**
 * 势力玩法加成解析（config_factions.faction_bonuses）
 * 须与 factionGameplayBonuses.js 保持同步
 *
 * @module shared/utils/factionGameplayBonuses
 */

/**
 * @param {unknown} raw
 * @returns {Array<{ key?: string, value?: unknown, itemId?: string, item_id?: string }>}
 */
function parseFactionBonusesArray(raw) {
  if (!raw) return [];
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
}

/**
 * @param {unknown} factionBonuses
 * @param {string} key
 */
function findFactionBonus(factionBonuses, key) {
  return parseFactionBonusesArray(factionBonuses).find((b) => b && b.key === key) || null;
}

/**
 * 三王等：部队卡最大兵力额外加成（叠在称号/宝物 bonus_max_troops 之上）
 * @param {unknown} factionBonuses
 * @returns {number}
 */
function getFactionTroopMaxTroopsBonus(factionBonuses) {
  const row = findFactionBonus(factionBonuses, 'troop_max_troops_bonus');
  if (!row) return 0;
  const n = Math.floor(Number(row.value) || 0);
  return n > 0 ? n : 0;
}

/**
 * 汉室/黄巾等：真三日报签到额外奖励串（与 rewardService 语法一致，如 silver:20 / item_token:1）
 * @param {unknown} factionBonuses
 * @returns {string|null}
 */
function getFactionDailyCheckinRewardsString(factionBonuses) {
  const row = findFactionBonus(factionBonuses, 'daily_checkin_rewards');
  if (!row) return null;
  const s = String(row.value ?? '').trim();
  return s || null;
}

/**
 * 日历格第二行短文案（无配置名时的 fallback）
 * @param {string|null|undefined} rewardsStr
 * @param {Record<string, string>|null|undefined} [itemNameById]
 * @returns {string|null}
 */
function formatFactionCheckinBonusDisplayShort(rewardsStr, itemNameById) {
  const raw = String(rewardsStr || '').trim();
  if (!raw) return null;
  const parts = raw.split(';').map((p) => p.trim()).filter(Boolean);
  const labels = [];
  for (const part of parts) {
    if (part.startsWith('silver:')) {
      const n = Math.floor(Number(part.slice('silver:'.length)) || 0);
      if (n > 0) labels.push(`💰+${n}银`);
      continue;
    }
    if (part.startsWith('food:')) {
      const n = Math.floor(Number(part.slice('food:'.length)) || 0);
      if (n > 0) labels.push(`🌾+${n}粮`);
      continue;
    }
    if (part.startsWith('item_') || part.includes('_item_')) {
      const [id, qtyRaw] = part.split(':');
      const qty = Math.max(1, Math.floor(Number(qtyRaw) || 1));
      const name = (itemNameById && itemNameById[id]) || id;
      const emoji = id.includes('badge') ? '🏅' : id.includes('token') ? '🎖️' : '🔑';
      labels.push(`${emoji}${name}${qty > 1 ? `×${qty}` : '+1'}`);
      continue;
    }
    labels.push(part);
  }
  return labels.length ? labels.join('·') : null;
}

/**
 * 日历格第二行：势力 bonus + 官职 silverBonus
 * 银+银 → "20+40"；道具+银 → "🎖️+40"；单侧则各自短文案
 *
 * @param {{
 *   factionRewards?: string|null,
 *   positionSilver?: number|null,
 *   itemNameById?: Record<string, string>|null,
 * }} opts
 * @returns {string|null}
 */
function formatCheckinExtraBonusesDisplayShort(opts = {}) {
  const factionRewards = String(opts.factionRewards || '').trim();
  const positionSilver = Math.floor(Number(opts.positionSilver) || 0);
  const itemNameById = opts.itemNameById;

  let factionSilver = 0;
  /** @type {string|null} */
  let factionNonSilverLabel = null;
  if (factionRewards) {
    for (const part of factionRewards.split(';').map((p) => p.trim()).filter(Boolean)) {
      if (part.startsWith('silver:')) {
        factionSilver += Math.floor(Number(part.slice('silver:'.length)) || 0);
        continue;
      }
      if (part.startsWith('food:')) {
        const n = Math.floor(Number(part.slice('food:'.length)) || 0);
        if (n > 0) factionNonSilverLabel = `🌾${n}`;
        continue;
      }
      if (part.startsWith('item_') || part.includes('_item_')) {
        const [id, qtyRaw] = part.split(':');
        const qty = Math.max(1, Math.floor(Number(qtyRaw) || 1));
        const emoji = id.includes('badge') ? '🏅' : id.includes('token') ? '🎖️' : '🔑';
        factionNonSilverLabel = qty > 1 ? `${emoji}×${qty}` : emoji;
        continue;
      }
      factionNonSilverLabel = part;
    }
  }

  if (factionSilver > 0 && positionSilver > 0 && !factionNonSilverLabel) {
    return `${factionSilver}+${positionSilver}`;
  }
  if (factionNonSilverLabel && positionSilver > 0) {
    return `${factionNonSilverLabel}+${positionSilver}`;
  }
  if (factionSilver > 0 && positionSilver <= 0 && !factionNonSilverLabel) {
    return String(factionSilver);
  }
  if (factionNonSilverLabel && positionSilver <= 0) {
    return factionNonSilverLabel;
  }
  if (positionSilver > 0) {
    return String(positionSilver);
  }
  return formatFactionCheckinBonusDisplayShort(factionRewards, itemNameById);
}

module.exports = {
  parseFactionBonusesArray,
  findFactionBonus,
  getFactionTroopMaxTroopsBonus,
  getFactionDailyCheckinRewardsString,
  formatFactionCheckinBonusDisplayShort,
  formatCheckinExtraBonusesDisplayShort,
};
