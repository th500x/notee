/**
 * 战略道路 · 共享常量与无 SQL 纯函数
 *
 * @description
 *     - 业务常量（自由步上限、单步粮草、势力池垫粮日上限）从 `backend/config/roadConfig.js` re-export
 *     - 与 SQL/事务无关的纯 helper（整数解析、玩家道路快照、路径形状校验、幂等键分域）
 *     - 动态 import 的 `strategicWorldMapStack` 加载器
 *
 *   不含数据库连接、事务，本文件**不应**直接 import `database/connection`。
 *
 * @module services/road/roadShared
 */

const { isNeighbor4 } = require('../../utils/roadGrid');

// ── 业务常量（集中在 `backend/config/roadConfig.js`，此处仅 re-export） ────────────────
const {
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
} = require('../../config/roadConfig');

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

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function buildPlayerRoadSnapshot(player) {
  return {
    roadJunId: player.road_jun_id || null,
    roadPositionX: player.road_position_x != null ? Number(player.road_position_x) : null,
    roadPositionY: player.road_position_y != null ? Number(player.road_position_y) : null,
    roadUpdatedAt: player.road_updated_at || null,
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

/** 道路写操作幂等键前缀（同列 `road_last_request_id`，按操作分域） */
const ROAD_REQ_SCOPE = {
  MOVE: 'move',
};

function scopedRoadRequestId(scope, clientRequestId) {
  const id = String(clientRequestId || '').trim();
  if (!id) return '';
  const prefix = `${scope}:`;
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

/** move 幂等匹配：`move:<uuid>` 精确匹配 */
function matchesMoveRequestId(stored, clientRequestId) {
  const id = String(clientRequestId || '').trim();
  if (!id || stored == null || stored === '') return false;
  return String(stored) === scopedRoadRequestId(ROAD_REQ_SCOPE.MOVE, id);
}

module.exports = {
  // 业务常量
  FREE_MOVES_PER_DAY,
  FOOD_PER_STEP,
  RESERVE_FOOD_DAILY_LIMIT,
  // 纯函数
  getStrategicStackModule,
  toInt,
  buildPlayerRoadSnapshot,
  validatePathShape,
  ROAD_REQ_SCOPE,
  scopedRoadRequestId,
  matchesMoveRequestId,
};
