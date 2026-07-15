/**
 * PvP 战术对决回放 · 纯状态（无 React/DOM）
 *
 * 1) `buildInitialTroops`：从 `BATTLE_START` 事件 + 双方编组快照构建棋盘部队对象（含 HP / 阵营 / 立绘字段），
 *    坐标与阵营经 `makeCanonicalView` 变换到观战者视角空间。
 * 2) `foldEvents`：把事件流折叠为最终态（兵力 / 坐标 / 胜方），供 Node 单测与离线快照（不依赖动画）。
 *
 * 设计：与 `pvpEventPlayer`（DOM 动画层）共享同一套坐标 / 兵力推进语义，确保「逐帧动画终态」与「直接折叠终态」一致。
 *
 * @see docs/10-core-system/17-5-DUEL_SYSTEM.md §12.6
 */

/** 解析内核 instanceId `${side}_${index}`（side ∈ a|b） */
export function parseInstanceId(instanceId) {
  const m = String(instanceId).match(/^([ab])_(\d+)$/);
  if (!m) return { side: null, index: -1 };
  return { side: m[1], index: Number(m[2]) };
}

/**
 * @param {object} battleStartPayload BATTLE_START.payload（{ units:[{ instanceId, side, name, troopType, y, x, troops }] }）
 * @param {object} view makeCanonicalView 返回
 * @param {{a:object[], b:object[]}} snapshotsBySide canonical 两侧编组快照（mapBuiltUnitsToSiegeNpcFormat 形状）
 * @returns {{ troops: object[], byId: Map<string, object> }}
 */
export function buildInitialTroops(battleStartPayload, view, snapshotsBySide) {
  const units = Array.isArray(battleStartPayload?.units) ? battleStartPayload.units : [];
  const troops = [];
  const byId = new Map();
  for (const u of units) {
    const { side, index } = parseInstanceId(u.instanceId);
    const snap = (snapshotsBySide?.[side] || [])[index] || {};
    const { y, x } = view.coord(u.y, u.x);
    const maxTroops = Number(snap.maxTroops ?? u.troops ?? 0) || 0;
    const current = Number(u.troops ?? maxTroops) || 0;
    const range = Number(snap.attackRange ?? 1) || 1;
    const troop = {
      id: u.instanceId,
      instanceId: u.instanceId,
      side: u.side,
      faction: view.faction(u.side),
      y,
      x,
      troopType: u.troopType ?? snap.troopType ?? 'infantry',
      weaponType: snap.weaponType ?? 'melee',
      rarity: snap.rarity ?? 'common',
      assetTroopId: snap.troopId ?? null,
      name: u.name ?? snap.troopName ?? u.instanceId,
      displayName:
        snap.character?.courtesyName || snap.character?.name || u.name || snap.troopName || u.instanceId,
      morale: 100,
      range,
      attackRange: range,
      maxTroops,
      currentTroops: current,
      initialTroops: current,
    };
    troops.push(troop);
    byId.set(troop.instanceId, troop);
  }
  return { troops, byId };
}

/**
 * 折叠事件为最终态（纯，无动画）。坐标按 view 变换；兵力以 DAMAGE.remain 为权威。
 * @returns {{ byId: Map<string, object>, winnerSide: 'a'|'b'|null, rounds: number }}
 */
export function foldEvents(events, byId, view) {
  let winnerSide = null;
  let rounds = 0;
  for (const ev of events || []) {
    const p = ev.payload || {};
    switch (ev.type) {
      case 'ROUND_START':
        rounds = p.round ?? rounds;
        break;
      case 'FORMATION_APPLIED':
        for (const u of p.units || []) {
          const t = byId.get(u.instanceId);
          if (t) {
            const c = view.coord(u.y, u.x);
            t.y = c.y;
            t.x = c.x;
          }
        }
        break;
      case 'MOVE': {
        const t = byId.get(p.instanceId);
        if (t && p.to) {
          const c = view.coord(p.to.y, p.to.x);
          t.y = c.y;
          t.x = c.x;
        }
        break;
      }
      case 'DAMAGE': {
        const t = byId.get(p.target);
        if (t) {
          t.currentTroops =
            p.remain != null ? Math.max(0, Number(p.remain)) : Math.max(0, t.currentTroops - (Number(p.casualties) || 0));
        }
        break;
      }
      case 'UNIT_ELIMINATED': {
        const t = byId.get(p.instanceId);
        if (t) t.currentTroops = 0;
        break;
      }
      case 'BATTLE_END':
        winnerSide = p.winnerSide ?? winnerSide;
        rounds = p.rounds ?? rounds;
        break;
      default:
        break;
    }
  }
  return { byId, winnerSide, rounds };
}

export default { parseInstanceId, buildInitialTroops, foldEvents };
