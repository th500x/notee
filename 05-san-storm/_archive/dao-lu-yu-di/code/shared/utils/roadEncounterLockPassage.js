/**
 * 道路交战格锁：第三者可将交战格视为「路径中透明」过境，但不可作为本次道路段终点落脚（与 `moveAlongRoad`、行军 UI 一致）。
 * 供 `game` 与 `backend` 共用，避免前后端口径分叉。
 */

/**
 * @param {Array<Record<string, unknown>>|null|undefined} lockedList - `road-presence.lockedCells` 或 SQL 行（蛇形/驼峰混用）
 * @param {number} gx
 * @param {number} gy
 * @returns {{ encounterId?: string, attackerPlayerId?: string|null, defenderPlayerId?: string|null, status: string } | null}
 */
export function findActiveRoadEncounterLockOnCell(lockedList, gx, gy) {
  const x = Math.trunc(Number(gx));
  const y = Math.trunc(Number(gy));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Array.isArray(lockedList)) return null;
  for (const row of lockedList) {
    if (!row || typeof row !== 'object') continue;
    const rx = Math.trunc(Number(row.positionX ?? row.position_x));
    const ry = Math.trunc(Number(row.positionY ?? row.position_y));
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx !== x || ry !== y) continue;
    const st = String(row.status || '').toLowerCase();
    if (st !== 'pending' && st !== 'fighting') continue;
    const encounterId = row.encounterId != null ? String(row.encounterId) : row.encounter_id != null ? String(row.encounter_id) : '';
    const attackerPlayerId = row.attackerPlayerId ?? row.attacker_player_id ?? null;
    const defenderPlayerId = row.defenderPlayerId ?? row.defender_player_id ?? null;
    return { encounterId: encounterId || undefined, attackerPlayerId, defenderPlayerId, status: st };
  }
  return null;
}

/**
 * @param {{ attackerPlayerId?: string|null, defenderPlayerId?: string|null }|null|undefined} lockMeta
 * @param {string|null|undefined} playerId
 */
export function isPlayerRoadEncounterParticipant(lockMeta, playerId) {
  if (!lockMeta) return false;
  const pid = String(playerId || '').trim();
  if (!pid) return false;
  const att = lockMeta.attackerPlayerId != null ? String(lockMeta.attackerPlayerId).trim() : '';
  const def = lockMeta.defenderPlayerId != null ? String(lockMeta.defenderPlayerId).trim() : '';
  return (att && pid === att) || (def && pid === def);
}

/**
 * 非参与方：是否禁止落在交战格（仅「道路段」最后一步；`moveAlongRoad` 的 `steps` 下标语义）。
 * @param {number} stepIndex - 当前在 `steps` 中的 0-based 下标
 * @param {number} roadStepsLength - `steps.length`
 */
export function isNonParticipantFinalRoadStepOntoEncounter(stepIndex, roadStepsLength) {
  const n = roadStepsLength;
  const i = stepIndex;
  return Number.isFinite(i) && Number.isFinite(n) && n > 0 && i === n - 1;
}
