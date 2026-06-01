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
 * 按极角排序，供 Catmull-Rom 闭合路径使用。
 * @param {Array<{ x: number, y: number }>} points
 * @param {number} cx
 * @param {number} cy
 */
function sortPointsByAngle(points, cx, cy) {
  return [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
}

/**
 * 整体径向外扩，保持有机轮廓，减轻样条段内凹。
 * @param {Array<{ x: number, y: number }>} points
 * @param {number} cx
 * @param {number} cy
 * @param {number} factor
 */
function expandPointsRadially(points, cx, cy, factor) {
  return points.map(({ x, y }) => {
    const dx = x - cx;
    const dy = y - cy;
    return { x: cx + dx * factor, y: cy + dy * factor };
  });
}

/**
 * 在左侧弧线（左上 / 正左 / 左下）补 3 个有机控制点，防止样条在左角内凹漏包。
 * 不注入矩形角点，避免整框变方块。
 * @param {Array<{ x: number, y: number }>} points
 * @param {number} cx
 * @param {number} cy
 * @param {number} rxBase
 * @param {number} ryBase
 * @param {number} seed
 */
function insertLeftFlankBulges(points, cx, cy, rxBase, ryBase, seed) {
  const rand = mulberry32(seed ^ 0x51f15e1d);
  const extras = [];
  const flankAngles = [
    Math.PI * 0.58 + (rand() - 0.5) * 0.14,
    Math.PI * 0.86 + (rand() - 0.5) * 0.1,
    Math.PI * 1.14 + (rand() - 0.5) * 0.14,
  ];
  for (let i = 0; i < flankAngles.length; i += 1) {
    const a = flankAngles[i];
    const rScale = 0.98 + rand() * 0.07;
    const rx = rxBase * rScale * (0.97 + rand() * 0.08);
    let ry = ryBase * rScale * (0.95 + rand() * 0.1);
    if (i === 0 || i === 2) ry *= 1.12 + rand() * 0.04;
    extras.push({
      x: cx + Math.cos(a) * rx,
      y: cy + Math.sin(a) * ry,
    });
  }
  return sortPointsByAngle([...points, ...extras], cx, cy);
}

/**
 * 椭圆周长布点 + 随机扰动（手绘流线主体）。
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {{ pointCount?: number, wobble?: number }} [opts]
 * @returns {Array<{ x: number, y: number }>}
 */
function generateBlobControlPoints(width, height, seed, opts = {}) {
  const rand = mulberry32(seed);
  const pointCount = opts.pointCount ?? 18;
  const wobble = opts.wobble ?? 0.14;
  const cx = width / 2;
  const cy = height / 2;
  const rxBase = width / 2;
  const ryBase = height / 2;
  const points = [];

  for (let i = 0; i < pointCount; i += 1) {
    const angle = (i / pointCount) * Math.PI * 2 - Math.PI / 2;
    const angleJitter = (rand() - 0.5) * wobble * 1.2;
    const a = angle + angleJitter;
    const rScale = 0.94 + rand() * 0.1;
    const rx = rxBase * rScale * (0.96 + rand() * 0.08);
    const ry = ryBase * rScale * (0.94 + rand() * 0.1);
    points.push({
      x: cx + Math.cos(a) * rx,
      y: cy + Math.sin(a) * ry,
    });
  }

  const withFlank = insertLeftFlankBulges(points, cx, cy, rxBase, ryBase, seed);
  return expandPointsRadially(withFlank, cx, cy, 1.035);
}

/**
 * @param {Array<{ x: number, y: number }>} points
 * @param {number} seed
 * @param {number} subdivisions
 * @param {{ width: number, height: number } | null} [bounds]
 * @returns {string}
 */
function roughSketchClosedPath(points, seed, subdivisions = 4, bounds = null) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const n = points.length;
  if (n < 2) return '';
  const roughAmp = 1.8 + rand() * 1.2;
  const cx = bounds ? bounds.width / 2 : 0;
  const cy = bounds ? bounds.height / 2 : 0;
  const samples = [];

  for (let i = 0; i < n; i += 1) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    samples.push({ x: p0.x, y: p0.y });
    for (let s = 1; s < subdivisions; s += 1) {
      const t = s / subdivisions;
      let x = p0.x + (p1.x - p0.x) * t + (rand() - 0.5) * roughAmp;
      let y = p0.y + (p1.y - p0.y) * t + (rand() - 0.5) * roughAmp;
      if (bounds) {
        const vx = x - cx;
        const vy = y - cy;
        const len = Math.hypot(vx, vy) || 1;
        const innerX0 = bounds.width * 0.08;
        const innerY0 = bounds.height * 0.08;
        const innerX1 = bounds.width * 0.92;
        const innerY1 = bounds.height * 0.92;
        if (x > innerX0 && x < innerX1 && y > innerY0 && y < innerY1) {
          x += (vx / len) * 1.2;
          y += (vy / len) * 1.2;
        }
      }
      samples.push({ x, y });
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
  const smoothPoints = generateBlobControlPoints(w, h, seed, { pointCount: 18, wobble: 0.15 });
  const fillPath = catmullRomClosedBezierPath(smoothPoints);
  const bounds = { width: w, height: h };
  const sketchPath = roughSketchClosedPath(smoothPoints, seed + 17, 5, bounds);
  const accentPoints = smoothPoints.map((p, i) => {
    const rand = mulberry32(seed + i * 101);
    return {
      x: p.x + (rand() - 0.5) * 2.2,
      y: p.y + (rand() - 0.5) * 2.2,
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

const DEFAULT_PAD = { top: 16, right: 16, bottom: 16, left: 20 };

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
