import { resolveKillLossTroopCounts } from '@/systems/battleScoreSystem';

const PVP_DUEL_DEFENDER_TYPES = new Set(['road_encounter', 'pvp_online']);

/** 玩家对玩家（道路遭遇 / 在线城防），非 NPC 守军 */
export function isPvpDuelDefenderType(defenderType) {
  return PVP_DUEL_DEFENDER_TYPES.has(String(defenderType || '').trim());
}

/** 权威自动对决战报是否可挂 `PvpAutoDuelReplay`（道路守方 / 披挂守方 / 攻方回放共用） */
export function isPvpAuthoritativeBattleLogReplayable(battleLog) {
  const logStr = Array.isArray(battleLog)
    ? battleLog.join('\n')
    : typeof battleLog === 'string'
      ? battleLog
      : '';
  return (
    logStr.length > 12 &&
    /═══\s*第\s*\d+\s*回合\s*═══/.test(logStr) &&
    /次攻击/.test(logStr) &&
    /\[攻方\]/.test(logStr)
  );
}

/** 披挂 `siege-outcome` 载荷 → 与道路守方相同的 `mapRoadEncounterOutcomeToSettlementProps` 入参 */
export function normalizePvpSiegeDefenseOutcomeForSettlement(outcome) {
  if (!outcome || typeof outcome !== 'object') return { viewerIsDefender: true };
  return {
    ...outcome,
    viewerIsDefender: true,
    settlement: outcome.siegeData && typeof outcome.siegeData === 'object' ? outcome.siegeData : {},
  };
}

function countScoreDetailKillUnits(details) {
  if (!details || !Array.isArray(details.kills)) return null;
  return details.kills.length;
}

/**
 * 道路遭遇权威裁定结果 → `StrategicSettlementCard` 展示字段（攻/守方视角）
 * @param {object} raw `getRoadEncounterAuthoritativeOutcome` 或攻方裁定 API 载荷
 */
export function mapRoadEncounterOutcomeToSettlementProps(raw) {
  const settlement = raw?.settlement && typeof raw.settlement === 'object' ? raw.settlement : {};
  const viewerIsDefender = !!raw?.viewerIsDefender;
  const attackerWon = !!raw?.attackerWon;
  const playerVictory = viewerIsDefender ? !attackerWon : attackerWon;

  if (viewerIsDefender) {
    const sd = raw?.defenderScoreDetails;
    const killUnits = countScoreDetailKillUnits(sd);
    const { killTroops } = resolveKillLossTroopCounts(sd);
    const killCount = killUnits != null ? killUnits : killTroops != null ? killTroops : 0;
    return {
      settlementKind: 'siege',
      hideNpcGarrisonLine: true,
      playerVictory,
      silverReward: 0,
      reputationReward: 0,
      killCount,
      authoritativeBattleLog: raw.battleLog,
      initialAttackerTroops: raw.initialAttackerTroops,
      initialDefenderTroops: raw.initialDefenderTroops,
      battleReportFailed: false,
      defeatRetreatNotice: !playerVictory ? raw.defeatRetreatNotice : undefined,
    };
  }

  const killCount = settlement.killCount ?? settlement.npcKilled ?? null;
  return {
    settlementKind: 'siege',
    hideNpcGarrisonLine: true,
    playerVictory,
    silverReward: settlement.silverReward ?? 0,
    reputationReward: settlement.reputationReward ?? 0,
    equipmentDrop: settlement.equipmentDrop ?? null,
    killCount,
    authoritativeBattleLog: raw.battleLog,
    initialAttackerTroops: raw.initialAttackerTroops,
    initialDefenderTroops: raw.initialDefenderTroops,
    battleReportFailed: false,
    showZeroKillNote: (killCount ?? 0) === 0 && !playerVictory,
    defeatRetreatNotice: !playerVictory ? raw.defeatRetreatNotice : undefined,
  };
}
