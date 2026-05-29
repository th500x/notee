/**
 * 战略大地图道路格叠站：同一 `road_jun_id` + `road_position` 上多人时，悬停主头像右侧展示其余玩家小头像（31-6 §9.2）。
 */

/** 含焦点玩家在内最多展示的头像数；第 11 个位置用省略号 */
export const STRATEGIC_STACK_MAX_FACES = 10;

/**
 * @param {string|null|undefined} junId
 * @param {unknown} rx
 * @param {unknown} ry
 * @returns {string|null}
 */
export function roadCellStackKey(junId, rx, ry) {
  const j = String(junId || '').trim();
  const x = Math.trunc(Number(rx));
  const y = Math.trunc(Number(ry));
  if (!j || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return `${j}:${x},${y}`;
}

/**
 * @param {object} p
 * @param {string} p.countyJunId - 当前郡
 * @param {string|null|undefined} p.focalPlayerId
 * @param {string|null|undefined} p.focalJunId - 已弃用叠站键来源；**叠站键一律用 `countyJunId`**（与当前郡视图、`road-presence` 的 `junId` 一致）。
 * @param {unknown} p.focalRx
 * @param {unknown} p.focalRy
 * @param {string|null|undefined} p.selfPlayerId
 * @param {string|null|undefined} p.selfJunId
 * @param {unknown} p.selfRx
 * @param {unknown} p.selfRy
 * @param {string|null|undefined} [p.selfPortraitUrl]
 * @param {string|null|undefined} [p.selfCharacterName]
 * @param {string|null|undefined} [p.selfDisplayName] - 本人悬停条 `title`（如 `[势力]角色名`）
 * @param {Array<{ playerId: string, roadJunId?: string|null, roadPositionX?: number, roadPositionY?: number, avatar?: string|null, characterName?: string|null, factionName?: string|null }>} p.othersRows - `road-presence` 的 others（不含本人）；叠站键以 **`countyJunId`** 为准
 * @returns {{ stripPeers: { playerId: string, portraitUrl: string|null, centerGlyph: string, stackTitle: string }[], showEllipsis: boolean, stackTotal: number }}
 */
export function buildStrategicRoadStackStripForFocal({
  countyJunId,
  focalPlayerId,
  focalJunId,
  focalRx,
  focalRy,
  selfPlayerId,
  selfJunId,
  selfRx,
  selfRy,
  selfPortraitUrl = null,
  selfCharacterName = null,
  selfDisplayName = null,
  othersRows,
}) {
  const county = String(countyJunId || '').trim();
  /** 同郡视图内叠站：键须与 `road-presence` 的 `junId` 一致（`StrategicWorldMapSection` 传玩家当前 `road_jun_id` 对应郡 `countyJunId`）。 */
  const focalKey = roadCellStackKey(county, focalRx, focalRy);
  if (!focalKey || !county || !focalPlayerId) {
    return { stripPeers: [], showEllipsis: false, stackTotal: 0 };
  }

  const byId = new Map();

  const pushMember = (playerId, avatar, characterName, stackTitle) => {
    const id = String(playerId || '').trim();
    if (!id) return;
    const charName = String(characterName || '').trim() || '…';
    const seq = Array.from(charName);
    const centerGlyph = seq.length ? seq[seq.length - 1] : '…';
    const title = String(stackTitle || '').trim() || charName;
    byId.set(id, {
      playerId: id,
      portraitUrl: avatar != null && typeof avatar === 'string' ? avatar : null,
      centerGlyph,
      stackTitle: title,
    });
  };

  const selfKey = roadCellStackKey(county, selfRx, selfRy);
  if (selfPlayerId && selfKey === focalKey) {
    pushMember(selfPlayerId, selfPortraitUrl, selfCharacterName, selfDisplayName);
  }

  for (const o of othersRows || []) {
    const ok = roadCellStackKey(county, o.roadPositionX, o.roadPositionY);
    if (ok !== focalKey) continue;
    const fn = String(o.factionName || '').trim();
    const cn = String(o.characterName || '').trim() || '…';
    const stackTitle = fn ? `[${fn}]${cn}` : cn;
    pushMember(o.playerId, o.avatar, o.characterName, stackTitle);
  }

  const all = [...byId.values()].sort((a, b) => a.playerId.localeCompare(b.playerId));
  const stackTotal = all.length;
  if (stackTotal <= 1) {
    return { stripPeers: [], showEllipsis: false, stackTotal };
  }

  const focalId = String(focalPlayerId).trim();
  const peers = all.filter((m) => m.playerId !== focalId);

  if (stackTotal <= STRATEGIC_STACK_MAX_FACES) {
    return { stripPeers: peers, showEllipsis: false, stackTotal };
  }
  return {
    stripPeers: peers.slice(0, STRATEGIC_STACK_MAX_FACES - 1),
    showEllipsis: true,
    stackTotal,
  };
}
