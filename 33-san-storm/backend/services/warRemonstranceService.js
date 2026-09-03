/**
 * 三公府 · 势力战事谏言（PVE 中立城 + PVP 敌对城）共用编排。
 *
 * - 大本营 JSON：`pvpWarService.createBaseCampJsonForCity`（PVE 经 `pveWarBaseCampService` 薄包装）
 * - 攻方大本营 NPC：`cityService.buildNpcUnitsForCityRow`（内存生成，不写 cities.npc_garrison）
 * - 上供银两：`remonstranceTributeService`（驳回即扣；通过且开战成功后再扣）
 *
 * @see 12-1-POSITION_SYSTEM.md §9 · 17-3-WAR_SYSTEM.md
 */

const cityService = require('./cityService');
const pvpWarService = require('./pvpWarService');
const remonstranceTributeService = require('./remonstranceTributeService');
const { pool } = require('../database/connection');

/**
 * 审批通过后执行开战（PVE / PVP 唯一入口，路由层勿再分叉实现）。
 *
 * @param {{
 *   proposalKind: 'pve'|'pvp',
 *   targetCityId: string,
 *   attackerFactionId: string,
 *   seasonKey: string,
 *   serverId?: string,
 *   proposer: { kind: string, playerId: string, displayName: string },
 *   proposerPlayer: object,
 *   normalizedPolicies: object,
 *   tributeSilver?: number,
 *   proposerPlayerId: string,
 * }} input
 */
async function executeApprovedWarRemonstrance(input) {
  const {
    proposalKind,
    targetCityId,
    attackerFactionId,
    seasonKey,
    serverId,
    proposer,
    proposerPlayer,
    normalizedPolicies,
    tributeSilver = 0,
    proposerPlayerId,
  } = input;

  let warPayload;
  if (proposalKind === 'pve') {
    const opened = await cityService.openPveWarOnNeutralCity(targetCityId, {
      openedByCharacterId: proposerPlayer?.character_id || null,
      bulletinFactionId: attackerFactionId,
    });
    warPayload = {
      proposalKind: 'pve',
      draftCreated: true,
      pveWar: opened,
      warId: opened.warId,
      war: null,
      transientPoliciesApplied: null,
    };
  } else {
    const war = await pvpWarService.createPvpWarDraftAndActivate({
      season: seasonKey,
      attackerFactionId,
      targetCityId,
      serverId,
      proposer,
      transientPolicies: normalizedPolicies,
    });
    warPayload = {
      proposalKind: 'pvp',
      draftCreated: true,
      war,
      pveWar: null,
      warId: war.pvpWarId,
      transientPoliciesApplied: normalizedPolicies,
    };
  }

  const tribute = await remonstranceTributeService.applyRemonstranceTributeStandalone(pool, {
    playerId: proposerPlayerId,
    factionId: attackerFactionId,
    tributeSilver,
  });

  return {
    ...warPayload,
    proposerPlayerId,
    tribute,
  };
}

module.exports = {
  executeApprovedWarRemonstrance,
};
