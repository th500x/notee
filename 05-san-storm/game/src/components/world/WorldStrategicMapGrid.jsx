import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import WorldStrategicMapTile from './WorldStrategicMapTile';
import { buildCampaignCellTooltipInfo } from '@/components/battle/battleConstants';
import {
  WORLD_MAP_DEFAULT_FACTION_LABELS,
  buildWorldMapCityPanelProps,
  worldMapCityIsPlayerSameFaction,
  worldMapCityTypeAllowsMainCitySet,
  worldMapRegionLabelFromRow,
  worldMapCityDefenseDisplayFromRow,
} from '@/utils/worldMapCityPanelCopy';
import {
  resolveStrategicTileCityCover,
  resolveStrategicTilePvpCampCover,
  STRATEGIC_MAP_FOOTPRINT_VISUAL_SELECTOR,
} from '@/utils/strategicMapTileContext';
import { useTileTooltipClamp } from '@/components/battle/useTileTooltipClamp';
import TileTooltipContent from '@/components/battle/TileTooltipContent';
import StrategicSiegeWarFloatingPanel from '@/components/world/StrategicSiegeWarFloatingPanel';
import StrategicPvpWarFloatingPanel from '@/components/world/StrategicPvpWarFloatingPanel';
import { useStrategicMapTooltipClickMode } from '@/hooks/useStrategicMapTooltipClickMode';
import { useStrategicMapNavigation } from '@/contexts/StrategicMapNavigationContext';
import {
  buildStrategicRoadOverlayPathD,
  ROAD_CONNECTIVITY_4,
} from '@shared/utils/strategicRoadOverlay.js';
import { isBanditMapObjectId } from '@shared/utils/smallMapEnemyRoster';
import { readStrategicCellAnchorId } from '@shared/utils/strategicCellAnchorId.js';
import { buildBattlefieldInfoHudAnchorMap } from '@/utils/junBattlefieldInfoHud';
import {
  buildRoadPassableKeySetForMarch,
  isPvpWarMarchTargetId,
} from '@shared/utils/strategicMarchPoi.js';
import {
  isBanditBattlefieldBoundPoi,
  junIdFromBanditPoiId,
  resolveBattlefieldExploreInfo,
} from '@/utils/battlefieldEntranceDual';
import { isJunBattlefieldEntryCell, isJunBattlefieldInfoCell } from '@shared/utils/junBattlefieldCell.js';
import { buildStrategicTerritoryStanceMap } from '@shared/utils/strategicTerritoryFlood.js';
import '@/components/battle/BattleMap.css';
import './WorldStrategicMap.css';
import { PHASE } from '@/components/event/EventConstants';
import { strategicExploreReopenBridge } from '@/utils/strategicExploreReopenBridge.js';
import StrategicMapSelfPawn from './StrategicMapSelfPawn';
import AdventurePanel from '@/components/game/tabs/lineup/AdventurePanel';
import ChapterStageMapPanel from '@/components/chapter/ChapterStageMapPanel';
import { usePlayerRefresh } from '@/contexts/PlayerContext';

/** PC 点击出 tooltip 时：按下先不抢 capture，平移需超过此距离再开始，避免「点格子」被当成拖拽 */
const WS_PAN_MOUSE_DRAG_THRESHOLD_PX = 5;
const WS_PAN_MOUSE_DRAG_THRESHOLD_SQ = WS_PAN_MOUSE_DRAG_THRESHOLD_PX * WS_PAN_MOUSE_DRAG_THRESHOLD_PX;

/**
 * 合并图有匪寨 **`banditPoiId`**，但郡城表 `cityById` 无该行时：用格上文案拼最小行，避免误走「城况未同步」。
 * @param {string} banditPoiId
 * @param {{ cityName?: string, city_name?: string, name?: string }|null|undefined} hintCell
 */
function syntheticBanditProgressRowFromAnchorCell(banditPoiId, hintCell) {
  const tid = String(banditPoiId || '').trim();
  const nameRaw =
    (hintCell &&
      (hintCell.battlefieldDisplayName ||
        hintCell.battlefield_display_name ||
        hintCell.cityName ||
        hintCell.city_name ||
        hintCell.name)) ||
    tid;
  const name = String(nameRaw).trim() || tid;
  return {
    banditPoiId: tid,
    bandit_poi_id: tid,
    city_name: name,
    cityName: name,
    city_type: 'bandit_camp',
    cityType: 'bandit_camp',
  };
}

/**
 * 郡战场入口四宫格：编组探险 · 事件探索 · 匪寨挑战。
 * @param {string} banditPoiId
 * @param {object|null|undefined} hintCell
 * @param {object} hd - hoverDataRef.current
 * @param {number} mapColumns
 * @param {number} mapRows
 * @param {unknown[][]} cells
 */
function buildBattlefieldEntranceDualTooltip(banditPoiId, hintCell, hd, mapColumns, mapRows, cells) {
  const anchorNorm = String(banditPoiId || '').trim();
  const standingId = String(hd.playerStandingPoiAnchorId || '').trim();
  const atThisPoi = !!anchorNorm && standingId !== '' && standingId === anchorNorm;
  const junId =
    junIdFromBanditPoiId(anchorNorm) ||
    (hintCell && (hintCell.junId || hintCell.jun_id)) ||
    null;
  const battlefieldExploreInfo = resolveBattlefieldExploreInfo(hintCell);
  /** 四宫格左下匪寨格标题（勿用战场地名「颍川战场」） */
  const banditTitle = '匪寨挑战';
  void mapColumns;
  void mapRows;
  void cells;
  void junId;

  return {
    type: 'battlefieldEntranceDual',
    interactive: true,
    uniformStrategicPanel: true,
    poiInteractionsLocked: !atThisPoi,
    banditPoiId: anchorNorm,
    banditTitle,
    playerId: hd.playerId ?? null,
    exploreInfo: battlefieldExploreInfo,
    subsidiaryExploreEmbed: hd.subsidiaryExploreEmbed ?? null,
    closeStrategicCityTooltip:
      typeof hd.closeStrategicCityTooltip === 'function' ? hd.closeStrategicCityTooltip : undefined,
    /** 探险弹层挂在地图根，勿放在 tooltip 内（关浮层会卸掉 DualPanel） */
    onOpenLineupAdventure:
      typeof hd.onOpenLineupAdventure === 'function'
        ? () => {
            hd.closeStrategicCityTooltip?.();
            hd.onOpenLineupAdventure();
          }
        : undefined,
    onOpenChapterTactical:
      typeof hd.onOpenChapterTactical === 'function'
        ? () => {
            hd.closeStrategicCityTooltip?.();
            hd.onOpenChapterTactical();
          }
        : undefined,
    onStartBanditRaid:
      atThisPoi && typeof hd.onStartBanditRaid === 'function'
        ? (payload) => {
            hd.onStartBanditRaid(payload);
            hd.closeStrategicCityTooltip?.();
          }
        : undefined,
    banditRaidStartBlockedReason:
      typeof hd.banditRaidStartBlockedReason === 'string' ? hd.banditRaidStartBlockedReason : null,
    postBanditRaidRefreshKey: Number.isFinite(Number(hd.postBanditRaidRefreshKey))
      ? Number(hd.postBanditRaidRefreshKey)
      : 0,
  };
}

/** 在合并格网上找任一绑定该匪寨的战场格（作标题 hint） */
function findBanditBattlefieldHintCell(cells, banditPoiId) {
  const id = String(banditPoiId || '').trim();
  if (!id || !cells?.length) return null;
  for (let gy = 0; gy < cells.length; gy++) {
    const row = cells[gy];
    if (!row) continue;
    for (let gx = 0; gx < row.length; gx++) {
      const cell = row[gx];
      if (!cell) continue;
      if (readStrategicCellAnchorId(cell) === id) return cell;
    }
  }
  return null;
}

/**
 * 本人立于「目标城 = 当前 tooltip 城」的 PVP 攻方大本营 footprint 时，`playerStandingPoiAnchorId` 为 `pvpWarId`，
 * 与 `anchorKey`（城 id）不等，但城备仍应视为「在本城语境」以显示三公府/驻军所等。
 *
 * @param {object} hd - hoverDataRef.current（须含 `pvpBaseCamps`）
 * @param {string} anchorNorm - 当前城 `cityId`
 */
function isStandingOwnCityLinkedPvpCampTheater(hd, anchorNorm) {
  const stand = String(hd.playerStandingPoiAnchorId || '').trim();
  const cityId = String(anchorNorm || '').trim();
  if (!stand || !cityId) return false;
  const camps = hd.pvpBaseCamps;
  if (!Array.isArray(camps) || !camps.length) return false;
  const war = camps.find((w) => String(w?.pvpWarId ?? w?.pvp_war_id ?? '').trim() === stand);
  if (!war) return false;
  const targetCityId = String(war.targetCityId ?? war.target_city_id ?? '').trim();
  return targetCityId !== '' && targetCityId === String(cityId).trim();
}

/** 路点格解析的 `pvpWarId`（`playerStandingPvpWarId`）与当前 tooltip 城为同一场战事目标城 */
function isStandingPvpWarIdLinkedToCityTooltip(hd, anchorNorm) {
  const warId = String(hd.playerStandingPvpWarId || '').trim();
  const cityId = String(anchorNorm || '').trim();
  if (!warId || !cityId) return false;
  const camps = hd.pvpBaseCamps;
  if (!Array.isArray(camps) || !camps.length) return false;
  const war = camps.find((w) => String(w?.pvpWarId ?? w?.pvp_war_id ?? '').trim() === warId);
  if (!war) return false;
  const targetCityId = String(war.targetCityId ?? war.target_city_id ?? '').trim();
  return targetCityId !== '' && targetCityId === String(cityId).trim();
}

/**
 * 守方立于攻方大本营格（`standingId` 为 pvpWarId）、点开 **该战事目标城** tooltip：城表 `faction_id` 与
 * `playerFactionId` 可能因类型/缓存不一致导致 `isOwn` 为 false，仍须能开城备（三公府/驻军所）。
 */
function canStrategicCityWarTheaterOwnActions(hd, anchorNorm) {
  if (!hd.playerId || !anchorNorm) return false;
  const stand = String(hd.playerStandingPoiAnchorId || '').trim();
  if (!isPvpWarMarchTargetId(stand)) return false;
  const camps = hd.pvpBaseCamps;
  if (!Array.isArray(camps) || !camps.length) return false;
  const war = camps.find((w) => String(w?.pvpWarId ?? w?.pvp_war_id ?? '').trim() === stand);
  if (!war) return false;
  const tid = String(war.targetCityId ?? war.target_city_id ?? '').trim();
  if (tid !== String(anchorNorm).trim()) return false;
  const defF = String(war.defenderFactionId ?? war.defender_faction_id ?? '').trim();
  const pf = String(hd.playerFactionId || '').trim();
  return defF !== '' && pf !== '' && String(defF).trim() === String(pf).trim();
}

/**
 * @param {object} row - cities 行或匪寨合成行
 * @param {string} anchorKey - 城池：`cityId`；匪寨：**`banditPoiId`**
 * @param {object} hd - hoverDataRef.current
 */
function buildStrategicWorldMapCityTooltip(row, anchorKey, hd) {
  const fb = hd.factionNameById || {};
  const statsMap = hd.garrisonStatsByCityId || {};
  const slotRaw = statsMap[anchorKey]?.slot_count;
  const slotNum = slotRaw != null ? Number(slotRaw) : null;

  const base = buildWorldMapCityPanelProps(row, {
    factionNameById: fb,
    playerFactionId: hd.playerFactionId,
    playerId: hd.playerId,
    siegeQuota: null,
    siegeLoading: hd.siegeLoading === true,
    garrisonSlotCount: Number.isFinite(slotNum) ? slotNum : null,
    cityById: hd.cityById,
  });

  const isOwn =
    !!hd.playerFactionId &&
    worldMapCityIsPlayerSameFaction(row, hd.playerFactionId);
  const canAct = !!(isOwn && hd.playerId && anchorKey && !base.isBanditStronghold);
  const standingId = String(hd.playerStandingPoiAnchorId || '').trim();
  const standWarFromCell = String(hd.playerStandingPvpWarId || '').trim();
  const anchorNorm = String(anchorKey || '').trim();
  const atThisPoiStrict = !!anchorNorm && standingId !== '' && standingId === anchorNorm;
  /** 立于攻方大本营格、tooltip 为「该战事目标城」：与城 id 不同仍视为同城语境（城备/攻打），不要求先 isOwn。 */
  const atThisPoiWarTheaterToThisCity =
    !!anchorNorm &&
    ((!!standingId &&
      isPvpWarMarchTargetId(standingId) &&
      isStandingOwnCityLinkedPvpCampTheater(hd, anchorNorm)) ||
      (!!standWarFromCell &&
        isPvpWarMarchTargetId(standWarFromCell) &&
        isStandingPvpWarIdLinkedToCityTooltip(hd, anchorNorm)));
  const atThisPoi = atThisPoiStrict || atThisPoiWarTheaterToThisCity;
  const canSetMainCity =
    canAct &&
    atThisPoi &&
    worldMapCityTypeAllowsMainCitySet(row) &&
    typeof hd.onSetMainCityRequest === 'function';

  const canOwnCityPanel = !!(
    atThisPoi &&
    (canAct || (atThisPoiWarTheaterToThisCity && canStrategicCityWarTheaterOwnActions(hd, anchorNorm)))
  );

  const canSiegeThis =
    !base.isBanditStronghold &&
    !isOwn &&
    !!hd.playerId &&
    typeof hd.onStartSiegeForCity === 'function';
  /** 立于攻方大本营 footprint 时 `playerStandingPoiAnchorId` 为 `pvpWarId`，与城 `city_id` 不等但须能点 **战事目标城** 走 `initiateAttackerCitySiege`（勿再用 `!atThisPoiWarTheaterToThisCity` 关死入口）。 */
  const canSiegeHere = !!(canSiegeThis && atThisPoi);

  /** 完整战略面板（含远距离只读）：用于 tooltip portal 粘滞悬停；与「可操作」解耦，见 `poiInteractionsLocked`。 */
  const canShowFullStrategicTooltip =
    !base.syncErrorMessage && !!anchorNorm && (!!row || base.isBanditStronghold);
  const poiInteractionsLocked = !!anchorNorm && !atThisPoi && canShowFullStrategicTooltip;

  const interactive = canShowFullStrategicTooltip;

  return {
    type: 'worldMapCity',
    interactive,
    poiInteractionsLocked,
    ...base,
    cityId: base.isBanditStronghold ? null : anchorKey,
    banditPoiId: base.isBanditStronghold ? base.banditPoiId ?? anchorKey : base.banditPoiId ?? null,
    factionDisplayMap: { ...WORLD_MAP_DEFAULT_FACTION_LABELS, ...fb },
    onStartSiege:
      canSiegeHere
        ? () => {
            hd.onStartSiegeForCity(anchorKey, row);
            hd.closeStrategicCityTooltip?.();
          }
        : undefined,
    showOwnCityActions: canOwnCityPanel,
    subsidiaryExploreEmbed: hd.subsidiaryExploreEmbed ?? null,
    closeStrategicCityTooltip:
      typeof hd.closeStrategicCityTooltip === 'function' ? hd.closeStrategicCityTooltip : undefined,
    ...(canSetMainCity
      ? {
          mainCityId: hd.playerMainCityId ?? null,
          mainCityChangedAt: hd.playerMainCityChangedAt ?? null,
          playerSilver: hd.playerSilver ?? null,
          onSetMainCityRequest: hd.onSetMainCityRequest,
          onSetMainCityError: hd.onSetMainCityError,
          onOpenBarracksPost:
            typeof hd.onOpenBarracksPost === 'function'
              ? () => {
                  hd.onOpenBarracksPost(anchorKey, base.cityBaseName);
                  hd.closeStrategicCityTooltip?.();
                }
              : undefined,
          onOpenSanGongFu:
            typeof hd.onOpenSanGongFu === 'function'
              ? () => {
                  hd.onOpenSanGongFu(anchorKey, base.cityBaseName);
                  hd.closeStrategicCityTooltip?.();
                }
              : undefined,
        }
      : {}),
    /** 战略地图：外框 295×395px 写死（BattleMap.css） */
    uniformStrategicPanel: true,
    onStartBanditRaid:
      base.isBanditStronghold && atThisPoi && typeof hd.onStartBanditRaid === 'function'
        ? (payload) => {
            hd.onStartBanditRaid(payload);
            hd.closeStrategicCityTooltip?.();
          }
        : undefined,
    banditRaidStartBlockedReason:
      base.isBanditStronghold && typeof hd.banditRaidStartBlockedReason === 'string'
        ? hd.banditRaidStartBlockedReason
        : null,
    postBanditRaidRefreshKey:
      base.isBanditStronghold && Number.isFinite(Number(hd.postBanditRaidRefreshKey))
        ? Number(hd.postBanditRaidRefreshKey)
        : 0,
  };
}

/**
 * PVP 攻方大本营：复用 `WorldMapCityInfoBlock` 城备布局；长官=战事发起人，驻地固定为无。
 * **守方攻打**：须本人路点锚在 **该战事目标城** `targetCityId`（战事城池）格网内；在毗邻道路或仅 hover 大本营格而未到目标城时不出击按钮。
 *
 * @param {object} warSlice - `listWars` 与 `base_camp` 合并切片（含 `pvpWarId`、`targetCityId`、`sideStats` 等）
 * @param {object} hd - `hoverDataRef.current`
 */
function buildStrategicPvpBaseCampTooltip(warSlice, hd) {
  const fb = hd.factionNameById || {};
  const row = hd.cityById?.[warSlice.targetCityId] || null;
  const regionLabel = row ? worldMapRegionLabelFromRow(row) : '';
  const defFid = String(warSlice.defenderFactionId ?? warSlice.defender_faction_id ?? '').trim();
  const attFid = String(warSlice.attackerFactionId ?? warSlice.attacker_faction_id ?? '').trim();
  const playerFid = String(hd.playerFactionId || '').trim();
  const isDef = !!(playerFid && playerFid === defFid);
  const isAtt = !!(playerFid && playerFid === attFid);
  const pvpId = String(warSlice.pvpWarId || '').trim();
  /** 守方须立于该战事 **目标城**（`targetCityId`）格网内方可攻打攻方大本营；毗邻道路或非战事城均不可。 */
  const targetCityId = String(warSlice.targetCityId ?? warSlice.target_city_id ?? '').trim();
  const standPoi = String(hd.playerStandingPoiAnchorId || '').trim();
  const atWarTheaterCity = !!(isDef && targetCityId && standPoi === targetCityId);
  const canStrike =
    isDef &&
    atWarTheaterCity &&
    hd.playerId &&
    typeof hd.onStartPvpBaseCampSiege === 'function' &&
    String(warSlice.status || 'active') === 'active';

  const proposer = warSlice.sideStats?.proposer;
  const lord =
    (proposer?.displayName && String(proposer.displayName).trim()) ||
    warSlice.attackerFactionName ||
    fb[attFid] ||
    WORLD_MAP_DEFAULT_FACTION_LABELS[attFid] ||
    '—';

  /** 标题后缀：守方看出击指引；攻方看己方营；其余势力看敌方营 */
  let siegeTargetLabel = '敌方营地';
  if (isDef) {
    siegeTargetLabel = atWarTheaterCity ? '可出击' : '请抵达目标城（战事城池）';
  } else if (isAtt) {
    siegeTargetLabel = '我方营地';
  }

  return {
    type: 'worldMapCity',
    interactive: true,
    poiInteractionsLocked: isDef && !atWarTheaterCity,
    uniformStrategicPanel: true,
    pvpAttackerBaseCampStrategic: true,
    pvpWarId: pvpId,
    siegeQuotaCityId: warSlice.targetCityId,
    cityId: null,
    banditPoiId: null,
    cityTitle: warSlice.warName || '攻方营寨',
    subtitleText: null,
    siegeTargetLabel,
    lordDisplayLabel: lord,
    factionId: attFid || null,
    factionLabel:
      warSlice.attackerFactionName || fb[attFid] || WORLD_MAP_DEFAULT_FACTION_LABELS[attFid] || '—',
    regionLabel,
    cityDefenseCoefficient: worldMapCityDefenseDisplayFromRow(row),
    npcAlive: warSlice.npcAlive,
    npcTotal: warSlice.npcTotal != null ? warSlice.npcTotal : '?',
    garrisonSlotCount: null,
    garrisonCap: null,
    syncErrorMessage: null,
    siegeLoading: hd.siegeLoading === true,
    playerId: hd.playerId,
    showOwnCityActions: false,
    cityBaseName: '营',
    onStartSiege:
      canStrike && pvpId
        ? () => {
            hd.onStartPvpBaseCampSiege(pvpId, warSlice);
            hd.closeStrategicCityTooltip?.();
          }
        : undefined,
    factionDisplayMap: { ...WORLD_MAP_DEFAULT_FACTION_LABELS, ...fb },
    subsidiaryExploreEmbed: null,
    closeStrategicCityTooltip: hd.closeStrategicCityTooltip,
  };
}

/**
 * 战略层郡大地图格网（颍川 16×40；豫州 L 形叠图 32×60 等）。
 * 与 `CampaignMapGrid` 分离：无战役部署、无部队层、无战斗引擎。
 * Tooltip：城池有 **`cityId`** 且在 `cityById` 有行时，与 `WorldMapCityInfoBlock` 同款（驻地编组 / 设为主城 / 攻城等）。
 * 匪寨用格上 **`banditPoiId`**（`readStrategicCellAnchorId`）；可无表行：合成最小行走匪寨专用面板。
 */
export default function WorldStrategicMapGrid({
  cells,
  seed,
  mapColumns = 32,
  mapRows = 40,
  title = null,
  meta = null,
  tilePx = 20,
  setTilePx = null,
  minTilePx = 12,
  maxTilePx = 56,
  onWheelZoomSteps = null,
  cityById = null,
  factionNameById = null,
  playerId = null,
  playerFactionId = null,
  siegeLoading = false,
  onStartSiegeForCity = null,
  garrisonStatsByCityId = null,
  /** `bumpGarrisonStats` 递增；驻地变更后须重建当前城池 tooltip */
  garrisonStatsRefreshKey = 0,
  subsidiaryExploreEmbed = null,
  playerMainCityId = null,
  playerMainCityChangedAt = null,
  playerSilver = null,
  onSetMainCityRequest = null,
  onSetMainCityError = null,
  onOpenBarracksPost = null,
  onOpenSanGongFu = null,
  /** 郡内道路格（merged.json）；仅展示，寻路以同数据为准 */
  roadCells = null,
  /** `'4'` 四连通 | `'8'` 八连通（画线邻接与此一致） */
  roadConnectivity = ROAD_CONNECTIVITY_4,
  /** 城名标签：显式盟友 `faction_id`（结盟接入后由上层传入） */
  strategicCityLabelAllyFactionIds = null,
  /** 城名标签：显式非敌对 `faction_id` */
  strategicCityLabelNonHostileFactionIds = null,
  /**
   * 全屏浮层（三公府 / 驻地编组 / 军营）打开或刚关闭时：强制收起 portal 城池 tooltip。
   * 避免 `tile-tooltip--interactive`（高 z、pointer-events:auto）在触屏上继续吃掉阳翟 2×2 的首笔触摸。
   */
  strategicFullScreenOverlayOpen = false,
  /** 玩家自身标记（主城块中心；见 31-6 §9）：`cx, cy, portraitUrl, displayName, centerGlyph, troopsCurrent, troopsMax` */
  strategicSelfPawn = null,
  /** 郡内在线他人道路 pawn 列表（31-6 §9.2、02 §2.1.2（3））；`road-presence` 结果 */
  strategicOtherPawns = null,
  /** 郡内 road_encounters 锁格列表（status IN ('pending','fighting')）；用于高亮与落点禁区提示 */
  strategicRoadLockedCells = null,
  /** 战略行军模式（本人叠层「行军」入口；道路选点 / road/move 接续开发） */
  strategicMarchMode = false,
  /** `road/move` 成功后跳跳棋逐格回放中：禁行军格点选与再次进入行军 */
  strategicRoadMarchAnimating = false,
  /**
   * 合并格网下玩家当前是否立于 **POI 占地块内**：城池 `city_id` 或匪寨 **`banditPoiId`**；
   * 纯道路格为 `''`（城 2×2 / 郡战场入口等「可通行但仍属 POI」例外由立足解析处理）。
   * 由 `StrategicWorldMapSection` 用 `resolveMergedStandpointStrategicPoiAnchorId` 计算（行军动画步与 profile 路点优先一致）。
   */
  playerStandingPoiAnchorId = '',
  /**
   * 本人当前立足格 `{ gx, gy }`（与 `playerStandingPoiAnchorId` 同源）；
   * 郡战场双面板仅允许点击**本格入口**打开。
   */
  playerStandingGridCell = null,
  onStrategicSelfMarchModeRequest = null,
  onStrategicSelfMarchModeExit = null,
  /** 行军模式下点击道路格 `(gridX, gridY)`（与 `data-strategic-x/y` 一致） */
  onStrategicMarchCellPick = null,
  /**
   * 道路格双击 / 触摸双触：直接打开沿路移动确认（与寻路预览同源；不经底栏说明条）。
   * @param {number} gx
   * @param {number} gy
   */
  onStrategicRoadDoubleMarchToCell = null,
  /** 道路开战模式切换成功后刷新档案（`road_intercept` / 银两） */
  onStrategicRoadSelfUpdated = null,
  /** 匪寨爬塔：扣次成功后由上层打开 `BattleArena`（payload 含 smallMapPveLoot / enemySlotRarities） */
  onStartBanditRaid = null,
  /** 与攻城相同的战略门闸文案；有值时 tooltip 内攻打按钮旁展示 */
  banditRaidStartBlockedReason = null,
  postBanditRaidRefreshKey = 0,
  /** 活跃 PVP 战事攻方大本营切片（由 `StrategicWorldMapSection` 轮询 `warAPI.listWars` 注入） */
  pvpBaseCamps = [],
  /** 全郡 active 战事目标城 `city_id` 列表（PVP + PVE；格网着火特效） */
  activeWarTargetCityIds = null,
  /** 本人路点落在大本营 footprint 内时的 `pvpWarId`（行军终点 / 格上网锚点等） */
  playerStandingPvpWarId = '',
  /** 守方在大本营面板发起攻打：`(pvpWarId, warSlice) => void`（须已立于战事目标城，见 `buildStrategicPvpBaseCampTooltip`） */
  onStartPvpBaseCampSiege = null,
  /**
   * Meowa 郡预览底板（相对格网左上角）：`{ junId, url, col0, row0, cols, rows }[]`
   * 有值时该矩形内格跳过战役草皮/地形，显示 preview.png。
   */
  meowaUnderlays = null,
}) {
  const meowaUnderlayList = useMemo(
    () => (Array.isArray(meowaUnderlays) ? meowaUnderlays.filter((u) => u?.url) : []),
    [meowaUnderlays],
  );
  const useMeowaUnderlay = meowaUnderlayList.length > 0;

  const cellHasMeowaUnderlay = useCallback(
    (gx, gy) => {
      if (!useMeowaUnderlay) return false;
      for (const u of meowaUnderlayList) {
        const c0 = Number(u.col0) || 0;
        const r0 = Number(u.row0) || 0;
        const cols = Number(u.cols) || 0;
        const rows = Number(u.rows) || 0;
        if (gx >= c0 && gx < c0 + cols && gy >= r0 && gy < r0 + rows) return true;
      }
      return false;
    },
    [useMeowaUnderlay, meowaUnderlayList],
  );
  const strategicNav = useStrategicMapNavigation();
  const tooltipClickMode = useStrategicMapTooltipClickMode();
  const [tooltipContent, setTooltipContent] = useState(null);
  /** 编组探险 / 章节弹层：须挂在 tooltip 外，关入口浮层后仍可打开 */
  const [lineupAdventureOpen, setLineupAdventureOpen] = useState(false);
  const [chapterTacticalOpen, setChapterTacticalOpen] = useState(false);
  const refreshPlayer = usePlayerRefresh();
  const onOpenLineupAdventure = useCallback(() => {
    setLineupAdventureOpen(true);
  }, []);
  const onOpenChapterTactical = useCallback(() => {
    setChapterTacticalOpen(true);
  }, []);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const tooltipContentRef = useRef(null);
  tooltipContentRef.current = tooltipContent;
  const lastTooltipAnchorKeyRef = useRef(null);
  const { tooltipRef, tooltipStyle } = useTileTooltipClamp(tooltipContent, tooltipPos);
  const wrapRef = useRef(null);
  const zoomRef = useRef(onWheelZoomSteps);
  zoomRef.current = onWheelZoomSteps;
  const tilePxRef = useRef(tilePx);
  tilePxRef.current = tilePx;
  const minTileRef = useRef(minTilePx);
  minTileRef.current = minTilePx;
  const maxTileRef = useRef(maxTilePx);
  maxTileRef.current = maxTilePx;
  /** 缩放前：视口中心对应格网内归一化坐标，layout 后滚回该点到屏幕中央 */
  const zoomAnchorRef = useRef(null);
  const [draggingPan, setDraggingPan] = useState(false);
  const panRef = useRef(null);

  const captureZoomAnchorAtViewportCenter = useCallback(() => {
    const w = wrapRef.current;
    const grid = w?.querySelector?.('.ws-map-grid');
    if (!w || !grid) return;
    const wr = w.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    const gw = Math.max(1, gr.width);
    const gh = Math.max(1, gr.height);
    zoomAnchorRef.current = {
      fx: Math.min(1, Math.max(0, (wr.left + wr.width / 2 - gr.left) / gw)),
      fy: Math.min(1, Math.max(0, (wr.top + wr.height / 2 - gr.top) / gh)),
    };
  }, []);

  const hoverGenRef = useRef(0);
  const leaveTooltipTimerRef = useRef(null);
  const tooltipInteractiveRef = useRef(false);
  tooltipInteractiveRef.current = !!tooltipContent?.interactive;

  const hoverDataRef = useRef({});
  /** 战略城池 tooltip 打开时记录锚点，便于 profile 刷新后重建内容（否则 mainCityId 等仍是快照） */
  const strategicCityTooltipMetaRef = useRef({ cityId: null, banditPoiId: null });

  /**
   * 探索结算关弹窗后，浏览器常把同一指针的后续 click 落在底下的战略格上；在「点击模式」下会触发
   * `handleWrapClickCapture` 关层，或命中「同城再点关层」分支。用内嵌的 `subsidiaryExploreEmbed.phase`
   * 在 REWARD→RETURNING、RETURNING→IDLE 后短窗内禁止这两种误关。
   */
  const explorePhaseSyncRef = useRef(subsidiaryExploreEmbed?.phase);
  const suppressStrategicCityClickDismissUntilRef = useRef(0);

  const clearLeaveTooltipTimer = useCallback(() => {
    if (leaveTooltipTimerRef.current != null) {
      clearTimeout(leaveTooltipTimerRef.current);
      leaveTooltipTimerRef.current = null;
    }
  }, []);

  const dismissTooltip = useCallback(() => {
    hoverGenRef.current += 1;
    lastTooltipAnchorKeyRef.current = null;
    strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: null };
    setTooltipContent(null);
  }, []);

  const scheduleTooltipHide = useCallback(
    (delayMs) => {
      clearLeaveTooltipTimer();
      if (delayMs <= 0) {
        dismissTooltip();
        return;
      }
      leaveTooltipTimerRef.current = setTimeout(() => {
        leaveTooltipTimerRef.current = null;
        dismissTooltip();
      }, delayMs);
    },
    [clearLeaveTooltipTimer, dismissTooltip],
  );

  const closeTooltipNow = useCallback(() => {
    clearLeaveTooltipTimer();
    dismissTooltip();
  }, [clearLeaveTooltipTimer, dismissTooltip]);

  hoverDataRef.current = {
    cells,
    cityById,
    factionNameById,
    playerId,
    playerFactionId,
    siegeLoading,
    onStartSiegeForCity,
    garrisonStatsByCityId,
    subsidiaryExploreEmbed,
    closeStrategicCityTooltip: closeTooltipNow,
    onOpenLineupAdventure,
    onOpenChapterTactical,
    playerMainCityId,
    playerMainCityChangedAt,
    playerSilver,
    onSetMainCityRequest,
    onSetMainCityError,
    onOpenBarracksPost,
    onOpenSanGongFu,
    onStartBanditRaid,
    banditRaidStartBlockedReason,
    postBanditRaidRefreshKey,
    playerStandingPoiAnchorId,
    playerStandingPvpWarId,
    onStartPvpBaseCampSiege,
    pvpBaseCamps,
  };

  const scheduleLeaveFromTile = useCallback(() => {
    const ms = tooltipInteractiveRef.current ? 220 : 80;
    scheduleTooltipHide(ms);
  }, [scheduleTooltipHide]);

  /**
   * 战略格城池 / 战场双面板浮层：禁止仅靠「指针离开瓦片 / 离开 portal / 离开地图滚动区」
   * 触发延时关层。否则探索结束底栏重现、Clamp 重算位置、瓦片与 portal 间移动等都会产生 mouseleave，
   * 约 80～260ms 后误关浮层，玩家误以为被踢回「纯大地图」。
   */
  const scheduleLeaveFromTileIfAllowed = useCallback(() => {
    const tc = tooltipContentRef.current;
    if (tc?.type === 'worldMapCity' && tc?.uniformStrategicPanel && tc?.interactive) return;
    if (tc?.type === 'battlefieldEntranceDual' && tc?.interactive) return;
    scheduleLeaveFromTile();
  }, [scheduleLeaveFromTile]);

  const scheduleLeaveFromWrap = useCallback(() => {
    const tc = tooltipContentRef.current;
    if (tc?.type === 'worldMapCity' && tc?.uniformStrategicPanel && tc?.interactive) return;
    if (tc?.type === 'battlefieldEntranceDual' && tc?.interactive) return;
    const ms = tooltipInteractiveRef.current ? 260 : 0;
    scheduleTooltipHide(ms);
  }, [scheduleTooltipHide]);

  useEffect(() => () => clearLeaveTooltipTimer(), [clearLeaveTooltipTimer]);

  const prevStrategicOverlayRef = useRef(false);
  useEffect(() => {
    const on = !!strategicFullScreenOverlayOpen;
    const was = prevStrategicOverlayRef.current;
    prevStrategicOverlayRef.current = on;
    if (on) {
      closeTooltipNow();
      return;
    }
    if (was) closeTooltipNow();
  }, [strategicFullScreenOverlayOpen, closeTooltipNow]);

  useEffect(() => {
    const m = strategicCityTooltipMetaRef.current;
    if (!m.cityId && !m.banditPoiId) return;
    const tc = tooltipContentRef.current;
    if (!tc) return;
    const hd = hoverDataRef.current;
    if (m.cityId) {
      if (tc.type !== 'worldMapCity') return;
      const row = hd.cityById?.[m.cityId];
      if (row) {
        setTooltipContent(buildStrategicWorldMapCityTooltip(row, m.cityId, hd));
      }
      return;
    }
    if (m.banditPoiId && isBanditMapObjectId(m.banditPoiId)) {
      const bf =
        tc.type === 'battlefieldEntranceDual' ||
        isBanditBattlefieldBoundPoi(cells, m.banditPoiId, mapColumns, mapRows);
      if (bf) {
        const hint =
          findBanditBattlefieldHintCell(cells, m.banditPoiId) || {
            cityName: tc.banditTitle || tc.cityTitle,
            city_name: tc.banditTitle || tc.cityTitle,
          };
        setTooltipContent(
          buildBattlefieldEntranceDualTooltip(m.banditPoiId, hint, hd, mapColumns, mapRows, cells),
        );
        return;
      }
      if (tc.type !== 'worldMapCity') return;
      const hint = { cityName: tc.cityTitle, city_name: tc.cityTitle };
      const synth = syntheticBanditProgressRowFromAnchorCell(m.banditPoiId, hint);
      setTooltipContent(buildStrategicWorldMapCityTooltip(synth, m.banditPoiId, hd));
    }
  }, [
    cells,
    mapColumns,
    mapRows,
    cityById,
    playerMainCityId,
    playerMainCityChangedAt,
    playerSilver,
    subsidiaryExploreEmbed,
    garrisonStatsByCityId,
    garrisonStatsRefreshKey,
    siegeLoading,
    onOpenBarracksPost,
    onOpenSanGongFu,
    onStartBanditRaid,
    banditRaidStartBlockedReason,
    postBanditRaidRefreshKey,
    playerStandingPoiAnchorId,
    playerStandingPvpWarId,
    pvpBaseCamps,
  ]);

  /** 立足战场**入口格**：自动打开匪寨+战场探索并排面板（信息区不弹；行军动画中不弹，落定后开） */
  const prevBattlefieldStandRef = useRef('');
  useEffect(() => {
    if (strategicRoadMarchAnimating) return;
    if (!cells?.length) return;

    const stand = String(playerStandingPoiAnchorId || '').trim();
    const sgx = Number(playerStandingGridCell?.gx);
    const sgy = Number(playerStandingGridCell?.gy);
    const standCell =
      Number.isFinite(sgx) && Number.isFinite(sgy) ? cells[sgy]?.[sgx] : null;
    const onEntry =
      !!stand &&
      isBanditMapObjectId(stand) &&
      isBanditBattlefieldBoundPoi(cells, stand, mapColumns, mapRows) &&
      isJunBattlefieldEntryCell(standCell);
    const standKey = onEntry ? `${stand}@${sgx},${sgy}` : '';

    const hd = hoverDataRef.current;
    const prev = prevBattlefieldStandRef.current;

    if (!onEntry) {
      if (prev && tooltipContentRef.current?.type === 'battlefieldEntranceDual') {
        closeTooltipNow();
      }
      prevBattlefieldStandRef.current = '';
      return;
    }

    // 仅在「新抵达该入口格」时自动打开
    if (prev === standKey) return;
    prevBattlefieldStandRef.current = standKey;

    const hint = standCell || findBanditBattlefieldHintCell(cells, stand);
    clearLeaveTooltipTimer();
    lastTooltipAnchorKeyRef.current = `banditEntry:${sgx},${sgy}`;
    strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: stand };
    const w = wrapRef.current;
    let px = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    let py = typeof window !== 'undefined' ? window.innerHeight * 0.38 : 0;
    if (w) {
      const wr = w.getBoundingClientRect();
      px = wr.left + wr.width / 2;
      py = wr.top + Math.min(180, wr.height * 0.35);
    }
    setTooltipPos({ x: px, y: py });
    setTooltipContent(
      buildBattlefieldEntranceDualTooltip(stand, hint, hd, mapColumns, mapRows, cells),
    );
  }, [
    playerStandingPoiAnchorId,
    playerStandingGridCell,
    strategicRoadMarchAnimating,
    cells,
    mapColumns,
    mapRows,
    closeTooltipNow,
    clearLeaveTooltipTimer,
  ]);

  useEffect(() => {
    if (!strategicNav?.registerResolveStrategicAnchorForCityId) return undefined;
    const resolveStrategicAnchorForCityId = (cityId) => {
      const id = String(cityId || '').trim();
      if (!id || !cells?.length) return null;
      for (let ri = 0; ri < cells.length; ri++) {
        const row = cells[ri];
        if (!row) continue;
        for (let ci = 0; ci < row.length; ci++) {
          const cell = row[ci];
          if (cell && readStrategicCellAnchorId(cell) === id) {
            return { gx: ci, gy: ri };
          }
        }
      }
      return null;
    };
    return strategicNav.registerResolveStrategicAnchorForCityId(resolveStrategicAnchorForCityId);
  }, [strategicNav, cells]);

  useEffect(() => {
    if (!strategicNav?.registerScrollToStrategicCell) return undefined;
    /**
     * 将 .ws-map-wrap 滚到以 (gx,gy) 为左上锚点的格（含 2×2 城块中心）。
     * 优先用瓦片 DOM + getBoundingClientRect，避免格网 gap:1px、flex 居中内层与纯公式不一致导致「闪一下又回弹」。
     */
    const scrollToStrategicCell = (gx, gy) => {
      const applyScroll = () => {
        const w = wrapRef.current;
        if (!w) return;
        let cx = Number(gx);
        let cy = Number(gy);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;
        cx = Math.max(0, Math.min(cx, mapColumns - 1));
        cy = Math.max(0, Math.min(cy, mapRows - 1));

        const vw = w.clientWidth;
        const vh = w.clientHeight;
        const maxSl = Math.max(0, w.scrollWidth - vw);
        const maxSt = Math.max(0, w.scrollHeight - vh);

        const tile = w.querySelector(
          `.ws-map-grid .ws-map-tile[data-strategic-x="${cx}"][data-strategic-y="${cy}"]`,
        );
        if (tile instanceof HTMLElement) {
          const wr = w.getBoundingClientRect();
          const spanEl =
            tile.querySelector(STRATEGIC_MAP_FOOTPRINT_VISUAL_SELECTOR) ||
            tile.querySelector('.ws-object-span-2, .ws-object-span-2x1, .ws-object-span-1x2');
          const tr =
            spanEl instanceof HTMLElement ? spanEl.getBoundingClientRect() : tile.getBoundingClientRect();
          const tileCenterX = tr.left + tr.width / 2 - wr.left + w.scrollLeft;
          const tileCenterY = tr.top + tr.height / 2 - wr.top + w.scrollTop;
          w.scrollLeft = Math.max(0, Math.min(tileCenterX - vw / 2, maxSl));
          w.scrollTop = Math.max(0, Math.min(tileCenterY - vh / 2, maxSt));
          return;
        }

        const t = tilePxRef.current;
        const gap = useMeowaUnderlay ? 0 : 1;
        const cellStride = t + gap;
        const centerX = cx * cellStride + (2 * t + gap) / 2;
        const centerY = cy * cellStride + (2 * t + gap) / 2;
        w.scrollLeft = Math.max(0, Math.min(centerX - vw / 2, maxSl));
        w.scrollTop = Math.max(0, Math.min(centerY - vh / 2, maxSt));
      };

      applyScroll();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyScroll();
          setTimeout(applyScroll, 0);
        });
      });
    };
    return strategicNav.registerScrollToStrategicCell(scrollToStrategicCell);
  }, [strategicNav, mapColumns, mapRows, useMeowaUnderlay]);

  /** 缩略图视口框：读/写当前可见格范围（与 `.ws-map-wrap` 滚动联动） */
  useEffect(() => {
    if (!strategicNav?.registerStrategicViewportApi) return undefined;
    const CELL_GAP = useMeowaUnderlay ? 0 : 1;

    const getViewport = () => {
      const w = wrapRef.current;
      const gridEl = w?.querySelector?.('.ws-map-grid');
      if (!w || !(gridEl instanceof HTMLElement)) return null;
      const stride = Math.max(1, (tilePxRef.current || 20) + CELL_GAP);
      const wRect = w.getBoundingClientRect();
      const gRect = gridEl.getBoundingClientRect();
      let gx = (wRect.left - gRect.left) / stride;
      let gy = (wRect.top - gRect.top) / stride;
      let gw = wRect.width / stride;
      let gh = wRect.height / stride;
      if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(gw) || !Number.isFinite(gh)) {
        return null;
      }
      gw = Math.max(0.5, Math.min(gw, mapColumns));
      gh = Math.max(0.5, Math.min(gh, mapRows));
      gx = Math.max(0, Math.min(gx, Math.max(0, mapColumns - gw)));
      gy = Math.max(0, Math.min(gy, Math.max(0, mapRows - gh)));
      return { gx, gy, gw, gh };
    };

    const setViewportTopLeft = (gxIn, gyIn) => {
      const w = wrapRef.current;
      const gridEl = w?.querySelector?.('.ws-map-grid');
      if (!w || !(gridEl instanceof HTMLElement)) return;
      const stride = Math.max(1, (tilePxRef.current || 20) + CELL_GAP);
      const cur = getViewport();
      if (!cur) return;
      let gx = Number(gxIn);
      let gy = Number(gyIn);
      if (!Number.isFinite(gx) || !Number.isFinite(gy)) return;
      gx = Math.max(0, Math.min(gx, Math.max(0, mapColumns - cur.gw)));
      gy = Math.max(0, Math.min(gy, Math.max(0, mapRows - cur.gh)));
      const maxSl = Math.max(0, w.scrollWidth - w.clientWidth);
      const maxSt = Math.max(0, w.scrollHeight - w.clientHeight);
      w.scrollLeft = Math.max(0, Math.min(w.scrollLeft + (gx - cur.gx) * stride, maxSl));
      w.scrollTop = Math.max(0, Math.min(w.scrollTop + (gy - cur.gy) * stride, maxSt));
    };

    const api = {
      getViewport,
      setViewportTopLeft,
      getMapSize: () => ({ mapColumns, mapRows }),
    };
    const unregister = strategicNav.registerStrategicViewportApi(api);

    const w = wrapRef.current;
    const onScrollOrResize = () => {
      strategicNav.notifyStrategicViewportChanged?.();
    };
    w?.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    const ro =
      typeof ResizeObserver !== 'undefined' && w
        ? new ResizeObserver(onScrollOrResize)
        : null;
    if (ro && w) ro.observe(w);

    onScrollOrResize();

    return () => {
      unregister?.();
      w?.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      ro?.disconnect();
    };
  }, [strategicNav, mapColumns, mapRows, tilePx, useMeowaUnderlay]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      const zoomFn = zoomRef.current;
      if (typeof zoomFn !== 'function') return;
      e.preventDefault();
      e.stopPropagation();
      const steps = e.deltaY > 0 ? -1 : 1;
      captureZoomAnchorAtViewportCenter();
      zoomFn(steps);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [captureZoomAnchorAtViewportCenter]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof setTilePx !== 'function') return undefined;
    let pinch0 = null;
    const clamp = (v) =>
      Math.min(maxTileRef.current, Math.max(minTileRef.current, Math.round(v)));

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinch0 = { d0: Math.max(1, Math.hypot(dx, dy)), tile0: tilePxRef.current };
        captureZoomAnchorAtViewportCenter();
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || !pinch0) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const next = pinch0.tile0 * (d / pinch0.d0);
      captureZoomAnchorAtViewportCenter();
      setTilePx(clamp(next));
    };
    const endPinch = (e) => {
      if (e.touches.length < 2) pinch0 = null;
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', endPinch);
    el.addEventListener('touchcancel', endPinch);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', endPinch);
      el.removeEventListener('touchcancel', endPinch);
    };
  }, [setTilePx, captureZoomAnchorAtViewportCenter]);

  /** 缩放后把「缩放前视口中心」对应的格网点滚回屏幕中央 */
  useLayoutEffect(() => {
    const a = zoomAnchorRef.current;
    if (!a) return;
    zoomAnchorRef.current = null;
    const w = wrapRef.current;
    const grid = w?.querySelector?.('.ws-map-grid');
    if (!w || !grid) return;
    const wr = w.getBoundingClientRect();
    const gr = grid.getBoundingClientRect();
    const gridLeftInContent = w.scrollLeft + (gr.left - wr.left);
    const gridTopInContent = w.scrollTop + (gr.top - wr.top);
    const pointX = a.fx * grid.offsetWidth;
    const pointY = a.fy * grid.offsetHeight;
    const maxSl = Math.max(0, w.scrollWidth - w.clientWidth);
    const maxSt = Math.max(0, w.scrollHeight - w.clientHeight);
    w.scrollLeft = Math.max(0, Math.min(gridLeftInContent + pointX - w.clientWidth / 2, maxSl));
    w.scrollTop = Math.max(0, Math.min(gridTopInContent + pointY - w.clientHeight / 2, maxSt));
  }, [tilePx]);

  const endPan = useCallback((e) => {
    const p = panRef.current;
    const w = wrapRef.current;
    const pid = e?.pointerId ?? p?.pid;
    if (p && w && pid != null) {
      try {
        w.releasePointerCapture(pid);
      } catch {
        /* ignore */
      }
    }
    panRef.current = null;
    setDraggingPan(false);
  }, []);

  const onPointerDownPan = useCallback(
    (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const w = wrapRef.current;
      if (!w) return;
      const deferDrag = tooltipClickMode;
      panRef.current = {
        x: e.clientX,
        y: e.clientY,
        sl: w.scrollLeft,
        st: w.scrollTop,
        pid: e.pointerId,
        dragActive: !deferDrag,
      };
      if (!deferDrag) {
        setDraggingPan(true);
        try {
          w.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [tooltipClickMode],
  );

  const onPointerMovePan = useCallback(
    (e) => {
      const p = panRef.current;
      const w = wrapRef.current;
      if (!p || !w) return;
      if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
        endPan(e);
        return;
      }
      if (!p.dragActive) {
        const mdx = e.clientX - p.x;
        const mdy = e.clientY - p.y;
        if (mdx * mdx + mdy * mdy < WS_PAN_MOUSE_DRAG_THRESHOLD_SQ) return;
        p.dragActive = true;
        p.sl = w.scrollLeft;
        p.st = w.scrollTop;
        p.x = e.clientX;
        p.y = e.clientY;
        setDraggingPan(true);
        try {
          w.setPointerCapture(p.pid);
        } catch {
          /* ignore */
        }
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      w.scrollLeft = p.sl - dx;
      w.scrollTop = p.st - dy;
    },
    [endPan],
  );

  const handleWrapClickCapture = useCallback(
    (e) => {
      if (!tooltipClickMode) return;
      if (!tooltipContentRef.current) return;
      if (Date.now() < suppressStrategicCityClickDismissUntilRef.current) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.ws-map-tile')) return;
      if (t.closest('.tile-tooltip')) return;
      closeTooltipNow();
    },
    [tooltipClickMode, closeTooltipNow],
  );

  const handleOpenTooltipFromTileEvent = useCallback((e) => {
    if (
      strategicMarchMode &&
      !strategicRoadMarchAnimating &&
      typeof onStrategicMarchCellPick === 'function' &&
      e?.type === 'click'
    ) {
      clearLeaveTooltipTimer();
      const y = Number(e.currentTarget.dataset.strategicY);
      const x = Number(e.currentTarget.dataset.strategicX);
      if (!Number.isNaN(y) && !Number.isNaN(x)) {
        onStrategicMarchCellPick(x, y);
      }
      return;
    }

    clearLeaveTooltipTimer();
    // 与 `dismissTooltip` 成对：`tooltipContent` 已空时锚点也必须清空，否则「同锚点再点关闭」仍可能用旧 ref
    // 误判（典型：关三公府/驻军所后先点阳翟无效，点过其它格再点阳翟才恢复）。
    if (!tooltipContentRef.current) {
      lastTooltipAnchorKeyRef.current = null;
    }
    const y = Number(e.currentTarget.dataset.strategicY);
    const x = Number(e.currentTarget.dataset.strategicX);
    if (Number.isNaN(y) || Number.isNaN(x)) return;
    const cell = hoverDataRef.current.cells[y]?.[x];
    const hd = hoverDataRef.current;
    const { cityById: cb } = hd;
    const cover =
      resolveStrategicTileCityCover(hoverDataRef.current.cells, y, x) ||
      resolveStrategicTilePvpCampCover(y, x, pvpBaseCamps, hoverDataRef.current.cells);

    const pvpWarIdHit = cover?.pvpWarId ? String(cover.pvpWarId).trim() : '';
    if (cover?.footprintKind?.startsWith('pvp_camp') && pvpWarIdHit) {
      const warSlice = pvpBaseCamps.find((c) => String(c.pvpWarId) === pvpWarIdHit) || null;
      if (warSlice) {
        const tc0 = tooltipContentRef.current;
        const samePvpCampTooltip =
          tc0?.pvpAttackerBaseCampStrategic &&
          tc0?.pvpWarId != null &&
          String(tc0.pvpWarId) === pvpWarIdHit;
        if (
          tooltipClickMode &&
          tc0 &&
          tc0.type === 'worldMapCity' &&
          tc0.interactive &&
          samePvpCampTooltip
        ) {
          if (Date.now() < suppressStrategicCityClickDismissUntilRef.current) {
            return;
          }
          closeTooltipNow();
          return;
        }
        lastTooltipAnchorKeyRef.current = `pvpCamp:${pvpWarIdHit}`;
        strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: null };
        setTooltipContent(buildStrategicPvpBaseCampTooltip(warSlice, hd));
        setTooltipPos({ x: e.clientX, y: e.clientY });
        return;
      }
    }

    const tooltipCell = cover?.anchorCell ? { ...(cell || {}), ...cover.anchorCell } : cell;
    const anchorId = readStrategicCellAnchorId(tooltipCell);
    const banditPoiId = anchorId && isBanditMapObjectId(anchorId) ? anchorId : null;
    const siegeCityId = banditPoiId ? null : anchorId || null;
    const row = siegeCityId && cb ? cb[siegeCityId] : null;
    const anchorY = cover?.anchorR ?? y;
    const anchorX = cover?.anchorC ?? x;
    const isBfEntry = isJunBattlefieldEntryCell(tooltipCell);
    const isBfInfo = isJunBattlefieldInfoCell(cell) || isJunBattlefieldInfoCell(tooltipCell);
    const standGx = Number(playerStandingGridCell?.gx);
    const standGy = Number(playerStandingGridCell?.gy);
    const clickIsStandingEntry =
      isBfEntry &&
      Number.isFinite(standGx) &&
      Number.isFinite(standGy) &&
      standGx === x &&
      standGy === y;
    const anchorKey =
      banditPoiId && isBfEntry
        ? `banditEntry:${x},${y}`
        : banditPoiId
          ? `bandit:${banditPoiId}`
          : siegeCityId
            ? `city:${siegeCityId}`
            : `cell:${anchorY},${anchorX}`;

    const tc = tooltipContentRef.current;
    const sameCityTooltip =
      !!siegeCityId && tc?.cityId != null && String(tc.cityId) === String(siegeCityId);
    const sameBanditDominoTooltip =
      !!banditPoiId &&
      !isBfEntry &&
      !isBfInfo &&
      tc?.type === 'worldMapCity' &&
      tc?.banditPoiId != null &&
      String(tc.banditPoiId) === String(banditPoiId);
    const sameBattlefieldEntryTooltip =
      tc?.type === 'battlefieldEntranceDual' &&
      clickIsStandingEntry &&
      tc?.banditPoiId != null &&
      String(tc.banditPoiId) === String(banditPoiId);
    const sameInteractiveStrategic =
      tc &&
      (tc.type === 'worldMapCity' || tc.type === 'battlefieldEntranceDual') &&
      tc.interactive;
    // 用当前浮层上的城池 `cityId`、匪寨骨牌或**本格**战场入口判断同锚点再点关闭。
    if (
      tooltipClickMode &&
      sameInteractiveStrategic &&
      (sameCityTooltip || sameBanditDominoTooltip || sameBattlefieldEntryTooltip)
    ) {
      if (Date.now() < suppressStrategicCityClickDismissUntilRef.current) {
        return;
      }
      closeTooltipNow();
      return;
    }

    // 中心信息区：仅展示叠层，不打开匪寨/探索双面板
    if (isBfInfo) {
      return;
    }

    lastTooltipAnchorKeyRef.current = anchorKey;

    if (tooltipCell && siegeCityId && row) {
      strategicCityTooltipMetaRef.current = { cityId: siegeCityId, banditPoiId: null };
      setTooltipContent(buildStrategicWorldMapCityTooltip(row, siegeCityId, hd));
      setTooltipPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tooltipCell && banditPoiId && !row) {
      if (isBanditBattlefieldBoundPoi(hoverDataRef.current.cells, banditPoiId, mapColumns, mapRows)) {
        // 四角入口：仅点击**本人当前立足**的那一格才开双面板
        if (!clickIsStandingEntry) {
          return;
        }
        strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId };
        setTooltipContent(
          buildBattlefieldEntranceDualTooltip(
            banditPoiId,
            tooltipCell,
            hd,
            mapColumns,
            mapRows,
            hoverDataRef.current.cells,
          ),
        );
        setTooltipPos({ x: e.clientX, y: e.clientY });
        return;
      }
      strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId };
      const synth = syntheticBanditProgressRowFromAnchorCell(banditPoiId, tooltipCell);
      setTooltipContent(buildStrategicWorldMapCityTooltip(synth, banditPoiId, hd));
      setTooltipPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tooltipCell && siegeCityId && !row) {
      strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: null };
      const nameBase = tooltipCell.cityName || siegeCityId;
      const titleStr =
        isBanditMapObjectId(siegeCityId) || isBanditMapObjectId(nameBase)
          ? String(nameBase)
          : String(nameBase).endsWith('城')
            ? nameBase
            : `${nameBase}城`;
      setTooltipContent({
        type: 'worldMapCity',
        interactive: false,
        cityTitle: titleStr,
        syncErrorMessage: '城池数据尚未同步，请稍后重试（城况接口）',
      });
      setTooltipPos({ x: e.clientX, y: e.clientY });
      return;
    }

    const info = tooltipCell ? buildCampaignCellTooltipInfo(tooltipCell) : null;
    if (!info) {
      lastTooltipAnchorKeyRef.current = null;
      strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: null };
      setTooltipContent(null);
      return;
    }
    strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: null };
    setTooltipContent({ type: 'tile', info });
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, [
    strategicMarchMode,
    strategicRoadMarchAnimating,
    onStrategicMarchCellPick,
    clearLeaveTooltipTimer,
    tooltipClickMode,
    closeTooltipNow,
    pvpBaseCamps,
    mapColumns,
    mapRows,
    playerStandingGridCell,
  ]);

  /** 战场探索结算后：主动重建入口双面板 portal（须仍立于入口格） */
  const reopenStrategicBattlefieldTooltipAfterExplore = useCallback(() => {
    clearLeaveTooltipTimer();
    const hd = hoverDataRef.current;
    const stand = String(hd.playerStandingPoiAnchorId || '').trim();
    const sgx = Number(playerStandingGridCell?.gx);
    const sgy = Number(playerStandingGridCell?.gy);
    const standCell =
      Number.isFinite(sgx) && Number.isFinite(sgy) ? cells[sgy]?.[sgx] : null;
    if (
      !stand ||
      !isBanditMapObjectId(stand) ||
      !isBanditBattlefieldBoundPoi(cells, stand, mapColumns, mapRows) ||
      !isJunBattlefieldEntryCell(standCell)
    ) {
      return;
    }
    const hint = standCell || findBanditBattlefieldHintCell(cells, stand);
    lastTooltipAnchorKeyRef.current = `banditEntry:${sgx},${sgy}`;
    strategicCityTooltipMetaRef.current = { cityId: null, banditPoiId: stand };
    const w = wrapRef.current;
    let px = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    let py = typeof window !== 'undefined' ? window.innerHeight * 0.38 : 0;
    if (w) {
      const wr = w.getBoundingClientRect();
      px = wr.left + wr.width / 2;
      py = wr.top + Math.min(180, wr.height * 0.35);
    }
    setTooltipPos({ x: px, y: py });
    setTooltipContent(
      buildBattlefieldEntranceDualTooltip(stand, hint, hd, mapColumns, mapRows, cells),
    );
  }, [clearLeaveTooltipTimer, cells, mapColumns, mapRows, playerStandingGridCell]);

  useEffect(() => {
    const p = subsidiaryExploreEmbed?.phase;
    const prev = explorePhaseSyncRef.current;
    explorePhaseSyncRef.current = p;

    /** 探索开局/进行中：关掉战略 tooltip，避免压在事件/小游戏/惩罚战 UI 上 */
    const exploreBusy = new Set([
      PHASE.EVENT,
      PHASE.ROLLING,
      PHASE.RESULT,
      PHASE.BATTLE,
      PHASE.REWARD,
      PHASE.MINIGAME,
    ]);
    if (exploreBusy.has(p) && !exploreBusy.has(prev)) {
      closeTooltipNow();
    }

    if (prev === PHASE.REWARD && p === PHASE.RETURNING) {
      suppressStrategicCityClickDismissUntilRef.current = Math.max(
        suppressStrategicCityClickDismissUntilRef.current,
        Date.now() + 900,
      );
    } else if (prev === PHASE.RETURNING && p === PHASE.IDLE) {
      suppressStrategicCityClickDismissUntilRef.current = Math.max(
        suppressStrategicCityClickDismissUntilRef.current,
        Date.now() + 650,
      );
      const cid = strategicExploreReopenBridge.lastAnchorCityId;
      const kind = strategicExploreReopenBridge.lastSubsidiaryKind;
      strategicExploreReopenBridge.clear();
      if (cid && kind === 'battlefield') {
        let raf = 0;
        raf = requestAnimationFrame(() => {
          reopenStrategicBattlefieldTooltipAfterExplore();
        });
        return () => cancelAnimationFrame(raf);
      }
    }
    return undefined;
  }, [subsidiaryExploreEmbed?.phase, reopenStrategicBattlefieldTooltipAfterExplore, closeTooltipNow]);

  const handleWrapperMove = useCallback((e) => {
    if (tooltipClickMode) return;
    setTooltipPos((prev) => {
      if (prev.x === e.clientX && prev.y === e.clientY) return prev;
      return { x: e.clientX, y: e.clientY };
    });
  }, [tooltipClickMode]);

  const county = mapColumns > 16 || mapRows > 20;

  /** 战场入口 / 攻方大本营立足：屏蔽本人势力·兵力 tooltip，头像穿透以免挡格点击 */
  const suppressSelfPawnHoverTooltip = useMemo(() => {
    if (String(playerStandingPvpWarId || '').trim()) return true;
    const stand = String(playerStandingPoiAnchorId || '').trim();
    if (
      stand &&
      isBanditMapObjectId(stand) &&
      isBanditBattlefieldBoundPoi(cells, stand, mapColumns, mapRows)
    ) {
      return true;
    }
    return false;
  }, [playerStandingPvpWarId, playerStandingPoiAnchorId, cells, mapColumns, mapRows]);

  const roadOverlayPathD = useMemo(() => {
    if (!roadCells?.length) return '';
    const conn = roadConnectivity === '8' ? '8' : ROAD_CONNECTIVITY_4;
    return buildStrategicRoadOverlayPathD(roadCells, conn, mapColumns, mapRows);
  }, [roadCells, roadConnectivity, mapColumns, mapRows]);

  const roadMarchPassableKeySet = useMemo(() => {
    if (!cells?.length || !roadCells?.length) return null;
    try {
      return buildRoadPassableKeySetForMarch(roadCells, cells, mapColumns, mapRows);
    } catch {
      return null;
    }
  }, [cells, roadCells, mapColumns, mapRows]);

  const territoryStanceMap = useMemo(() => {
    if (!playerFactionId || !cells?.length) return null;
    try {
      return buildStrategicTerritoryStanceMap({
        cells,
        roadCells,
        cityById,
        mapColumns,
        mapRows,
        playerFactionId,
        allyFactionIds: strategicCityLabelAllyFactionIds,
        nonHostileFactionIds: strategicCityLabelNonHostileFactionIds,
      });
    } catch {
      return null;
    }
  }, [
    cells,
    roadCells,
    cityById,
    mapColumns,
    mapRows,
    playerFactionId,
    strategicCityLabelAllyFactionIds,
    strategicCityLabelNonHostileFactionIds,
  ]);

  const battlefieldInfoHudByKey = useMemo(() => buildBattlefieldInfoHudAnchorMap(cells), [cells]);

  const canRoadDoubleEnterMarch =
    !strategicRoadMarchAnimating &&
    typeof onStrategicRoadDoubleMarchToCell === 'function';

  const activeWarTargetCityIdSet = useMemo(() => {
    if (!Array.isArray(activeWarTargetCityIds) || !activeWarTargetCityIds.length) return null;
    return new Set(activeWarTargetCityIds.map((id) => String(id).trim()).filter(Boolean));
  }, [activeWarTargetCityIds]);

  return (
    <div
      className={`ws-map-card ${county ? 'ws-map-card--county flex-1 min-h-0 flex flex-col h-full' : ''}`}
      style={{
        ['--ws-tile']: `${tilePx}px`,
        ['--ws-cols']: mapColumns,
        ['--ws-rows']: mapRows,
      }}
    >
      <div className={`ws-map-aligned-stack ${county ? 'flex-1 min-h-0 flex flex-col h-full' : ''}`}>
        {title ? <div className="ws-map-title">{title}</div> : null}
        {meta ? <div className="ws-map-meta">{meta}</div> : null}
        <div
          ref={wrapRef}
          className={`ws-map-wrap${draggingPan ? ' ws-map-wrap--dragging' : ''}`}
          onClickCapture={handleWrapClickCapture}
          onMouseMove={handleWrapperMove}
          onMouseLeave={tooltipClickMode ? undefined : scheduleLeaveFromWrap}
          onPointerDown={onPointerDownPan}
          onPointerMove={onPointerMovePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <div className="ws-map-scrollport-inner">
            <div className="ws-map-shell" style={{ position: 'relative' }}>
              {useMeowaUnderlay
                ? meowaUnderlayList.map((u) => {
                    const c0 = Number(u.col0) || 0;
                    const r0 = Number(u.row0) || 0;
                    const cols = Number(u.cols) || 0;
                    const rows = Number(u.rows) || 0;
                    return (
                      <img
                        key={`meowa-${u.junId || u.url}`}
                        className="ws-map-meowa-underlay"
                        src={u.url}
                        alt=""
                        draggable={false}
                        style={{
                          left: `calc(${c0} * var(--ws-tile))`,
                          top: `calc(${r0} * var(--ws-tile))`,
                          width: `calc(${cols} * var(--ws-tile))`,
                          height: `calc(${rows} * var(--ws-tile))`,
                        }}
                      />
                    );
                  })
                : null}
              <div className={`ws-map-grid${useMeowaUnderlay ? ' ws-map-grid--meowa-underlay' : ''}`}>
                {cells.map((row, ri) =>
                  row.map((cell, ci) => {
                    const cover =
                      resolveStrategicTileCityCover(cells, ri, ci) ||
                      resolveStrategicTilePvpCampCover(ri, ci, pvpBaseCamps, cells);
                    const anchorId = readStrategicCellAnchorId(cover?.anchorCell) || null;
                    let cityRow = anchorId && cityById ? cityById[anchorId] : null;
                    const showWarCityFire =
                      !!activeWarTargetCityIdSet &&
                      !!cover &&
                      cover.footprintKind === 'city_2x2' &&
                      cover.anchorR === ri &&
                      cover.anchorC === ci &&
                      !!anchorId &&
                      activeWarTargetCityIdSet.has(String(anchorId));
                    if (!cityRow && cover?.footprintKind?.startsWith?.('pvp_camp')) {
                      const af = cover.attackerFactionId ?? cover.attacker_faction_id;
                      if (af != null && String(af).trim() !== '') {
                        const fid = String(af).trim();
                        cityRow = { faction_id: fid, factionId: fid };
                      }
                    }
                    return (
                      <WorldStrategicMapTile
                        key={`${ri}-${ci}`}
                        cell={cell}
                        seed={seed}
                        gridY={ri}
                        gridX={ci}
                        strategicCover={cover}
                        cityRow={cityRow}
                        factionNameById={factionNameById}
                        playerFactionId={playerFactionId}
                        strategicCityLabelAllyFactionIds={strategicCityLabelAllyFactionIds}
                        strategicCityLabelNonHostileFactionIds={strategicCityLabelNonHostileFactionIds}
                        tooltipPointerMode={tooltipClickMode ? 'click' : 'hover'}
                        onHover={handleOpenTooltipFromTileEvent}
                        onLeave={tooltipClickMode ? undefined : scheduleLeaveFromTileIfAllowed}
                        onTooltipClick={handleOpenTooltipFromTileEvent}
                        strategicMarchMode={!!strategicMarchMode && !strategicRoadMarchAnimating}
                        onStrategicMarchCellPick={onStrategicMarchCellPick}
                        canRoadDoubleEnterMarch={canRoadDoubleEnterMarch}
                        onStrategicRoadDoubleEnterMarch={onStrategicRoadDoubleMarchToCell}
                        roadMarchPassableKeySet={roadMarchPassableKeySet}
                        territoryStance={territoryStanceMap?.get(`${ci},${ri}`) ?? null}
                        showWarCityFire={showWarCityFire}
                        suppressCampaignTerrain={cellHasMeowaUnderlay(ci, ri)}
                        battlefieldInfoHud={battlefieldInfoHudByKey.get(`${ci},${ri}`) || null}
                      />
                    );
                  }),
                )}
              </div>
              {roadOverlayPathD ? (
                <svg
                  className="ws-road-overlay"
                  viewBox={`0 0 ${mapColumns} ${mapRows}`}
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path
                    className="ws-road-overlay__stroke ws-road-overlay__stroke--outer"
                    d={roadOverlayPathD}
                  />
                  <path
                    className="ws-road-overlay__stroke ws-road-overlay__stroke--inner"
                    d={roadOverlayPathD}
                  />
                </svg>
              ) : null}
              {Array.isArray(strategicOtherPawns)
                ? strategicOtherPawns
                    .filter((p) => p && Number.isFinite(p.cx) && Number.isFinite(p.cy))
                    .map((p) => (
                      <StrategicMapSelfPawn
                        key={`other-${p.playerId}`}
                        cx={p.cx}
                        cy={p.cy}
                        portraitUrl={p.portraitUrl}
                        displayEffect={p.displayEffect || null}
                        displayName={p.displayName}
                        centerGlyph={p.centerGlyph}
                        stackStripPeers={p.stackStripPeers}
                        stackStripEllipsis={!!p.stackStripEllipsis}
                        roadIntercept={0}
                      />
                    ))
                : null}
              {strategicSelfPawn &&
              Number.isFinite(strategicSelfPawn.cx) &&
              Number.isFinite(strategicSelfPawn.cy) ? (
                <StrategicMapSelfPawn
                  cx={strategicSelfPawn.cx}
                  cy={strategicSelfPawn.cy}
                  portraitUrl={strategicSelfPawn.portraitUrl}
                  portraitFallbackUrl={strategicSelfPawn.portraitFallbackUrl}
                  displayEffect={strategicSelfPawn.displayEffect || null}
                  displayName={strategicSelfPawn.displayName}
                  centerGlyph={strategicSelfPawn.centerGlyph}
                  troopsCurrent={strategicSelfPawn.troopsCurrent}
                  troopsMax={strategicSelfPawn.troopsMax}
                  stackStripPeers={strategicSelfPawn.stackStripPeers}
                  stackStripEllipsis={!!strategicSelfPawn.stackStripEllipsis}
                  marchModeActive={!!strategicMarchMode && !strategicRoadMarchAnimating}
                  onEnterMarchMode={
                    strategicRoadMarchAnimating ? undefined : onStrategicSelfMarchModeRequest || undefined
                  }
                  onExitMarchMode={onStrategicSelfMarchModeExit || undefined}
                  roadIntercept={0}
                  interceptPlayerId={null}
                  interceptSilver={null}
                  onRoadSelfUpdated={undefined}
                  onRoadCell={!!strategicSelfPawn.onRoad}
                  suppressHoverTooltip={suppressSelfPawnHoverTooltip}
                />
              ) : null}
            </div>
          </div>
          {tooltipContent && typeof document !== 'undefined' && createPortal(
            <div
              className={`tile-tooltip tile-tooltip--portal${
                tooltipContent?.type === 'worldMapCity' ? ' tile-tooltip--world-map-city' : ''
              }${
                tooltipContent?.type === 'battlefieldEntranceDual'
                  ? ' tile-tooltip--battlefield-dual'
                  : ''
              }${tooltipContent?.interactive ? ' tile-tooltip--interactive' : ''}`}
              ref={tooltipRef}
              style={tooltipStyle}
              onMouseEnter={tooltipClickMode ? undefined : clearLeaveTooltipTimer}
              onMouseLeave={
                tooltipClickMode
                  ? undefined
                  : tooltipContent?.uniformStrategicPanel ||
                      tooltipContent?.type === 'battlefieldEntranceDual'
                    ? undefined
                    : closeTooltipNow
              }
            >
              <TileTooltipContent content={tooltipContent} />
            </div>,
            document.body,
          )}
          {tooltipContent &&
            typeof document !== 'undefined' &&
            tooltipContent.type === 'worldMapCity' &&
            tooltipContent.uniformStrategicPanel &&
            tooltipContent.interactive &&
            !tooltipContent.poiInteractionsLocked &&
            tooltipContent.cityId &&
            !tooltipContent.isBanditStronghold && (
              <>
                <StrategicSiegeWarFloatingPanel
                  anchorRef={tooltipRef}
                  tooltipPos={tooltipPos}
                  cityId={tooltipContent.cityId}
                  factionDisplayMap={tooltipContent.factionDisplayMap}
                  enabled
                  tooltipClickMode={tooltipClickMode}
                  clearLeaveTooltipTimer={clearLeaveTooltipTimer}
                  scheduleLeaveFromTile={scheduleLeaveFromTileIfAllowed}
                />
                <StrategicPvpWarFloatingPanel
                  anchorRef={tooltipRef}
                  tooltipPos={tooltipPos}
                  cityId={tooltipContent.cityId}
                  factionDisplayMap={tooltipContent.factionDisplayMap}
                  enabled
                  tooltipClickMode={tooltipClickMode}
                  clearLeaveTooltipTimer={clearLeaveTooltipTimer}
                  scheduleLeaveFromTile={scheduleLeaveFromTileIfAllowed}
                />
              </>
            )}
        </div>
      </div>
      {playerId ? (
        <AdventurePanel
          playerId={playerId}
          open={lineupAdventureOpen}
          onClose={() => setLineupAdventureOpen(false)}
          defaultExtraSlot={1}
          onChanged={async () => {
            await refreshPlayer?.({ silent: true });
          }}
        />
      ) : null}
      {playerId ? (
        <ChapterStageMapPanel
          open={chapterTacticalOpen}
          playerId={playerId}
          onClose={() => setChapterTacticalOpen(false)}
          onChanged={async () => {
            await refreshPlayer?.({ silent: true });
          }}
        />
      ) : null}
    </div>
  );
}
