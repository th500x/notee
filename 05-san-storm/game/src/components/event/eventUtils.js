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
import { LOCATION_PLACEHOLDERS, exploreLocationMatchesEvent } from '@/utils/eventLocationPlaceholders';
import { getOptionFactorFields } from '@shared/utils/eventOptionFactor.js';
import { expandRewardPresetsForPreview } from '@shared/utils/eventRewardPresets.js';
import {
  isBanditMapObjectId,
  EVENT_PUNISHMENT_COMBAT_BANDIT_LOCATION_SLOT_RARITIES,
  eventCardRarityToBanditTier,
  banditTierSlotRarities,
  cityTypeToBanditTier,
  normalizeBattleRarity,
  RARITY_ORDER,
} from '@shared/utils/smallMapEnemyRoster';

const WILDERNESS_EVENT_LOCS = new Set([
  LOCATION_PLACEHOLDERS.ANY_WILDERNESS,
  LOCATION_PLACEHOLDERS.CITY_MAJOR_WILDERNESS,
  LOCATION_PLACEHOLDERS.CITY_MEDIUM_WILDERNESS,
]);
const MARKET_EVENT_LOCS = new Set([
  LOCATION_PLACEHOLDERS.ANY_MARKET,
  LOCATION_PLACEHOLDERS.CITY_MAJOR_MARKET,
  LOCATION_PLACEHOLDERS.CITY_MEDIUM_MARKET,
]);

/**
 * 战略城 tooltip 荒郊/集市分池：按 location 占位符与 trigger_context 归类（与合并拉取的全量池配合）
 * @param {string|null|undefined} evLoc
 * @param {'wilderness'|'market'|null|undefined} subsidiaryKind
 * @param {string|null|undefined} triggerContext
 */
export function eventMatchesExploreSubsidiaryKind(evLoc, subsidiaryKind, triggerContext) {
  if (!subsidiaryKind) return true;
  const ev = String(evLoc ?? '').trim();
  const ctx = triggerContext != null ? String(triggerContext) : '';

  if (ev === LOCATION_PLACEHOLDERS.ALL) {
    if (subsidiaryKind === 'wilderness') return ctx === 'wilderness';
    if (subsidiaryKind === 'market') return ctx === 'market';
    return false;
  }
  if (subsidiaryKind === 'wilderness') {
    if (WILDERNESS_EVENT_LOCS.has(ev)) return true;
    if (MARKET_EVENT_LOCS.has(ev)) return false;
    return ctx === 'wilderness';
  }
  if (subsidiaryKind === 'market') {
    if (MARKET_EVENT_LOCS.has(ev)) return true;
    if (WILDERNESS_EVENT_LOCS.has(ev)) return false;
    return ctx === 'market';
  }
  return true;
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
 * 配置层 `trigger_probability`（与 API `trigger_probability` 一致）：
 * - 数值 **1**：与同池其他「必出」事件一起参与抽取（仍为一层随机）；若池中仅有此类则必为其中之一。
 * - **未填写 / null**（及历史非 1 小数，由 API 归一为「未填写」）：同一 `location` 池内 **均等** 随机。
 * @param {{ trigger_probability?: number|null }} e
 */
function isTriggerProbabilityGuaranteedOne(e) {
  const v = e?.trigger_probability;
  const n = Number(v);
  return Number.isFinite(n) && n === 1;
}

/**
 * 按新规则随机抽取探索事件：
 * - 仅有 **2 个及以上** `trigger_probability===1` 的「必出」时，只在必出子集内均等抽（两事件争位）。
 * - 若只有 **1 个** 必出且同池还有其它事件：仍对 **全池** 均等随机，避免「独苗必出」导致长期只命中同一事件（与多数「均等配置」预期一致）。
 */
export function pickRandomEvent(events) {
  if (!events || events.length === 0) return null;
  const guaranteed = events.filter(isTriggerProbabilityGuaranteedOne);
  let pool = events;
  if (guaranteed.length >= 2) {
    pool = guaranteed;
  }
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

/**
 * 探索选项分流：与 ExplorePanel / 后端运势一致，优先 `factor` 串，兼容仅写 `mainFactor` 或蛇形字段。
 * @returns {'minigame'|'always'|'luck'}
 */
export function getExploreOptionResolution(option) {
  if (!option || typeof option !== 'object') return 'luck';
  const mf = (option.mainFactor ?? option.main_factor);
  const mfs = mf != null && String(mf).trim() !== '' ? String(mf).trim() : '';
  if (mfs === 'minigame') return 'minigame';
  if (mfs === 'always') return 'always';
  const raw = option.factor != null ? String(option.factor).trim() : '';
  const rlow = raw.toLowerCase();
  if (rlow.startsWith('minigame')) return 'minigame';
  if (rlow === 'always') return 'always';
  const f = getOptionFactorFields(option);
  if (f && f.mainFactor === 'luck') return 'luck';
  if (mfs === 'luck') return 'luck';
  return 'luck';
}

/**
 * 玩家是否已「进入」某条探索链且尚未走完（已完成至少一环且未到最高环）。
 * 若存在多条未完成链（异常进度），取 **最早有完成记录** 的那条（按首条已完成事件的 `updated_at`，缺省则按 chain_id 字典序）。
 * @returns {string|null} chain_id 或 null
 */
export function getActiveExploreChainId(allEvents, completedEvents, playerItemCounts = {}) {
  const chainLevelNum = (lv) => {
    const n = Number(lv);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const chainIds = [...new Set(allEvents.map((e) => e.chain_id).filter(Boolean))];
  const inProgress = [];

  for (const cid of chainIds) {
    const chainEvents = allEvents
      .filter((e) => e.chain_id === cid)
      .sort((a, b) => chainLevelNum(a.chain_level) - chainLevelNum(b.chain_level));
    let maxLevel = 0;
    for (const e of chainEvents) {
      maxLevel = Math.max(maxLevel, chainLevelNum(e.chain_level));
    }
    if (maxLevel <= 0) continue;

    const eff = getEffectiveExploreChainMaxCompleted(allEvents, cid, completedEvents, playerItemCounts);
    if (eff > 0 && eff < maxLevel) {
      let firstCompleteTime = Infinity;
      for (const e of chainEvents) {
        const rec = completedEvents[e.event_id];
        if (rec?.status === 'completed' && rec.updated_at) {
          const t = Date.parse(rec.updated_at);
          if (Number.isFinite(t)) firstCompleteTime = Math.min(firstCompleteTime, t);
        }
      }
      inProgress.push({
        chainId: cid,
        firstCompleteTime: firstCompleteTime === Infinity ? 0 : firstCompleteTime,
      });
    }
  }

  if (inProgress.length === 0) return null;
  if (inProgress.length === 1) return inProgress[0].chainId;

  inProgress.sort((a, b) => {
    if (a.firstCompleteTime !== b.firstCompleteTime) return a.firstCompleteTime - b.firstCompleteTime;
    return String(a.chainId).localeCompare(String(b.chainId));
  });
  return inProgress[0].chainId;
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
 * 道具 id 与探索点 `city_id` 对齐：`exploreLocationId` 取主城 id（如 `san_1_city_2_yangdi`）→ slug `yangdi` → 道具 `item_yangdi_*`
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
 * 事件链「有效」最高已完成环数：按环序推进；若完成了链 1 但未拿到下一环钥匙（如选 B/判定失败未掉信物），则进度不推进，链 1 可再次被抽到。
 * 若下一环已在存档中为 completed，则不再用「是否持有下一环 required_items」卡进度（避免链2通关后信物被消耗，却误判链1可再打）。
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
      const nextRec = completedEvents[next.event_id];
      if (nextRec?.status !== 'completed') {
        break;
      }
    }
    effective = L;
  }
  return effective;
}

/**
 * 按探索地点 + 事件链进度过滤可抽到的事件池（与 useEventSystem 逻辑一致）
 * @param {Array} allEvents - 探索用合并池（含 explore / wilderness / market / mystery 等，由 useEventSystem 合并拉取）
 * @param {Object} completedEvents - 玩家已完成事件 { eventId: { status } }
 * @param {string} locationId - 探索点 city_id；`{all}` 任意；`{city_medium_wilderness}` 等与 `city_type` + 荒郊/集市开关匹配（见 exploreLocationMatchesEvent）
 * @param {Record<string, number>} [playerItemCounts] - 背包道具数量，用于校验链式 required_items
 * @param {Array<{ city_id?: string, cityId?: string, city_type?: string, cityType?: string }>|null} [citiesList] - GET /api/cities 列表；缺省则占位符无法按类型匹配（仅 `{all}` / 全字面相等）
 * @param {'wilderness'|'market'|null} [subsidiaryKind] - 仅战略城荒郊/集市内嵌条传入，用于分池与链锁范围
 */
export function filterExploreEventsPool(
  allEvents,
  completedEvents,
  locationId,
  playerItemCounts = {},
  citiesList = null,
  subsidiaryKind = null
) {
  if (!allEvents?.length || !locationId) return [];

  /** DB/API 常把 chain_level 当字符串；与数字用 !== 比较会把整条链全过滤掉（如某城仅链式探索时显示 0 件） */
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

  const chainSource = subsidiaryKind
    ? allEvents.filter((e) => eventMatchesExploreSubsidiaryKind(e.location, subsidiaryKind, e.trigger_context))
    : allEvents;

  let activeChainId = getActiveExploreChainId(chainSource, completedEvents, playerItemCounts);
  /**
   * 链进行中时，若「下一环」事件在当前 exploreLocationId 上无任何可匹配 location（例：匪寨链
   * `{any_bandit}` 与阳翟 `san_1_city_2_yangdi`），则不在此探索点套用链锁，避免荒郊/集市 UI 误显示 0 件。
   */
  if (activeChainId && locationId) {
    const hasNextAtLocation = allEvents.some((evt) => {
      if (!evt.chain_id || evt.chain_id !== activeChainId) return false;
      const completed = chainMaxCompleted[evt.chain_id] || 0;
      const maxLevel = chainMaxLevel[evt.chain_id] || 0;
      if (completed >= maxLevel) return false;
      if (chainLevelNum(evt.chain_level) !== completed + 1) return false;
      if (evt.required_items && !playerMeetsEventRequiredItems(evt.required_items, playerItemCounts)) {
        return false;
      }
      const evLoc = String(evt.location ?? '').trim();
      if (subsidiaryKind && !eventMatchesExploreSubsidiaryKind(evLoc, subsidiaryKind, evt.trigger_context)) {
        return false;
      }
      return exploreLocationMatchesEvent(evLoc, locationId, citiesList);
    });
    if (!hasNextAtLocation) activeChainId = null;
  }

  return allEvents.filter((evt) => {
    const evLoc = String(evt.location ?? '').trim();
    if (!exploreLocationMatchesEvent(evLoc, locationId, citiesList)) return false;
    if (!eventMatchesExploreSubsidiaryKind(evLoc, subsidiaryKind, evt.trigger_context)) return false;

    if (activeChainId) {
      if (!evt.chain_id || evt.chain_id !== activeChainId) return false;
    }

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
  const f = getOptionFactorFields(opt);
  return !!(f && f.mainFactor === 'luck' && f.mainRequirement != null && f.subFactors);
}

/**
 * 判断运势是否为成功（吉/大吉/鸿运）
 */
export function isFortuneSuccess(fortune) {
  return fortune && (fortune.name === '吉' || fortune.name === '大吉' || fortune.name === '鸿运');
}

/** @param {string|null|undefined} eventId */
function eventCardRarityFromEventId(eventId) {
  if (!eventId) return 'common';
  const parts = String(eventId).split('_');
  const lastPart = parts[parts.length - 1];
  const ch = lastPart && lastPart.length > 0 ? lastPart.charAt(0) : '';
  const map = { 1: 'common', 2: 'rare', 3: 'epic', 4: 'legendary', 5: 'core' };
  return map[ch] || 'common';
}

/** 选项 A 因子为 type-b 时惩罚战为 5 编制（与 EventBattle / useBattleMap 一致） */
function exploreOptionAIsTypeB(option) {
  if (!option || typeof option !== 'object') return false;
  const raw = String(option.factor ?? '').trim().toLowerCase();
  if (raw === 'type-b' || raw.startsWith('type-b')) return true;
  const mf = String(option.mainFactor ?? option.main_factor ?? '').trim().toLowerCase();
  return mf === 'type-b';
}

/** 选项是否配置「凶/大凶后可进入惩罚战」（CSV `option_*_trigger_battle` → JSON `triggerBattle`） */
export function exploreOptionTriggerBattle(option) {
  if (!option || typeof option !== 'object') return false;
  return !!(option.triggerBattle ?? option.trigger_battle);
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
 * @param {Record<string, unknown>} event
 * @param {string|null|undefined} exploreLocationId
 * @returns {string[]|null}
 */
export function getExplorePunitiveBattleTroopSlotRarities(event, exploreLocationId) {
  if (!event || !exploreLocationId || !eventHasExplorePunitiveBattleOptionA(event)) return null;
  const eventRarity = eventCardRarityFromEventId(event.event_id);
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
  const supported = new Set(['city_small', 'city_medium', 'city_major', 'gate', 'fort']);
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

