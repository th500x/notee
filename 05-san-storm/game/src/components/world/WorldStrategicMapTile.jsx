import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  campaignBgUrl,
  campaignTerrainUrl,
  campaignObjectUrl,
  buildCampaignVisualVariants,
} from '@/utils/campaignMapVisualAssets';
import { STRATEGIC_WAR_ZHAN_MARK_URL, tacticalFireFrameUrl } from '@/components/battle/battleConstants';
import {
  getFactionRepresentativeColor,
  hexToRgba,
  contrastTextOnFactionHex,
} from '@/utils/strategicMapFactionColors';
import { getStrategicMapCityLabelLines } from '@/utils/strategicMapCityLabels';
import {
  getStrategicCityLabelStance,
  strategicCityLabelInlineColorStyle,
} from '@/utils/strategicMapCityLabelStance';
import { worldMapFactionFlagPartsFromRow } from '@/utils/worldMapCityPanelCopy';
import { strategicTerritoryOverlayRgba } from '@shared/utils/strategicTerritoryFlood.js';
import { isJunBattlefieldEntryCell, isJunBattlefieldInfoCell } from '@shared/utils/junBattlefieldCell.js';
import { isSan1YuLStackVoidCell } from '@shared/utils/strategicWorldMapStack.js';
import { JUN_BATTLEFIELD_FACTION_SHARE_PLACEHOLDER } from '@/utils/junBattlefieldInfoHud';

/** 叠帧明暗闪烁周期（须与 WorldStrategicMap.css `--ws-fire-flicker-cycle` 一致） */
const STRATEGIC_FIRE_FLICKER_CYCLE_S = 1.2;

/** Meowa preview 已含城/关等；运行时勿再叠 `public/assets` 战役立绘 */
function isMeowaBakedStrategicObject(objectType) {
  const o = String(objectType || '');
  return (
    o === 'city_small' ||
    o === 'city_medium' ||
    o === 'city_major' ||
    o === 'city_gate' ||
    o === 'jun_battlefield'
  );
}

function strategicFireFrameDelay(frameIndex0Based) {
  return `${-((frameIndex0Based * STRATEGIC_FIRE_FLICKER_CYCLE_S) / 12)}s`;
}

function wsTerrainFallbackClass(terrain) {
  if (terrain === 'lake') return 'ws-terrain-fallback ws-terrain-lake';
  if (terrain === 'ford') return 'ws-terrain-fallback ws-terrain-ford';
  if (terrain === 'road') return 'ws-terrain-fallback ws-terrain-road';
  return null;
}

/**
 * 战略层郡大地图单格：仅地形 / 对象 / 特效展示。
 * 与 `CampaignMapTile` 职责分离（无战役部署、无战斗引擎宿主）。
 * 浏览模式且格点属于 **`buildRoadPassableKeySetForMarch`** 可通行道路时：键鼠 **`click` `detail===2`**、触摸 **短间隔两次 `touchend`** 可请求进入行军模式（与本人叠层点「行军」等价；非道路格无效）。
 * 瓦片素材路径复用 `campaignMapVisualAssets`（与 BattleTile 同源 PNG）。
 * @param {object|null} [cityRow] - 锚点格 `cityId` 对应 `cities` 行
 * @param {{ anchorR: number, anchorC: number, anchorCell: object, footprintKind?: 'city_2x2'|'bandit_2x1'|'bandit_1x2'|'pvp_camp_1x1'|'pvp_camp_2x1'|'pvp_camp_1x2' }|null} [strategicCover] - 本格是否属于某多格战略 POI 的锚点或延伸格
 */
function WorldStrategicMapTile({
  cell,
  seed,
  gridY,
  gridX,
  onHover,
  onLeave,
  /** 'hover' | 'click' — 见 useStrategicMapTooltipClickMode */
  tooltipPointerMode = 'hover',
  onTooltipClick,
  cityRow = null,
  strategicCover = null,
  /** 势力 id → 中文名（城右上旗心文案） */
  factionNameById = null,
  /** 行军模式：在「非点击出 tooltip」的指针下仍要点格选路 */
  strategicMarchMode = false,
  /** 浏览模式：允许道路格双击 / 触摸双触请求进入行军（由格网根据 `strategicMarchMode` 等计算） */
  canRoadDoubleEnterMarch = false,
  /** `(gx, gy)` → `StrategicWorldMapSection.openMarchConfirmForStrategicCell` */
  onStrategicRoadDoubleEnterMarch = null,
  /** `buildRoadPassableKeySetForMarch` 的 Set；`null` 时不处理道路双击 */
  roadMarchPassableKeySet = null,
  /** @param {number} gx @param {number} gy */
  onStrategicMarchCellPick = null,
  playerFactionId = null,
  /** 显式盟友 `faction_id`（结盟等接入后由战役/外交注入） */
  strategicCityLabelAllyFactionIds = null,
  /** 显式非敌对 `faction_id`（停战、任务保护势力等） */
  strategicCityLabelNonHostileFactionIds = null,
  /** 道路 BFS 领土立场：`own` | `hostile` | `ally`（仅视觉叠层） */
  territoryStance = null,
  /** active 战事目标城：2×2 锚点格叠「战」字贴图 */
  showWarCityFire = false,
  /**
   * 郡战场中心信息叠层（仅左上角格传入）：`{ width, height, displayName }`
   */
  battlefieldInfoHud = null,
  /**
   * Meowa 管线：格网下已是郡 preview（yingchuan_v0.1）。
   * 跳过战役草皮/地形，以及已画进预览的城/关/据点/战场入口 PNG（`public/assets` 旧瓦片）。
   * 城势力旗、战事「战」字、领土色、匪寨/大本营叠字仍叠；语义仍来自工坊 merged。
   */
  suppressCampaignTerrain = false,
}) {
  const c = cell || {};
  const variants = useMemo(() => buildCampaignVisualVariants(seed), [seed]);
  const bgV = c.base === 'plain_wasteland' ? variants.bgWaste : variants.bgGrass;
  const bgSrc = campaignBgUrl(c.base || 'plain_grassland', bgV);
  const meowaPipelineVisual = !!suppressCampaignTerrain;
  const showCampaignTerrainLayers = !meowaPipelineVisual;

  const footprintKind = strategicCover?.footprintKind ?? null;
  const isCityFootprint2x2 = footprintKind === 'city_2x2';
  const isBanditDomino = footprintKind === 'bandit_2x1' || footprintKind === 'bandit_1x2';
  const isPvpCampDomino =
    footprintKind === 'pvp_camp_1x1' ||
    footprintKind === 'pvp_camp_2x1' ||
    footprintKind === 'pvp_camp_1x2';
  const hasMultiCellFootprint = !!(strategicCover && footprintKind);

  const anchor = strategicCover?.anchorCell;
  const effectiveObject = anchor?.object ?? c.object;
  const isAnchorTile =
    strategicCover &&
    strategicCover.anchorR === gridY &&
    strategicCover.anchorC === gridX;

  const objectSpanClass = useMemo(() => {
    if (!hasMultiCellFootprint || !isAnchorTile) return '';
    if (footprintKind === 'city_2x2') return 'ws-object-span-2';
    if (footprintKind === 'bandit_2x1' || footprintKind === 'pvp_camp_2x1') return 'ws-object-span-2x1';
    if (footprintKind === 'bandit_1x2' || footprintKind === 'pvp_camp_1x2') return 'ws-object-span-1x2';
    return '';
  }, [hasMultiCellFootprint, isAnchorTile, footprintKind]);

  const terrainSrc = campaignTerrainUrl(c.terrain, variants);
  const fallbackCls = wsTerrainFallbackClass(c.terrain);

  const objSrc = useMemo(() => {
    if (hasMultiCellFootprint && !isAnchorTile) return null;
    if (!effectiveObject) return null;
    if (meowaPipelineVisual && isMeowaBakedStrategicObject(effectiveObject)) return null;
    return campaignObjectUrl(effectiveObject);
  }, [hasMultiCellFootprint, isAnchorTile, effectiveObject, cityRow, meowaPipelineVisual]);

  const showSpanningStrategicObject = hasMultiCellFootprint && isAnchorTile && !!objSrc;
  /** 大城/中城：优先库 `city_type`，回退锚点格 `object` */
  const showCityGoldGlow = useMemo(() => {
    if (!isCityFootprint2x2 || !isAnchorTile) return false;
    const ct = String(cityRow?.city_type ?? cityRow?.cityType ?? '').trim();
    if (ct === 'city_major' || ct === 'city_medium') return true;
    return effectiveObject === 'city_major' || effectiveObject === 'city_medium';
  }, [isCityFootprint2x2, isAnchorTile, cityRow, effectiveObject]);
  /** 与 `StrategicMapSelfPawn` 道路「来战」同源：`ws-map-self-pawn-intercept-pulse` */
  const banditInterceptGlow = isBanditDomino && showSpanningStrategicObject;
  const dominoLikeLabel = isBanditDomino || isPvpCampDomino;

  const fid = cityRow?.faction_id ?? cityRow?.factionId;
  const factionHex = fid ? getFactionRepresentativeColor(fid) : null;
  const factionTintRgba = factionHex ? hexToRgba(factionHex, 0.42) : null;
  const territoryOverlayRgba = useMemo(
    () => strategicTerritoryOverlayRgba(territoryStance),
    [territoryStance],
  );
  const showLegacyFactionCityTint = isCityFootprint2x2 && factionTintRgba && !territoryOverlayRgba;

  /** 城 2×2 用右上势力旗；匪寨 / 大本营仍叠字 */
  const labelLines = useMemo(() => {
    if (!hasMultiCellFootprint || !isAnchorTile || !effectiveObject) return null;
    if (isCityFootprint2x2) return null;
    return getStrategicMapCityLabelLines(cityRow, anchor, effectiveObject);
  }, [hasMultiCellFootprint, isAnchorTile, effectiveObject, cityRow, anchor, isCityFootprint2x2]);

  const cityLabelColorStyle = useMemo(() => {
    if (!labelLines) return undefined;
    const cityFid = cityRow?.faction_id ?? cityRow?.factionId;
    const stance = getStrategicCityLabelStance({
      cityFactionId: cityFid,
      playerFactionId,
      allyFactionIds: strategicCityLabelAllyFactionIds,
      nonHostileFactionIds: strategicCityLabelNonHostileFactionIds,
    });
    return strategicCityLabelInlineColorStyle(stance);
  }, [
    labelLines,
    cityRow,
    playerFactionId,
    strategicCityLabelAllyFactionIds,
    strategicCityLabelNonHostileFactionIds,
  ]);

  const factionFlag = useMemo(() => {
    if (!isCityFootprint2x2 || !isAnchorTile) return null;
    if (!fid || fid === 'san_1_faction_0001') return null;
    const fill = factionHex || '#6b7280';
    const parts = worldMapFactionFlagPartsFromRow(cityRow, factionNameById || {});
    if (!parts) return null;
    const cityLen = Array.from(String(parts.cityName || '')).length;
    return {
      fill,
      shortChar: parts.shortChar,
      cityName: parts.cityName,
      cityLen,
      textColor: contrastTextOnFactionHex(fill),
    };
  }, [isCityFootprint2x2, isAnchorTile, fid, factionHex, cityRow, factionNameById]);

  const [bgOk, setBgOk] = useState(true);
  const [tOk, setTOk] = useState(true);
  const [oOk, setOOk] = useState(true);

  const isClickTooltip = tooltipPointerMode === 'click';
  const marchPick = !!strategicMarchMode && typeof onStrategicMarchCellPick === 'function';

  const marchRoadCellKey = `${gridX},${gridY}`;
  const isMarchRoadCell = !!(
    roadMarchPassableKeySet &&
    typeof roadMarchPassableKeySet.has === 'function' &&
    roadMarchPassableKeySet.has(marchRoadCellKey)
  );
  const needsRoadDblMarch =
    !!canRoadDoubleEnterMarch &&
    isMarchRoadCell &&
    typeof onStrategicRoadDoubleEnterMarch === 'function';

  const roadTouchDblPrevRef = useRef(0);

  const handleRoadTouchEndMarchDbl = useCallback(
    (e) => {
      if (!needsRoadDblMarch) return;
      if (e.touches && e.touches.length > 0) return;
      if (!e.changedTouches?.[0]) return;
      const now = Date.now();
      const prev = roadTouchDblPrevRef.current;
      if (prev > 0 && now - prev < 420 && now - prev > 40) {
        e.preventDefault();
        e.stopPropagation();
        roadTouchDblPrevRef.current = 0;
        onStrategicRoadDoubleEnterMarch(gridX, gridY);
      } else {
        roadTouchDblPrevRef.current = now;
      }
    },
    [needsRoadDblMarch, onStrategicRoadDoubleEnterMarch],
  );

  const handleTileStrategicClick = useCallback(
    (e) => {
      if (needsRoadDblMarch && e.detail === 2) {
        e.preventDefault();
        e.stopPropagation();
        onStrategicRoadDoubleEnterMarch(gridX, gridY);
        return;
      }
      if (marchPick || (isClickTooltip && typeof onTooltipClick === 'function')) {
        e.preventDefault();
        e.stopPropagation();
        if (marchPick) onStrategicMarchCellPick(gridX, gridY);
        else if (isClickTooltip && typeof onTooltipClick === 'function') onTooltipClick(e);
      }
    },
    [
      needsRoadDblMarch,
      onStrategicRoadDoubleEnterMarch,
      marchPick,
      isClickTooltip,
      onTooltipClick,
      onStrategicMarchCellPick,
      gridX,
      gridY,
    ],
  );

  /** 仅锚点格抬 z-index / overflow：延伸格若同权会盖住邻格溢出的 2×2 立绘（与旧 `ws-tile-object-2x2` 一致） */
  const anchorStrategicFootprintRaised = hasMultiCellFootprint && isAnchorTile;

  const isBattlefieldEntry = isJunBattlefieldEntryCell(c);
  const isBattlefieldInfo = isJunBattlefieldInfoCell(c);
  const isVoidBand = !!(c.isVoid || c.voidBand) || isSan1YuLStackVoidCell(gridX, gridY);

  return (
    <div
      className={`ws-map-tile${anchorStrategicFootprintRaised ? ' ws-tile-strategic-footprint' : ''}${
        isClickTooltip || marchPick ? ' ws-map-tile--tooltip-click' : ''
      }${isBattlefieldEntry ? ' ws-tile-jun-battlefield' : ''}${
        isBattlefieldInfo ? ' ws-tile-jun-battlefield-info' : ''
      }${isVoidBand ? ' ws-tile-void-band' : ''}`}
      data-strategic-y={gridY}
      data-strategic-x={gridX}
      data-strategic-footprint-kind={isAnchorTile && footprintKind ? footprintKind : undefined}
      data-jun-battlefield={isBattlefieldEntry || isBattlefieldInfo ? '1' : undefined}
      data-void-band={isVoidBand ? '1' : undefined}
      onMouseEnter={isClickTooltip || marchPick ? undefined : onHover}
      onMouseLeave={isClickTooltip || marchPick ? undefined : onLeave}
      onClick={
        needsRoadDblMarch || marchPick || (isClickTooltip && typeof onTooltipClick === 'function')
          ? handleTileStrategicClick
          : undefined
      }
      onTouchEnd={needsRoadDblMarch ? handleRoadTouchEndMarchDbl : undefined}
    >
      {showCampaignTerrainLayers ? (
        bgOk ? (
          <img className="ws-layer" src={bgSrc} alt="" draggable={false} onError={() => setBgOk(false)} />
        ) : (
          <div
            className="ws-layer"
            style={{
              background: c.base === 'plain_wasteland' ? '#d4c4a8' : '#7cb87c',
            }}
          />
        )
      ) : null}
      {territoryOverlayRgba ? (
        <div
          className="ws-layer ws-territory-stance-tint"
          style={{ background: territoryOverlayRgba, zIndex: 1 }}
          aria-hidden
        />
      ) : null}
      {showLegacyFactionCityTint ? (
        <div
          className="ws-layer ws-faction-bg-tint"
          style={{ background: factionTintRgba, zIndex: 1 }}
          aria-hidden
        />
      ) : null}
      {showCampaignTerrainLayers && fallbackCls ? <div className={fallbackCls} /> : null}
      {showCampaignTerrainLayers &&
        terrainSrc &&
        (tOk ? (
          <img className="ws-layer" src={terrainSrc} alt="" draggable={false} onError={() => setTOk(false)} />
        ) : (
          <div
            className="ws-layer"
            style={{
              background:
                c.terrain === 'river'
                  ? 'rgba(30,100,200,0.45)'
                  : c.terrain === 'siege'
                    ? 'rgba(101,67,33,0.5)'
                    : 'rgba(40,80,40,0.35)',
            }}
          />
        ))}
      {objSrc &&
        (oOk ? (
          <img
            className={`ws-layer${
              showSpanningStrategicObject && objectSpanClass
                ? ` ${objectSpanClass} ws-strategic-footprint-visual`
                : ''
            }${banditInterceptGlow ? ' ws-strategic-bandit-intercept-glow' : ''}${
              showCityGoldGlow ? ' ws-strategic-city-gold-object' : ''
            }`}
            src={objSrc}
            alt=""
            draggable={false}
            onError={() => setOOk(false)}
            style={{ zIndex: 2 }}
          />
        ) : (
          <div
            className={`ws-obj-fallback${
              showSpanningStrategicObject
                ? footprintKind === 'city_2x2'
                  ? ' ws-obj-fallback-2x2'
                  : footprintKind === 'bandit_2x1' || footprintKind === 'pvp_camp_2x1'
                    ? ' ws-obj-fallback-2x1'
                    : footprintKind === 'bandit_1x2' || footprintKind === 'pvp_camp_1x2'
                      ? ' ws-obj-fallback-1x2'
                      : ''
                : ''
            }${banditInterceptGlow ? ' ws-strategic-bandit-intercept-glow' : ''}`}
          >
            {effectiveObject === 'military_camp'
              ? '营'
              : effectiveObject === 'military_tower'
                ? '塔'
                : effectiveObject === 'city_medium' ||
                    effectiveObject === 'city_small' ||
                    effectiveObject === 'city_major'
                  ? '城'
                  : isBanditDomino
                      ? '寨'
                      : isPvpCampDomino
                        ? '营'
                        : '·'}
          </div>
        ))}
      {showCityGoldGlow ? (
        <div
          className="ws-layer ws-object-span-2 ws-strategic-city-gold-glow"
          aria-hidden
          style={{ zIndex: 4 }}
        >
          <div className="ws-strategic-city-gold-glow-ring" />
          <div className="ws-strategic-city-gold-glow-sheen" />
        </div>
      ) : null}
      {showWarCityFire ? (
        <div
          className="ws-layer ws-object-span-2 ws-strategic-city-war-mark"
          aria-hidden
          style={{ zIndex: 5 }}
        >
          <img
            className="ws-strategic-city-war-mark-img"
            src={STRATEGIC_WAR_ZHAN_MARK_URL}
            alt=""
            draggable={false}
          />
        </div>
      ) : null}
      {isCityFootprint2x2 &&
      isAnchorTile &&
      factionHex &&
      effectiveObject === 'city_major' ? (
        <div
          className="ws-layer ws-object-span-2 ws-faction-city-front-vignette"
          aria-hidden
          style={{
            zIndex: 3,
            pointerEvents: 'none',
            mixBlendMode: 'multiply',
            background: `radial-gradient(ellipse 88% 82% at 50% 58%, ${hexToRgba(factionHex, 0.38)} 0%, transparent 72%)`,
          }}
        />
      ) : null}
      {labelLines && (
        <div
          className={`ws-strategic-label${
            objectSpanClass && (showSpanningStrategicObject || meowaPipelineVisual)
              ? ` ${objectSpanClass}`
              : ''
          }`}
          aria-hidden
        >
          {labelLines.line1 ? (
            <div className="ws-strategic-label-type" style={cityLabelColorStyle}>
              {labelLines.line1}
            </div>
          ) : null}
          <div
            className={`ws-strategic-label-name${dominoLikeLabel ? ' ws-strategic-label-name--bandit-primary' : ''}`}
            style={cityLabelColorStyle}
          >
            {labelLines.line2}
          </div>
          {labelLines.line3 ? (
            <div className="ws-strategic-label-lord" style={cityLabelColorStyle}>
              {labelLines.line3}
            </div>
          ) : null}
        </div>
      )}
      {factionFlag ? (
        <div className="ws-strategic-faction-flag-wrap ws-object-span-2" aria-hidden>
          <div
            className={`ws-strategic-faction-flag${
              factionFlag.cityLen >= 4
                ? ' ws-strategic-faction-flag--city4'
                : factionFlag.cityLen >= 3
                  ? ' ws-strategic-faction-flag--city3'
                  : ''
            }`}
            style={{
              '--ws-flag-fill': factionFlag.fill,
              color: factionFlag.textColor,
            }}
          >
            <span className="ws-strategic-faction-flag-pole" />
            <span className="ws-strategic-faction-flag-cloth">
              <span className="ws-strategic-faction-flag-text">
                <span className="ws-strategic-faction-flag-faction">{factionFlag.shortChar}</span>
                <span className="ws-strategic-faction-flag-sep">·</span>
                <span className="ws-strategic-faction-flag-city">{factionFlag.cityName}</span>
              </span>
            </span>
          </div>
        </div>
      ) : null}
      {battlefieldInfoHud ? (
        <div
          className="ws-battlefield-info-hud"
          style={{
            width: `calc(${battlefieldInfoHud.width} * var(--ws-tile) + 1px)`,
            height: `calc(${battlefieldInfoHud.height} * var(--ws-tile) + 1px)`,
          }}
          aria-hidden
        >
          <div className="ws-battlefield-info-hud-title">{battlefieldInfoHud.displayName}</div>
          <div className="ws-battlefield-info-hud-shares">
            {JUN_BATTLEFIELD_FACTION_SHARE_PLACEHOLDER.map((s) => (
              <span key={s.key} className="ws-battlefield-info-hud-share">
                {s.label} {s.pct}%
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {c.effect === 'fire' && (
        <div className="tile-fire-fx" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <img
              key={i}
              className="tile-fire-frame"
              src={tacticalFireFrameUrl(i + 1)}
              alt=""
              draggable={false}
              style={{ animationDelay: strategicFireFrameDelay(i) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(WorldStrategicMapTile);
