/**
 * AI 玩家移动规划（42-1 §6 / 42-2 Step 4）
 *
 * 职责：给一个 AI 玩家**定目标点**（匪寨 POI / 中城·大城 / 攻方大本营 / 守方城池），
 * 解析出 `targetPoiId`，再调用与真人**同一条**沿路移动 service `moveAlongRoad`。
 *
 * 关键复用：`moveAlongRoad(targetPoiId)` 内部已做道路栅格 BFS 寻路、离路出发占格解析、
 * 逐格遭遇登记、粮草/免费格扣减与 POI 锚点贴靠（见 `road/roadMoveAlongService.js`）。
 * 本规划器**只**负责「选哪个目标 + 拼 body + 调用」，**不**自写第二套寻路。
 *
 * 禁止静默兜底（与 `san-storm-road-stand-no-silent-repair` / `notee-code-quality` P0 一致）：
 *   - 目标解析失败 → 返回 `{ ok:true, moved:false, reason }`，**不**猜郡 / 不换语义无关的 POI；
 *   - `moveAlongRoad` 返回错误 → `console.error` 上报 + 原样返回 error，**不**改 `road_jun_id`/坐标、
 *     不悄悄换成「目标城城心」之类的替代路径；
 *   - 仅在「解析时」按可达性优先排序候选（同郡优先），这是**目标选择**，非失败后的语义替代。
 *
 * @module services/aiPlayerMovementPlanner
 */

const crypto = require('crypto');
const { pool } = require('../database/connection');
const roadEncounterService = require('./roadEncounterService');
const WarPvp = require('../models/WarPvp');
const { seasonFromFactionId } = require('./aiPlayerExplorePolicy');
const { isAllowedPlayerCityPoiCityType } = require('../../shared/utils/strategicMarchPoi.js');

const LOG = '[aiPlayer][movement]';

/** routine 移动意图（与 42-1 §6 表一一对应） */
const MOVE_INTENT = Object.freeze({
  BANDIT: 'bandit', // 打匪寨 → 匪寨 POI
  GACHA: 'gacha', // 封赏抽卡 → 本势力中城 / 大城
  ATTACK: 'attack', // 参与攻城（进攻）→ 攻方大本营
  DEFEND: 'defend', // 参与防守 → 守方城池
});

/**
 * 读取 AI 玩家当前道路状态（与 `moveAlongRoad` 的 FOR UPDATE 列一致的只读子集）。
 * @returns {Promise<{ playerId:string, factionId:string, season:string, roadJunId:string,
 *   roadX:number|null, roadY:number|null, mainCityId:string|null }|null>}
 */
async function loadPlayerRoadState(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return null;
  const [rows] = await pool.query(
    `SELECT player_id, faction_id, main_city_id,
            road_jun_id, road_position_x, road_position_y
       FROM players WHERE player_id = ?`,
    [pid],
  );
  if (!rows.length) return null;
  const r = rows[0];
  const factionId = r.faction_id != null ? String(r.faction_id).trim() : '';
  return {
    playerId: pid,
    factionId,
    season: seasonFromFactionId(factionId),
    roadJunId: r.road_jun_id != null ? String(r.road_jun_id).trim() : '',
    roadX: r.road_position_x != null ? Number(r.road_position_x) : null,
    roadY: r.road_position_y != null ? Number(r.road_position_y) : null,
    mainCityId: r.main_city_id != null ? String(r.main_city_id).trim() : null,
  };
}

/**
 * 解析「封赏抽卡」目标：本势力 **中城 / 大城**。
 * 优先级：主城（若本身为中/大城）→ 与玩家同郡 → 本季同势力任意，主城所在郡再优先。
 * @returns {Promise<{ targetPoiId:string, kind:'gacha', cityId:string, cityType:string, junId:string }|null>}
 */
async function resolveGachaCityTarget(state) {
  if (!state?.factionId) return null;
  const [rows] = await pool.query(
    `SELECT city_id, city_type, jun_id
       FROM cities
      WHERE season = ? AND faction_id = ?
        AND city_type IN ('city_medium','city_major')`,
    [state.season, state.factionId],
  );
  const cities = rows.filter((c) => isAllowedPlayerCityPoiCityType(c.city_type));
  if (!cities.length) return null;

  const sameJun = (c) => String(c.jun_id || '').trim() === state.roadJunId;
  const isMain = (c) => state.mainCityId && String(c.city_id || '').trim() === state.mainCityId;
  // 主城（中/大城）最稳：玩家本就在主城占格，离路出发解析最可靠
  cities.sort((a, b) => {
    const am = isMain(a) ? 0 : 1;
    const bm = isMain(b) ? 0 : 1;
    if (am !== bm) return am - bm;
    const aj = sameJun(a) ? 0 : 1;
    const bj = sameJun(b) ? 0 : 1;
    if (aj !== bj) return aj - bj;
    // 大城优先于中城（抽卡入口更可能在大城；与卡池入口设计无强绑定，仅排序偏好）
    const at = a.city_type === 'city_major' ? 0 : 1;
    const bt = b.city_type === 'city_major' ? 0 : 1;
    return at - bt;
  });
  const chosen = cities[0];
  return {
    targetPoiId: String(chosen.city_id).trim(),
    kind: 'gacha',
    cityId: String(chosen.city_id).trim(),
    cityType: chosen.city_type,
    junId: String(chosen.jun_id || '').trim(),
  };
}

/**
 * 解析「打匪寨」目标：全服耐久未耗尽（`cleared_layers < max_layers`）的 active 匪寨。
 * 优先同郡（道路可达性最高），其次本季其余郡。
 * @returns {Promise<{ targetPoiId:string, kind:'bandit', junId:string }|null>}
 */
async function resolveBanditTarget(state) {
  if (!state?.season) return null;
  const [rows] = await pool.query(
    `SELECT bandit_id, jun_id
       FROM bandits
      WHERE status = 'active'
        AND cleared_layers < max_layers
        AND jun_id LIKE ?
      ORDER BY (jun_id = ?) DESC, bandit_id ASC
      LIMIT 1`,
    [`${state.season}\\_jun\\_%`, state.roadJunId],
  );
  if (!rows.length) return null;
  const b = rows[0];
  return {
    targetPoiId: String(b.bandit_id).trim(),
    kind: 'bandit',
    junId: String(b.jun_id || '').trim(),
  };
}

/**
 * 解析「参与攻城（进攻）」目标：本势力为攻方且进行中、带 base_camp 的 PVP 战事。
 * 目标 POI 为 `pvp_war_id`（moveAlongRoad 据此走攻方大本营 footprint）。
 * @returns {Promise<{ targetPoiId:string, kind:'attack', targetCityId:string|null }|null>}
 */
async function resolveAttackBaseCampTarget(state) {
  if (!state?.factionId) return null;
  const wars = await WarPvp.listWars({
    status: 'active',
    attackerFactionId: state.factionId,
    season: state.season,
    limit: 50,
  });
  const war = wars.find((w) => w.baseCamp && Array.isArray(w.baseCamp.cells) && w.baseCamp.cells.length);
  if (!war) return null;
  return {
    targetPoiId: String(war.pvpWarId).trim(),
    kind: 'attack',
    targetCityId: war.targetCityId != null ? String(war.targetCityId).trim() : null,
  };
}

/**
 * 解析「参与防守」目标：本势力为守方的进行中 PVP 战事 → 被攻城池（本势力城）。
 * 目标 POI 为守城 `target_city_id`（moveAlongRoad 走该城道路锚格；canPlayerMarchToPoiCity 校验同势力）。
 * @returns {Promise<{ targetPoiId:string, kind:'defend', pvpWarId:string }|null>}
 */
async function resolveDefendCityTarget(state) {
  if (!state?.factionId) return null;
  const wars = await WarPvp.listWars({
    status: 'active',
    factionId: state.factionId,
    season: state.season,
    limit: 50,
  });
  const war = wars.find(
    (w) =>
      String(w.defenderFactionId ?? '') === state.factionId &&
      w.targetCityId != null &&
      String(w.targetCityId).trim() !== '',
  );
  if (!war) return null;
  return {
    targetPoiId: String(war.targetCityId).trim(),
    kind: 'defend',
    pvpWarId: String(war.pvpWarId).trim(),
  };
}

/**
 * 按意图解析目标点。
 * @param {object} state loadPlayerRoadState 结果
 * @param {string} intent MOVE_INTENT 之一
 */
async function resolveMovementTarget(state, intent) {
  switch (intent) {
    case MOVE_INTENT.BANDIT:
      return resolveBanditTarget(state);
    case MOVE_INTENT.GACHA:
      return resolveGachaCityTarget(state);
    case MOVE_INTENT.ATTACK:
      return resolveAttackBaseCampTarget(state);
    case MOVE_INTENT.DEFEND:
      return resolveDefendCityTarget(state);
    default:
      return null;
  }
}

/**
 * 调用真人同一条 `moveAlongRoad` 把 AI 移到目标 POI。
 * 失败不静默：`console.error` + 原样返回 error（不改库坐标 / 不换 POI）。
 *
 * @param {object} state loadPlayerRoadState 结果（须含合法 roadJunId）
 * @param {{ targetPoiId:string, kind:string }} target resolveMovementTarget 结果
 * @param {{ clientRequestId?: string }} [opts]
 * @returns {Promise<
 *   | { ok:true, moved:true, target:object, stepsApplied:number, encounter:object|null, road:object }
 *   | { ok:false, moved:false, target:object, status:number, error:string }
 * >}
 */
async function moveToTarget(state, target, opts = {}) {
  if (!state?.roadJunId) {
    const error = '玩家缺少 road_jun_id（道路状态未初始化），拒绝移动（不猜郡）';
    console.error(`${LOG} player=${state?.playerId} ${error}`);
    return { ok: false, moved: false, target, status: 400, error };
  }
  const clientRequestId =
    String(opts.clientRequestId || '').trim() || `ai-move-${state.playerId}-${crypto.randomUUID()}`;
  const body = {
    season: state.season,
    junId: state.roadJunId,
    clientRequestId,
    confirmFoodCost: true,
    // AI 行军不消耗粮草（个人粮/势力储备均不扣、不占免费格）：由 moveAlongRoad 识别此标志
    noFoodCost: true,
    targetPoiId: target.targetPoiId,
  };
  const res = await roadEncounterService.moveAlongRoad(state.playerId, body);
  if (!res.ok) {
    console.error(
      `${LOG} moveAlongRoad 失败 player=${state.playerId} intent=${target.kind} ` +
        `poi=${target.targetPoiId} jun=${state.roadJunId}: [${res.status}] ${res.error}`,
    );
    return { ok: false, moved: false, target, status: res.status, error: res.error };
  }
  return {
    ok: true,
    moved: true,
    target,
    stepsApplied: res.data?.stepsApplied ?? 0,
    encounter: res.data?.encounter ?? null,
    road: {
      junId: res.data?.roadJunId ?? state.roadJunId,
      x: res.data?.roadPositionX ?? null,
      y: res.data?.roadPositionY ?? null,
    },
  };
}

/**
 * Step 4 主入口：给定意图 → 解析目标 → 移动。
 * 无目标（如本势力无在打的战事 / 无可打匪寨）→ `{ ok:true, moved:false, reason:'no_target' }`。
 *
 * @param {string} playerId
 * @param {string} intent MOVE_INTENT 之一
 * @param {{ clientRequestId?: string }} [opts]
 */
async function planAndMove(playerId, intent, opts = {}) {
  const state = await loadPlayerRoadState(playerId);
  if (!state) return { ok: false, moved: false, error: '玩家不存在' };

  const target = await resolveMovementTarget(state, intent);
  if (!target) {
    return { ok: true, moved: false, reason: 'no_target', intent, playerId: state.playerId };
  }
  return moveToTarget(state, target, opts);
}

module.exports = {
  MOVE_INTENT,
  loadPlayerRoadState,
  resolveGachaCityTarget,
  resolveBanditTarget,
  resolveAttackBaseCampTarget,
  resolveDefendCityTarget,
  resolveMovementTarget,
  moveToTarget,
  planAndMove,
};
