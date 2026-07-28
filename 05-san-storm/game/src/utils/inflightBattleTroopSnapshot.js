/**
 * 小型图 / 大型战役战术：在**同一会话**内把己方战场兵力写入 sessionStorage，
 * 供 **`buildPlayerUnitsFromContext`**（经 **`applyInflightTroopSnapshotToBuiltUnits`**）在整页刷新后仍按战中损血组装进场单位，避免仅从 `getProfile` 卡面看起来像「满血复原」。
 *
 * **刻意不做**：按小时/分钟 TTL 丢弃快照；**不**把快照合并进 **`PlayerContext.cards`**（大地图/编组须与档案 `getProfile` 一致，含随时间缓慢恢复等后端口径）。
 *
 * **清除契约（事件驱动，须与产品入口对齐）**：
 * - **`useBattleSettlement`**：战报保存链结束后，**非**「可连战胜利」（匪寨/攻城胜利）时 **`clearInflightBattleTroopSnapshot`**；连战胜利保留战损供补兵/下一场。含暂离弹窗 **`flushAwayEndNotice`**（同上口径）。
 * - **`useEventSystem`**：关探索板 **`closeEvent`**；奖励 API 失败回 **`PHASE.IDLE`**；**`dismissBattleEntryBlocked`**（未进入战术壳）。
 * - **`WorldMap`**：匪寨战败「放弃」**`handleBanditRaidAbandon`**；匪寨/攻城结算 **退出**（`closeBanditRaidResult` / `closeSiegeResult`）时清除。
 * - **匪寨胜利「继续」补兵**：`handleBanditRaidContinue` 在 API 成功后 **`writeInflightBattleTroopSnapshot`** 覆盖抬高后的兵力；`WorldMap.battlePlayerUnits` 须依赖快照 `updatedAt` 重算。
 * 新开一场战术且 **`stage === READY`** 时会 **`writeInflightBattleTroopSnapshot`** 覆盖同键；未列出的放弃路径若需清快照，应在本文件注释中补一行并在对应 handler 调用 **`clearInflightBattleTroopSnapshot`**。
 */
const STORAGE_KEY = 'san_inflight_battle_troops_v1';

function troopBattleInstanceId(t) {
  if (!t) return null;
  if (t.instanceId != null && String(t.instanceId).trim() !== '') return String(t.instanceId);
  if (t.troop?.instanceId != null && String(t.troop.instanceId).trim() !== '') {
    return String(t.troop.instanceId);
  }
  return null;
}

/**
 * @returns {null | { playerId: string, troops: Array<{ instanceId: string, currentTroops: number, maxTroops?: number }>, updatedAt?: number }}
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
 * @returns {null | { playerId: string, troops: Array<{ instanceId: string, currentTroops: number, maxTroops?: number }>, updatedAt?: number }}
 */
export function readInflightBattleTroopSnapshot(playerId) {
  const raw = readRaw();
  const pid = String(playerId ?? '').trim();
  if (!raw || !pid || String(raw.playerId) !== pid) return null;
  return raw;
}

/**
 * 匪寨层间补兵：优先用 inflight（战场终局/补兵后）的 current+max；无快照则用卡面。
 * @param {string|number|null|undefined} playerId
 * @param {Array} cards
 * @returns {Array<{ instanceId: string, currentTroops: number, maxTroops: number }>}
 */
export function buildBanditBetweenLayerHealTroopRows(playerId, cards) {
  const snap = readInflightBattleTroopSnapshot(playerId);
  const snapMap = new Map();
  for (const row of snap?.troops || []) {
    if (row?.instanceId == null) continue;
    const id = String(row.instanceId);
    const current = Math.max(0, Math.round(Number(row.currentTroops) || 0));
    const maxN = Math.round(Number(row.maxTroops) || 0);
    snapMap.set(id, {
      current,
      max: Number.isFinite(maxN) && maxN > 0 ? maxN : null,
    });
  }
  if (!Array.isArray(cards)) return [];
  const out = [];
  const seen = new Set();
  for (const c of cards) {
    if (!c || c.cardType !== 'troop' || !c.isEquipped) continue;
    const instanceId = c.instanceId != null ? String(c.instanceId).trim() : '';
    if (!instanceId || seen.has(instanceId)) continue;
    seen.add(instanceId);
    const cfg = c.config || {};
    const cardMax = Math.max(
      0,
      Math.round(Number(cfg.maxTroops ?? cfg.max_troops) || 0) +
        Math.round(Number(c.bonusMaxTroops) || 0),
    );
    const snapRow = snapMap.get(instanceId);
    const maxTroops =
      snapRow?.max != null && snapRow.max > 0 ? snapRow.max : cardMax;
    if (maxTroops <= 0) continue;
    const fromCard = Math.max(0, Math.round(Number(c.currentTroops ?? maxTroops) || 0));
    const currentTroops = snapRow
      ? Math.min(maxTroops, snapRow.current)
      : Math.min(maxTroops, fromCard);
    out.push({ instanceId, currentTroops, maxTroops });
  }
  return out;
}

/**
 * @param {string|number|null|undefined} playerId
 * @param {Array<{ faction?: string, instanceId?: string|number, currentTroops?: number, maxTroops?: number, troop?: object }>} battlePlayerTroops
 *   战场对象（须 faction=player 或省略）或补兵 updates（带 instanceId/currentTroops/maxTroops）
 */
export function writeInflightBattleTroopSnapshot(playerId, battlePlayerTroops) {
  if (typeof sessionStorage === 'undefined' || playerId == null || String(playerId).trim() === '') {
    return;
  }
  const troops = (battlePlayerTroops || [])
    .filter((t) => {
      if (!t) return false;
      if (t.faction != null && String(t.faction) !== 'player') return false;
      const cur = Number(t.currentTroops ?? t.current_troops);
      return Number.isFinite(cur) && cur >= 0;
    })
    .map((t) => {
      const instanceId = troopBattleInstanceId(t);
      const currentTroops = Math.max(
        0,
        Math.round(Number(t.currentTroops ?? t.current_troops) || 0),
      );
      const maxN = Math.round(Number(t.maxTroops ?? t.max_troops) || 0);
      return {
        instanceId,
        currentTroops,
        ...(Number.isFinite(maxN) && maxN > 0 ? { maxTroops: maxN } : {}),
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
    if (row && row.instanceId != null) {
      map.set(String(row.instanceId), {
        current: Number(row.currentTroops),
        max: Number(row.maxTroops),
      });
    }
  }
  if (map.size === 0) return units;
  return units.map((u) => {
    const id =
      u?.troop?.instanceId != null
        ? String(u.troop.instanceId)
        : '';
    if (!id || !map.has(id)) return u;
    const snap = map.get(id);
    const unitMax = Math.max(0, Math.round(Number(u.maxTroops) || 0));
    const snapMax =
      Number.isFinite(snap.max) && snap.max > 0 ? Math.round(snap.max) : unitMax;
    const max = Math.max(unitMax, snapMax);
    const merged = Math.min(max, Math.max(0, Math.round(Number(snap.current))));
    return {
      ...u,
      currentTroops: merged,
      maxTroops: max,
      troop: u.troop ? { ...u.troop, maxTroops: max } : u.troop,
    };
  });
}
