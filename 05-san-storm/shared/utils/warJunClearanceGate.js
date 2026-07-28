/**
 * 战事发动 · 郡内清剿门闸（17-3）
 *
 * - 大城：须先占领本郡「相应势力」其余所有城
 * - 中城：须先占领本郡「相应势力」大城以外的其余城
 * - 小城等：无额外限制
 *
 * 「相应势力」：目标有归属 → 同 faction_id；目标中立 → 同郡仍中立的城。
 * 须与 `.cjs` 同步。
 */

/**
 * @param {object|null|undefined} row
 * @returns {string|null}
 */
function cityTypeOf(row) {
  if (!row || typeof row !== 'object') return null;
  const t = row.city_type ?? row.cityType ?? null;
  return t != null && String(t).trim() !== '' ? String(t).trim() : null;
}

/**
 * @param {object|null|undefined} row
 * @returns {string|null}
 */
function factionIdOf(row) {
  if (!row || typeof row !== 'object') return null;
  const f = row.faction_id ?? row.factionId ?? null;
  if (f == null || String(f).trim() === '') return null;
  return String(f).trim();
}

/**
 * @param {object|null|undefined} row
 * @returns {string|null}
 */
function junIdOf(row) {
  if (!row || typeof row !== 'object') return null;
  const j = row.jun_id ?? row.junId ?? null;
  if (j == null || String(j).trim() === '') return null;
  return String(j).trim();
}

/**
 * 目标城是否仍被「相应侧」占着（中立=无归属；已占=同防守势力）。
 * @param {object} cityRow
 * @param {string|null} defenderFactionId
 */
function stillHeldByDefenderSide(cityRow, defenderFactionId) {
  const cf = factionIdOf(cityRow);
  if (defenderFactionId == null) return cf == null;
  return cf != null && cf === defenderFactionId;
}

/**
 * @param {string} targetCityId
 * @param {Record<string, object>} cityById
 * @param {string|null|undefined} _attackerFactionId 预留（占领后城归属已变，以防守侧残留判定）
 * @returns {{ ok: boolean, reason?: string, blockingCityIds?: string[] }}
 */
export function evaluateWarJunClearance(targetCityId, cityById, _attackerFactionId = null) {
  const tid = String(targetCityId || '').trim();
  const byId = cityById && typeof cityById === 'object' ? cityById : {};
  const target = byId[tid];
  if (!tid || !target) {
    return { ok: false, reason: '目标城数据缺失', blockingCityIds: [] };
  }

  const ct = cityTypeOf(target);
  if (ct !== 'city_major' && ct !== 'city_medium') {
    return { ok: true };
  }

  const junId = junIdOf(target);
  if (!junId) {
    return { ok: false, reason: '目标城缺少郡信息', blockingCityIds: [] };
  }

  const defenderFactionId = factionIdOf(target);
  const blocking = [];

  for (const [id, row] of Object.entries(byId)) {
    const cid = String(id || '').trim();
    if (!cid || cid === tid) continue;
    if (junIdOf(row) !== junId) continue;
    if (!stillHeldByDefenderSide(row, defenderFactionId)) continue;
    const oct = cityTypeOf(row);
    if (ct === 'city_medium' && oct === 'city_major') continue;
    blocking.push(cid);
  }

  if (!blocking.length) return { ok: true };

  if (ct === 'city_major') {
    return {
      ok: false,
      reason: '须先占领本郡该势力其余所有城市，方可对该大城开战',
      blockingCityIds: blocking,
    };
  }
  return {
    ok: false,
    reason: '须先占领本郡该势力大城以外的其余城市，方可对该中城开战',
    blockingCityIds: blocking,
  };
}

/**
 * @param {string} targetCityId
 * @param {Record<string, object>} cityById
 * @param {string|null|undefined} attackerFactionId
 */
export function warTargetPassesJunClearance(targetCityId, cityById, attackerFactionId = null) {
  return evaluateWarJunClearance(targetCityId, cityById, attackerFactionId).ok;
}

/**
 * @param {string[]} cityIds
 * @param {Record<string, object>} cityById
 * @param {string|null|undefined} attackerFactionId
 * @returns {string[]}
 */
export function filterCityIdsByWarJunClearance(cityIds, cityById, attackerFactionId = null) {
  if (!Array.isArray(cityIds) || !cityIds.length) return [];
  return cityIds.filter((id) => warTargetPassesJunClearance(id, cityById, attackerFactionId));
}
