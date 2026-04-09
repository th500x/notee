/**
 * 战斗动画与 DOM 操作层
 *
 * 将 tacticalBattleEngine 中的 DOM 渲染、动画序列与基础战斗计算提取为独立模块，
 * 使回合驱动层（useBattleEngine）仅关注阵型编排与 AI 决策编排，
 * 动画层可独立调优与测试。
 *
 * 导出：
 *   - 模块函数：resolveTileElement / resolveSurfaceRoot / sleep / setBattleAnimationSkipDelays
 *   - Hook：   useBattleAnimations({ battleSurfaceRef, mapCardRef, mapResult, addLog, speedRef, battleTroops })
 */

import { useCallback } from 'react';
import { calcDamage, rollCritDodge, troopDamageToCasualties } from '@/systems/combatSystem';
import { bindTroopPortraitImg } from '@/utils/troopBattlePortrait';
import { dist, troopAttackRange } from '@/battle/ai/battleTurnAi';
import { mapTileIndex, tacticalTileIndex } from '@shared/utils/tacticalBattleGrid';
import { outcomeIfCommanderEliminated } from '@/systems/battleCampaignRules';
import * as fmt from '@/systems/battleTextFormatter';
import { moraleInlineColorForTroopBar } from '@/components/battle/battleConstants';
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
      const before = def.currentTroops;
      def.currentTroops = Math.max(0, def.currentTroops - dmg);
      if (import.meta.env.DEV) {
        const tile = getTileEl(def);
        const layer = tile?.querySelector('.troop-layer');
        console.warn('[battleAttack]', { id: def.id, name: def.displayName || def.name, dmg, before, after: def.currentTroops, tileFound: !!tile, layerFound: !!layer, y: def.y, x: def.x });
      }
      updateTroopHp(def);
      showDmg(def, `-${dmg}`, 'normal');
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtAttackResult(def, dmg), 'attack');
      await sleep(600, speedRef.current);
    },
    [addLog, addBattleAnim, updateTroopHp, showDmg, getTileEl, trimAllyBattleLog],
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
      addLog(fmt.fmtCritResult(def, dmg), 'crit');
      await sleep(700, speedRef.current);
    },
    [addLog, addBattleAnim, updateTroopHp, showDmg, shakeMap],
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

  const battleKill = useCallback(
    async (troop) => {
      if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtKill(troop), 'death');
      troop.currentTroops = 0;
      // 士气变化：消灭敌方 → 击杀方将领 +10；己方被消灭 → 该将领 -8
      const killerFaction = troop.faction === 'player' ? 'enemy' : 'player';
      for (const t of battleTroops) {
        if (t.faction === troop.faction && t.character === troop.character && t.currentTroops > 0) {
          t.morale = Math.max(0, Math.min(120, (t.morale || 70) - 8));
        }
      }
      for (const t of battleTroops) {
        if (t.faction === killerFaction && t.currentTroops > 0) {
          t.morale = Math.max(0, Math.min(120, (t.morale || 70) + 10));
        }
      }
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
        anyDamage = true;
        troop.currentTroops = cur - loss;
        updateTroopHp(troop);
        showDmg(troop, `-${loss}🔥`, 'normal');
        addLog(fmt.fmtFireTerrain(troop, loss), 'attack');
        await sleep(180, speedRef.current);
        if (troop.currentTroops <= 0) {
          const c = await runBattleKill(troop);
          if (c === 'player_win' || c === 'enemy_win') outcome = c;
        }
      }
      return { outcome, anyDamage };
    },
    [mapResult, updateTroopHp, showDmg, addLog, runBattleKill, speedRef, trimAllyBattleLog],
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

  const battleSkill = useCallback(
    async (atk, def, dmg, skillName) => {
      const applied = troopDamageToCasualties(def, dmg);
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtSkill(atk, def, skillName), 'skill');
      const flash = document.createElement('div');
      flash.className = 'skill-flash';
      flash.style.background = 'rgba(192,132,252,0.5)';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 500);
      const card = resolveSurfaceRoot(battleSurfaceRef, mapCardRef);
      if (card) {
        const sn = document.createElement('div');
        sn.className = 'skill-name-pop';
        sn.textContent = skillName;
        card.style.position = 'relative';
        card.appendChild(sn);
        setTimeout(() => sn.remove(), 1200);
      }
      await sleep(600, speedRef.current);
      addBattleAnim(def, 'anim-crit-hit', 600);
      shakeMap();
      def.currentTroops = Math.max(0, def.currentTroops - applied);
      updateTroopHp(def);
      showDmg(def, `-${applied}`, 'crit');
      if (!trimSkipForCombatPair(trimAllyBattleLog, atk, def)) addLog(fmt.fmtSkillResult(def, applied), 'skill');
      await sleep(800, speedRef.current);
    },
    [addLog, battleSurfaceRef, mapCardRef, addBattleAnim, shakeMap, updateTroopHp, showDmg, trimAllyBattleLog],
  );

  // ── 陷阱检查 ─────────────────────────────────────────────────────────────

  const checkTrap = useCallback(
    async (troop, y, x) => {
      if (!mapResult) return;
      const obj = mapResult.objects.find((o) => o.y === y && o.x === x && o.type === 'trap');
      if (obj) {
        const trapDmg = troopDamageToCasualties(troop, 50);
        troop.currentTroops = Math.max(0, troop.currentTroops - trapDmg);
        updateTroopHp(troop);
        showDmg(troop, `-${trapDmg} ⚠️`, 'normal');
        if (!trimSkipForTroop(trimAllyBattleLog, troop)) addLog(fmt.fmtTrap(troop, trapDmg), 'attack');
        await sleep(400, speedRef.current);
      }
    },
    [mapResult, updateTroopHp, showDmg, addLog, trimAllyBattleLog],
  );

  // ── 移动部队（逐格动画） ──────────────────────────────────────────────────

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
      const roll = rollCritDodge(atk, def);
      const dmg = calcDamage(atk, def, mapResult ? mapResult.terrain : null, { strike: 'normal' });
      if (roll === 'dodge') { await battleMiss(atk, def); return 0; }
      if (roll === 'crit') {
        const cd = troopDamageToCasualties(def, Math.round(dmg * 1.5));
        await battleCrit(atk, def, cd);
        return cd;
      }
      const applied = troopDamageToCasualties(def, dmg);
      const wt = atk.weaponType || '';
      if (wt.startsWith('archer') && atkRange >= 2) { await battleRanged(atk, def, applied, '➤'); }
      else { await battleAttack(atk, def, applied); }
      return applied;
    },
    [addLog, mapResult, battleMiss, battleCrit, battleRanged, battleAttack, trimAllyBattleLog],
  );

  const performCounterAttack = useCallback(
    async (atk, def) => {
      if (def.currentTroops <= 0) return;
      const d = dist(atk, def);
      const defRange = troopAttackRange(def);
      if (d > defRange) return;
      if (!trimSkipForCombatPair(trimAllyBattleLog, def, atk)) addLog(fmt.fmtCounter(def), 'attack');
      await sleep(150, speedRef.current);
      const roll = rollCritDodge(def, atk);
      const dmg = calcDamage(def, atk, mapResult ? mapResult.terrain : null, { strike: 'counter' });
      if (roll === 'dodge') { await battleMiss(def, atk); }
      else if (roll === 'crit') {
        await battleCrit(def, atk, troopDamageToCasualties(atk, Math.round(dmg * 1.5)));
      } else {
        const applied = troopDamageToCasualties(atk, dmg);
        const wt = def.weaponType || '';
        if (wt.startsWith('archer') && defRange >= 2) await battleRanged(def, atk, applied, '➤');
        else await battleAttack(def, atk, applied);
      }
      if (atk.currentTroops <= 0) return runBattleKill(atk);
      return undefined;
    },
    [addLog, mapResult, battleMiss, battleCrit, battleRanged, battleAttack, runBattleKill, trimAllyBattleLog],
  );

  return {
    getTileEl, getTroopLayer, addBattleAnim, shakeMap, showDmg,
    updateTroopHp, renderTroopOnTile, clearTroopFromTile,
    battleAttack, battleCrit, battleMiss,
    battleKill, runBattleKill,
    applyEndOfRoundFire,
    battleRanged, battleSkill,
    checkTrap, battleMove,
    performAttack, performCounterAttack,
  };
}
