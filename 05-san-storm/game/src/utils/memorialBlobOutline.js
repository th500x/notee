/**
 * 战斗纪念图 · 闭合手绘流线框（两大块文案背景）。
 * 路径由 seed 决定，同 battleId 可复现。
 * 框体插入各 `[data-memorial-block]` 内部（inset 负边距），避免离屏/跨层坐标失真。
 */

/** @param {string|number|null|undefined} input */
export function hashMemorialSeed(input) {
  const s = String(input ?? 'memorial');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** @param {number} seed */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Array<{ x: number, y: number }>} points
 * @returns {string}
 */
function catmullRomClosedBezierPath(points) {
  const n = points.length;
  if (n < 3) return '';
  const d = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    if (i === 0) d.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`);
    d.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    );
  }
  d.push('Z');
  return d.join(' ');
}

/**
 * @param {number} left
 * @param {number} top
 * @param {number} right
 * @param {number} bottom
 * @param {number} cornerR
 */
function roundedRectPerimeterMetrics(left, top, right, bottom, cornerR) {
  const w = right - left;
  const h = bottom - top;
  const r = Math.min(cornerR, w / 2, h / 2);
  const topLen = w - 2 * r;
  const rightLen = h - 2 * r;
  const bottomLen = w - 2 * r;
  const leftLen = h - 2 * r;
  const arcLen = (Math.PI / 2) * r;
  const total = topLen + rightLen + bottomLen + leftLen + 4 * arcLen;
  return { r, topLen, rightLen, bottomLen, leftLen, arcLen, total };
}

/**
 * 沿圆角矩形周长取点（顺时针），并返回该处外法线。
 * @param {number} left
 * @param {number} top
 * @param {number} right
 * @param {number} bottom
 * @param {number} cornerR
 * @param {number} dist
 * @returns {{ x: number, y: number, nx: number, ny: number }}
 */
function pointOnRoundedRectPerimeter(left, top, right, bottom, cornerR, dist) {
  const m = roundedRectPerimeterMetrics(left, top, right, bottom, cornerR);
  let d = ((dist % m.total) + m.total) % m.total;
  const { r, topLen, rightLen, bottomLen, leftLen, arcLen } = m;

  if (d <= topLen) {
    return { x: left + r + d, y: top, nx: 0, ny: -1 };
  }
  d -= topLen;
  if (d <= arcLen) {
    const a = -Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
    const cxArc = right - r;
    const cyArc = top + r;
    return {
      x: cxArc + Math.cos(a) * r,
      y: cyArc + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arcLen;
  if (d <= rightLen) {
    return { x: right, y: top + r + d, nx: 1, ny: 0 };
  }
  d -= rightLen;
  if (d <= arcLen) {
    const a = 0 + (d / arcLen) * (Math.PI / 2);
    const cxArc = right - r;
    const cyArc = bottom - r;
    return {
      x: cxArc + Math.cos(a) * r,
      y: cyArc + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arcLen;
  if (d <= bottomLen) {
    return { x: right - r - d, y: bottom, nx: 0, ny: 1 };
  }
  d -= bottomLen;
  if (d <= arcLen) {
    const a = Math.PI / 2 + (d / arcLen) * (Math.PI / 2);
    const cxArc = left + r;
    const cyArc = bottom - r;
    return {
      x: cxArc + Math.cos(a) * r,
      y: cyArc + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arcLen;
  if (d <= leftLen) {
    return { x: left, y: bottom - r - d, nx: -1, ny: 0 };
  }
  d -= leftLen;
  const a = Math.PI + (d / arcLen) * (Math.PI / 2);
  const cxArc = left + r;
  const cyArc = top + r;
  return {
    x: cxArc + Math.cos(a) * r,
    y: cyArc + Math.sin(a) * r,
    nx: Math.cos(a),
    ny: Math.sin(a),
  };
}

/**
 * Catmull-Rom 闭合曲线在角点易内凹；沿外法线轻微外扩，保证包住矩形四角。
 * @param {Array<{ x: number, y: number }>} points
 * @param {number} width
 * @param {number} height
 * @param {number} [expand]
 */
function guardBlobCornerCoverage(points, width, height, expand = 2.8) {
  const minX = -expand;
  const minY = -expand;
  const maxX = width + expand;
  const maxY = height + expand;
  const xBand = width * 0.4;
  const yBand = height * 0.38;
  return points.map(({ x, y }) => {
    let nx = x;
    let ny = y;
    if (nx < xBand) nx = Math.min(nx, minX);
    if (nx > width - xBand) nx = Math.max(nx, maxX);
    if (ny < yBand) ny = Math.min(ny, minY);
    if (ny > height - yBand) ny = Math.max(ny, maxY);
    return { x: nx, y: ny };
  });
}

/** 注入四角锚点并按极角排序，避免样条在左上/左下内凹漏包。 */
function injectCornerAnchors(points, width, height, expand = 2.8) {
  const cx = width / 2;
  const cy = height / 2;
  const corners = [
    { x: -expand, y: -expand },
    { x: width + expand, y: -expand },
    { x: width + expand, y: height + expand },
    { x: -expand, y: height + expand },
  ];
  return [...points, ...corners].sort((a, b) => {
    const aa = Math.atan2(a.y - cy, a.x - cx);
    const bb = Math.atan2(b.y - cy, b.x - cx);
    return aa - bb;
  });
}

/**
 * 沿圆角矩形周长布点 + 仅向外扰动，避免左侧上下角被椭圆内凹漏包。
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {{ pointCount?: number, wobble?: number }} [opts]
 * @returns {Array<{ x: number, y: number }>}
 */
function generateBlobControlPoints(width, height, seed, opts = {}) {
  const rand = mulberry32(seed);
  const pointCount = opts.pointCount ?? 24;
  const wobble = opts.wobble ?? 0.11;
  const edgeInset = 1;
  const left = edgeInset;
  const top = edgeInset;
  const right = width - edgeInset;
  const bottom = height - edgeInset;
  const cornerR = Math.min(width, height) * 0.07 + 6;
  const { total } = roundedRectPerimeterMetrics(left, top, right, bottom, cornerR);
  const wobbleAmp = Math.min(width, height) * wobble;
  const points = [];

  for (let i = 0; i < pointCount; i += 1) {
    const base = pointOnRoundedRectPerimeter(
      left,
      top,
      right,
      bottom,
      cornerR,
      (i / pointCount) * total + (rand() - 0.5) * (total / pointCount) * 0.35,
    );
    const out = wobbleAmp * (0.25 + rand() * 0.85);
    const tangentX = -base.ny;
    const tangentY = base.nx;
    const tang = (rand() - 0.5) * wobbleAmp * 0.45;
    points.push({
      x: base.x + base.nx * out + tangentX * tang,
      y: base.y + base.ny * out + tangentY * tang,
    });
  }

  return injectCornerAnchors(
    guardBlobCornerCoverage(points, width, height, 2.8),
    width,
    height,
    2.8,
  );
}

/**
 * @param {Array<{ x: number, y: number }>} points
 * @param {number} seed
 * @param {number} subdivisions
 * @returns {string}
 */
function roughSketchClosedPath(points, seed, subdivisions = 4, bounds = null) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const n = points.length;
  if (n < 2) return '';
  const roughAmp = 1.4 + rand() * 0.9;
  const cx = bounds ? bounds.width / 2 : 0;
  const cy = bounds ? bounds.height / 2 : 0;
  const minExpand = bounds ? -2.5 : null;
  const maxExpand = bounds
    ? { x: bounds.width + 2.5, y: bounds.height + 2.5 }
    : null;
  const nudgeOutward = (x, y) => {
    if (!bounds) return { x, y };
    let nx = x;
    let ny = y;
    const vx = nx - cx;
    const vy = ny - cy;
    const len = Math.hypot(vx, vy) || 1;
    if (nx > minExpand && nx < maxExpand.x && ny > minExpand && ny < maxExpand.y) {
      const push = 1.6;
      nx += (vx / len) * push;
      ny += (vy / len) * push;
    }
    return { x: nx, y: ny };
  };
  const samples = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    samples.push({ x: p0.x, y: p0.y });
    for (let s = 1; s < subdivisions; s += 1) {
      const t = s / subdivisions;
      const bx = p0.x + (p1.x - p0.x) * t;
      const by = p0.y + (p1.y - p0.y) * t;
      const vx = bx - cx;
      const vy = by - cy;
      const vlen = Math.hypot(vx, vy) || 1;
      const ox = (vx / vlen) * roughAmp * rand();
      const oy = (vy / vlen) * roughAmp * rand();
      const tx = (-vy / vlen) * (rand() - 0.5) * roughAmp * 0.6;
      const ty = (vx / vlen) * (rand() - 0.5) * roughAmp * 0.6;
      const nudged = nudgeOutward(bx + ox + tx, by + oy + ty);
      samples.push({ x: nudged.x, y: nudged.y });
    }
  }
  const parts = [`M ${samples[0].x.toFixed(2)} ${samples[0].y.toFixed(2)}`];
  for (let i = 1; i < samples.length; i += 1) {
    parts.push(`L ${samples[i].x.toFixed(2)} ${samples[i].y.toFixed(2)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @returns {{ fillPath: string, sketchPath: string, accentPath: string }}
 */
export function generateMemorialBlobPaths(width, height, seed) {
  const w = Math.max(48, width);
  const h = Math.max(48, height);
  const smoothPoints = generateBlobControlPoints(w, h, seed, { pointCount: 24, wobble: 0.12 });
  const fillPath = catmullRomClosedBezierPath(smoothPoints);
  const bounds = { width: w, height: h };
  const sketchPath = roughSketchClosedPath(smoothPoints, seed + 17, 5, bounds);
  const accentPoints = smoothPoints.map((p, i) => {
    const rand = mulberry32(seed + i * 101);
    const cx = w / 2;
    const cy = h / 2;
    const vx = p.x - cx;
    const vy = p.y - cy;
    const len = Math.hypot(vx, vy) || 1;
    const jitter = (rand() - 0.3) * 1.8;
    return {
      x: p.x + (vx / len) * jitter + (rand() - 0.5) * 1.2,
      y: p.y + (vy / len) * jitter + (rand() - 0.5) * 1.2,
    };
  });
  const accentPath = roughSketchClosedPath(accentPoints, seed + 33, 3, bounds);
  return { fillPath, sketchPath, accentPath };
}

/**
 * @param {{ width: number, height: number, seed: number }} p
 * @returns {string}
 */
export function buildMemorialBlobSvgMarkup({ width, height, seed }) {
  const { fillPath, sketchPath, accentPath } = generateMemorialBlobPaths(width, height, seed);
  return `
    <svg xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 ${width} ${height}"
      width="100%" height="100%"
      preserveAspectRatio="none"
      aria-hidden="true"
      style="display:block;overflow:visible;">
      <path d="${fillPath}" fill="rgba(72,68,64,0.42)" stroke="none"/>
      <path d="${sketchPath}" fill="none" stroke="rgba(212,175,55,0.38)" stroke-width="2.2"
        stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${accentPath}" fill="none" stroke="rgba(255,248,220,0.22)" stroke-width="1.1"
        stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>
    </svg>`;
}

const DEFAULT_PAD = { top: 16, right: 16, bottom: 16, left: 22 };

/** @param {number | { top?: number, right?: number, bottom?: number, left?: number }} pad */
function normalizeMemorialPad(pad) {
  if (typeof pad === 'number' && Number.isFinite(pad)) {
    return { top: pad, right: pad, bottom: pad, left: pad };
  }
  const base = DEFAULT_PAD;
  const p = pad && typeof pad === 'object' ? pad : {};
  return {
    top: p.top ?? base.top,
    right: p.right ?? base.right,
    bottom: p.bottom ?? base.bottom,
    left: p.left ?? base.left,
  };
}

/**
 * 在文字块内部插入手绘 blob 底（作为首子节点，z-index 低于正文）。
 * @param {HTMLElement} blockEl `[data-memorial-block]`
 * @param {number} seed
 * @param {number | { top?: number, right?: number, bottom?: number, left?: number }} [pad]
 */
export function attachMemorialBlobOutlineToBlock(blockEl, seed, pad = DEFAULT_PAD) {
  if (!blockEl || blockEl.querySelector('[data-memorial-blob-inset]')) return;

  const { top, right, bottom, left } = normalizeMemorialPad(pad);
  const innerW = Math.max(48, blockEl.offsetWidth);
  const innerH = Math.max(48, blockEl.offsetHeight);
  const w = innerW + left + right;
  const h = innerH + top + bottom;

  const wrap = document.createElement('div');
  wrap.setAttribute('data-memorial-blob-inset', '');
  wrap.style.cssText = [
    'position:absolute',
    `left:${-left}px`,
    `top:${-top}px`,
    `width:${w}px`,
    `height:${h}px`,
    'z-index:0',
    'pointer-events:none',
    'overflow:visible',
  ].join(';');

  wrap.innerHTML = buildMemorialBlobSvgMarkup({ width: w, height: h, seed });
  blockEl.insertBefore(wrap, blockEl.firstChild);
}

/**
 * 为多个文字块插入 blob（需已完成 layout）。
 * @param {HTMLElement} _container 保留参数以兼容调用方
 * @param {Array<{ element: HTMLElement, seed: number, pad?: number }>} blocks
 */
export function attachMemorialBlobOutlines(_container, blocks) {
  for (const { element, seed, pad } of blocks) {
    attachMemorialBlobOutlineToBlock(element, seed, pad);
  }
}
