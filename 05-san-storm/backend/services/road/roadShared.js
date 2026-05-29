/**
 * 道路遭遇 · 共享常量与无 SQL 纯函数
 *
 * @description
 *   把原 `roadEncounterService.js` 顶部的：
 *     - 业务常量（开战门闸价、自由步上限、单步粮草、储备金日上限、守方提示秒数、Stale 阈值）
 *     - 与 SQL/事务无关的纯 helper（id 生成、整数解析、玩家道路快照、路径形状校验、攻城 NPC 起始兵汇总等）
 *     - 动态 import 的 `strategicWorldMapStack` 加载器
 *   抽到本文件，让主 service / 拆分出来的兄弟 service 共用，主 service 行为零变动。
 *
 *   不含数据库连接、事务，本文件**不应**直接 import `database/connection`。
 *
 * @module services/road/roadShared
 */

const crypto = require('crypto');
const { isNeighbor4 } = require('../../utils/roadGrid');

// ── 业务常量（CR R3，2026-04-29：从 `backend/config/roadConfig.js` 集中导入再 re-export，
//   外部 `require('./services/road/roadShared')` 取常量的路径完全不变） ────────────────
const {
  INTERCEPT_COST_SILVER,
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
  ROAD_DEFENDER_ALERT_SEC,
  STALE_FIGHTING_NO_SETTLEMENT_MINUTES,
} = require('../../config/roadConfig');

/** MySQL/MariaDB 预编译对 `INTERVAL ? MINUTE` 常不生效，Stale 清理须用字面分钟数（仅来自上常数，禁止拼接用户输入） */
const STALE_FIGHT_SQL_MIN = Math.max(
  1,
  Math.min(10080, Math.floor(Number(STALE_FIGHTING_NO_SETTLEMENT_MINUTES) || 5)),
);

// ── 纯 helper ─────────────────────────────────────────────────────────────────

let strategicStackModPromise = null;
/**
 * 动态 import `shared/utils/strategicWorldMapStack.js`（ESM）；缓存 Promise 避免重复 import。
 * 调用方需 `await` 后再解构其暴露的函数。
 */
async function getStrategicStackModule() {
  if (!strategicStackModPromise) {
    strategicStackModPromise = import('../../../shared/utils/strategicWorldMapStack.js');
  }
  return strategicStackModPromise;
}

function newEncounterId(junId) {
  const bare = String(junId || '').replace(/^san_1_jun_/, '') || 'jun';
  const rnd = crypto.randomBytes(3).toString('hex');
  return `re_${bare}_${Date.now()}_${rnd}`.slice(0, 50);
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function buildPlayerRoadSnapshot(player) {
  return {
    road_jun_id: player.road_jun_id || null,
    road_position_x: player.road_position_x != null ? Number(player.road_position_x) : null,
    road_position_y: player.road_position_y != null ? Number(player.road_position_y) : null,
    road_intercept: player.road_intercept ? 1 : 0,
    road_updated_at: player.road_updated_at || null,
  };
}

/** 判断 path 是否合法（非空、逐格相邻、格坐标为整数） */
function validatePathShape(path) {
  if (!Array.isArray(path) || !path.length) return '路径为空';
  for (const step of path) {
    if (!step || typeof step !== 'object') return '路径格式错误';
    const x = toInt(step.x);
    const y = toInt(step.y);
    if (x == null || y == null) return '路径格坐标缺失';
  }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!isNeighbor4(Number(a.x), Number(a.y), Number(b.x), Number(b.y))) {
      return '路径格非 4-邻接';
    }
  }
  return null;
}

/** 攻城 NPC 起始兵力汇总（仅道路战权威推演用；行为同原内联） */
function sumSiegeNpcStartingTroopsRoad(npcs) {
  if (!Array.isArray(npcs)) return 0;
  let total = 0;
  for (const n of npcs) {
    const v = Number(n?.troopCount);
    if (Number.isFinite(v) && v > 0) total += Math.trunc(v);
  }
  return total;
}

/** 攻城 NPC 显示名汇总（仅道路战权威推演用；行为同原内联） */
function siegeNpcDisplayNamesRoad(npcs) {
  if (!Array.isArray(npcs)) return [];
  return npcs
    .map((n) => (n && typeof n.displayName === 'string' ? n.displayName.trim() : ''))
    .filter(Boolean);
}

/** 道路写操作幂等键前缀（同列 `road_last_request_id`，按操作分域，避免 move/intercept 互相覆盖） */
const ROAD_REQ_SCOPE = {
  MOVE: 'move',
  INTERCEPT: 'intercept',
};

function scopedRoadRequestId(scope, clientRequestId) {
  const id = String(clientRequestId || '').trim();
  if (!id) return '';
  const prefix = `${scope}:`;
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

/** move 幂等匹配：新格式 `move:<uuid>`；兼容历史裸 uuid */
function matchesMoveRequestId(stored, clientRequestId) {
  const id = String(clientRequestId || '').trim();
  if (!id || stored == null || stored === '') return false;
  const s = String(stored);
  return s === scopedRoadRequestId(ROAD_REQ_SCOPE.MOVE, id) || s === id;
}

/** intercept 幂等匹配：新格式 `intercept:<uuid>`；兼容历史裸 uuid */
function matchesInterceptRequestId(stored, clientRequestId) {
  const id = String(clientRequestId || '').trim();
  if (!id || stored == null || stored === '') return false;
  const s = String(stored);
  return s === scopedRoadRequestId(ROAD_REQ_SCOPE.INTERCEPT, id) || s === id;
}

module.exports = {
  // 业务常量
  INTERCEPT_COST_SILVER,
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
  ROAD_DEFENDER_ALERT_SEC,
  STALE_FIGHTING_NO_SETTLEMENT_MINUTES,
  STALE_FIGHT_SQL_MIN,
  // 纯函数
  getStrategicStackModule,
  newEncounterId,
  toInt,
  buildPlayerRoadSnapshot,
  validatePathShape,
  sumSiegeNpcStartingTroopsRoad,
  siegeNpcDisplayNamesRoad,
  ROAD_REQ_SCOPE,
  scopedRoadRequestId,
  matchesMoveRequestId,
  matchesInterceptRequestId,
};
