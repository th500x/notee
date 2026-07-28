/**
 * 章节战棋 · 站位模式 → 相对部署矩形（须与 chapterDeployPatterns.js 同步）
 */

function resolveChapterDeployRects(pattern, mapW, mapH) {
  const w = Math.max(4, Math.floor(Number(mapW) || 0));
  const h = Math.max(4, Math.floor(Number(mapH) || 0));
  const p = String(pattern || 'player_south_enemy_north').trim();

  if (p === 'player_west_enemy_east') {
    const pw = Math.max(2, Math.floor(w * 0.28));
    const ew = Math.max(2, Math.floor(w * 0.28));
    const bandH = Math.max(3, Math.floor(h * 0.7));
    const rowMin = Math.floor((h - bandH) / 2);
    const rowMax = rowMin + bandH - 1;
    return {
      player: makeRect(0, pw - 1, rowMin, rowMax),
      enemy: makeRect(w - ew, w - 1, rowMin, rowMax),
      ally: makeRect(pw, Math.min(pw + 1, w - ew - 1), rowMin, Math.min(rowMin + 2, rowMax)),
    };
  }

  if (p === 'ambush_player_edge') {
    const pw = Math.max(2, Math.floor(w * 0.35));
    const ph = Math.max(2, Math.floor(h * 0.28));
    const ew = Math.max(3, Math.floor(w * 0.45));
    const eh = Math.max(3, Math.floor(h * 0.4));
    const eColMin = Math.floor((w - ew) / 2);
    const eRowMin = Math.floor(h * 0.2);
    return {
      player: makeRect(0, pw - 1, h - ph, h - 1),
      enemy: makeRect(eColMin, eColMin + ew - 1, eRowMin, eRowMin + eh - 1),
    };
  }

  const bandH = Math.max(2, Math.floor(h * 0.22));
  const sidePad = Math.max(0, Math.floor(w * 0.08));
  return {
    player: makeRect(sidePad, w - 1 - sidePad, h - bandH, h - 1),
    enemy: makeRect(sidePad, w - 1 - sidePad, 0, bandH - 1),
    ally: makeRect(sidePad, Math.min(sidePad + 3, w - 1), h - bandH - 2, h - bandH - 1),
  };
}

function makeRect(colMin, colMax, rowMin, rowMax) {
  const c0 = Math.min(colMin, colMax);
  const c1 = Math.max(colMin, colMax);
  const r0 = Math.min(rowMin, rowMax);
  const r1 = Math.max(rowMin, rowMax);
  return {
    colMin: c0,
    colMax: c1,
    rowMin: r0,
    rowMax: r1,
    cols: c1 - c0 + 1,
    rows: r1 - r0 + 1,
  };
}

module.exports = { resolveChapterDeployRects };
