/**
 * 个人中心称号/成就目录：配置字段 → 展示文案
 */

const ATTR_LABELS = {
  luck: '运',
  courage: '勇',
  combat: '武',
  command: '统',
  intelligence: '智',
  politics: '政',
  charm: '魅',
};

const REWARD_LABELS = {
  silver: '银两',
  food: '粮草',
  contribution: '贡献',
  reputation: '声望',
};

function parseJsonObject(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** attribute_bonus ×10 存库 →「武+5」 */
function formatAttributeBonusDisplay(raw) {
  const obj = parseJsonObject(raw);
  const parts = [];
  for (const [key, val] of Object.entries(obj)) {
    const n = Number(val);
    if (!Number.isFinite(n) || n === 0) continue;
    const label = ATTR_LABELS[key] || key;
    const display = n / 10;
    const sign = display > 0 ? '+' : '';
    const text = Number.isInteger(display) ? String(display) : display.toFixed(1);
    parts.push(`${label}${sign}${text}`);
  }
  return parts.length ? parts.join(' ') : '—';
}

function cardIdGrantLabel(cardId) {
  const id = String(cardId);
  if (id.includes('_title_')) return `称号卡 ${id}`;
  if (id.includes('_achi_')) return `成就卡 ${id}`;
  if (id.includes('_equip_')) return `装备 ${id}`;
  if (id.includes('_char_') || id.includes('_troop_')) return `卡牌 ${id}`;
  return `卡牌 ${id}`;
}

/** rewards JSON →「银两 5000、贡献 100、称号卡 …」 */
function formatRewardsDisplay(raw) {
  const obj = parseJsonObject(raw);
  const parts = [];
  if (Array.isArray(obj.grant_card_ids)) {
    for (const cardId of obj.grant_card_ids) {
      if (cardId) parts.push(cardIdGrantLabel(cardId));
    }
  }
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'grant_card_ids') continue;
    const n = Number(val);
    if (!Number.isFinite(n) || n === 0) continue;
    const label = REWARD_LABELS[key] || key;
    parts.push(`${label} ${Math.round(n).toLocaleString('zh-CN')}`);
  }
  return parts.length ? parts.join('、') : '—';
}

module.exports = {
  formatAttributeBonusDisplay,
  formatRewardsDisplay,
};
