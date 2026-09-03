/**
 * 事件系统工具函数
 * 
 * @description 从 ExploreDemo 提取的核心算法，完全照抄原版逻辑
 *              属性值为显示值（个位数），与 ExploreDemo 一致
 *
 * 探索事件池筛选/抽取/选项分流已迁至前后端单一来源 `@shared/utils/exploreEventPool.js`；
 * 本文件 import 后再导出，保持既有 `@/components/event/eventUtils` 引用不变，勿在此重写第二套实现。
 */

import {
  FORTUNE_LEVELS, DICE_TABLE,
  RARITY_CN, RESOURCE_CN,
} from './EventConstants';
import { getOptionFactorFields } from '@shared/utils/eventOptionFactor.js';
import { expandRewardPresetsForPreview } from '@shared/utils/eventRewardPresets.js';
import {
  isBanditMapObjectId,
  EVENT_PUNISHMENT_COMBAT_BANDIT_LOCATION_SLOT_RARITIES,
  eventChainLevelToBattleRarity,
  eventCardRarityToBanditTier,
  banditTierSlotRarities,
  cityTypeToBanditTier,
  normalizeBattleRarity,
  RARITY_ORDER,
} from '@shared/utils/smallMapEnemyRoster';
import {
  TUTORIAL_EXPLORE_CHAIN_ID,
  eventMatchesExploreSubsidiaryKind,
  pickRandomEvent,
  getExploreOptionResolution,
  exploreOptionTriggerBattle,
  getActiveExploreChainId,
  playerMeetsEventRequiredItems,
  getEffectiveExploreChainMaxCompleted,
  getTutorialChainCompletedLevelForMapHint,
  getTutorialChainCompletedLevelForPool,
  isExploreChainStrandedRedoFromState,
  filterExploreEventsPool,
} from '@shared/utils/exploreEventPool.js';

/** 探索事件池筛选/抽取/选项分流：单一来源在 `@shared/utils/exploreEventPool.js`（前后端共用），此处再导出保持既有引用不变 */
export {
  TUTORIAL_EXPLORE_CHAIN_ID,
  eventMatchesExploreSubsidiaryKind,
  pickRandomEvent,
  getExploreOptionResolution,
  exploreOptionTriggerBattle,
  getActiveExploreChainId,
  playerMeetsEventRequiredItems,
  getEffectiveExploreChainMaxCompleted,
  getTutorialChainCompletedLevelForMapHint,
  getTutorialChainCompletedLevelForPool,
  isExploreChainStrandedRedoFromState,
  filterExploreEventsPool,
};

/**
 * `trigger_context = tutorial`：不扣探索开链兵符（亦不走旧探索次数）。
 * 与 `useEventSystem`、配置表 `config_events.trigger_context` 对齐。
 */
export function eventSkipsExploreQuota(ev) {
  return !!(ev && typeof ev === 'object' && String(ev.trigger_context || '').trim() === 'tutorial');
}

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
  const f = getOptionFactorFields(option);
  if (!f || f.mainFactor !== 'luck') return 0;
  const teamLuck = (playerChar.luck + general1.luck + general2.luck) / 3;
  const mainScore = teamLuck / f.mainRequirement;
  const teamSub = (
    calcSubFactor(f.subFactors, playerChar) +
    calcSubFactor(f.subFactors, general1) +
    calcSubFactor(f.subFactors, general2)
  ) / 3;
  const subScore = teamSub / f.subRequirement;
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
 * 解析奖励字符串为结构化数组
 * @param {string} str - 奖励字符串
 * @param {Object} [itemNameMap] - 道具ID→名称映射（可选）
 * @param {number} [multiplier] - 运势倍率（可选，资源数值会乘以此倍率后取整）
 * @returns {Array<{text: string, cardId?: string, cardType?: string}>}
 */
export function parseRewards(str, itemNameMap, multiplier) {
  if (!str) return [];
  const expanded = expandRewardPresetsForPreview(str);
  const m = (multiplier != null && multiplier !== 1.0) ? multiplier : 1;
  // 资源显示优先级
  const order = { '🎖️': 0, '🤝': 1, '💰': 2, '🌾': 3, '💪': 4 };
  const items = expanded.split(';').map(item => {
    const t = item.trim();
    if (t.startsWith('silver:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `💰 银两 +${v}` }; }
    if (t.startsWith('food:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `🌾 粮草 +${v}` }; }
    if (t.startsWith('reputation:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `🎖️ 声望 +${v}` }; }
    if (t.startsWith('contribution:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `🤝 贡献 +${v}` }; }
    if (t.startsWith('morale:')) { const v = Math.floor(parseInt(t.split(':')[1]) * m); return { text: `💪 士气 +${v}` }; }
    if (t.startsWith('random:position:level:')) {
      const parts = t.split(':');
      const lvl = parts[3] || '?';
      return { text: `👑 随机官职（品阶 Lv.${lvl}）`, isPosition: true };
    }
    if (t.startsWith('random:')) {
      const parts = t.split(':');
      const SLOT_CN = { weapon: '武器', armor: '防具', accessory: '辅助' };
      if (parts[1] === 'equipment' && SLOT_CN[parts[3]]) {
        const rarity = (parts[2] && RARITY_CN[parts[2]]) || '';
        const qty = parts[4] ? `×${parts[4]}` : '×1';
        return { text: `🎲 随机${rarity}${SLOT_CN[parts[3]]}装备 ${qty}`, cardType: 'equipment' };
      }
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
 * 从单段「奖励/消耗」类字符串中抽出事件道具 id（`item_` / `_item_`），先展开 reward-/pack- 简写与 `expandRewardPresetsForPreview` 一致。
 * @param {string|null|undefined} str
 * @returns {string[]}
 */
function extractItemIdsFromExploreRewardLikeString(str) {
  if (str == null || String(str).trim() === '') return [];
  const expanded = expandRewardPresetsForPreview(String(str));
  const out = [];
  for (const seg of expanded.split(';')) {
    const t = seg.trim();
    if (!t) continue;
    const colon = t.indexOf(':');
    const key = colon === -1 ? t : t.slice(0, colon).trim();
    if (key.startsWith('item_') || key.includes('_item_')) out.push(key);
  }
  return out;
}

/**
 * 当前探索点过滤后事件池中，所有选项/事件级配置里出现的**事件道具** id（去重、字典序）。
 * 不含银粮声望等纯资源、不含 random: 卡包（与「道具」展示口径一致）。
 * @param {Array<Record<string, unknown>>|null|undefined} poolEvents
 * @returns {string[]}
 */
export function collectExplorePoolDistinctItemIds(poolEvents) {
  if (!Array.isArray(poolEvents) || poolEvents.length === 0) return [];
  const set = new Set();
  const add = (s) => {
    for (const id of extractItemIdsFromExploreRewardLikeString(s)) set.add(id);
  };
  for (const evt of poolEvents) {
    if (!evt || typeof evt !== 'object') continue;
    if (evt.required_items) add(String(evt.required_items));
    for (const key of ['option_a', 'option_b']) {
      const opt = evt[key];
      if (!opt || typeof opt !== 'object') continue;
      if (opt.requiredItems) add(String(opt.requiredItems));
      if (opt.rewards) add(String(opt.rewards));
      if (opt.bonusRewards) add(String(opt.bonusRewards));
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

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
 * 道具 id 与探索点 `city_id` 对齐：`exploreLocationId` 为当前探索锚点（与事件 `location` 过滤同源）→ slug → 道具 `item_*`
 * @param {string} itemId
 * @param {string} exploreLocationId
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
 * 判断选项是否为因子判定类型（有运势预览）
 */
export function isFactorOption(opt) {
  const f = getOptionFactorFields(opt);
  return !!(f && f.mainFactor === 'luck' && f.mainRequirement != null && f.subFactors);
}

/**
 * 判断运势是否为成功（吉/大吉/鸿运）
 */
export function isFortuneSuccess(fortune) {
  return fortune && (fortune.name === '吉' || fortune.name === '大吉' || fortune.name === '鸿运');
}

/** 选项 A 因子为 type-b 时惩罚战为 5 编制（与 EventBattle / useBattleMap 一致） */
function exploreOptionAIsTypeB(option) {
  if (!option || typeof option !== 'object') return false;
  const raw = String(option.factor ?? '').trim().toLowerCase();
  if (raw === 'type-b' || raw.startsWith('type-b')) return true;
  const mf = String(option.mainFactor ?? option.main_factor ?? '').trim().toLowerCase();
  return mf === 'type-b';
}

/**
 * 凶/大凶后可能进入惩罚战（与 useEventSystem.confirmResult 一致）：选项 A 为 luck 流且 triggerBattle。
 * @param {Record<string, unknown>|null|undefined} event
 */
export function eventHasExplorePunitiveBattleOptionA(event) {
  const a = event?.option_a;
  if (!exploreOptionTriggerBattle(a)) return false;
  return getExploreOptionResolution(a) === 'luck';
}

/**
 * 单事件惩罚战敌方部队槽稀有度列表（长度 4 或 5），与小型图 PVE 抽池一致。
 * 难度来自 `chain_level`（见 `eventChainLevelToBattleRarity`）；匪寨格探索仍固定传奇四槽。
 * @param {Record<string, unknown>} event
 * @param {string|null|undefined} exploreLocationId
 * @returns {string[]|null}
 */
export function getExplorePunitiveBattleTroopSlotRarities(event, exploreLocationId) {
  if (!event || !exploreLocationId || !eventHasExplorePunitiveBattleOptionA(event)) return null;
  const eventRarity = eventChainLevelToBattleRarity(event.chain_level ?? event.chainLevel);
  const typeB = exploreOptionAIsTypeB(event.option_a);
  const bandit = isBanditMapObjectId(exploreLocationId);

  if (bandit && typeB) {
    return ['legendary', 'legendary', 'legendary', 'legendary', 'legendary'];
  }
  if (bandit) {
    return [...EVENT_PUNISHMENT_COMBAT_BANDIT_LOCATION_SLOT_RARITIES];
  }
  if (typeB) {
    let tr = normalizeBattleRarity(eventRarity);
    if (tr === 'core') tr = 'legendary';
    return [tr, tr, tr, tr, tr];
  }
  const tier = eventCardRarityToBanditTier(eventRarity);
  return banditTierSlotRarities(tier);
}

/**
 * 当前探索点事件池中，惩罚战可能抽到的敌方部队稀有度区间（与 EventBattle + useBattleMap 一致）。
 * @param {Array<Record<string, unknown>>|null|undefined} poolEvents
 * @param {string|null|undefined} exploreLocationId
 * @returns {{ hasPunitiveBattle: false } | { hasPunitiveBattle: true, min: string, max: string }}
 */
export function summarizeExplorePoolEnemyTroopRarityRange(poolEvents, exploreLocationId) {
  if (!Array.isArray(poolEvents) || poolEvents.length === 0 || !exploreLocationId) {
    return { hasPunitiveBattle: false };
  }
  let minIdx = RARITY_ORDER.length;
  let maxIdx = -1;
  for (const e of poolEvents) {
    const slots = getExplorePunitiveBattleTroopSlotRarities(e, exploreLocationId);
    if (!slots?.length) continue;
    for (const r of slots) {
      const n = normalizeBattleRarity(r);
      const i = RARITY_ORDER.indexOf(n);
      if (i < 0) continue;
      minIdx = Math.min(minIdx, i);
      maxIdx = Math.max(maxIdx, i);
    }
  }
  if (maxIdx < 0) return { hasPunitiveBattle: false };
  return {
    hasPunitiveBattle: true,
    min: RARITY_ORDER[minIdx],
    max: RARITY_ORDER[maxIdx],
  };
}

/**
 * 13-1「荒郊难度」↔ 主城 `city_type` → 22-1 §9.1 `BANDIT_NPC_SLOTS_BY_TIER` 四槽，
 * 得到惩罚战敌方**部队**稀有度展示区间（与 `banditTierSlotRarities(cityTypeToBanditTier(...))` 一致）。
 * 中城/据点 → 稀有档 → **稀有～史诗**；小城 → 普通档 → **普通～稀有**；大城/关隘 → 史诗档 → **史诗～传奇**。
 *
 * @param {string|null|undefined} cityType - `cities.city_type` / API 驼峰 `cityType`
 * @returns {{ min: string, max: string }|null}
 */
export function wildernessEnemyTroopRarityDocRangeFromMainCityType(cityType) {
  const ct = String(cityType ?? '').trim();
  if (!ct) return null;
  const supported = new Set(['city_small', 'city_medium', 'city_major', 'city_gate']);
  if (!supported.has(ct)) return null;
  const tier = cityTypeToBanditTier(ct);
  const slots = banditTierSlotRarities(tier);
  let minIdx = RARITY_ORDER.length;
  let maxIdx = -1;
  for (const r of slots) {
    const n = normalizeBattleRarity(r);
    const i = RARITY_ORDER.indexOf(n);
    if (i < 0) continue;
    minIdx = Math.min(minIdx, i);
    maxIdx = Math.max(maxIdx, i);
  }
  if (maxIdx < 0) return null;
  return { min: RARITY_ORDER[minIdx], max: RARITY_ORDER[maxIdx] };
}

/**
 * @param {Array<Record<string, unknown>>|null|undefined} citiesList
 * @param {string|null|undefined} cityId
 * @returns {string|null}
 */
export function resolveCityRowTypeForWildernessHint(citiesList, cityId) {
  if (!cityId || !Array.isArray(citiesList) || citiesList.length === 0) return null;
  const id = String(cityId).trim();
  const row = citiesList.find((c) => String(c.city_id ?? c.cityId ?? '').trim() === id);
  if (!row) return null;
  const ct = row.city_type ?? row.cityType;
  return ct != null && String(ct).trim() !== '' ? String(ct).trim() : null;
}

/**
 * 主城行 `city_id`（荒郊/集市与主城同 id）→ `city_type`。
 * @param {Array<Record<string, unknown>>|null|undefined} citiesList
 * @param {string|null|undefined} exploreLocationId
 * @returns {string|null}
 */
export function resolveCityTypeForWildernessTroopHint(citiesList, exploreLocationId) {
  return resolveCityRowTypeForWildernessHint(citiesList, exploreLocationId);
}

/**
 * 探索奖励 API 失败时弹窗副文案（与后端 `playerEventRewardsService` 等返回的 error 对齐）
 * @param {string|null|undefined} message
 * @returns {string|null}
 */
export function exploreRewardFailureSubhint(message) {
  const t = String(message || '').trim();
  if (!t) return '探索次数已退还，请稍后重试。';
  if (t.includes('传奇部队')) {
    return '请先在编组中装备或获得传奇（橙色）部队后再完成该选项。探索次数已退还。';
  }
  if (t.includes('核心部队')) {
    return '请先在编组中装备或获得核心（金色）部队后再完成该选项。探索次数已退还。';
  }
  if (t.includes('道具不足')) {
    return '背包中缺少所需道具，请先完成前置探索事件。探索次数已退还。';
  }
  if (/银两|粮草|声望|贡献/.test(t) && t.includes('不足')) {
    return '请补足资源或道具后重新探索。探索次数已退还。';
  }
  if (t.includes('已完成') || t.includes('重复')) {
    return null;
  }
  if (t.includes('惩罚战')) {
    return '请完成判定结果或惩罚战后再继续探索。';
  }
  return '探索次数已退还，请调整后重新探索。';
}
