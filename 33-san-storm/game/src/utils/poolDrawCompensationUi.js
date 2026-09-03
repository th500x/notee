/**
 * 卡池抽取补偿文案（将领重复/稀有度上限、部队栏位上限等）。
 * 与 cardPoolService 返回的 reason / compensation / rarityLimit 对齐。
 */

const RARITY_LABELS = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传奇',
  core: '核心',
};

function compensationAmountLabel(compensation) {
  if (!compensation || compensation.amount == null) return '';
  const amt = compensation.amount;
  return compensation.type === 'food' ? `🌾+${amt} 粮草` : `💰+${amt} 银两`;
}

/**
 * 汇总本批补偿资源（十连等多卡时横幅须用合计，不可只取首张）。
 * @param {object[]} cards
 * @returns {{ count: number, silver: number, food: number, label: string }}
 */
export function sumPoolDrawCompensation(cards) {
  let count = 0;
  let silver = 0;
  let food = 0;
  if (Array.isArray(cards)) {
    for (const c of cards) {
      if (!c?.compensated || !c.compensation) continue;
      const amt = Math.max(0, Math.floor(Number(c.compensation.amount) || 0));
      if (amt <= 0) continue;
      count += 1;
      if (c.compensation.type === 'food') food += amt;
      else silver += amt;
    }
  }
  const parts = [];
  if (silver > 0) parts.push(`💰+${silver} 银两`);
  if (food > 0) parts.push(`🌾+${food} 粮草`);
  return {
    count,
    silver,
    food,
    label: parts.join(' · '),
  };
}

/**
 * @param {object} card draw 响应 cards[] 单项
 * @param {'troop'|'character'} poolType
 * @returns {{ bannerTitle: string, bannerBody: string, cardTag: string, isRarityLimit: boolean, isDuplicate: boolean } | null}
 */
export function getPoolDrawCompensationUi(card, poolType) {
  if (!card?.compensated) return null;

  const rLab = RARITY_LABELS[String(card.rarity ?? '').toLowerCase()] || card.rarity || '未知';
  const name = card.cardName || '未知';
  const compLabel = compensationAmountLabel(card.compensation);
  const limitHint = card.rarityLimit
    ? `（${rLab} ${card.rarityLimit.owned}/${card.rarityLimit.max} 已满）`
    : '';

  switch (card.reason) {
    case 'character_duplicate':
      return {
        bannerTitle: '重复将领 · 未入背包',
        bannerBody: `「${name}」已在背包，本次发放 ${compLabel}（与重复规则相同）。`,
        cardTag: `重复 · ${compLabel}`,
        isRarityLimit: false,
        isDuplicate: true,
      };
    case 'character_rarity_limit':
      return {
        bannerTitle: `${rLab}将领栏位已满 · 未入背包`,
        bannerBody: `「${name}」未加入编组${limitHint}，本次发放 ${compLabel}（与重复将领补偿相同）。`,
        cardTag: `${rLab}已满 · ${compLabel}`,
        isRarityLimit: true,
        isDuplicate: false,
      };
    case 'troop_rarity_limit':
    case 'troop_limit':
      return {
        bannerTitle: `${rLab}部队栏位已满 · 未入背包`,
        bannerBody: `「${name}」未加入军营${limitHint}，本次发放 ${compLabel}。`,
        cardTag: `${rLab}已满 · ${compLabel}`,
        isRarityLimit: true,
        isDuplicate: false,
      };
    case 'no_card_available':
      return {
        bannerTitle: '达上限 · 未入背包',
        bannerBody: `本次发放 ${compLabel}。`,
        cardTag: `达上限 · ${compLabel}`,
        isRarityLimit: true,
        isDuplicate: false,
      };
    default:
      return {
        bannerTitle: '补偿 · 未入背包',
        bannerBody: compLabel ? `本次发放 ${compLabel}。` : '卡牌未新增入背包。',
        cardTag: compLabel || '补偿',
        isRarityLimit: false,
        isDuplicate: false,
      };
  }
}

/**
 * 结果弹窗顶部横幅：多卡补偿时标题取首张口径，正文用**合计**资源。
 * @param {object[]} cards
 * @param {'troop'|'character'} poolType
 * @returns {{ bannerTitle: string, bannerBody: string } | null}
 */
export function getPoolDrawCompensationBanner(cards, poolType) {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  const firstUi = cards.map((c) => getPoolDrawCompensationUi(c, poolType)).find(Boolean);
  if (!firstUi) return null;
  const sum = sumPoolDrawCompensation(cards);
  if (sum.count <= 1) {
    return { bannerTitle: firstUi.bannerTitle, bannerBody: firstUi.bannerBody };
  }
  const totalLabel = sum.label || '补偿';
  let bannerTitle = firstUi.bannerTitle;
  if (poolDrawHasRarityLimitCompensation(cards)) {
    bannerTitle = poolType === 'troop' ? '达上限 · 未入背包' : '栏位已满 · 未入背包';
    if (cards.every((c) => c.compensated && c.reason === 'character_duplicate')) {
      bannerTitle = '重复将领 · 未入背包';
    }
  } else if (cards.every((c) => c.compensated && c.reason === 'character_duplicate')) {
    bannerTitle = '重复将领 · 未入背包';
  }
  return {
    bannerTitle,
    bannerBody: `共 ${sum.count} 张未入背包，本次发放 ${totalLabel}。`,
  };
}

/**
 * @param {object[]} cards
 * @returns {boolean}
 */
export function poolDrawHasRarityLimitCompensation(cards) {
  return Array.isArray(cards) && cards.some(
    (c) => c.compensated && (
      c.reason === 'character_rarity_limit'
      || c.reason === 'troop_rarity_limit'
      || c.reason === 'troop_limit'
      || c.reason === 'no_card_available'
    ),
  );
}

/**
 * @param {object[]} cards
 * @param {'troop'|'character'} poolType
 * @returns {string}
 */
export function poolDrawResultModalTitle(cards, poolType, drawMode = 'batch') {
  const isBatch = drawMode === 'batch' || drawMode === 'badge_batch';
  const batchPrefix = drawMode === 'badge_batch' ? '徽章抽 · ' : drawMode === 'batch' ? '十连 · ' : '';
  const base = poolType === 'troop' ? '⚔️ 部队卡抽取结果' : '🎴 将领卡抽取结果';
  if (!Array.isArray(cards) || !cards.some((c) => c.compensated)) {
    return isBatch ? `${batchPrefix}${base.replace(/^[^\s]+\s/, '')}` : base;
  }
  if (poolDrawHasRarityLimitCompensation(cards)) {
    return poolType === 'troop' ? '⚠️ 部队抽取 · 栏位已满（补偿）' : '⚠️ 将领抽取 · 栏位已满（补偿）';
  }
  if (cards.some((c) => c.compensated && c.reason === 'character_duplicate')) {
    return '🎴 将领抽取 · 重复（补偿）';
  }
  return `⚠️ ${base.replace(/^[^\s]+\s/, '')} · 补偿`;
}
