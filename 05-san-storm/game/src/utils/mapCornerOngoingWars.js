/**
 * 大地图左上导航 · 进行中战事条目（17-3 · 32-4）
 * 排序：PVP 攻 > PVP 守 > PVE；同类按 createdAt 升序。
 */

const PVP_WAR_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string|null|undefined} targetCityName
 * @param {string|null|undefined} targetCityId
 */
export function formatMapCornerWarLabel(targetCityName, targetCityId) {
  let name = String(targetCityName || targetCityId || '未知').trim();
  name = name.replace(/攻城战$/u, '').trim();
  if (!name) name = String(targetCityId || '未知').trim();
  return `${name}之战`;
}

/**
 * @param {string|Date|null|undefined} endTime
 * @returns {number|null} 剩余分钟（向上取整）；无 endTime 返回 null
 */
export function getWarRemainingMinutes(endTime) {
  if (!endTime) return null;
  const ms = new Date(endTime).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return 0;
  return Math.ceil(ms / 60000);
}

/**
 * @param {number|null|undefined} totalMinutes
 * @returns {string|null}
 */
export function formatWarRemainingHoursMinutes(totalMinutes) {
  if (totalMinutes == null) return null;
  const m = Math.max(0, Math.ceil(Number(totalMinutes) || 0));
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return `${hours}小时${mins}分钟`;
}

/**
 * @param {{ kind: 'pvp'|'pve', status?: string, endTime?: string|null, startTime?: string|null, createdAt?: string|null }} entry
 */
export function resolveWarEndTimeForDisplay(entry) {
  if (entry.endTime) return entry.endTime;
  if (entry.kind === 'pvp' && entry.status === 'pending') return null;
  if (entry.kind === 'pvp' && entry.startTime) {
    const t = new Date(entry.startTime).getTime();
    if (Number.isFinite(t)) return new Date(t + PVP_WAR_DURATION_MS).toISOString();
  }
  if (entry.kind === 'pve' && entry.startTime) {
    const t = new Date(entry.startTime).getTime();
    if (Number.isFinite(t)) return new Date(t + PVP_WAR_DURATION_MS).toISOString();
  }
  if (entry.createdAt) {
    const t = new Date(entry.createdAt).getTime();
    if (Number.isFinite(t)) return new Date(t + PVP_WAR_DURATION_MS).toISOString();
  }
  return null;
}

/**
 * @param {object} entry
 * @returns {string}
 */
export function buildMapCornerWarTooltip(entry) {
  const mins = getWarRemainingMinutes(resolveWarEndTimeForDisplay(entry));
  const timeLine =
    mins == null
      ? entry.kind === 'pvp' && entry.status === 'pending'
        ? '剩余：待攻方落营'
        : '剩余：—'
      : mins <= 0
        ? '剩余：已到期（待结算）'
        : `剩余：${formatWarRemainingHoursMinutes(mins)}`;

  if (entry.kind === 'pve') {
    return [`中立城攻城（PVE）`, `参与势力：${entry.attackerFactionName || '—'}`, timeLine].join('\n');
  }

  const moraleLine =
    entry.hasWarMoraleInit &&
    entry.attackerWarMorale != null &&
    entry.defenderWarMorale != null
      ? `战事士气：${entry.attackerWarMorale}/${entry.defenderWarMorale}`
      : null;

  if (entry.isOffensive) {
    return [
      '我方进攻（PVP）',
      `攻方：${entry.attackerFactionName || '—'}`,
      `守方：${entry.defenderFactionName || '—'}`,
      ...(moraleLine ? [moraleLine] : []),
      timeLine,
    ].join('\n');
  }

  return [
    '我方防守（PVP）',
    `攻方：${entry.attackerFactionName || '—'}`,
    `守方：${entry.defenderFactionName || '—'}`,
    ...(moraleLine ? [moraleLine] : []),
    timeLine,
  ].join('\n');
}

/**
 * @param {object|null|undefined} sideStats
 */
export function warEntryHasMoraleInit(sideStats) {
  const init = sideStats && typeof sideStats === 'object' ? sideStats.warMoraleInit : null;
  return !!(init && typeof init === 'object' && init.formulaVersion != null);
}

/**
 * @param {{ pvpWars?: object[], pveWars?: object[], playerFactionId?: string|null }} opts
 * @returns {Array<object>}
 */
export function buildMapCornerOngoingWarEntries({ pvpWars = [], pveWars = [], playerFactionId }) {
  const fid = String(playerFactionId || '').trim();
  const entries = [];

  for (const w of pvpWars || []) {
    const attackerId = String(w.attackerFactionId || w.attacker_faction_id || '').trim();
    const defenderId = String(w.defenderFactionId || w.defender_faction_id || '').trim();
    if (fid && attackerId !== fid && defenderId !== fid) continue;
    const isOffensive = fid ? attackerId === fid : true;
    entries.push({
      id: `pvp:${w.pvpWarId || w.pvp_war_id}`,
      kind: 'pvp',
      isOffensive,
      status: w.status || 'active',
      targetCityId: w.targetCityId || w.target_city_id,
      targetCityName: w.targetCityName || w.target_city_name || null,
      attackerFactionName: w.attackerFactionName || w.attacker_faction_name || null,
      defenderFactionName: w.defenderFactionName || w.defender_faction_name || null,
      attackerWarMorale:
        w.attackerWarMorale != null ? Number(w.attackerWarMorale) : null,
      defenderWarMorale:
        w.defenderWarMorale != null ? Number(w.defenderWarMorale) : null,
      hasWarMoraleInit: warEntryHasMoraleInit(w.sideStats || w.side_stats),
      endTime: w.endTime || w.end_time || null,
      startTime: w.startTime || w.start_time || null,
      createdAt: w.createdAt || w.created_at || null,
      sortKey: Date.parse(w.createdAt || w.created_at || '') || 0,
    });
  }

  for (const w of pveWars || []) {
    entries.push({
      id: `pve:${w.warId || w.war_id}`,
      kind: 'pve',
      isOffensive: true,
      status: 'active',
      targetCityId: w.targetCityId || w.target_city_id,
      targetCityName: w.targetCityName || w.target_city_name || null,
      attackerFactionName: w.attackerFactionName || w.attacker_faction_name || null,
      defenderFactionName: '中立',
      endTime: w.endTime || w.end_time || null,
      startTime: w.startTime || w.start_time || w.createdAt || w.created_at || null,
      createdAt: w.createdAt || w.created_at || null,
      sortKey: Date.parse(w.createdAt || w.created_at || '') || 0,
    });
  }

  const priority = (e) => {
    if (e.kind === 'pvp' && e.isOffensive) return 0;
    if (e.kind === 'pvp' && !e.isOffensive) return 1;
    return 2;
  };

  return entries.sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return String(a.id).localeCompare(String(b.id));
  });
}
