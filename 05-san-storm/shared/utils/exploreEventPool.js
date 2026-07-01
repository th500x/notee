/**
 * 探索事件池筛选与抽取 — **前后端单一来源**（ESM）。
 *
 * 游戏前端经 `game/src/components/event/eventUtils.js` 再导出引用；
 * Node 后端（AI 玩家探索策略 `aiPlayerExplorePolicy`）经 dynamic `import()` 加载
 * （与 `smallMapEnemyRoster.js` / `eventLocationPlaceholders.js` 同模式，遵守 cjs/esm 边界规则）。
 *
 * 算法完全照搬原 `eventUtils.js`（探索链进度、地点匹配、必出抽取、选项分流）；
 * 修改逻辑请改本文件，勿在前端再写第二套实现。
 *
 * @module @shared/utils/exploreEventPool
 */

import { LOCATION_PLACEHOLDERS, exploreLocationMatchesEvent } from './eventLocationPlaceholders.js';
import { getOptionFactorFields } from './eventOptionFactor.js';

/** 教程探索链 `chain_id`；未完成时探索池只认本链，避免与无链/其它链/集市事件混抽 */
export const TUTORIAL_EXPLORE_CHAIN_ID = 'chain_tutorial_v1';

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

/** 选项是否配置「凶/大凶后可进入惩罚战」（CSV `option_*_trigger_battle` → JSON `triggerBattle`） */
export function exploreOptionTriggerBattle(option) {
  if (!option || typeof option !== 'object') return false;
  return !!(option.triggerBattle ?? option.trigger_battle);
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

    const eff =
      cid === TUTORIAL_EXPLORE_CHAIN_ID
        ? getTutorialChainCompletedLevelForPool(allEvents, completedEvents, playerItemCounts)
        : getEffectiveExploreChainMaxCompleted(allEvents, cid, completedEvents, playerItemCounts);
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
  const segments = String(requiredItemsStr).split(';').map((s) => s.trim()).filter(Boolean);
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
 * 教程链：按 `explore_events` 从链首起**连续** completed 的最大 `chain_level`（不看背包 snapshot）。
 */
function getTutorialStrictConsecutiveCompletedMaxLevel(allEvents, completedEvents) {
  const chainLevelNum = (lv) => {
    const n = Number(lv);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const chainEvents = allEvents
    .filter((e) => String(e.chain_id || '').trim() === TUTORIAL_EXPLORE_CHAIN_ID)
    .sort((a, b) => chainLevelNum(a.chain_level) - chainLevelNum(b.chain_level));
  let n = 0;
  for (const evt of chainEvents) {
    const L = chainLevelNum(evt.chain_level);
    if (L !== n + 1) break;
    if (completedEvents[evt.event_id]?.status !== 'completed') break;
    n = L;
  }
  return n;
}

/**
 * 教程链大地图 `event_hint`：仅按 `explore_events` **连续 completed** 计数，不用背包钥匙推进的有效环。
 * （与 `getTutorialChainCompletedLevelForPool` 分离，避免已拿 item_tutorial_2 却未打完 1002 时误显第 3 步匪寨文案。）
 */
export function getTutorialChainCompletedLevelForMapHint(allEvents, completedEvents) {
  return getTutorialStrictConsecutiveCompletedMaxLevel(allEvents, completedEvents);
}

/**
 * 教程链在 **`filterExploreEventsPool` / `isTutorial`** 上用的「已完成环数」：
 * `getEffectiveExploreChainMaxCompleted` 在「下一环 `required_items` 尚未出现在 `playerItemCounts` snapshot」时会少算 1，
 * 导致已连续通关 L、池却仍只认 L−1、只匹配第 L 环模板（如 1003 的 `{any_bandit}`），**中城汝阳**等处池恒空。
 * 当严格连打层数 **高于** 有效环且有效环 ≥1 时取严格值；**不回卷** eff=0、strict=1（仍靠 `getEffective` 支撑链 1 无钥重做）。
 */
export function getTutorialChainCompletedLevelForPool(allEvents, completedEvents, playerItemCounts) {
  const eff = getEffectiveExploreChainMaxCompleted(
    allEvents,
    TUTORIAL_EXPLORE_CHAIN_ID,
    completedEvents,
    playerItemCounts
  );
  const strict = getTutorialStrictConsecutiveCompletedMaxLevel(allEvents, completedEvents);
  if (strict > eff && eff >= 1) return strict;
  return eff;
}

/**
 * 与后端 `playerExploreEventService.isExploreChainStrandedRedo` 一致：
 * 本环已在 `completedEvents` 为 completed，且不满足下一环 `required_items`、且下一环尚未 completed → 允许本环留在池内重做。
 * 其它「本环已 completed」须从池内剔除，否则会出现有效进度已推进却仍抽到该环、而后端拒领奖励。
 */
export function isExploreChainStrandedRedoFromState(evt, allEvents, completedEvents, playerItemCounts = {}) {
  if (!evt?.chain_id || !evt?.event_id) return false;
  if (completedEvents[evt.event_id]?.status !== 'completed') return false;
  const chainLevelNum = (lv) => {
    const n = Number(lv);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const L = chainLevelNum(evt.chain_level);
  const chainEvents = allEvents
    .filter((e) => e.chain_id === evt.chain_id)
    .sort((a, b) => chainLevelNum(a.chain_level) - chainLevelNum(b.chain_level));
  const next = chainEvents.find((e) => chainLevelNum(e.chain_level) === L + 1);
  if (!next?.required_items || !String(next.required_items).trim()) return false;
  if (playerMeetsEventRequiredItems(next.required_items, playerItemCounts)) return false;
  if (completedEvents[next.event_id]?.status === 'completed') return false;
  return true;
}

/**
 * 按探索地点 + 事件链进度过滤可抽到的事件池（与 useEventSystem 逻辑一致）
 * @param {Array} allEvents - 探索用合并池（含 explore / wilderness / market / mystery 等，由 useEventSystem 合并拉取）
 * @param {Object} completedEvents - 玩家已完成事件 { eventId: { status } }
 * @param {string} locationId - 探索点 city_id；`{all}` 任意；`{city_medium_wilderness}` 等与 `city_type` + 荒郊/集市开关匹配（见 exploreLocationMatchesEvent）
 * @param {Record<string, number>} [playerItemCounts] - 背包道具数量，用于校验链式 required_items
 * @param {Array<{ city_id?: string, cityId?: string, city_type?: string, cityType?: string }>|null} [citiesList] - GET /api/cities 列表；缺省则占位符无法按类型匹配（仅 `{all}` / 全字面相等）
 * @param {'wilderness'|'market'|null} [subsidiaryKind] - 仅战略城荒郊/集市内嵌条传入，用于分池与链锁范围
 * @param {number|null|undefined} [playerReputation] - 玩家当前声望；低于事件 `min_reputation` 则不入池
 */
export function filterExploreEventsPool(
  allEvents,
  completedEvents,
  locationId,
  playerItemCounts = {},
  citiesList = null,
  subsidiaryKind = null,
  playerReputation = null
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
  if (chainIds.includes(TUTORIAL_EXPLORE_CHAIN_ID)) {
    chainMaxCompleted[TUTORIAL_EXPLORE_CHAIN_ID] = getTutorialChainCompletedLevelForPool(
      allEvents,
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

  const tutorialMaxLevel = chainMaxLevel[TUTORIAL_EXPLORE_CHAIN_ID] || 0;
  const tutorialEff = chainMaxCompleted[TUTORIAL_EXPLORE_CHAIN_ID] || 0;
  /** 教程链未通：池内只放行 `chain_tutorial_v1`，不混入无链/其它链/集市等（上层产品规则） */
  const tutorialChainIncomplete = tutorialMaxLevel > 0 && tutorialEff < tutorialMaxLevel;
  if (tutorialChainIncomplete) {
    activeChainId = TUTORIAL_EXPLORE_CHAIN_ID;
  }

  /**
   * 非教程链：一条链未完成时，若「下一环」在当前城此荒郊/集市子条无可匹配 location，临时解除链锁，
   * 以便无链荒郊等仍可出现（子条 UI 不致恒为 0 件）。
   *
   * **教程链未完成**：**不**在此解除链锁——荒郊/集市子条与默认探索池均**只**放行 `chain_tutorial_v1`，
   * 不混入其它 `trigger_context` 事件；避免未完成教程时在各城「正常探索」。
   */
  if (!tutorialChainIncomplete && subsidiaryKind && activeChainId && locationId) {
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
      if (!eventMatchesExploreSubsidiaryKind(evLoc, subsidiaryKind, evt.trigger_context)) {
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

    const minRepRaw = evt.min_reputation;
    if (minRepRaw != null && minRepRaw !== '') {
      const need = Number(minRepRaw);
      if (Number.isFinite(need)) {
        const pr = Number(playerReputation);
        const actual = Number.isFinite(pr) ? pr : 0;
        if (actual < need) return false;
      }
    }

    if (activeChainId) {
      if (!evt.chain_id || evt.chain_id !== activeChainId) return false;
    }

    if (!evt.chain_id) return true;

    if (completedEvents[evt.event_id]?.status === 'completed') {
      if (!isExploreChainStrandedRedoFromState(evt, allEvents, completedEvents, playerItemCounts)) {
        return false;
      }
    }

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
