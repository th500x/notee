/**
 * 小型图 / 大型战役战术：在**同一会话**内把己方战场兵力写入 sessionStorage，
 * 供 **`buildPlayerUnitsFromContext`**（经 **`applyInflightTroopSnapshotToBuiltUnits`**）在整页刷新后仍按战中损血组装进场单位，避免仅从 `getProfile` 卡面看起来像「满血复原」。
 *
 * **刻意不做**：按小时/分钟 TTL 丢弃快照；**不**把快照合并进 **`PlayerContext.cards`**（大地图/编组须与档案 `getProfile` 一致，含随时间缓慢恢复等后端口径）。
 *
 * **清除契约（事件驱动，须与产品入口对齐）**：
 * - **`useBattleSettlement`**：胜负已分、战报保存链结束后 **`clearInflightBattleTroopSnapshot`**（含暂离弹窗 **`flushAwayEndNotice`**）。
 * - **`useEventSystem`**：关探索板 **`closeEvent`**；奖励 API 失败回 **`PHASE.IDLE`**；**`dismissBattleEntryBlocked`**（未进入战术壳）。
 * - **`WorldMap`**：匪寨战败后点「放弃」**`handleBanditRaidAbandon`**（重置层数成功后）。
 * 新开一场战术且 **`stage === READY`** 时会 **`writeInflightBattleTroopSnapshot`** 覆盖同键；未列出的放弃路径若需清快照，应在本文件注释中补一行并在对应 handler 调用 **`clearInflightBattleTroopSnapshot`**。
 */
const STORAGE_KEY = 'san_inflight_battle_troops_v1';

function troopBattleInstanceId(t) {
  if (!t) return null;
  if (t.instanceId != null && String(t.instanceId).trim() !== '') return String(t.instanceId);
  if (t.instance_id != null && String(t.instance_id).trim() !== '') return String(t.instance_id);
  if (t.troop?.instanceId != null && String(t.troop.instanceId).trim() !== '') return String(t.troop.instanceId);
  if (t.troop?.instance_id != null && String(t.troop.instance_id).trim() !== '') return String(t.troop.instance_id);
  return null;
}

/**
 * @returns {null | { playerId: string, troops: Array<{ instanceId: string, currentTroops: number }>, updatedAt?: number }}
 */
function readRaw() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const s = sessionStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    const o = JSON.parse(s);
    if (!o || typeof o !== 'object') {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (typeof o.playerId !== 'string' || o.playerId.trim() === '') {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!Array.isArray(o.troops) || o.troops.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return o;
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * @param {string|number|null|undefined} playerId
 * @param {{ instanceId?: string|number, currentTroops?: number }[]} battlePlayerTroops  faction=player 的战场对象
 */
export function writeInflightBattleTroopSnapshot(playerId, battlePlayerTroops) {
  if (typeof sessionStorage === 'undefined' || playerId == null || String(playerId).trim() === '') return;
  const troops = (battlePlayerTroops || [])
    .filter((t) => t && t.faction === 'player' && Number(t.currentTroops) >= 0)
    .map((t) => {
      const instanceId = troopBattleInstanceId(t);
      return {
        instanceId,
        currentTroops: Math.max(0, Math.round(Number(t.currentTroops) || 0)),
      };
    })
    .filter((row) => row.instanceId);
  if (troops.length === 0) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        playerId: String(playerId).trim(),
        troops,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    /* 私密模式等 */
  }
}

export function clearInflightBattleTroopSnapshot() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 将 sessionStorage 中的进行中战损合并进 **`buildPlayerUnitsFromContext`** 产出的单位（仅战术入口使用）。
 *
 * @param {string|number|null|undefined} playerId
 * @param {Array<{ troop?: { instanceId?: string|number }, currentTroops?: number, maxTroops?: number }>} units
 * @returns {typeof units}
 */
export function applyInflightTroopSnapshotToBuiltUnits(playerId, units) {
  if (!units || units.length === 0) return units;
  const raw = readRaw();
  const pid = String(playerId ?? '').trim();
  if (!raw || String(raw.playerId) !== pid) return units;
  const map = new Map();
  for (const row of raw.troops || []) {
    if (row && row.instanceId != null) map.set(String(row.instanceId), Number(row.currentTroops));
  }
  if (map.size === 0) return units;
  return units.map((u) => {
    const id =
      u?.troop?.instanceId != null
        ? String(u.troop.instanceId)
        : u?.troop?.instance_id != null
          ? String(u.troop.instance_id)
          : '';
    if (!id || !map.has(id)) return u;
    const snap = map.get(id);
    const max = Math.max(0, Math.round(Number(u.maxTroops) || 0));
    const merged = Math.min(max, Math.max(0, Math.round(Number(snap))));
    return { ...u, currentTroops: merged };
  });
}
