/**
 * 事件系统工具函数
 * 
 * @description 从 ExploreDemo 提取的核心算法，完全照抄原版逻辑
 *              属性值为显示值（个位数），与 ExploreDemo 一致
 */

import {
  FORTUNE_LEVELS, DICE_TABLE,
  RARITY_CN, RESOURCE_CN,
} from './EventConstants';

// ========== 因子判定算法（完全照抄 ExploreDemo） ==========

/**
 * 计算副因子值
 * @param {string} type - military/strategist/balanced
 * @param {Object} char - 角色属性（显示值，个位数）
 */
export function calcSubFactor(type, char) {
  if (type === 'military') return (char.courage + char.command + char.combat) / 3;
  if (type === 'strategist') return (char.intelligence + char.politics + char.charm) / 3;
  return (char.courage + char.command + char.combat + char.intelligence + char.politics + char.charm) / 6;
}

/**
 * 计算基础分数
 * @param {Object} option - 事件选项（含 mainRequirement, subFactors, subRequirement）
 * @param {Object} playerChar - 玩家角色属性（显示值）
 * @param {Object} general1 - 将领1属性（显示值）
 * @param {Object} general2 - 将领2属性（显示值）
 */
export function calcBaseScore(option, playerChar, general1, general2) {
  const teamLuck = (playerChar.luck + general1.luck + general2.luck) / 3;
  const mainScore = teamLuck / option.mainRequirement;
  const teamSub = (
    calcSubFactor(option.subFactors, playerChar) +
    calcSubFactor(option.subFactors, general1) +
    calcSubFactor(option.subFactors, general2)
  ) / 3;
  const subScore = teamSub / option.subRequirement;
  return (mainScore * 0.6 + subScore * 0.4) * 100;
}

/**
 * 根据最终成功率获取运势等级
 */
export function getFortuneByRate(rate) {
  for (const f of FORTUNE_LEVELS) { if (rate >= f.min) return f; }
  return FORTUNE_LEVELS[4];
}

/**
 * 计算运势概率分布（用于预览）
 */
export function calcFortuneDistribution(option, playerChar, general1, general2) {
  const baseScore = calcBaseScore(option, playerChar, general1, general2);
  const distribution = {};
  FORTUNE_LEVELS.forEach(f => { distribution[f.name] = { ...f, probability: 0, diceList: [] }; });
  DICE_TABLE.forEach(d => {
    const finalRate = baseScore * d.multiplier;
    const fortune = getFortuneByRate(finalRate);
    distribution[fortune.name].probability += (1 / 6) * 100;
    distribution[fortune.name].diceList.push(d.dice);
  });
  return { baseScore, distribution };
}

/**
 * 投掷骰子，判定运势
 */
export function rollFortune(option, playerChar, general1, general2) {
  const baseScore = calcBaseScore(option, playerChar, general1, general2);
  const diceIndex = Math.floor(Math.random() * 6);
  const dice = DICE_TABLE[diceIndex];
  const finalRate = baseScore * dice.multiplier;
  const fortune = getFortuneByRate(finalRate);
  return { ...fortune, dice: dice.dice, diceMultiplier: dice.multiplier, finalRate, baseScore };
}

// ========== 奖励/消耗解析（完全照抄 ExploreDemo） ==========

/**
 * 解析奖励字符串为显示文本数组
 * @param {string} str - 奖励字符串
 * @param {Object} [itemNameMap] - 道具ID→名称映射（可选）
 * @param {number} [multiplier] - 运势倍率（可选，资源数值会乘以此倍率后取整）
 */
/**
 * 解析奖励字符串为结构化数组
 * @param {string} str - 奖励字符串
 * @param {Object} [itemNameMap] - 道具ID→名称映射（可选）
 * @param {number} [multiplier] - 运势倍率（可选，资源数值会乘以此倍率后取整）
 * @returns {Array<{text: string, cardId?: string, cardType?: string}>}
 */
export function parseRewards(str, itemNameMap, multiplier) {
  if (!str) return [];
  const m = (multiplier != null && multiplier !== 1.0) ? multiplier : 1;
  // 资源显示优先级
  const order = { '🎖️': 0, '🤝': 1, '💰': 2, '🌾': 3, '💪': 4 };
  const items = str.split(';').map(item => {
    const t = item.trim();
    if (t.startsWith('silver:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `💰 银两 +${v}` }; }
    if (t.startsWith('food:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `🌾 粮草 +${v}` }; }
    if (t.startsWith('reputation:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `🎖️ 声望 +${v}` }; }
    if (t.startsWith('contribution:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `🤝 贡献 +${v}` }; }
    if (t.startsWith('morale:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `💪 士气 +${v}` }; }
    if (t.startsWith('random:')) {
      const parts = t.split(':');
      const type = parts[1] === 'equipment' ? '装备件' : parts[1] === 'char' ? '将领' : '部队';
      const rarity = (parts[2] && RARITY_CN[parts[2]]) || '';
      const qty = parts[3] ? `×${parts[3]}` : '×1';
      return { text: `🎲 随机${rarity}${type} ${qty}`, cardType: parts[1] === 'equipment' ? 'equipment' : parts[1] === 'char' ? 'character' : 'troop' };
    }
    // 事件链道具 id 常含 _troop_ / _char_ 等子串，必须先于卡牌分支判断，否则会误识别为部队/将领卡
    if (t.includes('_item_') || t.startsWith('item_')) {
      const parts = t.split(':');
      const itemId = parts[0];
      const qty = parts[1] ? `×${parts[1]}` : '×1';
      const name = (itemNameMap && itemNameMap[itemId]) || '道具';
      return { text: `🔑 ${name} ${qty}` };
    }
    if (t.includes('_troop_')) {
      const parts = t.split(':');
      const cardId = parts[0];
      const qty = parts[1] ? `×${parts[1]}` : '×1';
      return { text: `⚔️ 部队卡 ${qty}`, cardId, cardType: 'troop' };
    }
    if (t.includes('_char_')) {
      const parts = t.split(':');
      const cardId = parts[0];
      const qty = parts[1] ? `×${parts[1]}` : '×1';
      return { text: `👤 将领 ${qty}`, cardId, cardType: 'character' };
    }
    if (t.includes('_title_')) {
      const parts = t.split(':');
      const cardId = parts[0];
      return { text: `🎖️ 称号`, cardId, cardType: 'title' };
    }
    if (t.includes('_equip_')) {
      const parts = t.split(':');
      const cardId = parts[0];
      return { text: `🛡️ 装备件`, cardId, cardType: 'equipment' };
    }
    if (t.includes('_position_')) {
      return { text: `👑 官职`, isPosition: true };
    }
    return { text: `📦 ${t}` };
  });
  // 按优先级排序：声望 > 贡献 > 银两 > 粮草 > 士气 > 其他
  items.sort((a, b) => {
    const ka = Object.keys(order).find(k => a.text.startsWith(k));
    const kb = Object.keys(order).find(k => b.text.startsWith(k));
    const oa = ka != null ? order[ka] : 99;
    const ob = kb != null ? order[kb] : 99;
    return oa - ob;
  });
  return items;
}

/**
 * 解析消耗道具字符串
 */
export function parseRequiredItems(str, itemNameMap) {
  if (!str) return '';
  return str.split(';').map(item => {
    const t = item.trim();
    if (!t) return '';
    const [key, val] = t.split(':');
    if (RESOURCE_CN[key]) return `${RESOURCE_CN[key]} ${val}`;
    // 道具ID（san_1_item_xxx 或 item_xxx 格式）
    if (key.includes('_item_') || key.startsWith('item_')) {
      const name = (itemNameMap && itemNameMap[key]) || '道具';
      return val ? `${name} ×${val}` : name;
    }
    return val != null ? `${key} ${val}` : key;
  }).filter(Boolean).join('、');
}

/**
 * 按概率权重随机抽取事件
 */
export function pickRandomEvent(events) {
  if (!events || events.length === 0) return null;
  const totalWeight = events.reduce((sum, e) => sum + e.trigger_probability, 0);
  let rand = Math.random() * totalWeight;
  for (const event of events) {
    rand -= event.trigger_probability;
    if (rand <= 0) return event;
  }
  return events[events.length - 1];
}

/**
 * 判断选项是否为因子判定类型（有运势预览）
 */
export function isFactorOption(opt) {
  return opt && opt.mainFactor === 'luck' && opt.mainRequirement && opt.subFactors;
}

/**
 * 判断运势是否为成功（吉/大吉/鸿运）
 */
export function isFortuneSuccess(fortune) {
  return fortune && (fortune.name === '吉' || fortune.name === '大吉' || fortune.name === '鸿运');
}
