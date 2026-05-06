/**
 * 战斗动画与 DOM 操作层
 *
 * 将 tacticalBattleEngine 中的 DOM 渲染、动画序列与基础战斗计算提取为独立模块，
 * 使回合驱动层（useBattleEngine）仅关注阵型编排与 AI 决策编排，
 * 动画层可独立调优与测试。
 *
 * 导出：
 *   - 模块函数：resolveTileElement / resolveSurfaceRoot / sleep / setBattleAnimationSkipDelays
 *   - Hook：   useBattleAnimations（含 performPhase3Heal / performPhase4Damage / performPhase5Composite、performSkillDemoStrike）
 */

import { useCallback } from 'react';
import { calcDamage, rollCritDodge, troopDamageToCasualties } from '@/systems/combatSystem';
import { resolveIncomingCasualtiesWithPhase2FirstHit } from '@shared/utils/skillPhase2Passive';
import {
  applyPhase3HealMutation,
  consumePhase3HealCharge,
  listPhase3HealTargetTroops,
  previewPhase3HealGains,
} from '@shared/utils/skillPhase3ActiveHeal';
import { applyPhase4CostSelf, consumePhase4DamageCharge, pickPhase4RandomVictims } from '@shared/utils/skillPhase4ActiveDamage';
import {
  consumePhase5CompositeCharge,
  phase5HealSlotStub,
} from '@shared/utils/skillPhase5CompositeDamage';
import { getTacticalActiveSkillCastRange } from '@shared/utils/tacticalSkillCastRange';
import { bindTroopPortraitImg } from '@/utils/troopBattlePortrait';
import { dist, troopAttackRange } from '@/battle/ai/battleTurnAi';
import { mapTileIndex, tacticalTileIndex } from '@shared/utils/tacticalBattleGrid';
import { outcomeIfCommanderEliminated } from '@/systems/battleCampaignRules';
import * as fmt from '@/systems/battleTextFormatter';
import { moraleInlineColorForTroopBar } from '@/components/battle/battleConstants';
import { applyMoraleOnStackEliminated } from '@/battle/commanderMorale';
import { trimSkipForCombatPair, trimSkipForTroop } from '@/battle/battleLogPolicy';

const GAME_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null
    ? import.meta.env.BASE_URL
    : '';

// ── 动画跳过控制 ──────────────────────────────────────────────────────────────

let battleAnimationSkipDelays = false;

/** PVE 离开超时等场景：跳过动画等待，战斗逻辑不变（由战斗壳层调用） */
export function setBattleAnimationSkipDelays(enabled) {
  battleAnimationSkipDelays = !!enabled;
}

export function sleep(ms, speed = 1) {
  if (battleAnimationSkipDelays) return Promise.resolve();
  const t = ms / (speed || 1);
  if (t <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, t));
}

// ── DOM 表面解析辅助（引擎与动画层共用，因此导出） ────────────────────────────

/**
 * 战斗表现层：`battleSurfaceRef` 与 `mapCardRef` 二选一，由壳层注入；
 * 不在二者之间静默切换。
 * - 战役：`createCampaignBattleSurface`（`data-battle-y/x`）
 * - 事件/攻城：`createTacticalMapCardSurface`（委托 `.map-grid .tile`）
 */
export function resolveTileElement(battleSurfaceRef, mapCardRef, y, x, mapResult = null) {
  const surf = battleSurfaceRef?.current;
  if (typeof surf?.getTileEl === 'function') return surf.getTileEl(y, x);
  const card = mapCardRef?.current;
  if (!card) return null;
  const tiles = card.querySelectorAll('.map-grid .tile');
  const idx = mapResult?.terrain?.[0]?.length
    ? mapTileIndex(y, x, mapResult)
    : tacticalTileIndex(y, x);
  return tiles[idx] ?? null;
}

export function resolveSurfaceRoot(battleSurfaceRef, mapCardRef) {
  const surf = battleSurfaceRef?.current;
  if (typeof surf?.getSurfaceRoot === 'function') return surf.getSurfaceRoot();
  return mapCardRef?.current ?? null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * 封装全部 DOM 渲染与战斗动画 `useCallback`，供 `useBattleEngine` 使用。
 *
 * @param {object}                 params
 * @param {React.MutableRefObject} params.battleSurfaceRef - 战役地图表面（可选）
 * @param {React.MutableRefObject} params.mapCardRef       - 战术格网根节点
 * @param {object|null}            params.mapResult        - 当前战场地图数据
 * @param {function}               params.addLog           - 战斗日志追加函数
 * @param {React.MutableRefObject} params.speedRef         - 动画速度倍率（ref，不触发重渲染）
 * @param {Array}                  params.battleTroops     - 当前战场所有部队（可变数组）
 * @param {boolean}                [params.trimAllyBattleLog] - 战役：省略友军相关战报行（入库体积）
 */
export function useBattleAnimations({
  battleSurfaceRef,
  mapCardRef,
  mapResult,
  addLog,
  speedRef,
  battleTroops,
  trimAllyBattleLog = false,
}) {
  // ── DOM helpers ───────────────────────────────────────────────────────────

  const getTileEl = useCallback(
    (troop) => resolveTileElement(battleSurfaceRef, mapCardRef, troop.y, troop.x, mapResult),
    [battleSurfaceRef, mapCardRef, mapResult],
  );

  const getTroopLayer = useCallback(
    (troop) => {
      const tile = getTileEl(troop);
      return tile ? tile.querySelector('.troop-layer') : null;
    },
    [getTileEl],
  );

  const addBattleAnim = useCallback(
    (troop, cls, dur = 500) => {
      const el = getTroopLayer(troop);
      if (!el) return;
      el.classList.add(cls);
      if (cls !== 'anim-death') setTimeout(() => el.classList.remove(cls), dur);
    },
    [getTroopLayer],
  );

  const shakeMap = useCallback(
    (dur = 300) => {
      const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
      if (!card) return;
      card.classList.add('anim-screen-shake');
      setTimeout(() => card.classList.remove('anim-screen-shake'), dur);
    },
    [battleSurfaceRef, mapCardRef],
  );

  const showDmg = useCallback(
    (troop, text, type = 'normal') => {
      const tile = getTileEl(troop);
      if (!tile) return;
      const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
      if (!card) return;
      const tileRect = tile.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const n = document.createElement('div');
      n.className = `dmg-num ${type}`;
      n.textContent = text;
      n.style.left = `${tileRect.left - cardRect.left + 6}px`;
      n.style.top = `${tileRect.top - cardRect.top + 8}px`;
      card.style.position = 'relative';
      card.appendChild(n);
      setTimeout(() => n.remove(), 1000);
    },
    [getTileEl, battleSurfaceRef, mapCardRef],
  );

  /** 大字技能名 `.skill-name-pop`：锚定在施法部队所在格中心（相对战术图容器），避免固定屏心误判阵营 */
  const positionSkillNamePopAtActor = useCallback(
    (sn, actor) => {
      if (!sn || !actor) return;
      const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
      if (!card) return;
      const tile = getTileEl(actor);
      if (tile) {
        const tr = tile.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        sn.style.left = `${tr.left - cr.left + tr.width / 2}px`;
        sn.style.top = `${tr.top - cr.top + tr.height / 2}px`;
      } else {
        sn.style.left = '50%';
        sn.style.top = '40%';
      }
    },
    [battleSurfaceRef, mapCardRef, getTileEl],
  );

  // ── 兵力方格更新 ──────────────────────────────────────────────────────────

  const updateTroopHp = useCallback(
    (troop) => {
      const tile = getTileEl(troop);
      if (!tile) return;
      const old = tile.querySelector('.troop-layer');
      if (!old) return;
      const totalBlocks = Math.ceil(troop.maxTroops / 100);
      const fullBlocks = Math.floor(troop.currentTroops / 100);
      const remainder = troop.currentTroops % 100;
      const hasHalf = remainder >= 50;
      const fc =
        troop.faction === 'player' ? 'player' :
        troop.faction === 'enemy'  ? 'enemy'  :
        (troop.campaignNpcForce ?? 'ally1');
      const allBlks = [];
      for (let b = 0; b < totalBlocks; b++) {
        if (b < fullBlocks) allBlks.push(`<div class="troop-hp-block full-${fc}"></div>`);
        else if (b === fullBlocks && hasHalf) allBlks.push(`<div class="troop-hp-block half-${fc}"></div>`);
      }
      const topBlks = allBlks.slice(0, 6).join('');
      const rightBlks = allBlks.slice(6).join('');
      const topEl = old.querySelector('.troop-hp-top');
      if (topEl) topEl.outerHTML = `<div class="troop-hp-top">${topBlks}</div>`;
      const oldRight = old.querySelector('.troop-hp-right');
      if (oldRight) oldRight.remove();
      if (rightBlks) {
        const tmp = document.createElement('div');
        tmp.innerHTML = `<div class="troop-hp-right">${rightBlks}</div>`;
        const glow = old.querySelector('.troop-glow');
        if (glow) old.insertBefore(tmp.firstChild, glow);
      }
    },
    [getTileEl],
  );

  // ── 渲染部队到指定 tile ───────────────────────────────────────────────────

  const renderTroopOnTile = useCallback(
    (troop) => {
      const tile = resolveTileElement(battleSurfaceRef, mapCardRef, troop.y, troop.x, mapResult);
      if (!tile) return;
      tile.setAttribute('data-troop', troop.id);
      tile.removeAttribute('data-info');
      const totalBlocks = Math.ceil(troop.maxTroops / 100);
      const fullBlocks = Math.floor(troop.currentTroops / 100);
      const remainder = troop.currentTroops % 100;
      const hasHalf = remainder >= 50;
      const fc =
        troop.faction === 'player' ? 'player' :
        troop.faction === 'enemy'  ? 'enemy'  :
        (troop.campaignNpcForce ?? 'ally1');
      const allBlks = [];
      for (let b = 0; b < totalBlocks; b++) {
        if (b < fullBlocks) allBlks.push(`<div class="troop-hp-block full-${fc}"></div>`);
        else if (b === fullBlocks && hasHalf) allBlks.push(`<div class="troop-hp-block half-${fc}"></div>`);
      }
      const topBlks = allBlks.slice(0, 6).join('');
      const rightBlks = allBlks.slice(6).join('');
      const hpHtml = `<div class="troop-hp-top">${topBlks}</div>${rightBlks ? `<div class="troop-hp-right">${rightBlks}</div>` : ''}`;
      const cr = troop.commanderRole;
      const isPlayerLordBar = troop.faction === 'player' && troop.lineupSlot === 'player';
      const nameBarClass = [
        'troop-name',
        cr === 'boss' ? 'is-commander-boss' : '',
        cr === 'hero' ? 'is-commander-hero' : '',
        isPlayerLordBar ? 'is-player-lord' : '',
      ].filter(Boolean).join(' ');
      const m = Number(troop.morale ?? 0);
      const moraleColor = moraleInlineColorForTroopBar(m);
      const goldMoraleBar = cr === 'boss' || cr === 'hero' || isPlayerLordBar;
      const mrHtml = goldMoraleBar
        ? `<span class="mr">${m}</span>`
        : `<span class="mr" style="color:${moraleColor}">${m}</span>`;
      const layer = document.createElement('div');
      layer.className = 'troop-layer';
      layer.innerHTML = `${hpHtml}<div class="troop-glow ${fc}"></div><img class="troop-img" alt=""><div class="${nameBarClass}"><span class="cn">${troop.displayName || troop.name}</span>${mrHtml}</div>`;
      const img = layer.querySelector('.troop-img');
      bindTroopPortraitImg(img, troop, GAME_BASE_URL);
      tile.appendChild(layer);
    },
    [battleSurfaceRef, mapCardRef, mapResult],
  );

  // ── 清除 tile 上的部队 ─────────────────────────────────────────────────────

  const clearTroopFromTile = useCallback(
    (troop) => {
      const tile = getTileEl(troop);
      if (!tile) return;
      const layer = tile.querySelector('.troop-layer');
      if (layer) layer.remove();
      tile.removeAttribute('data-troop');
      tile.removeAttribute('data-info');
    },
    [getTileEl],
  );

  // ── 战斗动画序列 ──────────────────────────────────────────────────────────

  /** 攻击方向辅助（纯计算，不依赖 hook state） */
  const getAtkDir = (a, d) => {
    const dx = d.x - a.x;
    const dy = d.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  };

  const battleAttack = useCallback(
    async (atk, def, dmg) => {
      const dir = getAtkDir(atk, def);
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtAttack(atk, def), 'attack');
      addBattleAnim(atk, `anim-atk-${dir}`, 400);
      await sleep(200, speedRef.current);
      addBattleAnim(def, 'anim-hit', 500);
      def.currentTroops = Math.max(0, def.currentTroops - dmg);
      updateTroopHp(def);
      showDmg(def, `-${dmg}`, 'normal');
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtAttackResult(def, dmg), 'attack');
      await sleep(600, speedRef.current);
    },
    [addLog, addBattleAnim, updateTroopHp, showDmg, trimAllyBattleLog],
  );

  const battleCrit = useCallback(
    async (atk, def, dmg) => {
      const dir = getAtkDir(atk, def);
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtCrit(atk, def), 'crit');
      addBattleAnim(atk, `anim-atk-${dir}`, 400);
      await sleep(200, speedRef.current);
      addBattleAnim(def, 'anim-crit-hit', 600);
      shakeMap();
      def.currentTroops = Math.max(0, def.currentTroops - dmg);
      updateTroopHp(def);
      showDmg(def, `-${dmg}`, 'crit');
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtCritResult(def, dmg), 'crit');
      await sleep(700, speedRef.current);
    },
    [addLog, addBattleAnim, updateTroopHp, showDmg, shakeMap, trimAllyBattleLog],
  );

  const battleMiss = useCallback(
    async (atk, def) => {
      const dir = getAtkDir(atk, def);
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtMiss(atk, def), 'attack');
      addBattleAnim(atk, `anim-atk-${dir}`, 400);
      await sleep(200, speedRef.current);
      addBattleAnim(def, 'anim-dodge', 600);
      showDmg(def, 'MISS', 'miss');
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtMissResult(def), 'miss');
      await sleep(700, speedRef.current);
    },
    [addLog, addBattleAnim, showDmg, trimAllyBattleLog],
  );

  /** 将领被动·首击免疫：不扣兵力，消耗一次次数 */
  const battleFirstHitImmune = useCallback(
    async (atk, def) => {
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtFirstHitImmune(def, atk), 'skill');
      addBattleAnim(def, 'anim-hit', 450);
      showDmg(def, '0 免疫', 'skill-phase2-immune');
      await sleep(550, speedRef.current);
    },
    [addLog, addBattleAnim, showDmg, trimAllyBattleLog],
  );

  /**
   * 阶段4 / 阶段5 主动伤害共用：单目标一段（闪避 → `calcDamage` → 首击免疫 → 扣兵 → 飘字）。
   * `shakeGate.shook`：同一施放扫多目标时，仅**首次实际扣兵**时 `shakeMap` 一次，与历史阶段4一致。
   * @param {object} actor
   * @param {object} def
   * @param {object} strikeOpts `combatSystem` 用 strike 选项（须含 `battleTroops`、`damageKind`、`skillDamageMultiplier`）
   * @param {'physical'|'strategy'} dk
   * @param {{ shook: boolean }} shakeGate 可变；调用前置 `{ shook: false }`
   */
  const strikeActiveSkillDamageOnce = useCallback(
    async (actor, def, strikeOpts, dk, shakeGate) => {
      if (!def || def.currentTroops <= 0) return;
      const dmgTypeCls = dk === 'strategy' ? 'skill-strategy' : 'skill-physical';
      const roll = rollCritDodge(actor, def);
      if (roll === 'dodge') {
        await battleMiss(actor, def);
        return;
      }
      const rawDmg = calcDamage(actor, def, mapResult ? mapResult.terrain : null, strikeOpts);
      const dmgMult = roll === 'crit' ? 1.5 : 1;
      const rawApplied = troopDamageToCasualties(def, Math.round(rawDmg * dmgMult));
      const r = resolveIncomingCasualtiesWithPhase2FirstHit(def, rawApplied);
      if (r.immuneTriggered) {
        await battleFirstHitImmune(actor, def);
        await sleep(280, speedRef.current);
        return;
      }
      addBattleAnim(def, roll === 'crit' ? 'anim-crit-hit' : 'anim-hit', roll === 'crit' ? 560 : 480);
      if (!shakeGate.shook) {
        shakeMap(220);
        shakeGate.shook = true;
      }
      def.currentTroops = Math.max(0, def.currentTroops - r.casualties);
      updateTroopHp(def);
      const label = roll === 'crit' ? `-${r.casualties} ★` : `-${r.casualties}`;
      const cls =
        roll === 'crit' ? (dk === 'strategy' ? 'skill-strategy-crit' : 'skill-physical-crit') : dmgTypeCls;
      showDmg(def, label, cls);
      if (!trimSkipForCombatPair(trimAllyBattleLog, actor, def)) {
        addLog(fmt.fmtAttackResult(def, r.casualties), 'skill');
      }
      await sleep(480, speedRef.current);
    },
    [
      addBattleAnim,
      shakeMap,
      updateTroopHp,
      showDmg,
      trimAllyBattleLog,
      battleMiss,
      battleFirstHitImmune,
      mapResult,
      speedRef,
      addLog,
    ],
  );

  /**
   * 演示用单次主动伤害：全屏闪与技能名配色同阶段4，结算走 `strikeActiveSkillDamageOnce`（物白/谋色飘字及暴击变体）。
   * 不消耗阶段4/5 次数；供 `playSkillDemo`。
   */
  const performSkillDemoStrike = useCallback(
    async (actor, def, { skillName, damageType = 'physical', skillDamageMultiplier = 1 } = {}) => {
      if (!actor || !def || def.currentTroops <= 0) return;
      const dk = String(damageType).toLowerCase() === 'strategy' ? 'strategy' : 'physical';
      const mult = Number(skillDamageMultiplier);
      const strikeOpts = {
        strike: 'normal',
        battleTroops,
        damageKind: dk,
        skillDamageMultiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
      };
      const flash = document.createElement('div');
      flash.className = 'skill-flash';
      flash.style.background = dk === 'strategy' ? 'rgba(56, 189, 248, 0.38)' : 'rgba(255, 255, 255, 0.32)';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 420);
      const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
      if (card) {
        const sn = document.createElement('div');
        sn.className = 'skill-name-pop';
        sn.textContent = skillName || '技能';
        sn.style.color = dk === 'strategy' ? '#7dd3fc' : '#f1f5f9';
        card.style.position = 'relative';
        positionSkillNamePopAtActor(sn, actor);
        card.appendChild(sn);
        setTimeout(() => sn.remove(), 1100);
      }
      await sleep(380, speedRef.current);
      if (!trimSkipForTroop(trimAllyBattleLog, actor)) {
        addLog(fmt.fmtPhase4DamageOpening(actor, skillName || '技能', 1), 'skill');
      }
      const shakeGate = { shook: false };
      await strikeActiveSkillDamageOnce(actor, def, strikeOpts, dk, shakeGate);
    },
    [
      battleSurfaceRef,
      mapCardRef,
      speedRef,
      trimAllyBattleLog,
      addLog,
      battleTroops,
      strikeActiveSkillDamageOnce,
      positionSkillNamePopAtActor,
    ],
  );

  const battleKill = useCallback(
    async (troop) => {
      if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtKill(troop), 'death');
      applyMoraleOnStackEliminated(battleTroops, troop);
      troop.currentTroops = 0;
      const layer = getTroopLayer(troop);
      if (layer) {
        layer.classList.add('anim-death');
        await sleep(800, speedRef.current);
        layer.remove();
      } else {
        await sleep(800, speedRef.current);
      }
      const tile = getTileEl(troop);
      if (tile) {
        tile.removeAttribute('data-troop');
        tile.removeAttribute('data-info');
      }
    },
    [addLog, getTroopLayer, getTileEl, battleTroops, trimAllyBattleLog],
  );

  /** 歼灭后若为主将 hero/boss，返回战役即时胜负 */
  const runBattleKill = useCallback(
    async (troop) => {
      await battleKill(troop);
      return outcomeIfCommanderEliminated(troop, battleTroops);
    },
    [battleKill, battleTroops],
  );

  /** 每回合全部行动结束后：站在着火格上的单位扣当前兵力 20% */
  const applyEndOfRoundFire = useCallback(
    async (troops) => {
      const cf = mapResult?.cellFire;
      if (!cf?.length) return { outcome: null, anyDamage: false };
      let outcome = null;
      let anyDamage = false;
      const list = troops.filter((t) => t.currentTroops > 0);
      list.sort((a, b) => a.y - b.y || a.x - b.x || String(a.id).localeCompare(String(b.id)));
      for (const troop of list) {
        if (troop.currentTroops <= 0) continue;
        if (!cf[troop.y]?.[troop.x]) continue;
        const cur = troop.currentTroops;
        const loss = Math.min(cur, Math.floor(cur * 0.2));
        if (loss <= 0) continue;
        const r = resolveIncomingCasualtiesWithPhase2FirstHit(troop, loss);
        if (r.casualties <= 0) {
          if (r.immuneTriggered) {
            if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtFirstHitImmuneEnvironmental(troop, '着火格'), 'skill');
            showDmg(troop, '0 免疫', 'skill-phase2-immune');
            await sleep(180, speedRef.current);
          }
          continue;
        }
        anyDamage = true;
        troop.currentTroops = cur - r.casualties;
        updateTroopHp(troop);
        showDmg(troop, `-${r.casualties}🔥`, 'normal');
        if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtFireTerrain(troop, r.casualties), 'attack');
        await sleep(180, speedRef.current);
        if (troop.currentTroops <= 0) {
          const c = await runBattleKill(troop);
          if (c === 'player_win' || c === 'enemy_win') outcome = c;
        }
      }
      return { outcome, anyDamage };
    },
    [mapResult, updateTroopHp, showDmg, addLog, runBattleKill, speedRef, trimAllyBattleLog, fmt],
  );

  const battleRanged = useCallback(
    async (atk, def, dmg, emoji = '➤') => {
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtRanged(atk, def), 'attack');
      const atkTile = getTileEl(atk);
      const defTile = getTileEl(def);
      const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
      if (atkTile && defTile && card) {
        const ar = atkTile.getBoundingClientRect();
        const dr = defTile.getBoundingClientRect();
        const cr = card.getBoundingClientRect();
        const fx = ar.left - cr.left + ar.width / 2;
        const fy = ar.top  - cr.top  + ar.height / 2;
        const tx = dr.left - cr.left + dr.width / 2;
        const ty = dr.top  - cr.top  + dr.height / 2;
        const d = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2);
        const dur = Math.max(300, Math.min(700, d * 1.5));
        const angle = Math.atan2(ty - fy, tx - fx) * 180 / Math.PI;
        const proj = document.createElement('div');
        proj.className = 'projectile';
        proj.textContent = emoji;
        proj.style.cssText = `left:${fx - 12}px;top:${fy - 12}px;transform:rotate(${angle}deg);transition:left ${dur}ms ease-in,top ${dur}ms ease-in;`;
        card.style.position = 'relative';
        card.appendChild(proj);
        requestAnimationFrame(() => { proj.style.left = `${tx - 12}px`; proj.style.top = `${ty - 12}px`; });
        await sleep(dur, speedRef.current);
        proj.remove();
      }
      addBattleAnim(def, 'anim-hit', 500);
      def.currentTroops = Math.max(0, def.currentTroops - dmg);
      updateTroopHp(def);
      showDmg(def, `-${dmg}`, 'normal');
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtAttackResult(def, dmg), 'attack');
      await sleep(600, speedRef.current);
    },
    [addLog, getTileEl, battleSurfaceRef, mapCardRef, addBattleAnim, updateTroopHp, showDmg, trimAllyBattleLog],
  );

  /** 阶段3·主动纯治疗（明镜 / 祈愿）：与 `skillPhase3ActiveHeal` 结算一致 */
  const performPhase3Heal = useCallback(
    async (actor, targetTroop, slot) => {
      if (!actor || !targetTroop || !slot) return;
      const { selfGain, allyGain } = applyPhase3HealMutation(actor, targetTroop, slot);
      if (selfGain + allyGain <= 0) return;
      consumePhase3HealCharge(actor, slot.skillId);

      const flash = document.createElement('div');
      flash.className = 'skill-flash';
      flash.style.background = 'rgba(72, 200, 120, 0.42)';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 450);

      const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
      if (card) {
        const sn = document.createElement('div');
        sn.className = 'skill-name-pop';
        sn.textContent = slot.name || '治疗';
        sn.style.color = '#8fef9a';
        card.style.position = 'relative';
        positionSkillNamePopAtActor(sn, actor);
        card.appendChild(sn);
        setTimeout(() => sn.remove(), 1100);
      }
      await sleep(420, speedRef.current);

      const sameUnit =
        targetTroop === actor ||
        (targetTroop.id != null && actor.id != null && String(targetTroop.id) === String(actor.id));
      if (sameUnit) {
        updateTroopHp(actor);
        showDmg(actor, `+${selfGain + allyGain}`, 'skill-heal');
      } else {
        if (selfGain > 0) {
          updateTroopHp(actor);
          showDmg(actor, `+${selfGain}`, 'skill-heal');
        }
        if (allyGain > 0) {
          updateTroopHp(targetTroop);
          showDmg(targetTroop, `+${allyGain}`, 'skill-heal');
        }
      }
      addBattleAnim(actor, 'anim-hit', 380);
      if (!trimSkipForTroop(trimAllyBattleLog, actor)) {
        addLog(fmt.fmtPhase3HealActive(actor, slot.name, selfGain, targetTroop, allyGain), 'skill');
      }
      await sleep(520, speedRef.current);
    },
    [
      addLog,
      battleSurfaceRef,
      mapCardRef,
      addBattleAnim,
      updateTroopHp,
      showDmg,
      trimAllyBattleLog,
      speedRef,
      positionSkillNamePopAtActor,
    ],
  );

  /** 阶段4·主动纯伤害：不触发反击；飘字色相见 `BattleMap.css`（物白 / 谋冷色） */
  const performPhase4Damage = useCallback(
    async (actor, slot, victims) => {
      if (!actor || !slot || !Array.isArray(victims) || victims.length === 0) return;
      const alive = victims.filter((v) => v && v.currentTroops > 0);
      if (!alive.length) return;
      if (!consumePhase4DamageCharge(actor, slot.skillId)) return;

      const { paid } = applyPhase4CostSelf(actor, slot.costSelf);
      if (paid > 0) updateTroopHp(actor);

      const dk = String(slot.damageType || 'physical').toLowerCase() === 'strategy' ? 'strategy' : 'physical';
      const mult = Number(slot.damageMultiplier);
      const strikeOpts = {
        strike: 'normal',
        battleTroops,
        damageKind: dk,
        skillDamageMultiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
      };

      const flash = document.createElement('div');
      flash.className = 'skill-flash';
      flash.style.background = dk === 'strategy' ? 'rgba(56, 189, 248, 0.38)' : 'rgba(255, 255, 255, 0.32)';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 420);

      const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
      if (card) {
        const sn = document.createElement('div');
        sn.className = 'skill-name-pop';
        sn.textContent = slot.name || '技能';
        sn.style.color = dk === 'strategy' ? '#7dd3fc' : '#f1f5f9';
        card.style.position = 'relative';
        positionSkillNamePopAtActor(sn, actor);
        card.appendChild(sn);
        setTimeout(() => sn.remove(), 1100);
      }
      await sleep(380, speedRef.current);

      if (!trimSkipForTroop(trimAllyBattleLog, actor)) {
        addLog(fmt.fmtPhase4DamageOpening(actor, slot.name, alive.length), 'skill');
      }

      const shakeGate = { shook: false };
      let si = 0;
      for (const def of alive) {
        if (def.currentTroops <= 0) continue;
        await sleep(45 * si, speedRef.current);
        si += 1;
        await strikeActiveSkillDamageOnce(actor, def, strikeOpts, dk, shakeGate);
      }
    },
    [
      addLog,
      battleSurfaceRef,
      mapCardRef,
      addBattleAnim,
      updateTroopHp,
      showDmg,
      trimAllyBattleLog,
      speedRef,
      mapResult,
      battleTroops,
      strikeActiveSkillDamageOnce,
      positionSkillNamePopAtActor,
    ],
  );

  /**
   * 将领主动 · 阶段5 复合：`damage_dot` / `damage_debuff` / `damage_heal` / `heal_damage`。
   * `victims`：与阶段4相同（形状锚点展开或随机池）；`heal_damage` 时传 `[]`，由本函数内随机段。
   * 不触发反击；治疗段不扣阶段3次数（仅扣阶段5次数）。
   */
  const performPhase5Composite = useCallback(
    async (actor, slot, victims) => {
      if (!actor || !slot) return [];
      const eff = String(slot.skillEffectType || '').toLowerCase();

      const dk = String(slot.damageType || 'physical').toLowerCase() === 'strategy' ? 'strategy' : 'physical';
      const mult = Number(slot.damageMultiplier);
      const strikeOpts = {
        strike: 'normal',
        battleTroops,
        damageKind: dk,
        skillDamageMultiplier: Number.isFinite(mult) && mult > 0 ? mult : 1,
      };

      const playPhase5OpenFlash = async () => {
        const flash = document.createElement('div');
        flash.className = 'skill-flash';
        flash.style.background = dk === 'strategy' ? 'rgba(56, 189, 248, 0.38)' : 'rgba(255, 255, 255, 0.32)';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 420);
        const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
        if (card) {
          const sn = document.createElement('div');
          sn.className = 'skill-name-pop';
          sn.textContent = slot.name || '技能';
          sn.style.color = dk === 'strategy' ? '#7dd3fc' : '#f1f5f9';
          card.style.position = 'relative';
          positionSkillNamePopAtActor(sn, actor);
          card.appendChild(sn);
          setTimeout(() => sn.remove(), 1100);
        }
        await sleep(380, speedRef.current);
      };

      const playHealSegmentVisual = async (selfGain, allyGain, targetTroop) => {
        const flash = document.createElement('div');
        flash.className = 'skill-flash';
        flash.style.background = 'rgba(72, 200, 120, 0.42)';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 450);
        const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
        if (card) {
          const sn = document.createElement('div');
          sn.className = 'skill-name-pop';
          sn.textContent = slot.name || '治疗';
          sn.style.color = '#8fef9a';
          card.style.position = 'relative';
          positionSkillNamePopAtActor(sn, actor);
          card.appendChild(sn);
          setTimeout(() => sn.remove(), 1100);
        }
        await sleep(420, speedRef.current);
        const sameUnit =
          targetTroop === actor ||
          (targetTroop.id != null && actor.id != null && String(targetTroop.id) === String(actor.id));
        if (sameUnit) {
          updateTroopHp(actor);
          showDmg(actor, `+${selfGain + allyGain}`, 'skill-heal');
        } else {
          if (selfGain > 0) {
            updateTroopHp(actor);
            showDmg(actor, `+${selfGain}`, 'skill-heal');
          }
          if (allyGain > 0) {
            updateTroopHp(targetTroop);
            showDmg(targetTroop, `+${allyGain}`, 'skill-heal');
          }
        }
        addBattleAnim(actor, 'anim-hit', 380);
        await sleep(520, speedRef.current);
      };

      if (eff === 'heal_damage') {
        const stub = phase5HealSlotStub(slot);
        const pre = previewPhase3HealGains(actor, actor, stub);
        if (pre.selfGain + pre.allyGain <= 0) return [];
        if (!consumePhase5CompositeCharge(actor, slot.skillId)) return [];
        const { paid } = applyPhase4CostSelf(actor, slot.costSelf);
        if (paid > 0) updateTroopHp(actor);
        const { selfGain, allyGain } = applyPhase3HealMutation(actor, actor, stub);
        if (!trimSkipForTroop(trimAllyBattleLog, actor)) {
          addLog(fmt.fmtPhase5HealDamageHeal(actor, slot.name, selfGain, allyGain), 'skill');
        }
        await playHealSegmentVisual(selfGain, allyGain, actor);
        const strikeCast = getTacticalActiveSkillCastRange(slot.skillId);
        const strikeList = pickPhase4RandomVictims(
          actor,
          { targetRange: 'random', targetCount: '1', skillId: slot.skillId },
          battleTroops,
          strikeCast,
        );
        if (!strikeList.length) return [];
        if (!trimSkipForCombatPair(trimAllyBattleLog, actor, strikeList[0])) {
          addLog(fmt.fmtPhase5HealDamageStrike(actor, strikeList[0]), 'skill');
        }
        await playPhase5OpenFlash();
        const strikeShake = { shook: false };
        for (const def of strikeList) {
          await strikeActiveSkillDamageOnce(actor, def, strikeOpts, dk, strikeShake);
        }
        return strikeList;
      }

      const alive = (victims || []).filter((v) => v && v.currentTroops > 0);
      if (!alive.length) return [];
      if (!consumePhase5CompositeCharge(actor, slot.skillId)) return [];
      const { paid } = applyPhase4CostSelf(actor, slot.costSelf);
      if (paid > 0) updateTroopHp(actor);

      await playPhase5OpenFlash();
      if (!trimSkipForTroop(trimAllyBattleLog, actor)) {
        addLog(fmt.fmtPhase5CompositeOpening(actor, slot.name, eff), 'skill');
      }

      const shakeGate = { shook: false };
      let si = 0;
      for (const def of alive) {
        if (def.currentTroops <= 0) continue;
        await sleep(45 * si, speedRef.current);
        si += 1;
        await strikeActiveSkillDamageOnce(actor, def, strikeOpts, dk, shakeGate);
      }

      if (eff === 'damage_dot' && slot.burn) {
        const { rounds, dotRatio } = slot.burn;
        for (const def of alive) {
          if (!def || def.currentTroops <= 0) continue;
          for (let ri = 0; ri < rounds; ri++) {
            if (def.currentTroops <= 0) break;
            const cur = def.currentTroops;
            const dotRaw = Math.min(cur, Math.floor(cur * dotRatio));
            if (dotRaw <= 0) continue;
            const r = resolveIncomingCasualtiesWithPhase2FirstHit(def, dotRaw);
            if (r.immuneTriggered) {
              await battleFirstHitImmune(actor, def);
              await sleep(200, speedRef.current);
              continue;
            }
            addBattleAnim(def, 'anim-hit', 420);
            def.currentTroops = Math.max(0, def.currentTroops - r.casualties);
            updateTroopHp(def);
            showDmg(def, `-${r.casualties}🔥`, 'skill-dot-fire');
            if (!trimSkipForCombatPair(trimAllyBattleLog, actor, def)) {
              addLog(fmt.fmtPhase5BurnTick(def, r.casualties, ri + 1, rounds), 'skill');
            }
            await sleep(380, speedRef.current);
          }
        }
      }

      if (eff === 'damage_debuff') {
        for (const def of alive) {
          if (!def || def.currentTroops <= 0) continue;
          const fd = slot.flatDamage != null ? Math.max(0, Math.floor(Number(slot.flatDamage))) : 0;
          if (fd > 0) {
            const rawApplied = troopDamageToCasualties(def, fd);
            const r = resolveIncomingCasualtiesWithPhase2FirstHit(def, rawApplied);
            if (r.immuneTriggered) {
              await battleFirstHitImmune(actor, def);
              await sleep(220, speedRef.current);
            } else {
              addBattleAnim(def, 'anim-hit', 450);
              def.currentTroops = Math.max(0, def.currentTroops - r.casualties);
              updateTroopHp(def);
              showDmg(def, `-${r.casualties}`, 'skill-special');
              if (!trimSkipForCombatPair(trimAllyBattleLog, actor, def)) {
                addLog(fmt.fmtPhase5FlatDamage(def, r.casualties), 'skill');
              }
              await sleep(400, speedRef.current);
            }
          }
          const lab = slot.debuffLabel != null ? String(slot.debuffLabel).trim() : '';
          if (lab) {
            showDmg(def, `⚠ ${lab.length > 18 ? `${lab.slice(0, 16)}…` : lab}`, 'skill-special');
            if (!trimSkipForCombatPair(trimAllyBattleLog, actor, def)) {
              addLog(fmt.fmtPhase5DebuffNotify(def, lab), 'skill');
            }
            await sleep(350, speedRef.current);
          }
        }
      }

      if (eff === 'damage_heal') {
        const stub = phase5HealSlotStub(slot);
        const cands = listPhase3HealTargetTroops(actor, stub, battleTroops);
        let healTarget = actor;
        for (const t of cands) {
          const p = previewPhase3HealGains(actor, t, stub);
          if (p.allyGain > 0 && t !== actor) {
            healTarget = t;
            break;
          }
        }
        const { selfGain, allyGain } = applyPhase3HealMutation(actor, healTarget, stub);
        if (selfGain + allyGain > 0) {
          if (!trimSkipForTroop(trimAllyBattleLog, actor)) {
            addLog(fmt.fmtPhase5DamageHealSegment(actor, slot.name, selfGain, healTarget, allyGain), 'skill');
          }
          await playHealSegmentVisual(selfGain, allyGain, healTarget);
        }
      }
      return alive;
    },
    [
      addLog,
      battleSurfaceRef,
      mapCardRef,
      addBattleAnim,
      updateTroopHp,
      showDmg,
      trimAllyBattleLog,
      speedRef,
      mapResult,
      battleTroops,
      strikeActiveSkillDamageOnce,
      listPhase3HealTargetTroops,
      previewPhase3HealGains,
      battleFirstHitImmune,
      positionSkillNamePopAtActor,
    ],
  );

  // ── 陷阱检查 ─────────────────────────────────────────────────────────────

  const checkTrap = useCallback(
    async (troop, y, x) => {
      if (!mapResult) return;
      const obj = mapResult.objects.find((o) => o.y === y && o.x === x && o.type === 'trap');
      if (obj) {
        const trapDmg = troopDamageToCasualties(troop, 50);
        const r = resolveIncomingCasualtiesWithPhase2FirstHit(troop, trapDmg);
        if (r.immuneTriggered) {
          if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtFirstHitImmuneEnvironmental(troop, '陷阱'), 'skill');
          showDmg(troop, '0 免疫', 'skill-phase2-immune');
          await sleep(400, speedRef.current);
          return;
        }
        troop.currentTroops = Math.max(0, troop.currentTroops - r.casualties);
        updateTroopHp(troop);
        showDmg(troop, `-${r.casualties} ⚠️`, 'normal');
        if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtTrap(troop, r.casualties), 'attack');
        await sleep(400, speedRef.current);
      }
    },
    [mapResult, updateTroopHp, showDmg, addLog, trimAllyBattleLog, fmt, speedRef],
  );

  const battleMove = useCallback(
    async (troop, path) => {
      if (!path || path.length === 0) return undefined;
      const dest = path[path.length - 1];
      const fc = troop.faction;
      if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtMove(troop, troop.x, troop.y, dest.x, dest.y), 'move');

      // 路径高亮
      const pathHls = [];
      for (const step of path) {
        const tile = resolveTileElement(battleSurfaceRef, mapCardRef, step.y, step.x, mapResult);
        if (tile) {
          const hl = document.createElement('div');
          hl.className = `move-hl ${fc}`;
          tile.appendChild(hl);
          pathHls.push(hl);
        }
      }
      await sleep(200, speedRef.current);

      for (let si = 0; si < path.length; si++) {
        const step = path[si];
        clearTroopFromTile(troop);
        troop.y = step.y;
        troop.x = step.x;
        renderTroopOnTile(troop);
        if (pathHls[si]) pathHls[si].remove();
        await sleep(180, speedRef.current);
        await checkTrap(troop, step.y, step.x);
        if (troop.currentTroops <= 0) {
          const camp = await runBattleKill(troop);
          for (let ri = si + 1; ri < pathHls.length; ri++) { if (pathHls[ri]) pathHls[ri].remove(); }
          return camp || undefined;
        }
      }
      for (const hl of pathHls) { if (hl && hl.parentNode) hl.remove(); }
      return undefined;
    },
    [addLog, battleSurfaceRef, mapCardRef, mapResult, clearTroopFromTile, renderTroopOnTile, checkTrap, runBattleKill, trimAllyBattleLog],
  );

  // ── 执行攻击 / 反击 ──────────────────────────────────────────────────────

  const performAttack = useCallback(
    async (atk, def) => {
      const d0 = dist(atk, def);
      const atkRange = troopAttackRange(atk);
      if (d0 > atkRange) {
        if (!trimSkipForTroop(trimAllyBattleLog, atk)) addLog(fmt.fmtOutOfRange(atk, d0, atkRange), 'move');
        return 0;
      }
      const strikeOpts = { strike: 'normal', battleTroops };
      const roll = rollCritDodge(atk, def);
      const dmg = calcDamage(atk, def, mapResult ? mapResult.terrain : null, strikeOpts);
      if (roll === 'dodge') { await battleMiss(atk, def); return 0; }
      if (roll === 'crit') {
        const cd = troopDamageToCasualties(def, Math.round(dmg * 1.5));
        const r = resolveIncomingCasualtiesWithPhase2FirstHit(def, cd);
        if (r.immuneTriggered) {
          await battleFirstHitImmune(atk, def);
          return 0;
        }
        await battleCrit(atk, def, r.casualties);
        return r.casualties;
      }
      const applied = troopDamageToCasualties(def, dmg);
      const r = resolveIncomingCasualtiesWithPhase2FirstHit(def, applied);
      if (r.immuneTriggered) {
        await battleFirstHitImmune(atk, def);
        return 0;
      }
      const wt = atk.weaponType || '';
      if (wt.startsWith('archer') && atkRange >= 2) { await battleRanged(atk, def, r.casualties, '➤'); }
      else { await battleAttack(atk, def, r.casualties); }
      return r.casualties;
    },
    [addLog, mapResult, battleMiss, battleCrit, battleRanged, battleAttack, trimAllyBattleLog, battleTroops, battleFirstHitImmune],
  );

  const performCounterAttack = useCallback(
    async (atk, def) => {
      if (def.currentTroops <= 0) return;
      const d = dist(atk, def);
      const defRange = troopAttackRange(def);
      if (d > defRange) return;
      if (!trimSkipForCombatPair(trimAllyBattleLog, def, atk)) addLog(fmt.fmtCounter(def), 'attack');
      await sleep(150, speedRef.current);
      const strikeOpts = { strike: 'counter', battleTroops };
      const roll = rollCritDodge(def, atk);
      const dmg = calcDamage(def, atk, mapResult ? mapResult.terrain : null, strikeOpts);
      const victim = atk;
      const aggressor = def;
      if (roll === 'dodge') { await battleMiss(def, atk); }
      else if (roll === 'crit') {
        const cd = troopDamageToCasualties(victim, Math.round(dmg * 1.5));
        const r = resolveIncomingCasualtiesWithPhase2FirstHit(victim, cd);
        if (r.immuneTriggered) await battleFirstHitImmune(aggressor, victim);
        else await battleCrit(def, atk, r.casualties);
      } else {
        const applied = troopDamageToCasualties(victim, dmg);
        const r = resolveIncomingCasualtiesWithPhase2FirstHit(victim, applied);
        if (r.immuneTriggered) await battleFirstHitImmune(aggressor, victim);
        else {
          const wt = def.weaponType || '';
          if (wt.startsWith('archer') && defRange >= 2) await battleRanged(def, atk, r.casualties, '➤');
          else await battleAttack(def, atk, r.casualties);
        }
      }
      if (atk.currentTroops <= 0) return runBattleKill(atk);
      return undefined;
    },
    [addLog, mapResult, battleMiss, battleCrit, battleRanged, battleAttack, runBattleKill, trimAllyBattleLog, battleTroops, battleFirstHitImmune],
  );

  return {
    getTileEl, getTroopLayer, addBattleAnim, shakeMap, showDmg,
    updateTroopHp, renderTroopOnTile, clearTroopFromTile,
    battleAttack, battleCrit, battleMiss,
    battleKill, runBattleKill,
    applyEndOfRoundFire,
    battleRanged,
    performSkillDemoStrike,
    checkTrap, battleMove,
    performAttack, performCounterAttack,
    performPhase3Heal,
    performPhase4Damage,
    performPhase5Composite,
  };
}
