/**
 * 章节关卡 roster 解析（须与 chapterStageRoster.cjs 同步）
 *
 * 语法对齐战役 units_spec 精神：
 *   side|char_id|troop_id:stack|morale:N|role:boss|ai:attack||…
 *
 * `troop_id:N` 与战役 `expandCampaignUnitsSpec` 同义：展开为 **N 个独立部队**，
 * 而非一个部队带 N 倍兵力。
 */

/**
 * @typedef {{
 *   faction: 'enemy'|'ally1'|'ally2',
 *   charId: string,
 *   troopId: string,
 *   morale: number,
 *   stackIndex: number,
 *   stackTotal: number,
 *   commanderRole?: string,
 *   battleAiStyle?: string,
 * }} ChapterRosterUnit
 */

/**
 * @param {string|null|undefined} raw
 * @returns {ChapterRosterUnit[]} 已按 stack 展开的逐个部队
 */
export function parseChapterStageRoster(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  const parts = text.split('||').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const bits = part.split('|').map((s) => s.trim()).filter(Boolean);
    if (bits.length < 3) continue;
    const factionRaw = bits[0];
    const faction =
      factionRaw === 'enemy' || factionRaw === 'ally1' || factionRaw === 'ally2'
        ? factionRaw
        : null;
    if (!faction) continue;
    const charId = bits[1];
    const troopBit = bits[2];
    const tm = /^([^:]+)(?::(\d+))?$/.exec(troopBit);
    if (!tm) continue;
    const troopId = tm[1];
    const stack = Math.max(1, parseInt(tm[2] || '1', 10) || 1);
    let morale = 70;
    let commanderRole;
    let battleAiStyle;
    for (let i = 3; i < bits.length; i++) {
      const b = bits[i];
      const mm = /^morale:(\d+)$/i.exec(b);
      if (mm) {
        morale = Math.max(0, Math.min(120, parseInt(mm[1], 10) || 70));
        continue;
      }
      const rm = /^role:(.+)$/i.exec(b);
      if (rm) {
        commanderRole = rm[1].trim();
        continue;
      }
      const am = /^ai:(.+)$/i.exec(b);
      if (am) {
        battleAiStyle = am[1].trim();
      }
    }
    for (let s = 0; s < stack; s++) {
      out.push({
        faction,
        charId,
        troopId,
        morale,
        stackIndex: s,
        stackTotal: stack,
        ...(commanderRole ? { commanderRole } : {}),
        ...(battleAiStyle ? { battleAiStyle } : {}),
      });
    }
  }
  return out;
}

/**
 * @param {string|null|undefined} raw
 * @returns {Record<string, number>}
 */
export function parseTerrainRatios(raw) {
  const text = String(raw || '').trim();
  const out = {};
  if (!text) return out;
  for (const seg of text.split(';')) {
    const m = /^([a-zA-Z_]+)\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(seg.trim());
    if (!m) continue;
    const key = m[1].toLowerCase();
    const n = Number(m[2]);
    if (!Number.isFinite(n) || n <= 0) continue;
    out[key] = n;
  }
  return out;
}

export default { parseChapterStageRoster, parseTerrainRatios };
