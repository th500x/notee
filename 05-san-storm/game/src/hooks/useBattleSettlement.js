/**
 * 战斗结束检测 + 战报保存 + 结算回调。
 * 事件战 / 攻城 / 战役均使用相同的结算逻辑，差异通过参数注入：
 *   - opponentType  由 battleType 推导
 *   - campaignId    战役时附带进 rewards
 *   - battleSettledRef  战役专用，结算触发后置 true，防止中断信标重复计次
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  calculateBattleScore,
  getSiegeBattleScoreMultiplier,
  mirrorTroopsForDefenderBattleScore,
} from '@/systems/battleScoreSystem';
import { battleAPI } from '@/services/battleApi';

const STAGE_READY = 'ready';

function resolveOpponentType(battleType) {
  if (battleType === 'pvp_siege') return 'player';
  if (battleType === 'pve_campaign') return 'campaign_enemy';
  return 'event_enemy';
}

/**
 * @param {string}       stage              - STAGE.READY / STAGE.LOADING
 * @param {object}       bmRef              - useRef(bm)，由壳层持续同步 .current
 * @param {object}       manualBattleRef    - useRef(manual)，用于获取宝箱奖励快照
 * @param {object}       mountedRef         - useRef(true)，组件卸载后置 false
 * @param {boolean}      battlePlaying      - bm.battlePlaying（用于 dep array 触发）
 * @param {string}       battleType         - 'pve_event'|'pve_siege'|'pvp_siege'|'pve_campaign'
 * @param {string|null}  playerId
 * @param {number}       silverAmount       - 战前银两（用于计算消耗）
 * @param {number}       [deploymentFoodCost] - 出征粮草（仅 pve_campaign；与 LineupTab 公式一致）
 * @param {string|null}  campaignId         - 战役 ID，非战役传 null
 * @param {object|null}  defenseReportMeta  - 驻守防守信息，非攻城传 null
 * @param {boolean}      recordOnly         - 仅记录战报不改兵力
 * @param {string|null}  siegeDefenderType  - 攻城积分倍率类型
 * @param {string}       opponentName
 * @param {object|null}  battleSettledRef   - 战役专用：结算触发后置 true（useRef）
 * @param {object}       pendingAwayNoticeRef - 来自 useAwayTimeout，是否弹离开提示
 * @param {object|null}  [smallMapPveLoot] - 写入战报 rewards.smallMapPveLoot；仅胜利时由后端 applyDeclaredSmallMapPveLoot（匪寨每层即时奖励等）
 * @param {function}     onBattleEnd        - (result, silverSpent, scoreResult, killedIndices, meta) => void
 */
export function useBattleSettlement({
  stage,
  bmRef,
  manualBattleRef,
  /** 可选：引擎 ref，用于获取自动战斗宝箱奖励 */
  engineRef = null,
  mountedRef,
  battlePlaying,
  battleType,
  playerId,
  silverAmount,
  deploymentFoodCost = 0,
  campaignId,
  defenseReportMeta,
  recordOnly,
  siegeDefenderType,
  opponentName,
  battleSettledRef,
  pendingAwayNoticeRef,
  smallMapPveLoot = null,
  onBattleEnd,
}) {
  const endedRef = useRef(false);
  const onBattleEndRef = useRef(onBattleEnd);
  onBattleEndRef.current = onBattleEnd;

  const [awayNoticeOpen, setAwayNoticeOpen] = useState(false);
  const pendingAwayEndRef = useRef(null);

  // 新一轮战斗开始，允许重新触发结算
  useEffect(() => {
    if (battlePlaying) endedRef.current = false;
  }, [battlePlaying]);

  // 战斗结束检测 + 保存战报 + 回调
  useEffect(() => {
    if (stage !== STAGE_READY || endedRef.current) return;
    if (battlePlaying) return;
    const m = bmRef.current;
    if (!m.roundNum || m.roundNum < 1) return;

    const pAlive = m.battleTroops.filter((t) => t.faction === 'player' && t.currentTroops > 0);
    const eAlive = m.battleTroops.filter((t) => t.faction === 'enemy' && t.currentTroops > 0);

    let result = null;
    if (eAlive.length === 0 && pAlive.length > 0) result = 'victory';
    else if (pAlive.length === 0) result = 'defeat';
    else if (m.battleEndReason === 'max_rounds') result = 'defeat';
    else if (m.battleEndReason === 'min_rounds') result = 'victory';
    // 战役：击败敌方 boss 主将时场上可能仍有杂兵，须凭引擎写入的结束原因走结算
    else if (m.battleEndReason === 'campaign_boss_win') result = 'victory';
    else if (m.battleEndReason === 'campaign_hero_loss') result = 'defeat';
    else return;

    endedRef.current = true;
    if (battleSettledRef) battleSettledRef.current = true;

    const check = setInterval(async () => {
      const b = bmRef.current;
      if (b.battlePlaying) return;
      clearInterval(check);
      if (!mountedRef.current) return;

      // 战报文本必须以「已写入的全部日志」为准：logs 状态可能尚未随 addLog 提交完毕，
      // battleLogsSyncRef 在 addLog 内与 setState 同步追加，避免击败 boss 等收尾日志未入库。
      const logLines = Array.isArray(b.battleLogsSyncRef?.current)
        ? b.battleLogsSyncRef.current
        : b.logs;

      const silverSpent = silverAmount - b.silverAmount;
      const siegeMult =
        battleType === 'pve_siege' || battleType === 'pvp_siege'
          ? getSiegeBattleScoreMultiplier(siegeDefenderType)
          : 1;
      const scoreOpts = { scoreMultiplier: siegeMult };
      const scoreResult = calculateBattleScore(b.battleTroops, b.roundNum, result, scoreOpts);

      const playerTroops = b.battleTroops.filter((t) => t.faction === 'player');
      const enemyTroops = b.battleTroops.filter((t) => t.faction === 'enemy');
      const deadEnemyStacks = enemyTroops.filter((t) => t.currentTroops <= 0);
      const aliveEnemyStacks = enemyTroops.filter((t) => t.currentTroops > 0).length;
      const initialEnemyStacks = b.initialEnemyStackCountRef?.current;
      const totalKills =
        typeof initialEnemyStacks === 'number' && initialEnemyStacks > 0
          ? Math.max(0, initialEnemyStacks - aliveEnemyStacks)
          : Math.max(0, enemyTroops.length - aliveEnemyStacks);
      const killedIndices = deadEnemyStacks.map((t) => t._npcIndex).filter((i) => i != null);
      const logText = logLines.map((l) => l?.text || '').filter(Boolean).join('\n');
      const troopCasualties = playerTroops
        .filter((t) => t.instanceId)
        .map((t) => ({ instanceId: t.instanceId, currentTroops: Math.max(0, t.currentTroops) }));

      const moraleUpdates = [];
      if (playerTroops.length > 0) {
        const alivePT = playerTroops.find((t) => t.currentTroops > 0) || playerTroops[0];
        moraleUpdates.push({ target: 'player', morale: alivePT.morale ?? 70 });
      }
      for (const t of playerTroops) {
        if (t.instanceId) moraleUpdates.push({ target: 'card', instanceId: t.instanceId, morale: t.morale ?? 70 });
      }

      /** 须在 try/catch 外声明：endMeta 在 catch 之后读取，避免块级作用域 ReferenceError */
      let veteranPromotions = [];
      let persistedBattleId = '';

      /** 攻城客户端战：与攻方 troopCasualties 对称，写回玩家守军各部队终局兵力（含半血存活） */
      const defenderLineupTroopUpdates =
        (battleType === 'pve_siege' || battleType === 'pvp_siege') && defenseReportMeta?.defenderPlayerId
          ? enemyTroops
              .filter((t) => t.instanceId)
              .map((t) => ({
                instanceId: t.instanceId,
                currentTroops: Math.max(0, Math.round(Number(t.currentTroops) || 0)),
                maxTroops: t.maxTroops,
              }))
          : null;

      const battleId = `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      persistedBattleId = battleId;
      let attackerBattleSaved = false;
      const manualChests =
        typeof manualBattleRef.current?.getCollectedChestRewards === 'function'
          ? manualBattleRef.current.getCollectedChestRewards()
          : [];
      const autoChests =
        typeof engineRef?.current?.getAutoChestRewards === 'function'
          ? engineRef.current.getAutoChestRewards()
          : [];
      const chestRewardsSnapshot = [...manualChests, ...autoChests];

      try {
        const opponentType = resolveOpponentType(battleType);
        const rewards = {
          battleScore: scoreResult.score,
          battleGrade: scoreResult.grade,
          scoreDetails: scoreResult.details,
          ...(battleType === 'pve_campaign' && campaignId ? { campaignId } : {}),
        };
        const silverSpentNum = Math.max(0, Math.floor(silverSpent));
        const deployFoodNum = Math.max(0, Math.floor(Number(deploymentFoodCost) || 0));
        const attackerPayload = {
          battleId,
          playerId: playerId || 'unknown',
          warId:
            (battleType === 'pve_siege' || battleType === 'pvp_siege') && defenseReportMeta?.warId
              ? defenseReportMeta.warId
              : undefined,
          battleType,
          opponentType,
          opponentName,
          result: result === 'victory' ? 'win' : 'lose',
          playerTeam: playerTroops.map((t) => ({ name: t.character?.courtesyName || t.name, rarity: t.rarity })),
          opponentTeam: enemyTroops.map((t) => ({ name: t.character?.courtesyName || t.name, rarity: t.rarity })),
          battleLog: logText,
          totalDamageDealt: scoreResult.details?.killTroops ?? 0,
          totalDamageTaken: scoreResult.details?.lossTroops ?? 0,
          totalKills,
          duration: b.roundNum,
          rewards,
          troopCasualties,
          moraleUpdates,
          chestRewards: chestRewardsSnapshot,
          recordOnly,
          ...(battleType === 'pve_campaign'
            ? {
                battleSilverSpent: silverSpentNum,
                deploymentFoodSpent: deployFoodNum,
              }
            : {}),
        };

        // 最多重试 2 次，减少偶发网络抖动导致战报丢失
        for (let attempt = 1; attempt <= 2; attempt++) {
          const saveRes = await battleAPI.saveBattle(attackerPayload);
          if (saveRes?.success) {
            attackerBattleSaved = true;
            veteranPromotions = saveRes.veteranPromotions || [];
            break;
          }
          if (attempt < 2) await new Promise((r) => setTimeout(r, 180));
          else console.error('[useBattleSettlement] 战报保存失败（重试后）:', saveRes?.error || 'unknown');
        }

        // 攻城时同步为守城方写一条镜像战报
        if ((battleType === 'pve_siege' || battleType === 'pvp_siege') && defenseReportMeta?.defenderPlayerId) {
          const meta = defenseReportMeta;
          const defenderLosses = enemyTroops.filter((t) => t.currentTroops <= 0).length;
          const defBattleId = `battle_${Date.now()}_def_${Math.random().toString(36).slice(2, 10)}`;
          const defLog = [
            `【驻守防守】${meta.cityName || '城池'}`,
            `来犯：${meta.attackerName || '攻城方'}`,
            '────────',
            '（以下为同一场战斗记录；您为守城方，攻城方为对手，战况与攻城方客户端战报同源）',
            '',
            logText,
          ].join('\n');
          const defPerspectiveResult = result === 'victory' ? 'defeat' : 'victory';
          const defScoreResult = calculateBattleScore(
            mirrorTroopsForDefenderBattleScore(b.battleTroops),
            b.roundNum,
            defPerspectiveResult,
            scoreOpts,
          );
          await battleAPI.saveBattle({
            battleId: defBattleId,
            playerId: meta.defenderPlayerId,
            warId: meta.warId || undefined,
            battleType: 'pvp_defense',
            opponentType: 'player',
            opponentId: meta.attackerPlayerId,
            opponentName: meta.attackerName || '攻城方',
            result: result === 'victory' ? 'lose' : 'win',
            playerTeam: enemyTroops.map((t) => ({ name: t.character?.courtesyName || t.name, rarity: t.rarity })),
            opponentTeam: playerTroops.map((t) => ({ name: t.character?.courtesyName || t.name, rarity: t.rarity })),
            battleLog: defLog,
            totalDamageDealt: defScoreResult.details?.killTroops ?? 0,
            totalDamageTaken: defScoreResult.details?.lossTroops ?? 0,
            totalKills: defenderLosses,
            duration: b.roundNum,
            rewards: {
              battleScore: defScoreResult.score,
              battleGrade: defScoreResult.grade,
              scoreDetails: defScoreResult.details,
            },
            recordOnly: true,
          });
        }
      } catch (err) {
        console.error('[useBattleSettlement] 保存战报失败:', err);
      }

      const endMeta = {
        battleReportSaved: attackerBattleSaved,
        chestRewards: chestRewardsSnapshot,
        veteranPromotions,
        battleId: persistedBattleId || undefined,
        ...(defenderLineupTroopUpdates?.length
          ? { defenderLineupTroopUpdates }
          : {}),
      };
      if (pendingAwayNoticeRef.current) {
        pendingAwayNoticeRef.current = false;
        endMeta.awayTimeout = true;
        pendingAwayEndRef.current = {
          result,
          silverSpent: silverSpent > 0 ? silverSpent : 0,
          scoreResult,
          killedIndices,
          meta: endMeta,
        };
        if (mountedRef.current) setAwayNoticeOpen(true);
      } else {
        onBattleEndRef.current?.(
          result,
          silverSpent > 0 ? silverSpent : 0,
          scoreResult,
          killedIndices,
          endMeta,
        );
      }
    }, 200);

    return () => clearInterval(check);
    // 仅依赖 battlePlaying/stage：避免 battleTroops 引用每帧变化导致 cleanup 清掉 interval
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battlePlaying, stage, silverAmount, deploymentFoodCost, battleType, opponentName, playerId, campaignId, defenseReportMeta, recordOnly, siegeDefenderType, smallMapPveLoot]);

  const flushAwayEndNotice = useCallback(() => {
    const p = pendingAwayEndRef.current;
    if (!p) return;
    pendingAwayEndRef.current = null;
    setAwayNoticeOpen(false);
    onBattleEndRef.current?.(p.result, p.silverSpent, p.scoreResult, p.killedIndices, p.meta);
  }, []);

  return { awayNoticeOpen, flushAwayEndNotice };
}
