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
 * 事件级 required_items 中的道具段是否满足（链 2+ 需持有链 1 道具；链 1 选 B 无道具则不得进链 2）
 * @param {string|null|undefined} requiredItemsStr - config_events.required_items（如 item_xxx 或 item_a;item_b:2）
 * @param {Record<string, number>} itemCounts - item_id → 数量
 */
export function playerMeetsEventRequiredItems(requiredItemsStr, itemCounts) {
  if (!requiredItemsStr || !String(requiredItemsStr).trim()) return true;
  const segments = String(requiredItemsStr).split(';').map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const colon = seg.indexOf(':');
    const key = colon === -1 ? seg : seg.slice(0, colon);
    const need = colon === -1 ? 1 : Math.max(1, parseInt(seg.slice(colon + 1), 10) || 1);
    if (!key.startsWith('item_') && !key.includes('_item_')) continue;
    if ((Number(itemCounts[key]) || 0) < need) return false;
  }
  return true;
}

/**
 * 道具 id 与探索点 location 对齐：config location 为 san_1_city_6_{地点}，道具为 item_{地点}_*
 * @param {string} itemId
 * @param {string} exploreLocationId - 如 san_1_city_6_nanyang
 */
export function itemIdMatchesExploreLocation(itemId, exploreLocationId) {
  if (!itemId || !exploreLocationId) return false;
  const slug = String(exploreLocationId).split('_').pop();
  if (!slug) return false;
  const id = String(itemId);
  return id.startsWith(`item_${slug}_`) || id === `item_${slug}`;
}

/**
 * @param {Array<{ itemId: string, name?: string, quantity?: number }>} items - GET /players/:id/items 结构
 * @param {string} exploreLocationId
 */
export function filterPlayerItemsForExploreLocation(items, exploreLocationId) {
  if (!items?.length || !exploreLocationId) return [];
  return items.filter((it) => itemIdMatchesExploreLocation(it.itemId, exploreLocationId));
}

/**
 * 事件链「有效」最高已完成环数：仅当第 L 环在存档中为 completed，且（无 L+1 或玩家已满足 L+1 的 required_items）时，才把 L 记入进度。
 * 若完成了链 1 但未拿到下一环钥匙（如选 B/判定失败未掉信物），则进度不推进，链 1 可再次被抽到。
 */
export function getEffectiveExploreChainMaxCompleted(allEvents, chainId, completedEvents, playerItemCounts = {}) {
  if (!allEvents?.length || !chainId) return 0;

  const chainLevelNum = (lv) => {
    const n = Number(lv);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const chainEvents = allEvents
    .filter((e) => e.chain_id === chainId)
    .sort((a, b) => chainLevelNum(a.chain_level) - chainLevelNum(b.chain_level));

  let effective = 0;
  for (const evt of chainEvents) {
    const L = chainLevelNum(evt.chain_level);
    if (L !== effective + 1) continue;
    const rec = completedEvents[evt.event_id];
    if (rec?.status !== 'completed') break;

    const next = chainEvents.find((e) => chainLevelNum(e.chain_level) === L + 1);
    if (!next) {
      effective = L;
      break;
    }
    if (next.required_items && !playerMeetsEventRequiredItems(next.required_items, playerItemCounts)) {
      break;
    }
    effective = L;
  }
  return effective;
}

/**
 * 按探索地点 + 事件链进度过滤可抽到的事件池（与 useEventSystem 逻辑一致）
 * @param {Array} allEvents - 已按 trigger_context 过滤后的全量（如 explore）
 * @param {Object} completedEvents - 玩家已完成事件 { eventId: { status } }
 * @param {string} locationId - 事件 location，须与 config_events.location 完全一致
 * @param {Record<string, number>} [playerItemCounts] - 背包道具数量，用于校验链式 required_items
 */
export function filterExploreEventsPool(allEvents, completedEvents, locationId, playerItemCounts = {}) {
  if (!allEvents?.length || !locationId) return [];

  /** DB/API 常把 chain_level 当字符串；与数字用 !== 比较会把整条链全过滤掉（如山海关仅链式探索时显示 0 件） */
  const chainLevelNum = (lv) => {
    const n = Number(lv);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const chainIds = [...new Set(allEvents.map((e) => e.chain_id).filter(Boolean))];
  const chainMaxCompleted = {};
  for (const cid of chainIds) {
    chainMaxCompleted[cid] = getEffectiveExploreChainMaxCompleted(
      allEvents,
      cid,
      completedEvents,
      playerItemCounts
    );
  }

  const chainMaxLevel = {};
  for (const evt of allEvents) {
    if (!evt.chain_id) continue;
    const cl = chainLevelNum(evt.chain_level);
    if (cl > 0) {
      chainMaxLevel[evt.chain_id] = Math.max(chainMaxLevel[evt.chain_id] || 0, cl);
    }
  }

  return allEvents.filter((evt) => {
    if (evt.location !== locationId) return false;

    if (!evt.chain_id) return true;

    const completed = chainMaxCompleted[evt.chain_id] || 0;
    const maxLevel = chainMaxLevel[evt.chain_id] || 0;
    if (completed >= maxLevel) return false;
    if (chainLevelNum(evt.chain_level) !== completed + 1) return false;

    if (evt.required_items && !playerMeetsEventRequiredItems(evt.required_items, playerItemCounts)) {
      return false;
    }
    return true;
  });
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
