/**
 * 战略大地图：玩家自身占位。圆形内为角色名末字；键鼠悬停圆形时显示全名与兵力 tooltip。
 * 触摸 / 粗指针：`pointerType==='touch'`（不依赖 `(pointer: coarse)`，避免竖屏误判）；道路格上 **行军/来战** 固定于头像上下（无弹出/关闭）；非道路格短按/单击仍弹出操作条（行军/来战，无「关闭」）。长按约 1s 松手后直接进入行军模式。
 * 键鼠：单击打开操作条（与悬停可同时看到 tooltip）。**一键进军**请使用道路格双击 / 触摸双触（见 `WorldStrategicMapTile` 与 **31-6 §8**），**不在**本人叠层上绑双击，避免竖屏单点被误判为双击。
 */

import { useState, useCallback, useSyncExternalStore, useRef, useEffect, useMemo } from 'react';
import { playerAPI } from '@/services/playerApi';
import { createRoadClientRequestId } from '@/utils/roadClientRequestId';
import { mapDisplayEffectToAvatarClass } from '@/utils/mapDisplayEffect';

const BASE = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/';

/** 触摸：达到此按住时长后，松手时视为「一键进军」 */
const TOUCH_LONG_MARCH_MS = 980;
/** 触摸：短按判定最大按住时间 */
const TOUCH_TAP_MAX_MS = 320;
/** 触摸：移动超过此像素则取消长按识别（避免与地图平移抢手势） */
const TOUCH_MOVE_CANCEL_PX = 16;

/** 与 `roadEncounterService.INTERCEPT_COST_SILVER` 一致：0→1 扣银 */
const ROAD_INTERCEPT_SILVER_COST = 50;

function subscribePointerCoarse(cb) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(pointer: coarse)');
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getPointerCoarseSnapshot() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function getPointerCoarseServerSnapshot() {
  return false;
}

function resolvePortraitSrc(portraitUrl) {
  if (!portraitUrl || typeof portraitUrl !== 'string') return null;
  const u = portraitUrl.trim();
  if (!u) return null;
  if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
  return `${BASE}${u.replace(/^\//, '')}`;
}

/** 从 `[势力]角色名` 拆 tooltip 两行，避免 `word-break` 把角色名截成「游侠 / 儿」 */
function splitMapPawnTooltipLabels(displayName) {
  const raw = String(displayName || '').trim();
  if (!raw) return { factionLine: null, characterLine: '…' };
  const m = raw.match(/^\[([^\]]+)\](.+)$/);
  if (m) {
    const faction = String(m[1] || '').trim();
    const character = String(m[2] || '').trim() || '…';
    return { factionLine: faction || null, characterLine: character };
  }
  return { factionLine: null, characterLine: raw };
}

/**
 * @param {object} props
 * @param {number} props.cx
 * @param {number} props.cy
 * @param {string|null|undefined} props.portraitUrl
 * @param {string|null|undefined} [props.portraitFallbackUrl] - 立绘 404 时回退（如创角头像）
 * @param {string|null|undefined} [props.displayEffect] - 成就光效枚举：金色/红色/绿色/黑色
 * @param {string} props.displayName - `[势力]角色名`，用于 tooltip
 * @param {string} props.centerGlyph - 角色名末字（图标正中）
 * @param {number} props.troopsCurrent
 * @param {number} props.troopsMax
 * @param {Array<{ playerId: string, portraitUrl: string|null, centerGlyph: string, stackTitle?: string }>} [props.stackStripPeers] - 同格叠站时悬停主头像右侧小头像（不含焦点本人）
 * @param {boolean} [props.stackStripEllipsis] - 同格人数 >10 时第 11 位为省略号
 * @param {boolean} [props.marchModeActive] - 是否已处于行军模式（操作条展示「退出行军」）
 * @param {() => void} [props.onEnterMarchMode] - 进入行军模式（与点操作条「行军」一致）
 * @param {() => void} [props.onExitMarchMode] - 退出行军模式
 * @param {0|1} [props.roadIntercept] - 道路「来战」：`1` 时头像赤红光晕；**本人与路人棋子**均可传（由 `road-presence` 的 `roadIntercept`）；**点钮改状态**仍仅本人叠层（须同时传 `interceptPlayerId` + `onRoadSelfUpdated`）
 * @param {string|null} [props.interceptPlayerId] - 当前登录玩家 id（与 `onRoadSelfUpdated` 同时传入才显示来战/休战按钮与扣银确认）
 * @param {number|null} [props.interceptSilver] - 当前银两（展示确认文案）
 * @param {() => void|Promise<void>} [props.onRoadSelfUpdated] - 切换成功后刷新档案
 * @param {boolean} [props.onRoadCell] - 当前立点在道路格：行军/来战固定显于头像上下（31-6 §8）
 * @param {(open: boolean) => void} [props.onSelfPawnOverlayOpenChange] - 非道路格操作条或来战确认打开时通知（道路格固定钮不计入）
 */
export default function StrategicMapSelfPawn({
  cx,
  cy,
  portraitUrl,
  portraitFallbackUrl = null,
  displayEffect = null,
  displayName,
  centerGlyph,
  troopsCurrent,
  troopsMax,
  stackStripPeers = null,
  stackStripEllipsis = false,
  marchModeActive = false,
  /** 仅本人叠层传入：他人 pawn 不传，禁用行军操作条与触摸长按进军 */
  onEnterMarchMode,
  onExitMarchMode,
  roadIntercept = 0,
  interceptPlayerId = null,
  interceptSilver = null,
  onRoadSelfUpdated = null,
  onRoadCell = false,
  onSelfPawnOverlayOpenChange = null,
}) {
  const selfMarchUi = typeof onEnterMarchMode === 'function';
  const roadFixedActions = selfMarchUi && !!onRoadCell;
  const interceptControlsEnabled =
    selfMarchUi &&
    typeof onRoadSelfUpdated === 'function' &&
    interceptPlayerId != null &&
    String(interceptPlayerId).length > 0;
  const coarsePointer = useSyncExternalStore(
    subscribePointerCoarse,
    getPointerCoarseSnapshot,
    getPointerCoarseServerSnapshot,
  );
  const [hover, setHover] = useState(false);
  const [showActionPopover, setShowActionPopover] = useState(false);
  /** `null` | `'enable'` | `'disable'`：道路开战扣银确认 / 休战确认 */
  const [interceptPanel, setInterceptPanel] = useState(null);
  const [interceptClientRequestId, setInterceptClientRequestId] = useState(null);
  const [interceptBusy, setInterceptBusy] = useState(false);
  const [interceptError, setInterceptError] = useState('');
  /** 触摸长按「一键进军」档：与悬停同文案的 tooltip 仅在该档为 true（短按与操作条同显时不单独依赖此项） */
  const [touchLongTooltip, setTouchLongTooltip] = useState(false);

  const hitRef = useRef(null);
  /** @type {null | { pointerId: number, t0: number, x0: number, y0: number, lastX: number, lastY: number, marchTimerId: ReturnType<typeof setTimeout>|null, marchArmed: boolean }} */
  const pointerTrackRef = useRef(null);
  const suppressClickRef = useRef(false);
  /** 打开操作条后短窗口内忽略 document 外点，避免触屏同一次 tap 的幽灵 pointerdown 立刻关条 */
  const popoverOutsideGuardUntilRef = useRef(0);

  const clearMarchTimer = useCallback(() => {
    const tr = pointerTrackRef.current;
    if (tr?.marchTimerId != null) {
      clearTimeout(tr.marchTimerId);
      tr.marchTimerId = null;
    }
  }, []);

  const portraitCandidates = useMemo(() => {
    const out = [];
    const push = (u) => {
      const s = u != null ? String(u).trim() : '';
      if (s && !out.includes(s)) out.push(s);
    };
    push(portraitUrl);
    push(portraitFallbackUrl);
    return out;
  }, [portraitUrl, portraitFallbackUrl]);

  const [portraitCandidateIdx, setPortraitCandidateIdx] = useState(0);

  useEffect(() => {
    setPortraitCandidateIdx(0);
  }, [portraitCandidates]);

  const src =
    portraitCandidateIdx < portraitCandidates.length
      ? resolvePortraitSrc(portraitCandidates[portraitCandidateIdx])
      : null;

  const onPortraitError = useCallback(() => {
    setPortraitCandidateIdx((i) => i + 1);
  }, []);
  const { factionLine, characterLine } = splitMapPawnTooltipLabels(displayName);
  const g = (centerGlyph && String(centerGlyph).trim()) || '';
  const seq = Array.from(g);
  const glyph = seq.length ? seq[seq.length - 1] : '…';
  const showTroops = Number.isFinite(troopsCurrent) && Number.isFinite(troopsMax);
  const troopText = showTroops ? `${Math.max(0, Math.round(troopsCurrent))}/${Math.max(0, Math.round(troopsMax))}` : null;
  const showHoverTooltip = hover && !coarsePointer;
  /** 短按打开操作条时与键鼠单击一致：tooltip 与按钮同显（非道路格） */
  const showAnyTooltip = showHoverTooltip || touchLongTooltip || (!roadFixedActions && showActionPopover);
  const stripPeers = Array.isArray(stackStripPeers) ? stackStripPeers : [];
  const showStackStripRow =
    showAnyTooltip && (stripPeers.length > 0 || stackStripEllipsis);

  const onEnter = useCallback(() => setHover(true), []);
  const onLeave = useCallback(() => setHover(false), []);

  const armSuppressClick = useCallback(() => {
    suppressClickRef.current = true;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 400);
  }, []);

  /** 竖屏等场景 `(pointer: coarse)` 可能为 false，仍以 `pointerType === 'touch'` 为准 */
  const isTouchLikePointer = useCallback(
    (e) => e.pointerType === 'touch' || (coarsePointer && e.pointerType !== 'mouse'),
    [coarsePointer],
  );

  const endPointerGesture = useCallback(() => {
    clearMarchTimer();
    const track = pointerTrackRef.current;
    pointerTrackRef.current = null;
    if (!track) return;
    try {
      const el = hitRef.current;
      if (el instanceof HTMLElement && typeof el.releasePointerCapture === 'function') {
        el.releasePointerCapture(track.pointerId);
      }
    } catch (_) {}
    const { t0, x0, y0 } = track;
    const marchArmed = !!track.marchArmed;
    const elapsed = Date.now() - t0;
    const moved = Math.hypot(track.lastX - x0, track.lastY - y0);
    setTouchLongTooltip(false);

    if (moved <= TOUCH_MOVE_CANCEL_PX && elapsed <= TOUCH_TAP_MAX_MS && !marchArmed) {
      armSuppressClick();
      if (!roadFixedActions) {
        popoverOutsideGuardUntilRef.current = Date.now() + 480;
        setShowActionPopover(true);
      }
    } else if (marchArmed && typeof onEnterMarchMode === 'function') {
      armSuppressClick();
      setShowActionPopover(false);
      onEnterMarchMode();
    }
  }, [clearMarchTimer, onEnterMarchMode, armSuppressClick, roadFixedActions]);

  const onPointerDown = useCallback(
    (e) => {
      if (!selfMarchUi || e.button !== 0) return;
      if (!isTouchLikePointer(e)) return;
      e.stopPropagation();
      // 抑制浏览器随后补发的「兼容 click」，避免与 pointer 短按分支打架导致首触误进军
      if (isTouchLikePointer(e)) e.preventDefault();
      clearMarchTimer();
      const el = e.currentTarget;
      try {
        if (el instanceof HTMLElement && typeof el.setPointerCapture === 'function') {
          el.setPointerCapture(e.pointerId);
        }
      } catch (_) {
        /* 部分环境拒绝 capture，仍依赖 hit 上 pointerup */
      }
      pointerTrackRef.current = {
        pointerId: e.pointerId,
        t0: Date.now(),
        x0: e.clientX,
        y0: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        marchTimerId: null,
        marchArmed: false,
      };
      const marchTimer = window.setTimeout(() => {
        const tr = pointerTrackRef.current;
        if (!tr || tr.pointerId !== e.pointerId) return;
        const moved = Math.hypot(tr.lastX - tr.x0, tr.lastY - tr.y0);
        if (moved > TOUCH_MOVE_CANCEL_PX) return;
        tr.marchArmed = true;
        setTouchLongTooltip(true);
      }, TOUCH_LONG_MARCH_MS);
      pointerTrackRef.current.marchTimerId = marchTimer;
    },
    [selfMarchUi, isTouchLikePointer, clearMarchTimer],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!selfMarchUi) return;
      const tr = pointerTrackRef.current;
      if (!tr || e.pointerId !== tr.pointerId) return;
      tr.lastX = e.clientX;
      tr.lastY = e.clientY;
      const moved = Math.hypot(tr.lastX - tr.x0, tr.lastY - tr.y0);
      if (moved > TOUCH_MOVE_CANCEL_PX) {
        clearMarchTimer();
        tr.marchArmed = false;
        setTouchLongTooltip(false);
        try {
          const el = hitRef.current;
          if (el instanceof HTMLElement && typeof el.releasePointerCapture === 'function') {
            el.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}
        pointerTrackRef.current = null;
      }
    },
    [selfMarchUi, clearMarchTimer],
  );

  const onPointerUp = useCallback(
    (e) => {
      if (!selfMarchUi) return;
      const tr = pointerTrackRef.current;
      if (!tr || e.pointerId !== tr.pointerId) return;
      e.stopPropagation();
      if (isTouchLikePointer(e)) e.preventDefault();
      endPointerGesture();
    },
    [selfMarchUi, endPointerGesture, isTouchLikePointer],
  );

  const onPointerCancel = useCallback(
    (e) => {
      if (!selfMarchUi) return;
      const tr = pointerTrackRef.current;
      if (!tr || e.pointerId !== tr.pointerId) return;
      clearMarchTimer();
      try {
        const el = hitRef.current;
        if (el instanceof HTMLElement && typeof el.releasePointerCapture === 'function') {
          el.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
      pointerTrackRef.current = null;
      setTouchLongTooltip(false);
    },
    [selfMarchUi, clearMarchTimer],
  );

  useEffect(
    () => () => {
      clearMarchTimer();
      pointerTrackRef.current = null;
    },
    [clearMarchTimer],
  );

  useEffect(() => {
    if (typeof onSelfPawnOverlayOpenChange !== 'function') return undefined;
    const overlayOpen = (!roadFixedActions && showActionPopover) || !!interceptPanel;
    onSelfPawnOverlayOpenChange(overlayOpen);
    return () => {
      if (overlayOpen) onSelfPawnOverlayOpenChange(false);
    };
  }, [showActionPopover, interceptPanel, roadFixedActions, onSelfPawnOverlayOpenChange]);

  useEffect(() => {
    if (!selfMarchUi || !showActionPopover || roadFixedActions) return undefined;
    let removeListener = null;
    const rafId = requestAnimationFrame(() => {
      const onDocPointerDown = (ev) => {
        if (Date.now() < popoverOutsideGuardUntilRef.current) return;
        const el = hitRef.current;
        if (el && ev.target instanceof Node && el.contains(ev.target)) return;
        setShowActionPopover(false);
        setInterceptPanel(null);
        setInterceptError('');
        setInterceptBusy(false);
      };
      document.addEventListener('pointerdown', onDocPointerDown, true);
      removeListener = () => document.removeEventListener('pointerdown', onDocPointerDown, true);
    });
    return () => {
      cancelAnimationFrame(rafId);
      removeListener?.();
    };
  }, [selfMarchUi, showActionPopover, roadFixedActions]);

  const onHitClick = useCallback(
    (e) => {
      if (!selfMarchUi || roadFixedActions) return;
      const ne = e.nativeEvent;
      // 触屏后浏览器补发的「兼容 click」走 pointer 分支即可，避免与格网/进军抢首帧
      if (ne && typeof ne === 'object' && ne.sourceCapabilities?.firesTouch) return;
      if (suppressClickRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      popoverOutsideGuardUntilRef.current = Date.now() + 480;
      setShowActionPopover(true);
    },
    [selfMarchUi, roadFixedActions],
  );

  const handleMarchButton = useCallback(() => {
    setInterceptPanel(null);
    setInterceptError('');
    setShowActionPopover(false);
    if (marchModeActive) {
      if (typeof onExitMarchMode === 'function') onExitMarchMode();
    } else if (typeof onEnterMarchMode === 'function') {
      onEnterMarchMode();
    }
  }, [marchModeActive, onEnterMarchMode, onExitMarchMode]);

  const handleInterceptConfirm = useCallback(async () => {
    if (!interceptControlsEnabled || !interceptPanel) return;
    const enable = interceptPanel === 'enable';
    if (enable) {
      const s = interceptSilver;
      if (Number.isFinite(s) && s < ROAD_INTERCEPT_SILVER_COST) {
        setInterceptError(`银两不足：开启需 ${ROAD_INTERCEPT_SILVER_COST} 银`);
        return;
      }
    }
    setInterceptBusy(true);
    setInterceptError('');
    const rid = interceptClientRequestId || createRoadClientRequestId('intercept');
    try {
      const res = await playerAPI.setRoadIntercept(interceptPlayerId, enable, rid);
      if (!res?.success) {
        setInterceptError(typeof res?.error === 'string' ? res.error : '操作失败');
        return;
      }
      await onRoadSelfUpdated();
      setInterceptPanel(null);
      setShowActionPopover(false);
    } catch (e) {
      setInterceptError(e?.message || '网络错误');
    } finally {
      setInterceptBusy(false);
    }
  }, [interceptControlsEnabled, interceptPanel, interceptPlayerId, interceptSilver, interceptClientRequestId, onRoadSelfUpdated]);

  const silverShort =
    interceptPanel === 'enable' &&
    Number.isFinite(interceptSilver) &&
    interceptSilver < ROAD_INTERCEPT_SILVER_COST;

  const openInterceptPanel = useCallback(() => {
    setInterceptError('');
    setInterceptClientRequestId(createRoadClientRequestId('intercept'));
    setInterceptPanel(roadIntercept === 1 ? 'disable' : 'enable');
  }, [roadIntercept]);

  const renderMarchButton = (className) => (
    <button
      type="button"
      className={className}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        handleMarchButton();
      }}
    >
      {marchModeActive ? '退出行军' : '行军'}
    </button>
  );

  const renderInterceptButton = (className) => {
    if (!interceptControlsEnabled) return null;
    return (
      <button
        type="button"
        className={className}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          openInterceptPanel();
        }}
      >
        {roadIntercept === 1 ? '休战' : '来战'}
      </button>
    );
  };

  const renderInterceptConfirmPanel = () => (
    <div className="ws-map-self-pawn__actions" role="dialog" aria-label="道路开战确认">
      <div className="ws-map-self-pawn__intercept-msg">
        {interceptPanel === 'enable' ? (
          <>
            开启<strong className="ws-map-self-pawn__intercept-strong">道路开战</strong>将扣除银两{' '}
            <strong className="ws-map-self-pawn__intercept-strong">{ROAD_INTERCEPT_SILVER_COST}</strong>
            {Number.isFinite(interceptSilver) ? (
              <>
                ，当前银两 <strong className="ws-map-self-pawn__intercept-strong">{interceptSilver}</strong>
              </>
            ) : null}
            。确认后会和敌对玩家在遭遇时交战！
          </>
        ) : (
          <>确认关闭道路开战模式？关闭后不再扣费，已扣银两不退回。</>
        )}
      </div>
      {interceptError ? (
        <div className="ws-map-self-pawn__intercept-err" role="alert">
          {interceptError}
        </div>
      ) : null}
      <div className="ws-map-self-pawn__intercept-actions">
        <button
          type="button"
          className="ws-map-self-pawn__action-btn"
          disabled={interceptBusy}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setInterceptPanel(null);
            setInterceptError('');
          }}
        >
          返回
        </button>
        <button
          type="button"
          className="ws-map-self-pawn__action-btn ws-map-self-pawn__action-btn--danger"
          disabled={interceptBusy || silverShort}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void handleInterceptConfirm();
          }}
        >
          {interceptBusy ? '提交中…' : '确认'}
        </button>
      </div>
    </div>
  );

  const hitClassName = roadFixedActions
    ? 'ws-map-self-pawn__hit ws-map-self-pawn__hit--road-fixed'
    : 'ws-map-self-pawn__hit';

  const glowClass = mapDisplayEffectToAvatarClass(displayEffect);
  const avatarClassName = [
    'ws-map-self-pawn__avatar',
    roadIntercept === 1 ? 'ws-map-self-pawn__avatar--intercept' : '',
    glowClass,
  ]
    .filter(Boolean)
    .join(' ');

  // 不在根节点设 aria-hidden：首触时部分 WebKit 会误把事件落到下层格网，表现为「一点头像就进军」；操作条打开时子树内已有可聚焦控件。
  return (
    <div
      className={`ws-map-self-pawn${selfMarchUi ? ' ws-map-self-pawn--self' : ' ws-map-self-pawn--other'}`}
      style={{ left: `${cx}px`, top: `${cy}px` }}
    >
      <div className="ws-map-self-pawn__anchor">
        <div
          ref={hitRef}
          className={hitClassName}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onClick={selfMarchUi ? onHitClick : undefined}
          onPointerDown={selfMarchUi ? onPointerDown : undefined}
          onPointerMove={selfMarchUi ? onPointerMove : undefined}
          onPointerUp={selfMarchUi ? onPointerUp : undefined}
          onPointerCancel={selfMarchUi ? onPointerCancel : undefined}
        >
          {roadFixedActions && !interceptPanel
            ? renderMarchButton(
                'ws-map-self-pawn__road-fixed-btn ws-map-self-pawn__road-fixed-btn--primary',
              )
            : null}
          <div className="ws-map-self-pawn__avatar-row">
            <div className="ws-map-self-pawn__avatar-wrap">
              <div className={avatarClassName}>
                {src ? (
                  <img
                    className="ws-map-self-pawn__img"
                    src={src}
                    alt=""
                    draggable={false}
                    onError={onPortraitError}
                  />
                ) : (
                  <div className="ws-map-self-pawn__img ws-map-self-pawn__img--fallback" />
                )}
                <span className="ws-map-self-pawn__center-glyph">{glyph}</span>
              </div>
              {showAnyTooltip ? (
                <div className="ws-map-self-pawn__tooltip">
                  {factionLine ? (
                    <div className="ws-map-self-pawn__tooltip-faction">{factionLine}</div>
                  ) : null}
                  <div className="ws-map-self-pawn__tooltip-name">{characterLine}</div>
                  {troopText ? (
                    <div className="ws-map-self-pawn__tooltip-troops">{troopText}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {showStackStripRow ? (
              <div className="ws-map-self-pawn__stack-strip" aria-hidden>
                {stripPeers.map((peer) => {
                  const psrc = resolvePortraitSrc(peer.portraitUrl);
                  const pg = String(peer.centerGlyph || '').trim() || '…';
                  const ptitle = String(peer.stackTitle || '').trim() || peer.playerId;
                  return (
                    <div
                      key={peer.playerId}
                      className="ws-map-self-pawn__stack-face"
                      title={ptitle}
                    >
                      {psrc ? (
                        <img
                          className="ws-map-self-pawn__stack-img"
                          src={psrc}
                          alt=""
                          draggable={false}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="ws-map-self-pawn__stack-img ws-map-self-pawn__stack-img--fallback" />
                      )}
                      <span className="ws-map-self-pawn__stack-glyph">{pg}</span>
                    </div>
                  );
                })}
                {stackStripEllipsis ? (
                  <div className="ws-map-self-pawn__stack-face ws-map-self-pawn__stack-face--ellipsis" title="更多">
                    …
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {roadFixedActions && interceptPanel ? renderInterceptConfirmPanel() : null}
          {roadFixedActions && !interceptPanel
            ? renderInterceptButton(
                'ws-map-self-pawn__road-fixed-btn ws-map-self-pawn__road-fixed-btn--danger',
              )
            : null}
          {!roadFixedActions && showActionPopover ? (
            interceptPanel ? (
              renderInterceptConfirmPanel()
            ) : (
              <div className="ws-map-self-pawn__actions" role="dialog" aria-label="本人地图操作">
                {renderMarchButton(
                  'ws-map-self-pawn__action-btn ws-map-self-pawn__action-btn--primary',
                )}
                {renderInterceptButton(
                  'ws-map-self-pawn__action-btn ws-map-self-pawn__action-btn--danger',
                )}
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
