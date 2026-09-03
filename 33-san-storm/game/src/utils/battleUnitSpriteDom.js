/**
 * 战斗格 DOM 侧视序列帧控制器（阶段 D）
 * 与 React `BattleUnitSpritePlayer` 共用 assets 路径约定；供 useBattleAnimations / TroopLayer 回退链使用。
 *
 * 布局要点（勿再只改 CSS width%）：
 * 导入画布脚底居中，角色实体常仅占画布约 25%～35% 高。若把整张画布拉到 200%～300% 格高，
 * 放大的主要是上方透明区，实体看起来几乎不变，且易错位到上一格。
 * 正确做法：img 先按「一格大小 + object-position:bottom」放下，再用 transform-origin:bottom 做 scale。
 *
 * @see docs/00/90-assets/99-2-BATTLE_UNIT_SPRITE_PIPELINE.md
 */

import { bindTroopPortraitImg } from '@/utils/troopBattlePortrait';
import { battleUnitAssetBase } from '@/components/battle/BattleUnitSpritePlayer';
import { resolveBattleUnitKey as resolveBattleUnitKeyFromDefaults } from '@shared/utils/battleUnitKeyResolve.js';

/** @type {Map<string, object>} */
const manifestCache = new Map();

/**
 * 缺省「实体高 / 画布高」（manifest 无 contentHeightRatio 时）。
 * 各单位实测约 0.23～0.56，偏大素材若仍按 0.30 估算会撑满格子；优先读 manifest。
 */
const CONTENT_HEIGHT_RATIO = 0.30;
/** 希望实体约占格子高度的比例（留给顶血条、底名条） */
const TARGET_TILE_FILL = 0.58;
/** 播帧加速（>1 更快）；manifest fps × 此系数 */
const SPRITE_PLAYBACK_SPEED = 2;

/**
 * @param {unknown} raw
 * @returns {number}
 */
function resolveContentHeightRatio(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return CONTENT_HEIGHT_RATIO;
  return Math.min(0.75, Math.max(0.15, n));
}

/**
 * 特写 battleUnitKey → 稀有度×兵种默认表 → null（再回退静态立绘）
 * @param {object} troop
 * @returns {string|null}
 */
export function resolveBattleUnitKey(troop) {
  return resolveBattleUnitKeyFromDefaults(troop);
}

/**
 * @param {string} unitKey
 * @param {string} [baseUrl]
 */
async function loadManifest(unitKey, baseUrl) {
  if (manifestCache.has(unitKey)) return manifestCache.get(unitKey);
  const url = `${battleUnitAssetBase(unitKey, baseUrl)}manifest.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const data = await res.json();
  manifestCache.set(unitKey, data);
  return data;
}

/**
 * 战场格序列帧布局：脚底对齐当前格，按实体占比放大（行内样式，不依赖易被缓存的 width%）。
 * 用 manifest.contentHeightRatio 把不同体型统一到 TARGET_TILE_FILL，避免高级兵撑格、小兵偏小。
 * @param {HTMLImageElement} img
 * @param {boolean} [flipX]
 */
export function layoutBattleUnitSpriteImg(img, flipX = false) {
  if (!img || !img.classList.contains('troop-img--unit-sprite')) return;

  const tileEl = img.closest('.tile');
  let tilePx = 0;
  if (tileEl) {
    tilePx = tileEl.clientWidth || tileEl.getBoundingClientRect().width || 0;
  }
  if (!(tilePx > 0)) tilePx = 64;

  const contentRatio = resolveContentHeightRatio(img._battleSpriteContentHeightRatio);
  const scale = TARGET_TILE_FILL / contentRatio;

  img.style.position = 'absolute';
  img.style.left = '50%';
  img.style.right = 'auto';
  img.style.top = 'auto';
  // 脚底贴近名条上方，站在格底而非格心；缩放原点在脚底，只往上长
  img.style.bottom = '6%';
  img.style.width = `${Math.round(tilePx)}px`;
  img.style.height = `${Math.round(tilePx)}px`;
  img.style.maxWidth = 'none';
  img.style.margin = '0';
  img.style.objectFit = 'contain';
  img.style.objectPosition = 'center bottom';
  img.style.transformOrigin = 'center bottom';
  img.style.imageRendering = 'pixelated';
  const sx = flipX ? -scale : scale;
  img.style.transform = `translateX(-50%) scale(${sx.toFixed(3)}, ${scale.toFixed(3)})`;
}

function clearBattleUnitSpriteLayout(img) {
  if (!img) return;
  img._battleSpriteContentHeightRatio = undefined;
  img.style.position = '';
  img.style.left = '';
  img.style.right = '';
  img.style.top = '';
  img.style.bottom = '';
  img.style.width = '';
  img.style.height = '';
  img.style.maxWidth = '';
  img.style.margin = '';
  img.style.objectFit = '';
  img.style.objectPosition = '';
  img.style.transformOrigin = '';
  img.style.transform = '';
  img.style.imageRendering = '';
}

/**
 * @param {HTMLImageElement} img
 * @param {object} manifest
 * @param {string} assetBase
 */
function createController(img, manifest, assetBase) {
  let action = 'idle';
  let frameIndex = 0;
  let flipX = false;
  let timer = null;
  let destroyed = false;
  /** one-shot 播完后停在末帧，不回 idle（致死受击→死亡衔接） */
  let holdAfterOneShot = false;
  /** @type {(() => void)|null} */
  let oneShotResolve = null;

  img._battleSpriteContentHeightRatio = resolveContentHeightRatio(manifest.contentHeightRatio);

  const clearTimer = () => {
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const paint = () => {
    if (destroyed || !img.isConnected) return;
    const spec = manifest.actions?.[action];
    const frames = spec?.frames || [];
    if (!frames.length) return;
    const rel = frames[Math.min(frameIndex, frames.length - 1)];
    img.src = `${assetBase}${rel}`;
    layoutBattleUnitSpriteImg(img, flipX);
  };

  const finishOneShot = () => {
    const resolve = oneShotResolve;
    oneShotResolve = null;
    if (resolve) resolve();
  };

  const startLoop = () => {
    clearTimer();
    const spec = manifest.actions?.[action];
    const frames = spec?.frames || [];
    if (!frames.length) return;
    const fps = (manifest.fps?.[action] || 12) * SPRITE_PLAYBACK_SPEED;
    const ms = Math.max(16, Math.round(1000 / fps));
    const loop = spec?.loop !== false;
    paint();
    timer = window.setInterval(() => {
      if (destroyed) {
        clearTimer();
        return;
      }
      const list = manifest.actions?.[action]?.frames || [];
      if (!list.length) return;
      if (frameIndex + 1 < list.length) {
        frameIndex += 1;
        paint();
        return;
      }
      if (loop) {
        frameIndex = 0;
        paint();
        return;
      }
      clearTimer();
      finishOneShot();
      // 非循环结束后回到 idle；die / hold 停在末帧
      if (action !== 'die' && !holdAfterOneShot && manifest.actions?.idle) {
        action = 'idle';
        frameIndex = 0;
        startLoop();
      }
      holdAfterOneShot = false;
    }, ms);
  };

  return {
    unitKey: manifest.unitKey,
    getAction: () => action,
    setFlipX(next) {
      flipX = !!next;
      layoutBattleUnitSpriteImg(img, flipX);
    },
    /**
     * @param {string} nextAction
     * @param {{ hold?: boolean }} [opts] hold=true：one-shot 播完停末帧（不回 idle）
     * @returns {Promise<void>} loop 动作立即 resolve；one-shot 播完 resolve
     */
    play(nextAction, opts = {}) {
      if (destroyed) return Promise.resolve();
      const key = manifest.actions?.[nextAction]
        ? nextAction
        : manifest.actions?.idle
          ? 'idle'
          : Object.keys(manifest.actions || {})[0];
      if (!key) return Promise.resolve();
      finishOneShot();
      holdAfterOneShot = !!opts.hold;
      action = key;
      frameIndex = 0;
      const loop = manifest.actions[key]?.loop !== false;
      if (loop) {
        holdAfterOneShot = false;
        startLoop();
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        oneShotResolve = resolve;
        startLoop();
      });
    },
    destroy() {
      destroyed = true;
      clearTimer();
      finishOneShot();
      clearBattleUnitSpriteLayout(img);
    },
  };
}

/**
 * 绑定序列帧；无 battleUnitKey 或加载失败则回退静态立绘。
 * @param {HTMLImageElement|null} imgEl
 * @param {object} troop
 * @param {string} [baseUrl]
 * @returns {Promise<object|null>} controller
 */
export async function attachBattleUnitSprite(imgEl, troop, baseUrl = '') {
  if (!imgEl) return null;
  const prev = imgEl._battleSpriteCtrl;
  if (prev) {
    prev.destroy();
    imgEl._battleSpriteCtrl = null;
  }

  const unitKey = resolveBattleUnitKey(troop);
  if (!unitKey) {
    imgEl.classList.remove('troop-img--unit-sprite');
    clearBattleUnitSpriteLayout(imgEl);
    bindTroopPortraitImg(imgEl, troop, baseUrl);
    return null;
  }

  try {
    const manifest = await loadManifest(unitKey, baseUrl);
    const assetBase = battleUnitAssetBase(unitKey, baseUrl);
    const ctrl = createController(imgEl, manifest, assetBase);
    imgEl._battleSpriteCtrl = ctrl;
    imgEl.classList.add('troop-img--unit-sprite');
    imgEl.alt = troop.displayName || troop.name || unitKey;
    imgEl.onerror = null;
    layoutBattleUnitSpriteImg(imgEl, false);
    // 首帧布局时格宽可能仍为 0，下一帧再量一次
    requestAnimationFrame(() => layoutBattleUnitSpriteImg(imgEl, false));
    await ctrl.play('idle');
    return ctrl;
  } catch {
    imgEl.classList.remove('troop-img--unit-sprite');
    clearBattleUnitSpriteLayout(imgEl);
    bindTroopPortraitImg(imgEl, troop, baseUrl);
    return null;
  }
}

/**
 * @param {HTMLElement|null} layer
 * @returns {object|null}
 */
export function getBattleSpriteFromLayer(layer) {
  if (!layer) return null;
  if (layer._battleSprite) return layer._battleSprite;
  const img = layer.querySelector?.('.troop-img');
  return img?._battleSpriteCtrl || null;
}

/**
 * @param {HTMLElement|null} layer
 */
export function destroyBattleSpriteOnLayer(layer) {
  const ctrl = getBattleSpriteFromLayer(layer);
  if (ctrl) ctrl.destroy();
  if (layer) layer._battleSprite = null;
  const img = layer?.querySelector?.('.troop-img');
  if (img) {
    img._battleSpriteCtrl = null;
    img.classList.remove('troop-img--unit-sprite');
    clearBattleUnitSpriteLayout(img);
  }
}

/**
 * 水平朝向：攻击/移动以左右为主；上下保持当前或默认朝右。
 * @param {'left'|'right'|'up'|'down'} dir
 * @returns {boolean|null} flipX；null 表示不改
 */
export function flipXFromAtkDir(dir) {
  if (dir === 'left') return true;
  if (dir === 'right') return false;
  return null;
}

/**
 * 远程弹道：播 manifest.actions.projectile（箭矢/火球等）。
 * 无素材或加载失败时返回 false，由调用方用 emoji 回退。
 *
 * @param {object} opts
 * @param {HTMLElement} opts.cardEl 战斗表面根（相对定位容器）
 * @param {number} opts.fromX
 * @param {number} opts.fromY
 * @param {number} opts.toX
 * @param {number} opts.toY
 * @param {string} opts.unitKey
 * @param {string} [opts.baseUrl]
 * @param {number} opts.durationMs 实际飞行毫秒（已按播速折算，与 await 对齐）
 * @returns {Promise<boolean>}
 */
export async function flyBattleUnitProjectile({
  cardEl,
  fromX,
  fromY,
  toX,
  toY,
  unitKey,
  baseUrl = '',
  durationMs,
}) {
  if (!cardEl || !unitKey || !(durationMs > 0)) return false;
  let manifest;
  try {
    manifest = await loadManifest(unitKey, baseUrl);
  } catch {
    return false;
  }
  const frames = manifest?.actions?.projectile?.frames;
  if (!Array.isArray(frames) || frames.length === 0) return false;

  const assetBase = battleUnitAssetBase(unitKey, baseUrl);
  const urls = frames.map((f) => `${assetBase}${f}`);
  await Promise.all(
    urls.map(
      (src) =>
        new Promise((resolve) => {
          const im = new Image();
          im.onload = im.onerror = () => resolve();
          im.src = src;
        }),
    ),
  );

  const pc = manifest.projectileCanvas || { w: 48, h: 48 };
  const display = Math.min(56, Math.max(28, Math.max(Number(pc.w) || 48, Number(pc.h) || 48)));
  const half = display / 2;
  const angle = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI;

  const img = document.createElement('img');
  img.className = 'projectile projectile--sprite';
  img.alt = '';
  img.draggable = false;
  img.src = urls[0];
  img.style.cssText = [
    `left:${fromX - half}px`,
    `top:${fromY - half}px`,
    `width:${display}px`,
    `height:${display}px`,
    `transform:rotate(${angle}deg)`,
    `transition:left ${durationMs}ms ease-in,top ${durationMs}ms ease-in`,
  ].join(';');

  cardEl.style.position = 'relative';
  cardEl.appendChild(img);

  let frameTimer = null;
  if (urls.length > 1) {
    const fps = (manifest.fps?.projectile || 16) * SPRITE_PLAYBACK_SPEED;
    const interval = Math.max(16, 1000 / fps);
    let frameIdx = 0;
    frameTimer = setInterval(() => {
      frameIdx = (frameIdx + 1) % urls.length;
      img.src = urls[frameIdx];
    }, interval);
  }

  requestAnimationFrame(() => {
    img.style.left = `${toX - half}px`;
    img.style.top = `${toY - half}px`;
  });

  await new Promise((r) => setTimeout(r, durationMs));
  if (frameTimer) clearInterval(frameTimer);
  img.remove();
  return true;
}
