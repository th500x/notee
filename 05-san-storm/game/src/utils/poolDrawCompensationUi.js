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
export function poolDrawResultModalTitle(cards, poolType, drawMode = 'single') {
  const batchPrefix = drawMode === 'batch' ? '十连 · ' : '';
  const base = poolType === 'troop' ? '⚔️ 部队卡抽取结果' : '🎴 将领卡抽取结果';
  if (!Array.isArray(cards) || !cards.some((c) => c.compensated)) {
    return drawMode === 'batch' ? `${batchPrefix}${base.replace(/^[^\s]+\s/, '')}` : base;
  }
  if (poolDrawHasRarityLimitCompensation(cards)) {
    return poolType === 'troop' ? '⚠️ 部队抽取 · 栏位已满（补偿）' : '⚠️ 将领抽取 · 栏位已满（补偿）';
  }
  if (cards.some((c) => c.compensated && c.reason === 'character_duplicate')) {
    return '🎴 将领抽取 · 重复（补偿）';
  }
  return `⚠️ ${base.replace(/^[^\s]+\s/, '')} · 补偿`;
}
