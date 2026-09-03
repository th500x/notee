/**
 * 侧视部队序列帧播放器（阶段 C）
 * 读取 public/assets/san_1_battle/units/{unitKey}/manifest.json 并按 fps 切帧。
 * @see docs/00/90-assets/99-2-BATTLE_UNIT_SPRITE_PIPELINE.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function normalizeBase(baseUrl) {
  const b =
    baseUrl != null && baseUrl !== ''
      ? String(baseUrl)
      : typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
        ? String(import.meta.env.BASE_URL)
        : '/';
  return b.endsWith('/') ? b : `${b}/`;
}

/**
 * @param {string} unitKey
 * @param {string} [baseUrl]
 */
export function battleUnitAssetBase(unitKey, baseUrl) {
  return `${normalizeBase(baseUrl)}assets/san_1_battle/units/${encodeURIComponent(unitKey)}/`;
}

/**
 * @param {object} props
 * @param {string} props.unitKey
 * @param {string} [props.action] 当前动作键；未传则 idle
 * @param {boolean} [props.flipX] 水平镜像（对向）
 * @param {number} [props.displaySize] CSS 显示边长（px）；默认按 canvas 缩放适配
 * @param {string} [props.baseUrl]
 * @param {(action: string) => void} [props.onActionComplete] 非 loop 动作播完
 * @param {string} [props.className]
 */
export default function BattleUnitSpritePlayer({
  unitKey,
  action = 'idle',
  flipX = false,
  displaySize = null,
  baseUrl,
  onActionComplete,
  className = '',
}) {
  const [manifest, setManifest] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [frameIndex, setFrameIndex] = useState(0);
  const actionRef = useRef(action);
  const onCompleteRef = useRef(onActionComplete);
  actionRef.current = action;
  onCompleteRef.current = onActionComplete;

  const assetBase = useMemo(
    () => (unitKey ? battleUnitAssetBase(unitKey, baseUrl) : ''),
    [unitKey, baseUrl],
  );

  useEffect(() => {
    if (!unitKey || !assetBase) return undefined;
    let cancelled = false;
    setManifest(null);
    setLoadError('');
    setFrameIndex(0);
    fetch(`${assetBase}manifest.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`manifest ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setManifest(data);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message || String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [unitKey, assetBase]);

  const resolvedAction = useMemo(() => {
    if (!manifest?.actions) return 'idle';
    if (manifest.actions[action]) return action;
    if (manifest.actions.idle) return 'idle';
    return Object.keys(manifest.actions)[0] || 'idle';
  }, [manifest, action]);

  const actionSpec = manifest?.actions?.[resolvedAction] || null;
  const frames = actionSpec?.frames || [];
  /** 与 battleUnitSpriteDom 战场播速对齐 */
  const fps = (manifest?.fps?.[resolvedAction] || 12) * 2;
  const loop = actionSpec?.loop !== false;

  // 切换动作时重置帧
  useEffect(() => {
    setFrameIndex(0);
  }, [resolvedAction, unitKey]);

  const advance = useCallback(() => {
    if (!frames.length) return;
    setFrameIndex((prev) => {
      const next = prev + 1;
      if (next < frames.length) return next;
      if (loop) return 0;
      const doneAction = actionRef.current;
      queueMicrotask(() => {
        onCompleteRef.current?.(doneAction);
      });
      return prev;
    });
  }, [frames.length, loop]);

  useEffect(() => {
    if (!frames.length) return undefined;
    const ms = Math.max(16, Math.round(1000 / fps));
    const id = window.setInterval(advance, ms);
    return () => window.clearInterval(id);
  }, [advance, frames.length, fps, resolvedAction, unitKey]);

  const canvasW = manifest?.canvas?.w || 128;
  const canvasH = manifest?.canvas?.h || 128;
  const cssSize = displaySize != null ? displaySize : Math.min(240, Math.max(96, canvasW));
  const frameRel = frames[Math.min(frameIndex, frames.length - 1)] || '';
  const src = frameRel ? `${assetBase}${frameRel}` : '';

  if (loadError) {
    return (
      <div className={`text-sm text-red-300 ${className}`}>
        加载失败（{unitKey}）：{loadError}
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className={`text-sm text-stone-400 ${className}`}>加载 {unitKey}…</div>
    );
  }

  return (
    <div
      className={`inline-flex flex-col items-center ${className}`}
      data-unit-key={unitKey}
      data-action={resolvedAction}
    >
      <div
        className="relative overflow-hidden rounded-md border border-stone-600/80"
        style={{
          width: cssSize,
          height: cssSize,
          backgroundImage:
            'linear-gradient(45deg,#2a2a3a 25%,transparent 25%),linear-gradient(-45deg,#2a2a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a3a 75%),linear-gradient(-45deg,transparent 75%,#2a2a3a 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
          backgroundColor: '#1e1e2e',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={`${unitKey} ${resolvedAction}`}
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              imageRendering: 'pixelated',
              transform: flipX ? 'scaleX(-1)' : undefined,
            }}
          />
        ) : null}
      </div>
      <div className="mt-1 text-[10px] text-stone-500 tabular-nums">
        {canvasW}×{canvasH} · {resolvedAction} · {frameIndex + 1}/{frames.length || 0} · {fps}fps
      </div>
    </div>
  );
}
