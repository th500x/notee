/**
 * BattleArena - 通用战斗场景组件
 * 
 * @description 提供完整的战斗 UI：地图生成 + 部队分配 + 引擎 + 手动/自动 + 日志
 *              由 EventBattle / SiegeBattle 等调用，传入我方和敌方部队数据
 * 
 * @param {Array} playerUnits - 我方部队（buildPlayerUnitsFromContext 的输出）
 * @param {string} enemyRarity - 敌方稀有度（用于从配置池随机生成敌方，与 enemyUnits 二选一）
 * @param {Array} enemyUnits - 敌方部队（直接传入，优先于 enemyRarity）
 * @param {number} silverAmount - 玩家银两
 * @param {string} playerId - 玩家ID
 * @param {string} battleType - 战斗类型（pve_event / pve_siege）
 * @param {string} opponentName - 对手名称
 * @param {function} onBattleEnd - 战斗结束回调 (result, silverSpent, scoreResult, killedEnemyIndices)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBattleMap } from '@/hooks/useBattleMap';
import { getTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { bindTroopPortraitImg } from '@/utils/troopBattlePortrait';
import { useBattleEngine } from '@/hooks/useBattleEngine';
import { useManualBattle } from '@/hooks/useManualBattle';
import BattleMap from '@/components/battle/BattleMap';
import BattleLog from '@/components/battle/BattleLog';
import BattleAuxPanel from '@/components/battle/BattleAuxPanel';
import MapLegend from '@/components/battle/MapLegend';
import { MAP_W } from '@/components/battle/battleConstants';
import '@/components/battle/BattleMap.css';
import {
  calculateBattleScore,
  getSiegeBattleScoreMultiplier,
  mirrorTroopsForDefenderBattleScore,
} from '@/systems/battleScoreSystem';
import { battleAPI } from '@/services/battleApi';

const STAGE = { LOADING: 'loading', READY: 'ready' };

/** 手动渲染部队到 tile DOM（showTroops={false} 时需要） */
function renderTroopsToDOM(mapCardRef, battleTroops, baseUrl = '') {
  const card = mapCardRef?.current;
  if (!card) return;
  const tiles = card.querySelectorAll('.map-grid .tile');
  for (const troop of battleTroops) {
    if (troop.currentTroops <= 0) continue;
    const tile = tiles[troop.y * MAP_W + troop.x];
    if (!tile) continue;
    tile.setAttribute('data-troop', troop.id);
    tile.removeAttribute('data-info');
    const fc = troop.faction === 'player' ? 'player' : 'enemy';
    const totalBlocks = Math.ceil(troop.maxTroops / 100);
    const fullBlocks = Math.floor(troop.currentTroops / 100);
    const remainder = troop.currentTroops % 100;
    const hasHalf = remainder >= 50;
    const allBlks = [];
    for (let b = 0; b < totalBlocks; b++) {
      if (b < fullBlocks) allBlks.push(`<div class="troop-hp-block full-${fc}"></div>`);
      else if (b === fullBlocks && hasHalf) allBlks.push(`<div class="troop-hp-block half-${fc}"></div>`);
    }
    const topBlks = allBlks.slice(0, 6).join('');
    const rightBlks = allBlks.slice(6).join('');
    const hpHtml = `<div class="troop-hp-top">${topBlks}</div>${rightBlks ? `<div class="troop-hp-right">${rightBlks}</div>` : ''}`;
    const layer = document.createElement('div');
    layer.className = 'troop-layer';
    layer.innerHTML = `${hpHtml}<div class="troop-glow ${troop.faction}"></div><img class="troop-img" alt=""><div class="troop-name"><span class="cn">${troop.displayName || troop.name}</span><span class="mr">${troop.morale}/100</span></div>`;
    const img = layer.querySelector('.troop-img');
    bindTroopPortraitImg(img, troop, baseUrl);
    tile.appendChild(layer);
  }
}

/**
 * @param {object} [defenseReportMeta] 异步驻守防守战：战斗结束后为驻守方额外写入一条 pvp_defense 战报（recordOnly）
 * @param {boolean} [recordOnly] 为 true 时只记战报、不通过 /battles 改兵力（防守方本地观战与攻城方结算去重）
 * @param {string} [siegeDefenderType] 攻城 context：`npc` | `player_garrison` | `pvp_online`，用于战报积分倍率（与 getSiegeBattleScoreMultiplier 一致）
 */
export default function BattleArena({
  playerUnits, enemyRarity, enemyUnits,
  silverAmount = 0, playerId, battleType = 'pve_event', opponentName = '敌军',
  onBattleEnd,
  defenseReportMeta = null,
  recordOnly = false,
  siegeDefenderType = null,
  /** 事件惩罚战：强制加入的敌方将领 ID 列表（如 5v5 额外主将），传入 assignRealBattleTroops */
  eventExtraEnemyCharacterIds = null,
}) {
  const [stage, setStage] = useState(STAGE.LOADING);
  const [layoutWidth, setLayoutWidth] = useState('auto');
  const mapCardRef = useRef(null);
  const initRef = useRef(false);
  const troopsRendered = useRef(false);
  const mountedRef = useRef(true);
  const manualBattleRef = useRef(null);
  /** 攻城等预置敌方阵容时自动开战，避免未点「开始」导致不落战报 */
  const siegeAutoStartedRef = useRef(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const bm = useBattleMap();

  const engine = useBattleEngine({
    battleTroops: bm.battleTroops, setBattleTroops: bm.setBattleTroops,
    mapResult: bm.mapResult, addLog: bm.addLog, setLogs: bm.setLogs,
    battlePlaying: bm.battlePlaying, setBattlePlaying: bm.setBattlePlaying,
    roundNum: bm.roundNum, setRoundNum: bm.setRoundNum,
    silverAmount: bm.silverAmount, setSilverAmount: bm.setSilverAmount,
    activeFormation: bm.activeFormation, setActiveFormation: bm.setActiveFormation,
    autoBattle: bm.autoBattle, autoFormation: bm.autoFormation,
    mapCardRef, manualBattleRef,
  });

  const manual = useManualBattle({
    battleTroops: bm.battleTroops, mapResult: bm.mapResult, mapCardRef,
    performAttack: engine.performAttack, performCounterAttack: engine.performCounterAttack,
    battleKill: engine.battleKill, battleMove: engine.battleMove,
    formationGroupMove: engine.formationGroupMove, removeFormationBuffs: engine.removeFormationBuffs,
    addLog: bm.addLog,
  });

  manualBattleRef.current = manual;

  // 初始化
  useEffect(() => {
    if (initRef.current || !playerUnits || playerUnits.length === 0) return;
    // 需要配置数据加载完（用于 enemyRarity 模式）
    if (!enemyUnits && bm.allTroops.length < 3) return;

    initRef.current = true;
    bm.generate('standard');

    if (enemyUnits) {
      // 直接使用传入的敌方部队（攻城模式）
      const baseUrl = import.meta.env.BASE_URL;
      const playerPositions = [
        { y: 9, x: 1 }, { y: 9, x: 4 }, { y: 9, x: 7 }, { y: 8, x: 2 }, { y: 8, x: 5 },
      ];
      const enemyPositions = [
        { y: 0, x: 1 }, { y: 0, x: 5 }, { y: 1, x: 3 }, { y: 1, x: 7 },
      ];

      const pResult = playerUnits.slice(0, 5).map((unit, i) => {
        const attempts = getTroopPortraitUrlAttempts(unit.troop, baseUrl);
        return {
          ...unit.troop,
          id: unit.troop.id + '_p' + i,
          faction: 'player',
          y: playerPositions[i].y, x: playerPositions[i].x,
          currentTroops: unit.currentTroops ?? unit.troop.maxTroops,
          maxTroops: unit.maxTroops ?? unit.troop.maxTroops,
          character: unit.character || null,
          displayName: unit.character ? (unit.character.courtesyName || unit.character.name) : unit.troop.name,
          morale: unit.morale ?? 70,
          instanceId: unit.troop.instanceId,
          imgSrc: attempts[0],
          imgPortraitAttempts: attempts,
          imgFallback: attempts[attempts.length - 1],
        };
      });

      const eResult = enemyUnits.slice(0, 4).map((npc, i) => {
        const raw = npc.character;
        const charName = raw
          ? (raw.courtesyName || raw.courtesy_name || raw.name || raw.character_name || raw.characterName)
          : null;
        const morale = Math.round(50 + Math.random() * 30) + (raw?.traitModifier ?? raw?.trait_modifier ?? 0);
        const npcTroopMeta = {
          id: npc.troopId,
          rarity: npc.rarity,
          troopType: npc.troopType,
          weaponType: npc.weaponType,
        };
        const attempts = getTroopPortraitUrlAttempts(npcTroopMeta, baseUrl);
        const luckRaw = raw != null && raw.luck != null ? Number(raw.luck) : 50;
        const courageRaw = raw != null && raw.courage != null ? Number(raw.courage) : 50;
        const combatRaw = raw != null && raw.combat != null ? Number(raw.combat) : 50;
        const commandRaw = raw != null && raw.command != null ? Number(raw.command) : 50;
        const intelRaw = raw != null && raw.intelligence != null ? Number(raw.intelligence) : 50;
        const polRaw = raw != null && raw.politics != null ? Number(raw.politics) : 50;
        const charmRaw = raw != null && raw.charm != null ? Number(raw.charm) : 50;
        return {
          id: npc.troopId + '_e' + i,
          name: npc.troopName, rarity: npc.rarity,
          troopType: npc.troopType, weaponType: npc.weaponType,
          attack: npc.attack, defense: npc.defense,
          speed: npc.speed, movement: npc.movement, range: npc.attackRange,
          maxTroops: npc.maxTroops, currentTroops: npc.currentTroops ?? npc.maxTroops,
          faction: 'enemy',
          y: enemyPositions[i].y, x: enemyPositions[i].x,
          character: raw && charName ? {
            name: charName,
            courtesyName: charName,
            luck: luckRaw / 10, courage: courageRaw / 10,
            combat: combatRaw / 10, command: commandRaw / 10,
            intelligence: intelRaw / 10,
            politics: polRaw / 10, charm: charmRaw / 10,
          } : null,
          displayName: charName || npc.troopName,
          morale: Math.max(0, Math.min(100, morale)),
          imgSrc: attempts[0],
          imgPortraitAttempts: attempts,
          imgFallback: attempts[attempts.length - 1],
          _npcIndex: npc.index,
          instanceId: npc._troopInstanceId || null,
        };
      });

      bm.setBattleTroops([...pResult, ...eResult]);
    } else {
      // 从配置池随机生成敌方（事件模式）
      bm.assignRealBattleTroops(playerUnits, enemyRarity || 'common', {
        extraEnemyCharacterIds: eventExtraEnemyCharacterIds,
      });
    }

    bm.toggleBattle();
    bm.setSilverAmount(silverAmount);
    bm.toggleAutoFormation(true);
    setStage(STAGE.READY);
  }, [playerUnits, enemyUnits, enemyRarity, eventExtraEnemyCharacterIds, bm.allTroops.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage !== STAGE.READY || siegeAutoStartedRef.current) return;
    if (!enemyUnits || enemyUnits.length === 0) return;
    if (battleType !== 'pve_siege' && battleType !== 'pvp_siege') return;
    siegeAutoStartedRef.current = true;
    const t = requestAnimationFrame(() => {
      engine.playBattleRound();
    });
    return () => cancelAnimationFrame(t);
  }, [stage, enemyUnits, battleType, engine.playBattleRound]);

  // 渲染部队到 DOM
  useEffect(() => {
    if (troopsRendered.current) return;
    if (bm.mapResult && bm.battleTroops.length > 0 && mapCardRef.current) {
      requestAnimationFrame(() => {
        renderTroopsToDOM(mapCardRef, bm.battleTroops, import.meta.env.BASE_URL);
        troopsRendered.current = true;
      });
    }
  }, [bm.mapResult, bm.battleTroops]);

  // 同步布局宽度
  useEffect(() => {
    if (mapCardRef.current) setLayoutWidth(mapCardRef.current.offsetWidth + 'px');
  }, [bm.mapResult]);

  // 监听战斗结束
  const endedRef = useRef(false);
  const onBattleEndRef = useRef(onBattleEnd);
  onBattleEndRef.current = onBattleEnd;

  useEffect(() => {
    if (stage !== STAGE.READY || endedRef.current) return;
    if (bm.logs.length === 0) return;
    const recentLogs = bm.logs.slice(-5);
    let result = null;
    for (const log of recentLogs) {
      if (!log) continue;
      if (log.text.includes('敌方全军覆没') || log.text.includes('胜利')) { result = 'victory'; break; }
      if (log.text.includes('我方全军覆没')) { result = 'defeat'; break; }
    }
    if (!result) return;
    endedRef.current = true;
    const check = setInterval(async () => {
      if (!bm.battlePlaying) {
        clearInterval(check);
        if (!mountedRef.current) return;
        const silverSpent = (silverAmount) - bm.silverAmount;
        const siegeMult =
          battleType === 'pve_siege' || battleType === 'pvp_siege'
            ? getSiegeBattleScoreMultiplier(siegeDefenderType)
            : 1;
        const scoreOpts = { scoreMultiplier: siegeMult };
        const scoreResult = calculateBattleScore(bm.battleTroops, bm.roundNum, result, scoreOpts);

        const playerTroops = bm.battleTroops.filter(t => t.faction === 'player');
        const enemyTroops = bm.battleTroops.filter(t => t.faction === 'enemy');
        const totalKills = enemyTroops.filter(t => t.currentTroops <= 0).length;
        const killedIndices = enemyTroops.filter(t => t.currentTroops <= 0).map(t => t._npcIndex).filter(i => i != null);
        const logText = bm.logs.map(l => l?.text || '').filter(Boolean).join('\n');
        const troopCasualties = playerTroops.filter(t => t.instanceId).map(t => ({ instanceId: t.instanceId, currentTroops: Math.max(0, t.currentTroops) }));
        const moraleUpdates = [];
        if (playerTroops.length > 0) {
          const alivePT = playerTroops.find(t => t.currentTroops > 0) || playerTroops[0];
          moraleUpdates.push({ target: 'player', morale: alivePT.morale ?? 70 });
        }
        for (const t of playerTroops) {
          if (t.instanceId) moraleUpdates.push({ target: 'card', instanceId: t.instanceId, morale: t.morale ?? 70 });
        }

        const battleId = `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let attackerBattleSaved = false;
        try {
          const attackerPayload = {
            battleId, playerId: playerId || 'unknown',
            warId: (battleType === 'pve_siege' || battleType === 'pvp_siege') && defenseReportMeta?.warId ? defenseReportMeta.warId : undefined,
            battleType,
            opponentType: battleType === 'pvp_siege' ? 'player' : 'event_enemy',
            opponentName,
            result: result === 'victory' ? 'win' : 'lose',
            playerTeam: playerTroops.map(t => ({ name: t.character?.courtesyName || t.name, rarity: t.rarity })),
            opponentTeam: enemyTroops.map(t => ({ name: t.character?.courtesyName || t.name, rarity: t.rarity })),
            battleLog: logText, totalKills, duration: bm.roundNum,
            rewards: {
              battleScore: scoreResult.score,
              battleGrade: scoreResult.grade,
              scoreDetails: scoreResult.details,
            },
            troopCasualties, moraleUpdates,
            chestRewards: typeof manualBattleRef.current?.getCollectedChestRewards === 'function'
              ? manualBattleRef.current.getCollectedChestRewards()
              : [],
            recordOnly,
          };
          // 网络抖动/瞬时异常时重试，减少“战报偶发未写入”
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            const saveRes = await battleAPI.saveBattle(attackerPayload);
            if (saveRes?.success) {
              attackerBattleSaved = true;
              break;
            }
            if (attempt < 2) {
              // 间隔极短，不影响主流程结算
              await new Promise((resolve) => setTimeout(resolve, 180));
            } else {
              console.error('[BattleArena] 攻城战报保存失败（重试后）:', saveRes?.error || 'unknown');
            }
          }

          if ((battleType === 'pve_siege' || battleType === 'pvp_siege') && defenseReportMeta?.defenderPlayerId) {
            const meta = defenseReportMeta;
            const defenderLosses = enemyTroops.filter(t => t.currentTroops <= 0).length;
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
              mirrorTroopsForDefenderBattleScore(bm.battleTroops),
              bm.roundNum,
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
              playerTeam: enemyTroops.map(t => ({ name: t.character?.courtesyName || t.name, rarity: t.rarity })),
              opponentTeam: playerTroops.map(t => ({ name: t.character?.courtesyName || t.name, rarity: t.rarity })),
              battleLog: defLog,
              totalKills: defenderLosses,
              duration: bm.roundNum,
              rewards: {
                battleScore: defScoreResult.score,
                battleGrade: defScoreResult.grade,
                scoreDetails: defScoreResult.details,
              },
              recordOnly: true,
            });
          }
        } catch (err) {
          console.error('[BattleArena] 保存战报失败:', err);
        }

        onBattleEndRef.current?.(
          result,
          silverSpent > 0 ? silverSpent : 0,
          scoreResult,
          killedIndices,
          { battleReportSaved: attackerBattleSaved }
        );
      }
    }, 200);
    return () => clearInterval(check);
  }, [bm.logs, bm.battlePlaying, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[60] overflow-auto bg-[#1a1a2e]">
      <div className="battle-page">
        {stage === STAGE.LOADING && (
          <div className="maps-row">
            <div style={{ color: '#555', fontSize: 14, padding: 40 }}>正在准备战场...</div>
          </div>
        )}
        {bm.mapResult && (
          <BattleMap
            mapResult={bm.mapResult} mapLabel={bm.mapLabel}
            battleTroops={bm.battleTroops} showTroops={false}
            isBattle={bm.isBattle} mapCardRef={mapCardRef}
            autoBattle={bm.autoBattle}
            onTakeover={() => bm.toggleAutoBattle(false)}
            onTileClick={!bm.autoBattle ? manual.handleTileClick : undefined}
            manualProps={!bm.autoBattle ? {
              phase: manual.phase, activeTroop: manual.activeTroop,
              formationTroops: manual.formationTroops, reachableTiles: manual.reachableTiles,
              onStandby: manual.handleStandby, onFormationStandby: manual.handleFormationStandby,
              attackPreview: manual.attackPreview,
              chestReward: manual.chestReward, confirmChestReward: manual.confirmChestReward,
            } : undefined}
          />
        )}
        {bm.roundNum === 0 && (
          <BattleAuxPanel
            silverAmount={bm.silverAmount}
            autoBattle={bm.autoBattle} toggleAutoBattle={bm.toggleAutoBattle}
            autoFormation={bm.autoFormation} toggleAutoFormation={bm.toggleAutoFormation}
            maxWidth={layoutWidth}
            onStartBattle={stage === STAGE.READY ? engine.playBattleRound : null}
            battlePlaying={bm.battlePlaying}
          />
        )}
        {bm.roundNum === 0 && <MapLegend maxWidth={layoutWidth} />}
        <BattleLog logs={bm.logs} visible={bm.isBattle} maxWidth={layoutWidth} />
      </div>
    </div>
  );
}
