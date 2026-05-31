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
 * @param {number} width
 * @param {number} height
 * @param {number} seed
 * @param {{ pointCount?: number, wobble?: number }} [opts]
 * @returns {Array<{ x: number, y: number }>}
 */
function generateBlobControlPoints(width, height, seed, opts = {}) {
  const rand = mulberry32(seed);
  const pointCount = opts.pointCount ?? 16;
  const wobble = opts.wobble ?? 0.14;
  const cx = width / 2;
  const cy = height / 2;
  const rxBase = width / 2;
  const ryBase = height / 2;
  const points = [];
  for (let i = 0; i < pointCount; i += 1) {
    const angle = (i / pointCount) * Math.PI * 2 - Math.PI / 2;
    const angleJitter = (rand() - 0.5) * wobble * 1.4;
    const a = angle + angleJitter;
    const rScale = 0.9 + rand() * 0.14;
    const rx = rxBase * rScale * (0.96 + rand() * 0.08);
    const ry = ryBase * rScale * (0.94 + rand() * 0.1);
    points.push({
      x: cx + Math.cos(a) * rx,
      y: cy + Math.sin(a) * ry,
    });
  }
  return points;
}

/**
 * @param {Array<{ x: number, y: number }>} points
 * @param {number} seed
 * @param {number} subdivisions
 * @returns {string}
 */
function roughSketchClosedPath(points, seed, subdivisions = 4) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const n = points.length;
  if (n < 2) return '';
  const roughAmp = 1.8 + rand() * 1.2;
  const samples = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    samples.push({ x: p0.x, y: p0.y });
    for (let s = 1; s < subdivisions; s += 1) {
      const t = s / subdivisions;
      samples.push({
        x: p0.x + (p1.x - p0.x) * t + (rand() - 0.5) * roughAmp,
        y: p0.y + (p1.y - p0.y) * t + (rand() - 0.5) * roughAmp,
      });
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
  const smoothPoints = generateBlobControlPoints(w, h, seed, { pointCount: 16, wobble: 0.16 });
  const fillPath = catmullRomClosedBezierPath(smoothPoints);
  const sketchPath = roughSketchClosedPath(smoothPoints, seed + 17, 5);
  const accentPoints = smoothPoints.map((p, i) => {
    const rand = mulberry32(seed + i * 101);
    return {
      x: p.x + (rand() - 0.5) * 2.2,
      y: p.y + (rand() - 0.5) * 2.2,
    };
  });
  const accentPath = roughSketchClosedPath(accentPoints, seed + 33, 3);
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

const DEFAULT_PAD = 16;

/**
 * 在文字块内部插入手绘 blob 底（作为首子节点，z-index 低于正文）。
 * @param {HTMLElement} blockEl `[data-memorial-block]`
 * @param {number} seed
 * @param {number} [pad]
 */
export function attachMemorialBlobOutlineToBlock(blockEl, seed, pad = DEFAULT_PAD) {
  if (!blockEl || blockEl.querySelector('[data-memorial-blob-inset]')) return;

  const innerW = Math.max(48, blockEl.offsetWidth);
  const innerH = Math.max(48, blockEl.offsetHeight);
  const w = innerW + pad * 2;
  const h = innerH + pad * 2;

  const wrap = document.createElement('div');
  wrap.setAttribute('data-memorial-blob-inset', '');
  wrap.style.cssText = [
    'position:absolute',
    `left:${-pad}px`,
    `top:${-pad}px`,
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
