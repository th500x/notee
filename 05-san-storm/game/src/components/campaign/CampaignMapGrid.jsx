import { forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CampaignMapTile from './CampaignMapTile';
import CampaignMapUnitsOverlay from './CampaignMapUnitsOverlay';
import { manualHighlightForTacticalCell } from '@/battle/manualHighlightModel';
import {
  buildTroopTooltipContent, buildCampaignCellTooltipInfo, sumBattleFactionTroopTotals,
} from '@/components/battle/battleConstants';
import { useTileTooltipClamp } from '@/components/battle/useTileTooltipClamp';
import TileTooltipContent from '@/components/battle/TileTooltipContent';
import '@/components/battle/BattleMap.css';
import './CampaignMapGrid.css';

/**
 * 象限框必须叠在格子上方用 absolute，不可作为 grid 子项（否则与 320 格争位，地图会挤到网格外）。
 *
 * Tooltip 架构（v2：与小型地图 BattleMap 统一）
 * ──────────────────────────────────────────────
 * 每格 CampaignMapTile 的根节点同时承担引擎宿主（data-battle-y/x）和事件源（onMouseEnter）。
 * 引擎在运行期写入 data-troop；hover 时直接从 dataset.troop 读取，优先级：
 *   部队 → 地形/对象/特效
 * 不再使用 elementsFromPoint，杜绝叠层/z-index 导致的命中漂移。
 */
const CampaignMapGrid = forwardRef(function CampaignMapGrid(
  {
    cells,
    seed,
    title = '战役地图（与 BattleTile 同源素材）',
    meta,
    battleTroops = [],
    deploymentMode = false,
    battleManual = false,
    deployRect = null,
    onCellClick,
    playerByCell,
    deployTroopSelectMode = false,
    selectedDeployTroopId = null,
    onPlayerUnitMarkerClick,
    showBattleEngineHosts = false,
    showStaticNpcUnits = true,
    manualHighlightModel = null,
    manualChrome = null,
    tooltipApiRef = null,
    /** 与 `BattleMap` 一致：存在普攻/治疗/形状伤害预览时，不显示敌军 hover 部队 tooltip，避免与预估叠层 */
    suppressEnemyTroopTooltip = false,
    roundNum = 0,
    /** 手动战斗时显示在「第N回合」徽章右侧的提示（战役大图等） */
    manualActionHintText = null,
  },
  shellRef,
) {
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const { tooltipRef, tooltipStyle } = useTileTooltipClamp(tooltipContent, tooltipPos);
  const [mapInfoOpen, setMapInfoOpen] = useState(false);
  const mapTitleBlockRef = useRef(null);
  /** 同 BattleMap：兵力原地变更时数组引用不变，不可对 battleTroops 引用做 useMemo 缓存 */
  const factionTroopTotals = sumBattleFactionTroopTotals(battleTroops);
  const gridRows = Array.isArray(cells) ? cells.length : 0;
  const gridCols = gridRows > 0 && Array.isArray(cells[0]) ? cells[0].length : 0;
  const gridStyle =
    gridCols > 0 && gridRows > 0
      ? { '--camp-cols': gridCols, '--camp-rows': gridRows }
      : undefined;

  useEffect(() => {
    if (!mapInfoOpen) return undefined;
    const onPointerDown = (e) => {
      if (mapTitleBlockRef.current?.contains(e.target)) return;
      setMapInfoOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMapInfoOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [mapInfoOpen]);

  const suppressEnemyTroopTooltipRef = useRef(false);
  suppressEnemyTroopTooltipRef.current = suppressEnemyTroopTooltip;

  if (tooltipApiRef) {
    tooltipApiRef.current = {
      showTroopTooltip(troop, clientX, clientY) {
        if (suppressEnemyTroopTooltipRef.current && troop?.faction === 'enemy') {
          setTooltipContent(null);
          return;
        }
        setTooltipContent(buildTroopTooltipContent(troop));
        setTooltipPos({ x: clientX, y: clientY });
      },
    };
  }

  // ── Tooltip：与 BattleMap 统一的 mouseEnter 方案 ─────────────────────────
  // 用 ref 包裹使 handleHover 引用稳定，避免 320 格因 onHover 变化全量 re-render
  const hoverDataRef = useRef({ battleTroops, cells, suppressEnemyTroopTooltip });
  hoverDataRef.current = { battleTroops, cells, suppressEnemyTroopTooltip };

  const handleHover = useCallback((e) => {
    const tile = e.currentTarget;
    const troopId = tile.dataset.troop;
    const y = Number(tile.dataset.tacticalY);
    const x = Number(tile.dataset.tacticalX);
    if (Number.isNaN(y) || Number.isNaN(x)) return;
    const { battleTroops: bt, cells: cl, suppressEnemyTroopTooltip: blockEnemyTip } = hoverDataRef.current;
    if (troopId) {
      const troop = bt.find((t) => t.id === troopId && t.currentTroops > 0);
      if (troop) {
        if (blockEnemyTip && troop.faction === 'enemy') {
          setTooltipContent(null);
          return;
        }
        setTooltipContent(buildTroopTooltipContent(troop));
        setTooltipPos({ x: e.clientX, y: e.clientY });
        return;
      }
    }
    const cell = cl[y]?.[x];
    const info = cell ? buildCampaignCellTooltipInfo(cell) : null;
    if (!info) { setTooltipContent(null); return; }
    setTooltipContent({ type: 'tile', info });
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleLeave = useCallback(() => { setTooltipContent(null); }, []);

  const handleWrapperMove = useCallback((e) => {
    setTooltipPos((prev) => {
      if (prev.x === e.clientX && prev.y === e.clientY) return prev;
      return { x: e.clientX, y: e.clientY };
    });
  }, []);

  const inDeployRect = (col, row) =>
    deployRect &&
    col >= deployRect.colMin &&
    col <= deployRect.colMax &&
    row >= deployRect.rowMin &&
    row <= deployRect.rowMax;

  const cellInteractive =
    ((deploymentMode || battleManual) && !!onCellClick);

  const showTileTooltips = deploymentMode || battleManual;

  return (
    <div className="campaign-map-card">
      <div className="campaign-map-aligned-stack">
        {title && (
          <div className="campaign-map-title" style={{ position: 'relative' }} ref={mapTitleBlockRef}>
            <button
              type="button"
              className="map-title-label-btn"
              aria-expanded={mapInfoOpen}
              aria-controls="campaign-map-gen-info"
              title="点按查看地图信息"
              onClick={() => setMapInfoOpen((v) => !v)}
            >
              {title}
            </button>
            {roundNum > 0 && <span className="round-badge">第{roundNum}回合</span>}
            {manualActionHintText ? (
              <span className="campaign-map-action-hint">{manualActionHintText}</span>
            ) : null}
            {mapInfoOpen && meta ? (
              <div id="campaign-map-gen-info" className="map-label-info-pop" role="dialog" aria-label="地图信息">
                {meta}
              </div>
            ) : null}
          </div>
        )}
        <div className="campaign-map-meta map-meta-troops" aria-live="polite">
          <span className="mt-player">我军：{factionTroopTotals.player}</span>
          <span className="mt-sep">/</span>
          <span className="mt-enemy">敌军：{factionTroopTotals.enemy}</span>
          <span className="mt-sep">/</span>
          <span className="mt-ally">友军：{factionTroopTotals.ally}</span>
        </div>
        <div
          className="campaign-map-wrap"
          onMouseMove={showTileTooltips ? handleWrapperMove : undefined}
          onMouseLeave={showTileTooltips ? handleLeave : undefined}
        >
        <div
          className="campaign-map-shell"
          ref={shellRef}
          style={{ position: 'relative', ...(gridStyle || {}) }}
        >
          <div className="campaign-map-grid">
            {cells.map((row, ri) =>
              row.map((cell, ci) => {
                const mh =
                  manualHighlightModel
                    ? manualHighlightForTacticalCell(ri, ci, manualHighlightModel)
                    : { kind: null };
                let manualHl = null;
                let manualMoveCost = null;
                if (mh.kind === 'active') manualHl = 'active';
                else if (mh.kind === 'move') {
                  manualHl = 'move';
                  manualMoveCost = mh.cost ?? null;
                } else if (mh.kind === 'heal') manualHl = 'heal';
                else if (mh.kind === 'atk') manualHl = 'atk';
                return (
                  <CampaignMapTile
                    key={`${ri}-${ci}`}
                    cell={cell}
                    seed={seed}
                    tacticalY={ri}
                    tacticalX={ci}
                    deployHighlight={deploymentMode && inDeployRect(ci, ri)}
                    interactive={cellInteractive}
                    onTileClick={cellInteractive ? () => onCellClick(ci, ri) : undefined}
                    engineActive={showBattleEngineHosts}
                    manualHl={manualHl}
                    manualMoveCost={manualMoveCost}
                    onHover={showTileTooltips ? handleHover : undefined}
                    onLeave={showTileTooltips ? handleLeave : undefined}
                  />
                );
              })
            )}
          </div>
          <CampaignMapUnitsOverlay
            cells={cells}
            playerByCell={playerByCell}
            deployTroopSelectMode={deployTroopSelectMode}
            selectedDeployTroopId={selectedDeployTroopId}
            onPlayerUnitMarkerClick={onPlayerUnitMarkerClick}
            showStaticNpcUnits={showStaticNpcUnits}
          />
          {manualChrome ? (
            <div
              className="campaign-manual-chrome"
              style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }}
            >
              {manualChrome}
            </div>
          ) : null}
        </div>
        {/* 地形/部队浮动提示：挂 body，避免 campaign-map-wrap 滚动层裁切 */}
        {tooltipContent && typeof document !== 'undefined' && createPortal(
          <div
            className="tile-tooltip tile-tooltip--portal"
            ref={tooltipRef}
            style={tooltipStyle}
          >
            <TileTooltipContent content={tooltipContent} />
          </div>,
          document.body,
        )}
        </div>
      </div>
    </div>
  );
});

export default CampaignMapGrid;
