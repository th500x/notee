/**
 * 真三日报 · 28 日签到奖励（与 event option_*_rewards 同 DSL，子集白名单）
 * 须与 dailyReportCheckinRewards.js 同步 · 32-6 §3
 */

const CHECKIN_CYCLE_MAX = 28;

const CHECKIN_ALLOWED_RESOURCE = new Set(['silver', 'food']);
const CHECKIN_ALLOWED_PARSED_TYPES = new Set(['resource', 'item', 'specific_card']);

const FORBIDDEN_TOKEN_RE =
  /^(reward-[a-e]|pack-[a-e]|random:|reputation:|contribution:|morale:|minigame:)/i;

/**
 * @param {string} rewardStr
 * @returns {string}
 */
function assertCheckinRewardsString(rewardStr) {
  const s = String(rewardStr ?? '').trim();
  if (!s) {
    throw new Error('签到 rewards 不能为空');
  }
  for (const part of s.split(';')) {
    const t = part.trim();
    if (!t) continue;
    if (FORBIDDEN_TOKEN_RE.test(t)) {
      throw new Error(`签到 rewards 不允许：${t}`);
    }
    if (t.includes('_position_')) {
      throw new Error(`签到 rewards 不允许官职：${t}`);
    }
  }
  return s;
}

/**
 * @param {Array<{ type: string, resource?: string }>} parsed parseRewardString 结果
 */
function assertCheckinParsedRewards(parsed) {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('签到 rewards 解析结果为空');
  }
  for (const r of parsed) {
    if (!CHECKIN_ALLOWED_PARSED_TYPES.has(r.type)) {
      throw new Error(`签到 rewards 不允许类型：${r.type}`);
    }
    if (r.type === 'resource' && !CHECKIN_ALLOWED_RESOURCE.has(r.resource)) {
      throw new Error(`签到 rewards 不允许资源：${r.resource}`);
    }
    if (r.type === 'unknown') {
      throw new Error(`签到 rewards 无法识别：${r.raw || '?'}`);
    }
  }
}

/**
 * @param {Array<object>} parsed
 * @param {Record<string, string>} [itemNameById]
 * @returns {string}
 */
function formatCheckinRewardDisplayShort(parsed, itemNameById = {}) {
  if (!Array.isArray(parsed) || !parsed.length) return '—';
  const parts = [];
  for (const r of parsed) {
    if (r.type === 'resource') {
      if (r.resource === 'silver' && r.amount > 0) parts.push(`${r.amount}银`);
      else if (r.resource === 'food' && r.amount > 0) parts.push(`${r.amount}粮`);
    } else if (r.type === 'item') {
      const name = itemNameById[r.itemId] || '道具';
      parts.push(r.quantity > 1 ? `${name}×${r.quantity}` : name);
    } else if (r.type === 'specific_card') {
      parts.push(r.quantity > 1 ? `卡牌×${r.quantity}` : '卡牌');
    }
  }
  return parts.length ? parts.join('+') : '—';
}

/**
 * @param {Array<object>} details executeRewardsOnConnection details
 * @returns {{ silver: number, food: number, items: Array<{ itemId, itemName, quantity }>, displaySummary: string }}
 */
function summarizeCheckinGrantDetails(details) {
  let silver = 0;
  let food = 0;
  /** @type {Array<{ itemId: string, itemName: string, quantity: number }>} */
  const items = [];
  const summaryParts = [];

  for (const d of details || []) {
    if (d.type === 'resource') {
      if (d.resource === 'silver') {
        silver += d.amount || 0;
        if (d.amount > 0) summaryParts.push(`银两 +${d.amount}`);
      } else if (d.resource === 'food') {
        food += d.amount || 0;
        if (d.amount > 0) summaryParts.push(`粮草 +${d.amount}`);
      }
    } else if (d.type === 'item') {
      items.push({
        itemId: d.itemId,
        itemName: d.itemName || d.itemId,
        quantity: d.quantity || 1,
      });
      summaryParts.push(`${d.itemName || d.itemId} +${d.quantity || 1}`);
    } else if (d.type === 'card' || d.type === 'random_card') {
      const label = d.cardName || '卡牌';
      summaryParts.push(label);
    }
  }

  return {
    silver,
    food,
    items,
    displaySummary: summaryParts.length ? summaryParts.join('，') : '签到成功',
  };
}

module.exports = {
  CHECKIN_CYCLE_MAX,
  assertCheckinRewardsString,
  assertCheckinParsedRewards,
  formatCheckinRewardDisplayShort,
  summarizeCheckinGrantDetails,
};
