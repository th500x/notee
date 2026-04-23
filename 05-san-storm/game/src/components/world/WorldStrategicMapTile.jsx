import { memo, useEffect, useMemo, useState } from 'react';
import {
  campaignBgUrl,
  campaignTerrainUrl,
  campaignObjectUrl,
  buildCampaignVisualVariants,
} from '@/utils/campaignMapVisualAssets';
import { tacticalFireFrameUrl } from '@/components/battle/battleConstants';
import {
  getFactionRepresentativeColor,
  hexToRgba,
  getStrategicFactionLogoUrl,
  getStrategicFactionMarkerCount,
} from '@/utils/strategicMapFactionColors';
import { getStrategicMapCityLabelLines } from '@/utils/strategicMapCityLabels';
import {
  getStrategicCityLabelStance,
  strategicCityLabelInlineColorStyle,
} from '@/utils/strategicMapCityLabelStance';

function wsTerrainFallbackClass(terrain) {
  if (terrain === 'lake') return 'ws-terrain-fallback ws-terrain-lake';
  if (terrain === 'ford') return 'ws-terrain-fallback ws-terrain-ford';
  if (terrain === 'road') return 'ws-terrain-fallback ws-terrain-road';
  return null;
}

/**
 * 战略层郡大地图单格：仅地形 / 对象 / 特效展示。
 * 与 `CampaignMapTile` 职责分离（无战役部署、无战斗引擎宿主）。
 * 瓦片素材路径复用 `campaignMapVisualAssets`（与 BattleTile 同源 PNG）。
 * @param {object|null} [cityRow] - 锚点格 `cityId` 对应 `cities` 行（ fort 用 `build_status` 选空置/建成图）
 * @param {{ anchorR: number, anchorC: number, anchorCell: object, footprintKind?: 'city_2x2'|'bandit_2x1'|'bandit_1x2' }|null} [strategicCover] - 本格是否属于某多格战略 POI 的锚点或延伸格
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
  /** 主城在 cityById 中挂有荒郊/集市入口时，2×2 锚点格琥珀扫光（对齐卡池入口 shimmer） */
  subsidiaryHubGlow = false,
  /** 2×2 城块「右上角」那一格：尚有探索次数时在瓦片角标红叹号 */
  exploreRemainBadge = false,
  /** 行军模式：在「非点击出 tooltip」的指针下仍要点格选路 */
  strategicMarchMode = false,
  /** @param {number} gx @param {number} gy */
  onStrategicMarchCellPick = null,
  playerFactionId = null,
  /** 显式盟友 `faction_id`（结盟等接入后由战役/外交注入） */
  strategicCityLabelAllyFactionIds = null,
  /** 显式非敌对 `faction_id`（停战、任务保护势力等） */
  strategicCityLabelNonHostileFactionIds = null,
}) {
  const c = cell || {};
  const variants = useMemo(() => buildCampaignVisualVariants(seed), [seed]);
  const bgV = c.base === 'plain_wasteland' ? variants.bgWaste : variants.bgGrass;
  const bgSrc = campaignBgUrl(c.base || 'plain_grassland', bgV);

  const footprintKind = strategicCover?.footprintKind ?? null;
  const isCityFootprint2x2 = footprintKind === 'city_2x2';
  const isBanditDomino = footprintKind === 'bandit_2x1' || footprintKind === 'bandit_1x2';
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
    if (footprintKind === 'bandit_2x1') return 'ws-object-span-2x1';
    if (footprintKind === 'bandit_1x2') return 'ws-object-span-1x2';
    return '';
  }, [hasMultiCellFootprint, isAnchorTile, footprintKind]);

  const terrainSrc = campaignTerrainUrl(c.terrain, variants);
  const fallbackCls = wsTerrainFallbackClass(c.terrain);

  const objSrc = useMemo(() => {
    if (hasMultiCellFootprint && !isAnchorTile) return null;
    if (!effectiveObject) return null;
    if (effectiveObject === 'fort' && cityRow) {
      return campaignObjectUrl('fort', {
        buildStatus: cityRow.buildStatus ?? cityRow.build_status,
      });
    }
    return campaignObjectUrl(effectiveObject);
  }, [hasMultiCellFootprint, isAnchorTile, effectiveObject, cityRow]);

  const showSpanningStrategicObject = hasMultiCellFootprint && isAnchorTile && !!objSrc;
  /** 与 `StrategicMapSelfPawn` 道路「来战」同源：`ws-map-self-pawn-intercept-pulse` */
  const banditInterceptGlow = isBanditDomino && showSpanningStrategicObject;

  const fid = cityRow?.faction_id ?? cityRow?.factionId;
  const factionHex = fid ? getFactionRepresentativeColor(fid) : null;
  const factionTintRgba = factionHex ? hexToRgba(factionHex, 0.42) : null;

  const labelLines = useMemo(() => {
    if (!hasMultiCellFootprint || !isAnchorTile || !effectiveObject) return null;
    return getStrategicMapCityLabelLines(cityRow, anchor, effectiveObject);
  }, [hasMultiCellFootprint, isAnchorTile, effectiveObject, cityRow, anchor]);

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

  const factionLogoUrl = useMemo(() => getStrategicFactionLogoUrl(fid), [fid]);
  const factionMarkerCount = useMemo(
    () => getStrategicFactionMarkerCount(cityRow, effectiveObject),
    [cityRow, effectiveObject],
  );

  const [bgOk, setBgOk] = useState(true);
  const [tOk, setTOk] = useState(true);
  const [oOk, setOOk] = useState(true);
  const [factionLogoOk, setFactionLogoOk] = useState(true);

  useEffect(() => {
    setFactionLogoOk(true);
  }, [factionLogoUrl]);

  const isClickTooltip = tooltipPointerMode === 'click';
  const marchPick = !!strategicMarchMode && typeof onStrategicMarchCellPick === 'function';

  /** 仅锚点格抬 z-index / overflow：延伸格若同权会盖住邻格溢出的 2×2 立绘（与旧 `ws-tile-object-2x2` 一致） */
  const anchorStrategicFootprintRaised = hasMultiCellFootprint && isAnchorTile;

  return (
    <div
      className={`ws-map-tile${anchorStrategicFootprintRaised ? ' ws-tile-strategic-footprint' : ''}${
        isClickTooltip || marchPick ? ' ws-map-tile--tooltip-click' : ''
      }`}
      data-strategic-y={gridY}
      data-strategic-x={gridX}
      data-strategic-footprint-kind={isAnchorTile && footprintKind ? footprintKind : undefined}
      onMouseEnter={isClickTooltip || marchPick ? undefined : onHover}
      onMouseLeave={isClickTooltip || marchPick ? undefined : onLeave}
      onClick={
        marchPick || (isClickTooltip && typeof onTooltipClick === 'function')
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (marchPick) onStrategicMarchCellPick(gridX, gridY);
              else if (isClickTooltip && typeof onTooltipClick === 'function') onTooltipClick(e);
            }
          : undefined
      }
    >
      {bgOk ? (
        <img className="ws-layer" src={bgSrc} alt="" draggable={false} onError={() => setBgOk(false)} />
      ) : (
        <div
          className="ws-layer"
          style={{
            background: c.base === 'plain_wasteland' ? '#d4c4a8' : '#7cb87c',
          }}
        />
      )}
      {isCityFootprint2x2 && factionTintRgba ? (
        <div
          className="ws-layer ws-faction-bg-tint"
          style={{ background: factionTintRgba, zIndex: 1 }}
          aria-hidden
        />
      ) : null}
      {fallbackCls && <div className={fallbackCls} />}
      {terrainSrc &&
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
      {isCityFootprint2x2 && isAnchorTile && subsidiaryHubGlow ? (
        <div
          className="ws-layer ws-object-span-2 ws-subsidiary-hub-glow"
          aria-hidden
          style={{ zIndex: 2 }}
        >
          <div className="ws-subsidiary-hub-glow-base" />
          <div className="ws-subsidiary-hub-glow-shimmer" />
        </div>
      ) : null}
      {objSrc &&
        (oOk ? (
          <img
            className={`ws-layer${
              showSpanningStrategicObject && objectSpanClass
                ? ` ${objectSpanClass} ws-strategic-footprint-visual`
                : ''
            }${banditInterceptGlow ? ' ws-strategic-bandit-intercept-glow' : ''}`}
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
                  : footprintKind === 'bandit_2x1'
                    ? ' ws-obj-fallback-2x1'
                    : footprintKind === 'bandit_1x2'
                      ? ' ws-obj-fallback-1x2'
                      : ''
                : ''
            }${banditInterceptGlow ? ' ws-strategic-bandit-intercept-glow' : ''}`}
          >
            {effectiveObject === 'military_camp'
              ? '营'
              : effectiveObject === 'military_tower'
                ? '塔'
                : effectiveObject === 'city_medium' || effectiveObject === 'city_small'
                  ? '城'
                  : effectiveObject === 'fort'
                    ? '据'
                    : isBanditDomino
                      ? '寨'
                      : '·'}
          </div>
        ))}
      {labelLines && (
        <div
          className={`ws-strategic-label${showSpanningStrategicObject && objectSpanClass ? ` ${objectSpanClass}` : ''}`}
          aria-hidden
        >
          {labelLines.line1 ? (
            <div className="ws-strategic-label-type" style={cityLabelColorStyle}>
              {labelLines.line1}
            </div>
          ) : null}
          <div
            className={`ws-strategic-label-name${isBanditDomino ? ' ws-strategic-label-name--bandit-primary' : ''}`}
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
      {isCityFootprint2x2 && isAnchorTile && factionLogoUrl && factionLogoOk ? (
        <div className="ws-strategic-faction-logo-wrap ws-object-span-2" aria-hidden>
          <div className="ws-strategic-faction-logo-stack">
            {Array.from({ length: factionMarkerCount }, (_, i) => (
              <img
                key={i}
                className="ws-strategic-faction-logo"
                src={factionLogoUrl}
                alt=""
                draggable={false}
                onError={() => setFactionLogoOk(false)}
              />
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
              style={{ animationDelay: `${-(i * 1.2) / 12}s` }}
            />
          ))}
        </div>
      )}
      {exploreRemainBadge ? (
        <span className="ws-strategic-explore-quota-badge" title="尚有探索次数" aria-hidden>
          !
        </span>
      ) : null}
      <span className="ws-quad-marker">{c.quad}</span>
    </div>
  );
}

export default memo(WorldStrategicMapTile);
