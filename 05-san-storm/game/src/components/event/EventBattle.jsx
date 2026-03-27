/**
 * EventBattle - 事件系统惩罚战斗组件
 * 
 * @description 当事件判定为凶/大凶且 triggerBattle=true 时，
 *              接入真实战斗系统（完全复用 BattleMapPage 的组件和布局）
 *              战斗结束后回调 onBattleEnd('victory'/'defeat')
 * 
 * 重要：传 showTroops={false} 给 BattleMap，部队渲染完全由引擎 DOM 操作管理。
 *       这是因为 useBattleEngine 通过直接 DOM 操作（appendChild/remove）移动部队，
 *       如果同时让 React 渲染 TroopLayer，两套系统会冲突导致 removeChild 崩溃。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { useBattleMap } from '@/hooks/useBattleMap';
import { useBattleEngine } from '@/hooks/useBattleEngine';
import { useManualBattle } from '@/hooks/useManualBattle';
import BattleMap from '@/components/battle/BattleMap';
import BattleLog from '@/components/battle/BattleLog';
import BattleAuxPanel from '@/components/battle/BattleAuxPanel';
import MapLegend from '@/components/battle/MapLegend';
import { MAP_W } from '@/components/battle/battleConstants';
import '@/components/battle/BattleMap.css';
import { calculateBattleScore } from '@/systems/battleScoreSystem';
import { battleAPI } from '@/services/battleApi';

/** 战斗阶段 */
const STAGE = {
  LOADING: 'loading',
  READY: 'ready',
};

/**
 * 手动渲染部队到 tile DOM（复制自 useBattleEngine.renderTroopOnTile）
 * 因为传了 showTroops={false}，React 不渲染 TroopLayer，需要手动初始化
 */
function renderTroopsToDOM(mapCardRef, battleTroops) {
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
    layer.innerHTML = `${hpHtml}<div class="troop-glow ${troop.faction}"></div><img class="troop-img" src="${troop.imgSrc || ''}" alt="${troop.name}" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=''}else{this.style.display='none'}" data-fb="${troop.imgFallback || ''}"><div class="troop-name"><span class="cn">${troop.displayName || troop.name}</span><span class="mr">${troop.morale}/100</span></div>`;
    tile.appendChild(layer);
  }
}

export default function EventBattle({ onBattleEnd, playerId, playerName, playerSilver, currentEvent }) {
  const [stage, setStage] = useState(STAGE.LOADING);
  const [layoutWidth, setLayoutWidth] = useState('auto');
  const mapCardRef = useRef(null);
  const initRef = useRef(false);
  const troopsRendered = useRef(false);
  const mountedRef = useRef(true);

  // 组件卸载标记，防止异步操作在卸载后更新状态
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 从 PlayerContext 获取编组数据
  const { player, cards } = usePlayerContext();

  const bm = useBattleMap();

  const manualBattleRef = useRef(null);

  const engine = useBattleEngine({
    battleTroops: bm.battleTroops,
    setBattleTroops: bm.setBattleTroops,
    mapResult: bm.mapResult,
    addLog: bm.addLog,
    setLogs: bm.setLogs,
    battlePlaying: bm.battlePlaying,
    setBattlePlaying: bm.setBattlePlaying,
    roundNum: bm.roundNum,
    setRoundNum: bm.setRoundNum,
    silverAmount: bm.silverAmount,
    setSilverAmount: bm.setSilverAmount,
    activeFormation: bm.activeFormation,
    setActiveFormation: bm.setActiveFormation,
    autoBattle: bm.autoBattle,
    autoFormation: bm.autoFormation,
    mapCardRef,
    manualBattleRef,
  });

  const manual = useManualBattle({
    battleTroops: bm.battleTroops,
    mapResult: bm.mapResult,
    mapCardRef,
    performAttack: engine.performAttack,
    performCounterAttack: engine.performCounterAttack,
    battleKill: engine.battleKill,
    battleMove: engine.battleMove,
    formationGroupMove: engine.formationGroupMove,
    removeFormationBuffs: engine.removeFormationBuffs,
    addLog: bm.addLog,
  });

  // 同步 manualBattleRef
  manualBattleRef.current = manual;

  // 从编组数据构建我方部队单位
  const buildPlayerUnits = useCallback(() => {
    if (!cards || cards.length === 0) return [];
    const units = [];

    // 玩家角色 + 玩家部队
    const playerTroop = cards.find(c => c.card_type === 'troop' && c.is_equipped && c.equipped_by === 'player' && c.equipped_slot === 'troop');
    if (playerTroop && player) {
      const cfg = playerTroop.config || {};
      units.push({
        troop: {
          id: cfg.id || playerTroop.card_id,
          instanceId: playerTroop.instance_id,
          name: cfg.name || playerTroop.card_id,
          rarity: cfg.rarity || playerTroop.rarity || 'common',
          troopType: cfg.troopType,
          weaponType: cfg.weaponType,
          attack: cfg.attack || 0,
          defense: cfg.defense || 0,
          speed: cfg.speed || 0,
          movement: cfg.movement || 0,
          range: cfg.range || 1,
          maxTroops: (cfg.maxTroops || 0) + (playerTroop.bonus_max_troops || 0),
          troopWeight: cfg.troopWeight || 1,
          battleCount: playerTroop.battle_count ?? 0,
          maxBattleCount: playerTroop.max_battle_count ?? 25,
          skills: cfg.skills || [],
        },
        character: {
          name: player.character_name,
          courtesyName: player.character_name,
          combat: player.combat / 10,
          command: player.command / 10,
          intelligence: player.intelligence / 10,
          luck: player.luck / 10,
          courage: player.courage / 10,
          traitModifier: 0,
        },
        currentTroops: playerTroop.current_troops ?? ((cfg.maxTroops || 0) + (playerTroop.bonus_max_troops || 0)),
        maxTroops: (cfg.maxTroops || 0) + (playerTroop.bonus_max_troops || 0),
        morale: player.morale ?? 70,
      });
    }

    // 将领1 + 将领1部队（troop1, troop2）
    const char1Card = cards.find(c => c.card_type === 'character' && c.is_equipped && c.equipped_by === 'character1' && c.equipped_slot === 'character');
    const char1Troops = cards.filter(c => c.card_type === 'troop' && c.is_equipped && c.equipped_by === 'character1');
    if (char1Card && char1Troops.length > 0) {
      const charCfg = char1Card.config || {};
      const charData = {
        name: charCfg.name || char1Card.card_id,
        courtesyName: charCfg.name || char1Card.card_id,
        combat: charCfg.combat || 5,
        command: charCfg.command || 5,
        intelligence: charCfg.intelligence || 5,
        luck: charCfg.luck || 5,
        courage: charCfg.courage || 5,
        traitModifier: charCfg.traitModifier || 0,
      };
      // 所有已装备部队都上阵
      for (const t of char1Troops) {
        const tCfg = t.config || {};
        units.push({
          troop: {
            id: tCfg.id || t.card_id,
            instanceId: t.instance_id,
            name: tCfg.name || t.card_id,
            rarity: tCfg.rarity || t.rarity || 'common',
            troopType: tCfg.troopType,
            weaponType: tCfg.weaponType,
            attack: tCfg.attack || 0,
            defense: tCfg.defense || 0,
            speed: tCfg.speed || 0,
            movement: tCfg.movement || 0,
            range: tCfg.range || 1,
            maxTroops: (tCfg.maxTroops || 0) + (t.bonus_max_troops || 0),
            troopWeight: tCfg.troopWeight || 1,
            battleCount: t.battle_count ?? 0,
            maxBattleCount: t.max_battle_count ?? 25,
            skills: tCfg.skills || [],
          },
          character: charData,
          currentTroops: t.current_troops ?? ((tCfg.maxTroops || 0) + (t.bonus_max_troops || 0)),
          maxTroops: (tCfg.maxTroops || 0) + (t.bonus_max_troops || 0),
          morale: char1Card.morale ?? 70,
        });
      }
    }

    // 将领2 + 将领2部队
    const char2Card = cards.find(c => c.card_type === 'character' && c.is_equipped && c.equipped_by === 'character2' && c.equipped_slot === 'character');
    const char2Troops = cards.filter(c => c.card_type === 'troop' && c.is_equipped && c.equipped_by === 'character2');
    if (char2Card && char2Troops.length > 0) {
      const charCfg = char2Card.config || {};
      const charData = {
        name: charCfg.name || char2Card.card_id,
        courtesyName: charCfg.name || char2Card.card_id,
        combat: charCfg.combat || 5,
        command: charCfg.command || 5,
        intelligence: charCfg.intelligence || 5,
        luck: charCfg.luck || 5,
        courage: charCfg.courage || 5,
        traitModifier: charCfg.traitModifier || 0,
      };
      for (const t of char2Troops) {
        const tCfg = t.config || {};
        units.push({
          troop: {
            id: tCfg.id || t.card_id,
            instanceId: t.instance_id,
            name: tCfg.name || t.card_id,
            rarity: tCfg.rarity || t.rarity || 'common',
            troopType: tCfg.troopType,
            weaponType: tCfg.weaponType,
            attack: tCfg.attack || 0,
            defense: tCfg.defense || 0,
            speed: tCfg.speed || 0,
            movement: tCfg.movement || 0,
            range: tCfg.range || 1,
            maxTroops: (tCfg.maxTroops || 0) + (t.bonus_max_troops || 0),
            troopWeight: tCfg.troopWeight || 1,
            battleCount: t.battle_count ?? 0,
            maxBattleCount: t.max_battle_count ?? 25,
            skills: tCfg.skills || [],
          },
          character: charData,
          currentTroops: t.current_troops ?? ((tCfg.maxTroops || 0) + (t.bonus_max_troops || 0)),
          maxTroops: (tCfg.maxTroops || 0) + (t.bonus_max_troops || 0),
          morale: char2Card.morale ?? 70,
        });
      }
    }

    return units;
  }, [cards, player]);

  // 从事件ID解析稀有度：san_1_event_{type}_{rarity}{seq}，千位数字=稀有度
  const eventRarity = (() => {
    if (!currentEvent?.event_id) return 'common';
    const parts = currentEvent.event_id.split('_');
    const lastPart = parts[parts.length - 1]; // e.g. "1001" or "2001"
    const thousandsDigit = lastPart.charAt(0);
    const map = { '1': 'common', '2': 'rare', '3': 'epic', '4': 'legendary', '5': 'core' };
    return map[thousandsDigit] || 'common';
  })();

  // 初始化：等待配置数据加载后，用真实编组生成地图 + 开启战斗
  useEffect(() => {
    if (initRef.current) return;
    if (bm.allTroops.length >= 3) {
      const playerUnits = buildPlayerUnits();
      if (playerUnits.length === 0) {
        // 没有编组数据，直接判定战斗失败（无奖励）
        initRef.current = true;
        onBattleEnd('defeat', 0, null);
        return;
      }
      initRef.current = true;
      bm.generate('standard');
      bm.assignRealBattleTroops(playerUnits, eventRarity);
      bm.toggleBattle();
      bm.setSilverAmount(playerSilver ?? 0);
      bm.toggleAutoFormation(true);
      setStage(STAGE.READY);
    }
  }, [bm.allTroops.length, buildPlayerUnits]); // eslint-disable-line react-hooks/exhaustive-deps

  // 地图渲染后，手动把部队渲染到 DOM（因为 showTroops={false}）
  useEffect(() => {
    if (troopsRendered.current) return;
    if (bm.mapResult && bm.battleTroops.length > 0 && mapCardRef.current) {
      // 等一帧让 BattleMap 完成 DOM 渲染
      requestAnimationFrame(() => {
        renderTroopsToDOM(mapCardRef, bm.battleTroops);
        troopsRendered.current = true;
      });
    }
  }, [bm.mapResult, bm.battleTroops]);

  // 同步布局宽度
  useEffect(() => {
    if (mapCardRef.current) {
      setLayoutWidth(mapCardRef.current.offsetWidth + 'px');
    }
  }, [bm.mapResult]);

  // 监听战斗结束 → 等引擎停止后直接回调事件系统
  const endedRef = useRef(false);
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
    // 等引擎播放完毕再回调（轮询检查）
    const check = setInterval(() => {
      if (!bm.battlePlaying) {
        clearInterval(check);
        if (mountedRef.current) {
          const silverSpent = (playerSilver ?? 0) - bm.silverAmount;
          // 计算战后评分
          const scoreResult = calculateBattleScore(
            bm.battleTroops,
            bm.roundNum,
            result
          );

          // 保存战报到数据库
          const battleId = `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const playerTroops = bm.battleTroops.filter(t => t.faction === 'player');
          const enemyTroops = bm.battleTroops.filter(t => t.faction === 'enemy');
          const totalKills = enemyTroops.filter(t => t.currentTroops <= 0).length;
          const logText = bm.logs.map(l => l?.text || '').filter(Boolean).join('\n');

          // 我方部队战后兵力（用于更新数据库）
          const troopCasualties = playerTroops
            .filter(t => t.instanceId)
            .map(t => ({ instanceId: t.instanceId, currentTroops: Math.max(0, t.currentTroops) }));

          // 我方战后士气（按将领分组，取该将领存活部队的士气值）
          const moraleUpdates = [];
          // 玩家角色士气
          const playerTroop = playerTroops.find(t => t.character?.courtesyName === bm.battleTroops.find(bt => bt.faction === 'player')?.character?.courtesyName);
          if (playerTroops.length > 0) {
            const alivePT = playerTroops.find(t => t.currentTroops > 0) || playerTroops[0];
            moraleUpdates.push({ target: 'player', morale: alivePT.morale ?? 70 });
          }
          // 将领卡士气（通过 instanceId 关联）
          for (const t of playerTroops) {
            if (t.instanceId) {
              moraleUpdates.push({ target: 'card', instanceId: t.instanceId, morale: t.morale ?? 70 });
            }
          }

          battleAPI.saveBattle({
            battleId,
            playerId: playerId || 'unknown',
            battleType: 'pve_event',
            opponentType: 'event_enemy',
            opponentName: '事件战斗',
            result: result === 'victory' ? 'win' : 'lose',
            playerTeam: playerTroops.map(t => ({
              name: t.character?.courtesyName || t.character?.name || t.name,
              rarity: t.rarity,
            })),
            opponentTeam: enemyTroops.map(t => ({
              name: t.character?.courtesyName || t.character?.name || t.name,
              rarity: t.rarity,
            })),
            battleLog: logText,
            totalKills,
            duration: bm.roundNum,
            rewards: {
              battleScore: scoreResult.score,
              battleGrade: scoreResult.grade,
              scoreDetails: scoreResult.details,
            },
            troopCasualties,
            moraleUpdates,
            chestRewards: manual.collectedChestRewards || [],
          }).catch(err => console.error('[EventBattle] 保存战报失败:', err));

          onBattleEnd(result, silverSpent > 0 ? silverSpent : 0, scoreResult);
        }
      }
    }, 200);
    return () => clearInterval(check);
  }, [bm.logs, bm.battlePlaying, stage, onBattleEnd]);

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
            mapResult={bm.mapResult}
            mapLabel={bm.mapLabel}
            battleTroops={bm.battleTroops}
            showTroops={false}
            isBattle={bm.isBattle}
            mapCardRef={mapCardRef}
            autoBattle={bm.autoBattle}
            onTakeover={() => bm.toggleAutoBattle(false)}
            onTileClick={!bm.autoBattle ? manual.handleTileClick : undefined}
            manualProps={!bm.autoBattle ? {
              phase: manual.phase,
              activeTroop: manual.activeTroop,
              formationTroops: manual.formationTroops,
              onStandby: manual.handleStandby,
              onFormationStandby: manual.handleFormationStandby,
              attackPreview: manual.attackPreview,
              chestReward: manual.chestReward,
              confirmChestReward: manual.confirmChestReward,
            } : undefined}
          />
        )}

        {bm.roundNum === 0 && (
          <BattleAuxPanel
            silverAmount={bm.silverAmount}
            autoBattle={bm.autoBattle}
            toggleAutoBattle={bm.toggleAutoBattle}
            autoFormation={bm.autoFormation}
            toggleAutoFormation={bm.toggleAutoFormation}
            maxWidth={layoutWidth}
            onStartBattle={stage === STAGE.READY ? engine.playBattleRound : null}
            battlePlaying={bm.battlePlaying}
          />
        )}

        {bm.roundNum === 0 && (
          <MapLegend maxWidth={layoutWidth} />
        )}

        <BattleLog logs={bm.logs} visible={bm.isBattle} maxWidth={layoutWidth} />
      </div>
    </div>
  );
}
