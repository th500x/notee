/**
 * 回合制战斗引擎：在 `mapResult.terrain` 定义的矩形格网上执行回合、动画与阵型。
 * 事件/攻城为默认 8×10；战役为整图 16×20，坐标与战略格 `(col,row)` 一致（x=列，y=行）。
 *
 * 层次职责：
 *   useBattleAnimations  → DOM 渲染、动画序列、单次攻击/反击执行
 *   useBattleEngine（此文件）→ 阵型编排、回合调度、AI 决策编排、银两结算
 */

import { useState, useCallback, useRef } from 'react';
import { autoSelectFormation } from '@/systems/formationSystem';
import {
  dist,
  troopAttackRange,
  getMoveCost as _getMoveCost,
  findBestMoveTarget as _findBestMoveTarget,
} from '@/battle/ai/battleTurnAi';
import { resolveChestReward } from '@/battle/chestRewardResolver';
import {
  getMapTerrainDimensions,
  getSouthDeployRowRange,
  isInMapGrid,
} from '@shared/utils/tacticalBattleGrid';
import * as fmt from '@/systems/battleTextFormatter';
import {
  sleep,
  setBattleAnimationSkipDelays,
  resolveTileElement,
  useBattleAnimations,
} from '@/battle/useBattleAnimations';
import { trimSkipForTroop } from '@/battle/battleLogPolicy';

export { setBattleAnimationSkipDelays };

/**
 * 阵型 shape 仅含 3 格时，为其余我方单位在底部部署带内补互不重叠的 passable 格（距阵型中心曼哈顿近者优先），
 * 避免多支部队叠在同一格导致「少一支兵」。
 */
function collectExtraDeployPositions(needed, occupiedKeys, mapResult, battleTroops, formation, cy, cx) {
  if (needed <= 0) return [];
  const south = getSouthDeployRowRange(mapResult);
  if (!south.length) return [];
  const yLo = south[0];
  const yHi = south[south.length - 1];
  const { w: mapW } = getMapTerrainDimensions(mapResult);
  const forbid = formation.forbidTerrain || [];
  const occupied = new Set(occupiedKeys);
  const candidates = [];
  for (let y = yLo; y <= yHi; y++) {
    for (let x = 0; x < mapW; x++) {
      const k = `${y},${x}`;
      if (occupied.has(k)) continue;
      if (!isInMapGrid(y, x, mapResult)) continue;
      if (_getMoveCost(y, x, mapResult) === Infinity) continue;
      if (battleTroops.some((t) => t.faction === 'enemy' && t.currentTroops > 0 && t.y === y && t.x === x)) continue;
      if (mapResult && forbid.length > 0) {
        const tile = mapResult.terrain[y]?.[x];
        if (forbid.includes(tile)) continue;
      }
      const dist = Math.abs(y - cy) + Math.abs(x - cx);
      candidates.push({ y, x, dist });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist || a.y - b.y || a.x - b.x);
  const out = [];
  for (const c of candidates) {
    if (out.length >= needed) break;
    const k = `${c.y},${c.x}`;
    if (occupied.has(k)) continue;
    occupied.add(k);
    out.push({ y: c.y, x: c.x });
  }
  return out;
}

export function useBattleEngine({
  battleTroops, setBattleTroops,
  mapResult, addLog, setLogs,
  battlePlaying, setBattlePlaying,
  roundNum, setRoundNum,
  silverAmount, setSilverAmount,
  activeFormation, setActiveFormation,
  autoBattle, autoFormation,
  mapCardRef,
  /** 可选：战役地图等自定义瓦片宿主；缺省时仅用 mapCardRef 战术格网 */
  battleSurfaceRef = null,
  manualBattleRef,
  /** 战役：坚守 X 回合即胜（玩家视角）；null 表示不适用 */
  minRounds = null,
  /** 超过此回合数判败；默认 30 回合（事件/战役通用） */
  maxRounds = 30,
  /** 可选：战斗结束时由引擎通知壳层结束原因（含战役主将：'campaign_boss_win' | 'campaign_hero_loss'） */
  setBattleEndReason = null,
  /** 战役：战报省略友军 ally 流水，减小 battle_log（仅 LargeMapBattle 开启） */
  trimAllyBattleLog = false,
}) {
  const speedRef = useRef(1);
  const roundNumRef = useRef(roundNum);
  const activeFormationRef = useRef(activeFormation);
  const autoBattleRef = useRef(autoBattle);
  const battlePlayingRef = useRef(battlePlaying);
  const minRoundsRef = useRef(minRounds);
  const maxRoundsRef = useRef(maxRounds);
  const takenOver = useRef(false);

  // ── 自动战斗宝箱 ──
  const [autoChestReward, setAutoChestReward] = useState(null);
  const autoChestRewardsRef = useRef([]);

  // 同步 ref 与 state
  roundNumRef.current = roundNum;
  activeFormationRef.current = activeFormation;
  autoBattleRef.current = autoBattle;
  battlePlayingRef.current = battlePlaying;
  minRoundsRef.current = minRounds;
  maxRoundsRef.current = maxRounds;

  // ── 动画层（DOM 渲染、战斗动画序列、攻击/反击执行） ─────────────────────────
  const {
    getTileEl,
    renderTroopOnTile, clearTroopFromTile,
    battleAttack, battleCrit, battleMiss,
    battleKill, runBattleKill,
    applyEndOfRoundFire,
    battleRanged, battleSkill,
    checkTrap, battleMove,
    performAttack, performCounterAttack,
  } = useBattleAnimations({
    battleSurfaceRef, mapCardRef, mapResult, addLog, speedRef, battleTroops, trimAllyBattleLog,
  });

  /** 战役主将（boss/hero）即时胜负：写入 battleEndReason，供 useBattleSettlement 在「敌军未全灭」等情况下仍能结算 */
  const notifyCampaignCommanderEnd = useCallback(
    (outcome) => {
      if (outcome === 'player_win') setBattleEndReason?.('campaign_boss_win');
      else if (outcome === 'enemy_win') setBattleEndReason?.('campaign_hero_loss');
      addLog(fmt.fmtCampaignCommanderEnd(outcome), 'death');
      if (outcome === 'player_win') {
        const remainingEnemy = battleTroops.filter((t) => t.faction === 'enemy' && t.currentTroops > 0).length;
        if (remainingEnemy > 0) {
          addLog(`📜 本回合尚未行动的单位不再出手；场上 ${remainingEnemy} 支敌军残部按战役规则结束战斗。`, 'round');
        }
      }
      addLog('── 本场战斗记录结束 ──', 'round');
      return outcome;
    },
    [setBattleEndReason, addLog, battleTroops],
  );

  // ── 自动战斗宝箱开启 ──────────────────────────────────────────────────────
  const checkChestAuto = useCallback(async (troop) => {
    if (!troop || troop.currentTroops <= 0) return;
    const reward = await resolveChestReward(troop, mapResult, battleTroops);
    if (!reward) return;
    addLog(`  📦 ${reward.troopName} 开启宝箱，获得 ${reward.name}（${reward.rarityLabel}）`, 'skill');
    autoChestRewardsRef.current.push(reward);
    setAutoChestReward(reward);
    await sleep(2000, speedRef.current);
    setAutoChestReward(null);
    await sleep(200, speedRef.current);
  }, [mapResult, battleTroops, addLog]);

  // ── 阵型整体移动 ──────────────────────────────────────────────────────────

  const formationGroupMove = useCallback(async (troops, dy, dx) => {
    const fc = troops[0]?.faction || 'player';
    const newPositions = troops.map(t => ({ troop: t, ny: t.y + dy, nx: t.x + dx }));
    const formationIds = new Set(troops.map((t) => t.id));
    const allValid = newPositions.every((p) => {
      if (!isInMapGrid(p.ny, p.nx, mapResult)) return false;
      if (_getMoveCost(p.ny, p.nx, mapResult) === Infinity) return false;
      const occupant = battleTroops.find(
        (bt) =>
          bt.currentTroops > 0 &&
          bt.y === p.ny &&
          bt.x === p.nx &&
          !formationIds.has(bt.id) &&
          bt.faction !== 'ally',
      );
      if (occupant) return false;
      return true;
    });
    if (!allValid) {
      if (import.meta.env.DEV) {
        const details = newPositions.map((p) => ({
          id: p.troop.id,
          from: [p.troop.y, p.troop.x],
          to: [p.ny, p.nx],
          oob: !isInMapGrid(p.ny, p.nx, mapResult),
          impass: _getMoveCost(p.ny, p.nx, mapResult) === Infinity,
          occupant: (() => {
            const bt = battleTroops.find(
              (b) =>
                b.currentTroops > 0 &&
                b.y === p.ny &&
                b.x === p.nx &&
                !formationIds.has(b.id) &&
                b.faction !== 'ally',
            );
            return bt
              ? { id: bt.id, faction: bt.faction, y: bt.y, x: bt.x }
              : null;
          })(),
        }));
      }
      return false;
    }

    const hls = [];
    for (const p of newPositions) {
      const tile = resolveTileElement(battleSurfaceRef, mapCardRef, p.ny, p.nx, mapResult);
      if (tile) {
        const hl = document.createElement('div');
        hl.className = `move-hl ${fc}`;
        tile.appendChild(hl);
        hls.push(hl);
      }
    }
    for (const t of troops) clearTroopFromTile(t);
    for (const p of newPositions) { p.troop.y = p.ny; p.troop.x = p.nx; }
    for (const t of troops) renderTroopOnTile(t);
    for (const hl of hls) setTimeout(() => hl.remove(), 600);
    await sleep(200, speedRef.current);
    for (const t of troops) {
      await checkTrap(t, t.y, t.x);
      if (t.currentTroops <= 0) {
        const c = await runBattleKill(t);
        if (c) return c;
      }
    }
    return true;
  }, [battleSurfaceRef, mapCardRef, mapResult, battleTroops, clearTroopFromTile, renderTroopOnTile, checkTrap, runBattleKill]);

  // ── 应用阵型 ──────────────────────────────────────────────────────────────

  const applyFormationBuffs = useCallback(async (formation) => {
    if (!formation) return;
    const playerTroops = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0);
    if (playerTroops.length < 3) return;
    const shape = formation.shape;
    let bestCenter = null;
    const candidateCenters = [];
    const south = getSouthDeployRowRange(mapResult);
    if (!south.length) {
      addLog(fmt.fmtFormationFail(), 'round');
      return;
    }
    const yLo = south[0];
    const yHi = south[south.length - 1];
    const { w: mapW } = getMapTerrainDimensions(mapResult);
    const midX = (mapW - 1) / 2;
    for (let y = yLo; y <= yHi; y++) {
      for (let x = 1; x <= mapW - 2; x++) candidateCenters.push({ y, x });
    }
    const nPlayer = playerTroops.length;
    // 优先在「靠近当前部署位置」处成阵，避免战役图里从部署区远端瞬移到最靠北格（小型图部署区窄，不明显）
    const pcY = nPlayer > 0 ? playerTroops.reduce((s, t) => s + t.y, 0) / nPlayer : 0;
    const pcX = nPlayer > 0 ? playerTroops.reduce((s, t) => s + t.x, 0) / nPlayer : 0;
    candidateCenters.sort((a, b) => {
      const da = Math.abs(a.y - pcY) + Math.abs(a.x - pcX);
      const db = Math.abs(b.y - pcY) + Math.abs(b.x - pcX);
      if (da !== db) return da - db;
      return (a.y - b.y) || Math.abs(a.x - midX) - Math.abs(b.x - midX);
    });
    const forbid = formation.forbidTerrain || [];
    for (const center of candidateCenters) {
      const basePositions = shape.map((s) => ({ y: center.y + s.dy, x: center.x + s.dx }));
      const baseValid = basePositions.every((p) => {
        if (!isInMapGrid(p.y, p.x, mapResult)) return false;
        if (_getMoveCost(p.y, p.x, mapResult) === Infinity) return false;
        if (battleTroops.some((t) => t.faction === 'enemy' && t.currentTroops > 0 && t.y === p.y && t.x === p.x)) return false;
        if (mapResult && forbid.length > 0) {
          const tile = mapResult.terrain[p.y]?.[p.x];
          if (forbid.includes(tile)) return false;
        }
        return true;
      });
      const baseKeys = basePositions.map((p) => `${p.y},${p.x}`);
      if (!baseValid || new Set(baseKeys).size !== baseKeys.length) continue;

      let positions;
      if (nPlayer <= basePositions.length) {
        positions = basePositions.slice(0, nPlayer);
      } else {
        const extraNeeded = nPlayer - basePositions.length;
        const extras = collectExtraDeployPositions(
          extraNeeded, baseKeys, mapResult, battleTroops, formation, center.y, center.x,
        );
        if (extras.length < extraNeeded) continue;
        positions = basePositions.concat(extras);
      }
      const allKeys = positions.map((p) => `${p.y},${p.x}`);
      if (new Set(allKeys).size !== allKeys.length) continue;
      bestCenter = { center, positions };
      break;
    }
    if (!bestCenter) {
      addLog(fmt.fmtFormationFail(), 'round');
      return;
    }
    const { positions } = bestCenter;
    for (let i = 0; i < playerTroops.length; i++) {
      const troop = playerTroops[i];
      const target = positions[i];
      clearTroopFromTile(troop);
      troop.y = target.y;
      troop.x = target.x;
      renderTroopOnTile(troop);
    }
    for (const t of playerTroops) {
      t._formationBuffs = formation.effects;
      if (formation.effects.moveBonus) { t._origMovement = t.movement; t.movement = Math.max(1, (t.movement || 3) + formation.effects.moveBonus); }
      // 鹤翼「两翼」射程加成仅作用于弓兵，避免近战单位在阵型整体攻击中吃到 +1 射程
      if (formation.effects.rangeBonus) {
        const wt = t.weaponType || '';
        if (wt.startsWith('archer')) {
          t._origRange = t.range;
          t.range = troopAttackRange(t) + formation.effects.rangeBonus;
        }
      }
    }
    activeFormationRef.current = formation;
    setActiveFormation(formation);
    addLog(fmt.fmtFormation(formation.name, formation.desc), 'skill');
    for (const pos of positions) {
      const tile = resolveTileElement(battleSurfaceRef, mapCardRef, pos.y, pos.x, mapResult);
      if (tile) {
        const hl = document.createElement('div');
        hl.className = 'move-hl player';
        hl.style.animation = 'hl-fade 2s ease-out forwards';
        tile.appendChild(hl);
        setTimeout(() => hl.remove(), 2000);
      }
    }
  }, [battleTroops, mapResult, addLog, clearTroopFromTile, renderTroopOnTile, setActiveFormation, battleSurfaceRef, mapCardRef]);

  // ── 移除阵型 ──────────────────────────────────────────────────────────────

  const removeFormationBuffs = useCallback(() => {
    const curFormation = activeFormationRef.current;
    if (!curFormation) return;
    const playerTroops = battleTroops.filter(t => t.faction === 'player');
    for (const t of playerTroops) {
      if (t._origMovement != null) { t.movement = t._origMovement; delete t._origMovement; }
      if (t._origRange    != null) { t.range    = t._origRange;    delete t._origRange;    }
      delete t._formationBuffs;
      delete t._formationHandled;
    }
    addLog(fmt.fmtFormationDisband(curFormation.name), 'round');
    activeFormationRef.current = null;
    setActiveFormation(null);
  }, [battleTroops, addLog, setActiveFormation]);

  // ── 阵型整体行动（AI 驱动） ───────────────────────────────────────────────

  const formationGroupAction = useCallback(async () => {
    const fTroops = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0 && t._formationBuffs);
    if (fTroops.length === 0) { removeFormationBuffs(); return; }
    const curFormation = activeFormationRef.current;
    addLog(fmt.fmtFormationAction(curFormation?.name), 'skill');
    await sleep(300, speedRef.current);

    const enemies = battleTroops.filter(t => t.faction === 'enemy' && t.currentTroops > 0);
    if (enemies.length === 0) return;

    const centerY = Math.round(fTroops.reduce((s, t) => s + t.y, 0) / fTroops.length);
    const centerX = Math.round(fTroops.reduce((s, t) => s + t.x, 0) / fTroops.length);
    let closestEnemy = null, closestDist = Infinity;
    for (const e of enemies) {
      const d = Math.abs(e.y - centerY) + Math.abs(e.x - centerX);
      if (d < closestDist) { closestDist = d; closestEnemy = e; }
    }
    if (!closestEnemy) return;

    const movements = fTroops.map(t => t.movement || 3);
    const formationMove = Math.round(movements.reduce((a, b) => a + b, 0) / movements.length);

    // 检查阵型中是否有部队可攻击任何敌人
    const canAnyAttack = () => {
      const aliveFT = fTroops.filter(t => t.currentTroops > 0);
      const aliveEn = enemies.filter(e => e.currentTroops > 0);
      for (const atk of aliveFT) {
        for (const e of aliveEn) {
          if (dist(atk, e) <= troopAttackRange(atk)) return true;
        }
      }
      return false;
    };

    // 移动前先检查：已经有部队在攻击范围内则跳过移动
    if (!canAnyAttack()) {
      const dirY = closestEnemy.y < centerY ? -1 : (closestEnemy.y > centerY ? 1 : 0);
      const dirX = closestEnemy.x < centerX ? -1 : (closestEnemy.x > centerX ? 1 : 0);
      let remainMove = formationMove;
      if (dirY !== 0) {
        const vertSteps = Math.min(remainMove, Math.abs(closestEnemy.y - centerY));
        for (let i = 0; i < vertSteps && remainMove > 0; i++) {
          const maxCost = Math.max(...fTroops.filter(t => t.currentTroops > 0).map(t => {
            const ny = t.y + dirY;
            return isInMapGrid(ny, t.x, mapResult) ? _getMoveCost(ny, t.x, mapResult) : Infinity;
          }));
          if (maxCost > remainMove || maxCost === Infinity) break;
          addLog(fmt.fmtFormationMove(dirY), 'move');
          const ok = await formationGroupMove(fTroops.filter(t => t.currentTroops > 0), dirY, 0);
          if (ok === 'player_win' || ok === 'enemy_win') return ok;
          if (!ok) break;
          remainMove -= maxCost;
        }
      }
      if (dirX !== 0 && remainMove > 0) {
        const horizSteps = Math.min(remainMove, Math.abs(closestEnemy.x - centerX));
        for (let i = 0; i < horizSteps && remainMove > 0; i++) {
          const maxCost = Math.max(...fTroops.filter(t => t.currentTroops > 0).map(t => {
            const nx = t.x + dirX;
            return isInMapGrid(t.y, nx, mapResult) ? _getMoveCost(t.y, nx, mapResult) : Infinity;
          }));
          if (maxCost > remainMove || maxCost === Infinity) break;
          addLog(fmt.fmtFormationMoveX(dirX), 'move');
          const ok = await formationGroupMove(fTroops.filter(t => t.currentTroops > 0), 0, dirX);
          if (ok === 'player_win' || ok === 'enemy_win') return ok;
          if (!ok) break;
          remainMove -= maxCost;
        }
      }
    }

    await sleep(200, speedRef.current);

    // 攻击
    const aliveFTroops = fTroops.filter(t => t.currentTroops > 0);
    const aliveEnemies = enemies.filter(e => e.currentTroops > 0);
    const newCenterY = Math.round(aliveFTroops.reduce((s, t) => s + t.y, 0) / aliveFTroops.length);
    const newCenterX = Math.round(aliveFTroops.reduce((s, t) => s + t.x, 0) / aliveFTroops.length);
    const sortedEnemies = [...aliveEnemies].sort((a, b) => {
      const da = Math.abs(a.y - newCenterY) + Math.abs(a.x - newCenterX);
      const db = Math.abs(b.y - newCenterY) + Math.abs(b.x - newCenterX);
      return da - db;
    });

    let anyCanAttack = false;
    for (const atk of aliveFTroops) {
      for (const e of sortedEnemies) {
        if (e.currentTroops > 0 && dist(atk, e) <= troopAttackRange(atk)) { anyCanAttack = true; break; }
      }
      if (anyCanAttack) break;
    }
    if (!anyCanAttack) {
      addLog(fmt.fmtFormationWait(), 'move');
      for (const t of fTroops) t._formationHandled = true;
      return;
    }

    addLog(fmt.fmtFormationAttack(), 'skill');
    await sleep(200, speedRef.current);

    for (const atk of aliveFTroops) {
      if (atk.currentTroops <= 0) continue;
      let target = null;
      for (const e of sortedEnemies) {
        if (e.currentTroops > 0 && dist(atk, e) <= troopAttackRange(atk)) { target = e; break; }
      }
      if (!target) continue;
      await performAttack(atk, target);
      if (target.currentTroops <= 0) {
        const c = await runBattleKill(target);
        if (c === 'player_win' || c === 'enemy_win') return c;
      }
    }

    // 敌方反击
    const survivingEnemies  = aliveEnemies.filter(e => e.currentTroops > 0);
    const survivingFTroops  = aliveFTroops.filter(t => t.currentTroops > 0);
    if (survivingEnemies.length > 0 && survivingFTroops.length > 0) {
      const ce = survivingEnemies[0];
      const ct = survivingFTroops.find(t => dist(ce, t) <= troopAttackRange(ce));
      if (ct) {
        addLog(fmt.fmtEnemyCounter(), 'attack');
        await sleep(150, speedRef.current);
        await performAttack(ce, ct);
        if (ct.currentTroops <= 0) {
          const c = await runBattleKill(ct);
          if (c === 'player_win' || c === 'enemy_win') return c;
        }
      }
    }

    // 自动战斗宝箱：阵型中存活 player 部队依次检查脚下宝箱
    for (const t of aliveFTroops.filter(ft => ft.currentTroops > 0 && ft.faction === 'player')) {
      await checkChestAuto(t);
    }

    for (const t of fTroops) t._formationHandled = true;
    removeFormationBuffs();
    await sleep(300, speedRef.current);
  }, [battleTroops, mapResult, addLog, formationGroupMove, performAttack, runBattleKill, removeFormationBuffs, checkChestAuto]);

  // ── 执行单回合 ────────────────────────────────────────────────────────────

  const executeSingleRound = useCallback(async () => {
    const alive = battleTroops.filter(t => t.currentTroops > 0);
    if (alive.length === 0) return 'enemy_win';
    const players = alive.filter(t => t.faction === 'player');
    const enemies = alive.filter(t => t.faction === 'enemy');
    if (players.length === 0) return 'enemy_win';
    if (enemies.length === 0) return 'player_win';

    const newRound = roundNumRef.current + 1;
    roundNumRef.current = newRound;
    setRoundNum(newRound);

    // 回合上限：超过 maxRounds 判为败
    const maxR = maxRoundsRef.current;
    if (maxR != null && newRound > maxR) {
      addLog(`⏰ 已达最大回合数（${maxR}回合），战败`, 'death');
      setBattleEndReason?.('max_rounds');
      return 'enemy_win';
    }
    // 坚守胜利：达到 minRounds 回合即视为守住
    const minR = minRoundsRef.current;
    if (minR != null && newRound >= minR) {
      addLog(`🏆 坚守 ${minR} 回合，战胜！`, 'round');
      setBattleEndReason?.('min_rounds');
      return 'player_win';
    }

    addLog(fmt.fmtRoundStart(newRound), 'round');
    await sleep(400, speedRef.current);

    // 首回合阵型
    if (newRound === 1 && autoFormation) {
      const formation = autoSelectFormation(battleTroops, mapResult ? mapResult.terrain : null);
      if (formation) {
        await applyFormationBuffs(formation);
        await sleep(500, speedRef.current);
      } else {
        addLog(fmt.fmtNoFormation(), 'round');
      }
    }

    if (activeFormationRef.current) {
      if (autoBattleRef.current) {
        const fgEnd = await formationGroupAction();
        if (fgEnd === 'player_win' || fgEnd === 'enemy_win') {
          return notifyCampaignCommanderEnd(fgEnd);
        }
        await sleep(300, speedRef.current);
      } else {
        if (manualBattleRef?.current) {
          await manualBattleRef.current.startFormationTurn(
            battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0 && t._formationBuffs),
            activeFormationRef.current,
          );
        }
        await sleep(300, speedRef.current);
      }
      // 阵型行动后胜负检查
      const fmtP = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0);
      const fmtE = battleTroops.filter(t => t.faction === 'enemy'  && t.currentTroops > 0);
      if (fmtP.length === 0) { addLog(fmt.fmtBattleEnd('enemy_win'),  'death'); return 'enemy_win'; }
      if (fmtE.length === 0) { addLog(fmt.fmtBattleEnd('player_win'), 'round'); return 'player_win'; }
    }

    const turnOrder = [...alive].sort((a, b) => (b.speed || 4) - (a.speed || 4));
    for (const troop of turnOrder) {
      if (troop.currentTroops <= 0) continue;
      if (troop._formationHandled) continue;

      // 回合中途胜负检查：任一方全灭则立即结束
      const midPlayers = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0);
      const midEnemies = battleTroops.filter(t => t.faction === 'enemy'  && t.currentTroops > 0);
      if (midPlayers.length === 0) { addLog(fmt.fmtBattleEnd('enemy_win'),  'death'); return 'enemy_win'; }
      if (midEnemies.length === 0) { addLog(fmt.fmtBattleEnd('player_win'), 'round'); return 'player_win'; }

      if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtTurnStart(troop), 'round');
      await sleep(200, speedRef.current);

      // ── 手动模式：仅 faction:'player' 我军暂停；faction:'ally' 友军 NPC 走下方 AI
      if (!autoBattleRef.current && manualBattleRef?.current && troop.faction === 'player') {
        await manualBattleRef.current.startManualTurn(troop);
        await sleep(200, speedRef.current);
        continue;
      }

      // ── AI 决策（自动模式 或 敌方/友军 NPC 部队） ──
      const shouldChest = autoBattleRef.current && troop.faction === 'player';
      const decision = _findBestMoveTarget(troop, battleTroops, mapResult, { prioritizeChests: shouldChest });
      if (!decision) {
        if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtNoTarget(troop), 'move');
        await sleep(200, speedRef.current);
        continue;
      }

      if (decision.move && decision.move.length > 0) {
        const campMove = await battleMove(troop, decision.move);
        if (campMove === 'player_win' || campMove === 'enemy_win') {
          return notifyCampaignCommanderEnd(campMove);
        }
        if (troop.currentTroops <= 0) continue;
      }

      if (decision.target && decision.target.currentTroops > 0) {
        const d = dist(troop, decision.target);
        if (d <= troopAttackRange(troop)) {
          await performAttack(troop, decision.target);
          if (decision.target.currentTroops <= 0) {
            const c = await runBattleKill(decision.target);
            if (c === 'player_win' || c === 'enemy_win') {
              return notifyCampaignCommanderEnd(c);
            }
          } else {
            const ca = await performCounterAttack(troop, decision.target);
            if (ca === 'player_win' || ca === 'enemy_win') {
              return notifyCampaignCommanderEnd(ca);
            }
          }
        } else if (!trimSkipForTroop(trimAllyBattleLog, troop)) {
          addLog(fmt.fmtOutOfRange(troop, d, troopAttackRange(troop)), 'move');
        }
      } else if (!decision.target) {
        if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtStillOutOfRange(troop), 'move');
      }

      // 自动战斗宝箱开启（player 部队行动后检查脚下宝箱）
      if (shouldChest && troop.currentTroops > 0) {
        await checkChestAuto(troop);
      }
      await sleep(200, speedRef.current);
    }

    for (const t of battleTroops) delete t._formationHandled;

    const fireRet = await applyEndOfRoundFire(battleTroops);
    if (fireRet.outcome === 'player_win' || fireRet.outcome === 'enemy_win') {
      return notifyCampaignCommanderEnd(fireRet.outcome);
    }

    const pAlive = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0);
    const eAlive = battleTroops.filter(t => t.faction === 'enemy'  && t.currentTroops > 0);
    if (pAlive.length === 0) { addLog(fmt.fmtBattleEnd('enemy_win'),  'death'); return 'enemy_win'; }
    if (eAlive.length === 0) { addLog(fmt.fmtBattleEnd('player_win'), 'round'); return 'player_win'; }
    addLog(fmt.fmtRoundEnd(pAlive.length, eAlive.length), 'round');
    return 'continue';
  }, [battleTroops, setBattleTroops, setRoundNum, autoFormation, mapResult, addLog, trimAllyBattleLog,
      applyFormationBuffs, formationGroupAction, battleMove, performAttack, runBattleKill, performCounterAttack,
      applyEndOfRoundFire, notifyCampaignCommanderEnd, checkChestAuto]);

  // ── 播放回合 ──────────────────────────────────────────────────────────────

  const playBattleRound = useCallback(async () => {
    if (battlePlaying) {
      return;
    }
    speedRef.current = 2;
    /** 本场开战时是否为自动模式；用于切手动时提示文案，且与手动全程保持 speed=2 一致 */
    const startedWithAuto = autoBattleRef.current;
    setBattlePlaying(true);

    // 战役大地图：`data-battle-y/x` 宿主与 `setBattlePlaying(true)` 同批提交后，下一帧才挂载齐全。
    // 事件小地图已由 renderTroopsToBattleMapDom 画过 `.troop-layer`，此处有层则跳过。
    if (battleSurfaceRef?.current?.getTileEl) {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const t of battleTroops) {
        if (t.currentTroops <= 0) continue;
        const tile = resolveTileElement(battleSurfaceRef, mapCardRef, t.y, t.x, mapResult);
        if (!tile) continue;
        if (!tile.querySelector('.troop-layer')) renderTroopOnTile(t);
      }
    }

    const aliveEnemy     = battleTroops.filter((t) => t.faction === 'enemy'  && t.currentTroops > 0);
    const alivePlayerFac = battleTroops.filter((t) => t.faction === 'player' && t.currentTroops > 0);
    if (aliveEnemy.length === 0 || alivePlayerFac.length === 0) {
      addLog(
        aliveEnemy.length === 0
          ? '无法开战：场上无敌方部队。战役格子的 campaignUnit.troopId 须在部队配置中存在，否则大地图仍显示头像但战术阵中无敌军。'
          : '无法开战：我方无可战部队。',
        'death',
      );
      speedRef.current = 1;
      setBattlePlaying(false);
      return;
    }

    if (autoBattleRef.current) {
      // 自动战斗：扣银两
      const playerCount = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0).length;
      const cost = playerCount * 2;
      if (silverAmount < cost) {
        addLog(fmt.fmtSilverInsufficient(cost, playerCount, silverAmount), 'death');
        speedRef.current = 1;
        setBattlePlaying(false);
        return;
      }
      setSilverAmount(prev => prev - cost);
      addLog(fmt.fmtSilverCost(cost, silverAmount - cost), 'round');
    }

    let result = 'continue';
    try {
      while (result === 'continue') {
        // 中途从自动切为手动：仅打日志；动画速度与自动一致保持 speed=2
        if (!autoBattleRef.current && !takenOver.current) {
          takenOver.current = true;
          if (startedWithAuto) addLog('🖐 玩家接管战斗，切换为手动模式', 'round');
        }
        result = await executeSingleRound();
        if (result === 'continue') await sleep(300, speedRef.current);
      }
      // executeSingleRound 在「首回合前」即判胜负时不会递增 roundNum；
      // 壳层结束检测要求 roundNum>=1，否则无法结算。
      if ((result === 'player_win' || result === 'enemy_win') && roundNumRef.current < 1) {
        roundNumRef.current = 1;
        setRoundNum(1);
      }
    } finally {
      setBattleAnimationSkipDelays(false);
    }
    takenOver.current = false;
    speedRef.current = 1;
    setBattlePlaying(false);
  }, [
    battlePlaying, battleTroops, silverAmount,
    addLog, setSilverAmount, setBattlePlaying,
    executeSingleRound, battleSurfaceRef, mapCardRef, mapResult, renderTroopOnTile,
  ]);

  // ── Demo 按钮 ─────────────────────────────────────────────────────────────

  const playAtkDemo = useCallback(async () => {
    if (battlePlaying || battleTroops.length < 6) return;
    setBattlePlaying(true);
    await battleAttack(battleTroops[0], battleTroops[3], Math.floor(80 + Math.random() * 60));
    setBattlePlaying(false);
  }, [battlePlaying, battleTroops, setBattlePlaying, battleAttack]);

  const playCritDemo = useCallback(async () => {
    if (battlePlaying || battleTroops.length < 6) return;
    setBattlePlaying(true);
    await battleCrit(battleTroops[1], battleTroops[4], Math.floor(150 + Math.random() * 80));
    setBattlePlaying(false);
  }, [battlePlaying, battleTroops, setBattlePlaying, battleCrit]);

  const playMissDemo = useCallback(async () => {
    if (battlePlaying || battleTroops.length < 6) return;
    setBattlePlaying(true);
    await battleMiss(battleTroops[3], battleTroops[0]);
    setBattlePlaying(false);
  }, [battlePlaying, battleTroops, setBattlePlaying, battleMiss]);

  const playSkillDemo = useCallback(async () => {
    if (battlePlaying || battleTroops.length < 6) return;
    setBattlePlaying(true);
    const names = ['破阵', '火攻', '落雷', '连弩齐射'];
    await battleSkill(battleTroops[4], battleTroops[1], Math.floor(120 + Math.random() * 100), names[Math.floor(Math.random() * names.length)]);
    setBattlePlaying(false);
  }, [battlePlaying, battleTroops, setBattlePlaying, battleSkill]);

  const playRangedDemo = useCallback(async () => {
    if (battlePlaying || battleTroops.length < 6) return;
    setBattlePlaying(true);
    await battleRanged(battleTroops[2], battleTroops[5], Math.floor(60 + Math.random() * 50), '➤');
    setBattlePlaying(false);
  }, [battlePlaying, battleTroops, setBattlePlaying, battleRanged]);

  return {
    playBattleRound,
    performAttack, performCounterAttack, battleKill, battleMove,
    formationGroupMove, removeFormationBuffs,
    playAtkDemo, playCritDemo, playMissDemo, playSkillDemo, playRangedDemo,
    autoChestReward,
    getAutoChestRewards: () => autoChestRewardsRef.current.slice(),
  };
}
