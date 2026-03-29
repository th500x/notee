/**
 * useBattleEngine - 战斗流程引擎
 *
 * 管理战斗回合执行、动画播放、阵型系统
 * 从 demo/map-generator-demo.html 完全迁移，逻辑一致
 */

import { useCallback, useRef } from 'react';
import { calcDamage, rollCritDodge, troopDamageToCasualties } from '@/systems/combatSystem';
import { bindTroopPortraitImg } from '@/utils/troopBattlePortrait';
import { autoSelectFormation } from '@/systems/formationSystem';
import {
  dist, getMoveCost as _getMoveCost, isOccupied as _isOccupied,
  findBestMoveTarget as _findBestMoveTarget,
} from '@/systems/battleFlowManager';
import { MAP_W } from '@/components/battle/battleConstants';
import * as fmt from '@/systems/battleTextFormatter';

const GAME_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null ? import.meta.env.BASE_URL : '';

function sleep(ms, speed = 1) {
  return new Promise(r => setTimeout(r, ms / speed));
}

function inB(y, x) { return y >= 0 && y < 10 && x >= 0 && x < 8; }

export function useBattleEngine({
  battleTroops, setBattleTroops,
  mapResult, addLog, setLogs,
  battlePlaying, setBattlePlaying,
  roundNum, setRoundNum,
  silverAmount, setSilverAmount,
  activeFormation, setActiveFormation,
  autoBattle, autoFormation,
  mapCardRef,
  manualBattleRef,
}) {
  const speedRef = useRef(1);
  const roundNumRef = useRef(roundNum);
  const activeFormationRef = useRef(activeFormation);
  const autoBattleRef = useRef(autoBattle);
  const takenOver = useRef(false);

  // 同步 ref 与 state
  roundNumRef.current = roundNum;
  activeFormationRef.current = activeFormation;
  autoBattleRef.current = autoBattle;

  // ── DOM helpers ──
  const getTileEl = useCallback((troop) => {
    const card = mapCardRef?.current;
    if (!card) return null;
    const tiles = card.querySelectorAll('.map-grid .tile');
    return tiles[troop.y * MAP_W + troop.x] || null;
  }, [mapCardRef]);

  const getTroopLayer = useCallback((troop) => {
    const tile = getTileEl(troop);
    return tile ? tile.querySelector('.troop-layer') : null;
  }, [getTileEl]);

  const addBattleAnim = useCallback((troop, cls, dur = 500) => {
    const el = getTroopLayer(troop);
    if (!el) return;
    el.classList.add(cls);
    if (cls !== 'anim-death') setTimeout(() => el.classList.remove(cls), dur);
  }, [getTroopLayer]);

  const shakeMap = useCallback((dur = 300) => {
    const card = mapCardRef?.current;
    if (!card) return;
    card.classList.add('anim-screen-shake');
    setTimeout(() => card.classList.remove('anim-screen-shake'), dur);
  }, [mapCardRef]);

  const showDmg = useCallback((troop, text, type = 'normal') => {
    const tile = getTileEl(troop);
    if (!tile) return;
    const n = document.createElement('div');
    n.className = `dmg-num ${type}`;
    n.textContent = text;
    n.style.left = '6px'; n.style.top = '8px';
    tile.appendChild(n);
    setTimeout(() => n.remove(), 1000);
  }, [getTileEl]);

  const getAtkDir = (a, d) => {
    const dx = d.x - a.x, dy = d.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  };

  // ── 更新兵力方格 ──
  const updateTroopHp = useCallback((troop) => {
    const tile = getTileEl(troop);
    if (!tile) return;
    const old = tile.querySelector('.troop-layer');
    if (!old) return;
    const totalBlocks = Math.ceil(troop.maxTroops / 100);
    const fullBlocks = Math.floor(troop.currentTroops / 100);
    const remainder = troop.currentTroops % 100;
    const hasHalf = remainder >= 50;
    const fc = troop.faction === 'player' ? 'player' : 'enemy';
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
  }, [getTileEl]);

  // ── 渲染部队到指定tile ──
  const renderTroopOnTile = useCallback((troop) => {
    const card = mapCardRef?.current;
    if (!card) return;
    const tiles = card.querySelectorAll('.map-grid .tile');
    const tile = tiles[troop.y * MAP_W + troop.x];
    if (!tile) return;
    tile.setAttribute('data-troop', troop.id);
    tile.removeAttribute('data-info');
    const totalBlocks = Math.ceil(troop.maxTroops / 100);
    const fullBlocks = Math.floor(troop.currentTroops / 100);
    const remainder = troop.currentTroops % 100;
    const hasHalf = remainder >= 50;
    const fc = troop.faction === 'player' ? 'player' : 'enemy';
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
    bindTroopPortraitImg(img, troop, GAME_BASE_URL);
    tile.appendChild(layer);
  }, [mapCardRef]);

  // ── 清除tile上的部队 ──
  const clearTroopFromTile = useCallback((troop) => {
    const tile = getTileEl(troop);
    if (!tile) return;
    const layer = tile.querySelector('.troop-layer');
    if (layer) layer.remove();
    tile.removeAttribute('data-troop');
    if (mapResult) {
      const t = mapResult.terrain[troop.y]?.[troop.x];
      const obj = mapResult.objects.find(o => o.y === troop.y && o.x === troop.x);
      const infoKey = obj ? obj.type : (t !== 'plain' ? t : null);
      if (infoKey) tile.setAttribute('data-info', infoKey);
    }
  }, [getTileEl, mapResult]);

  // ── 战斗动画 ──
  const battleAttack = useCallback(async (atk, def, dmg) => {
    const dir = getAtkDir(atk, def);
    addLog(fmt.fmtAttack(atk, def), 'attack');
    addBattleAnim(atk, `anim-atk-${dir}`, 400);
    await sleep(200, speedRef.current);
    addBattleAnim(def, 'anim-hit', 500);
    def.currentTroops = Math.max(0, def.currentTroops - dmg);
    updateTroopHp(def);
    showDmg(def, `-${dmg}`, 'normal');
    addLog(fmt.fmtAttackResult(def, dmg), 'attack');
    await sleep(600, speedRef.current);
  }, [addLog, addBattleAnim, updateTroopHp, showDmg]);

  const battleCrit = useCallback(async (atk, def, dmg) => {
    const dir = getAtkDir(atk, def);
    addLog(fmt.fmtCrit(atk, def), 'crit');
    addBattleAnim(atk, `anim-atk-${dir}`, 400);
    await sleep(200, speedRef.current);
    addBattleAnim(def, 'anim-crit-hit', 600);
    shakeMap();
    def.currentTroops = Math.max(0, def.currentTroops - dmg);
    updateTroopHp(def);
    showDmg(def, `-${dmg}`, 'crit');
    addLog(fmt.fmtCritResult(def, dmg), 'crit');
    await sleep(700, speedRef.current);
  }, [addLog, addBattleAnim, updateTroopHp, showDmg, shakeMap]);

  const battleMiss = useCallback(async (atk, def) => {
    const dir = getAtkDir(atk, def);
    addLog(fmt.fmtMiss(atk, def), 'attack');
    addBattleAnim(atk, `anim-atk-${dir}`, 400);
    await sleep(200, speedRef.current);
    addBattleAnim(def, 'anim-dodge', 600);
    showDmg(def, 'MISS', 'miss');
    addLog(fmt.fmtMissResult(def), 'miss');
    await sleep(700, speedRef.current);
  }, [addLog, addBattleAnim, showDmg]);

  const battleKill = useCallback(async (troop) => {
    addLog(fmt.fmtKill(troop), 'death');
    troop.currentTroops = 0;

    // 士气变化：消灭敌方 → 击杀方将领+10，己方被消灭 → 该将领-8
    const killerFaction = troop.faction === 'player' ? 'enemy' : 'player';
    // 被消灭方将领士气 -8
    for (const t of battleTroops) {
      if (t.faction === troop.faction && t.character === troop.character && t.currentTroops > 0) {
        t.morale = Math.max(0, Math.min(120, (t.morale || 70) - 8));
      }
    }
    // 击杀方同将领士气 +10（找最近的击杀方部队的将领）
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
      if (mapResult) {
        const t = mapResult.terrain[troop.y]?.[troop.x];
        const obj = mapResult.objects.find(o => o.y === troop.y && o.x === troop.x);
        const infoKey = obj ? obj.type : (t !== 'plain' ? t : null);
        if (infoKey) tile.setAttribute('data-info', infoKey);
      }
    }
  }, [addLog, getTroopLayer, getTileEl, mapResult, battleTroops]);

  const battleRanged = useCallback(async (atk, def, dmg, emoji = '➤') => {
    addLog(fmt.fmtRanged(atk, def), 'attack');
    const atkTile = getTileEl(atk), defTile = getTileEl(def);
    const card = mapCardRef?.current;
    if (atkTile && defTile && card) {
      const ar = atkTile.getBoundingClientRect(), dr = defTile.getBoundingClientRect(), cr = card.getBoundingClientRect();
      const fx = ar.left - cr.left + ar.width / 2, fy = ar.top - cr.top + ar.height / 2;
      const tx = dr.left - cr.left + dr.width / 2, ty = dr.top - cr.top + dr.height / 2;
      const d = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2);
      const dur = Math.max(300, Math.min(700, d * 1.5));
      const angle = Math.atan2(ty - fy, tx - fx) * 180 / Math.PI;
      const proj = document.createElement('div');
      proj.className = 'projectile'; proj.textContent = emoji;
      proj.style.cssText = `left:${fx - 12}px;top:${fy - 12}px;transform:rotate(${angle}deg);transition:left ${dur}ms ease-in,top ${dur}ms ease-in;`;
      card.style.position = 'relative'; card.appendChild(proj);
      requestAnimationFrame(() => { proj.style.left = `${tx - 12}px`; proj.style.top = `${ty - 12}px`; });
      await sleep(dur, speedRef.current);
      proj.remove();
    }
    addBattleAnim(def, 'anim-hit', 500);
    def.currentTroops = Math.max(0, def.currentTroops - dmg);
    updateTroopHp(def);
    showDmg(def, `-${dmg}`, 'normal');
    addLog(fmt.fmtAttackResult(def, dmg), 'attack');
    await sleep(600, speedRef.current);
  }, [addLog, getTileEl, mapCardRef, addBattleAnim, updateTroopHp, showDmg]);

  const battleSkill = useCallback(async (atk, def, dmg, skillName) => {
    const applied = troopDamageToCasualties(def, dmg);
    addLog(fmt.fmtSkill(atk, def, skillName), 'skill');
    const flash = document.createElement('div');
    flash.className = 'skill-flash'; flash.style.background = 'rgba(192,132,252,0.5)';
    document.body.appendChild(flash); setTimeout(() => flash.remove(), 500);
    const card = mapCardRef?.current;
    if (card) {
      const sn = document.createElement('div'); sn.className = 'skill-name-pop'; sn.textContent = skillName;
      card.style.position = 'relative'; card.appendChild(sn); setTimeout(() => sn.remove(), 1200);
    }
    await sleep(600, speedRef.current);
    addBattleAnim(def, 'anim-crit-hit', 600);
    shakeMap();
    def.currentTroops = Math.max(0, def.currentTroops - applied);
    updateTroopHp(def);
    showDmg(def, `-${applied}`, 'crit');
    addLog(fmt.fmtSkillResult(def, applied), 'skill');
    await sleep(800, speedRef.current);
  }, [addLog, mapCardRef, addBattleAnim, shakeMap, updateTroopHp, showDmg]);

  // ── 陷阱检查 ──
  const checkTrap = useCallback(async (troop, y, x) => {
    if (!mapResult) return;
    const obj = mapResult.objects.find(o => o.y === y && o.x === x && o.type === 'trap');
    if (obj) {
      const trapDmg = troopDamageToCasualties(troop, 50);
      troop.currentTroops = Math.max(0, troop.currentTroops - trapDmg);
      updateTroopHp(troop);
      showDmg(troop, `-${trapDmg} ⚠️`, 'normal');
      addLog(fmt.fmtTrap(troop, trapDmg), 'attack');
      await sleep(400, speedRef.current);
    }
  }, [mapResult, updateTroopHp, showDmg, addLog]);

  // ── 移动部队（逐格） ──
  const battleMove = useCallback(async (troop, path) => {
    if (!path || path.length === 0) return;
    const dest = path[path.length - 1];
    const fc = troop.faction;
    addLog(fmt.fmtMove(troop, troop.x, troop.y, dest.x, dest.y), 'move');

    const card = mapCardRef?.current;
    if (!card) return;
    const allTiles = card.querySelectorAll('.map-grid .tile');

    // 路径高亮
    const pathHls = [];
    for (const step of path) {
      const tile = allTiles[step.y * MAP_W + step.x];
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
        await battleKill(troop);
        for (let ri = si + 1; ri < pathHls.length; ri++) { if (pathHls[ri]) pathHls[ri].remove(); }
        return;
      }
    }
    for (const hl of pathHls) { if (hl && hl.parentNode) hl.remove(); }
  }, [addLog, mapCardRef, clearTroopFromTile, renderTroopOnTile, checkTrap, battleKill]);

  // ── 执行攻击 ──
  const performAttack = useCallback(async (atk, def) => {
    const roll = rollCritDodge(atk, def);
    const dmg = calcDamage(atk, def, mapResult ? mapResult.terrain : null);
    const atkRange = atk.range || 1;
    if (roll === 'dodge') { await battleMiss(atk, def); return 0; }
    if (roll === 'crit') {
      const cd = troopDamageToCasualties(def, Math.round(dmg * 1.5));
      await battleCrit(atk, def, cd);
      return cd;
    }
    const applied = troopDamageToCasualties(def, dmg);
    const wt = atk.weaponType || '';
    const isArcher = wt.startsWith('archer');
    if (isArcher && atkRange >= 2) { await battleRanged(atk, def, applied, '➤'); }
    else { await battleAttack(atk, def, applied); }
    return applied;
  }, [mapResult, battleMiss, battleCrit, battleRanged, battleAttack]);

  // ── 反击 ──
  const performCounterAttack = useCallback(async (atk, def) => {
    if (def.currentTroops <= 0) return;
    const d = dist(atk, def);
    const defRange = def.range || 1;
    if (d > defRange) return;
    addLog(fmt.fmtCounter(def), 'attack');
    await sleep(150, speedRef.current);
    const roll = rollCritDodge(def, atk);
    const dmg = calcDamage(def, atk, mapResult ? mapResult.terrain : null);
    if (roll === 'dodge') { await battleMiss(def, atk); }
    else if (roll === 'crit') {
      await battleCrit(def, atk, troopDamageToCasualties(atk, Math.round(dmg * 1.5)));
    }
    else {
      const applied = troopDamageToCasualties(atk, dmg);
      const wt = def.weaponType || '';
      if (wt.startsWith('archer') && defRange >= 2) await battleRanged(def, atk, applied, '➤');
      else await battleAttack(def, atk, applied);
    }
    if (atk.currentTroops <= 0) await battleKill(atk);
  }, [addLog, mapResult, battleMiss, battleCrit, battleRanged, battleAttack, battleKill]);

  // ── 阵型整体移动 ──
  const formationGroupMove = useCallback(async (troops, dy, dx) => {
    const fc = troops[0]?.faction || 'player';
    const card = mapCardRef?.current;
    if (!card) return;
    const newPositions = troops.map(t => ({ troop: t, ny: t.y + dy, nx: t.x + dx }));
    const allValid = newPositions.every(p => {
      if (!inB(p.ny, p.nx)) return false;
      if (_getMoveCost(p.ny, p.nx, mapResult) === Infinity) return false;
      const occupant = battleTroops.find(bt => bt.currentTroops > 0 && bt.y === p.ny && bt.x === p.nx && !troops.includes(bt));
      if (occupant) return false;
      return true;
    });
    if (!allValid) return false;

    const allTiles = card.querySelectorAll('.map-grid .tile');
    const hls = [];
    for (const p of newPositions) {
      const tile = allTiles[p.ny * MAP_W + p.nx];
      if (tile) { const hl = document.createElement('div'); hl.className = `move-hl ${fc}`; tile.appendChild(hl); hls.push(hl); }
    }
    for (const t of troops) clearTroopFromTile(t);
    for (const p of newPositions) { p.troop.y = p.ny; p.troop.x = p.nx; }
    for (const t of troops) renderTroopOnTile(t);
    for (const hl of hls) setTimeout(() => hl.remove(), 600);
    await sleep(200, speedRef.current);
    for (const t of troops) {
      await checkTrap(t, t.y, t.x);
      if (t.currentTroops <= 0) await battleKill(t);
    }
    return true;
  }, [mapCardRef, mapResult, battleTroops, clearTroopFromTile, renderTroopOnTile, checkTrap, battleKill]);

  // ── 应用阵型 ──
  const applyFormationBuffs = useCallback(async (formation) => {
    if (!formation) return;
    const playerTroops = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0);
    if (playerTroops.length < 3) return;
    const shape = formation.shape;
    let bestCenter = null;
    const candidateCenters = [];
    for (let y = 7; y <= 9; y++) for (let x = 1; x <= 6; x++) candidateCenters.push({ y, x });
    candidateCenters.sort((a, b) => (a.y - b.y) || Math.abs(a.x - 3.5) - Math.abs(b.x - 3.5));
    for (const center of candidateCenters) {
      const positions = shape.map(s => ({ y: center.y + s.dy, x: center.x + s.dx }));
      const valid = positions.every(p => {
        if (!inB(p.y, p.x)) return false;
        if (_getMoveCost(p.y, p.x, mapResult) === Infinity) return false;
        if (battleTroops.some(t => t.faction === 'enemy' && t.currentTroops > 0 && t.y === p.y && t.x === p.x)) return false;
        if (mapResult && formation.forbidTerrain.length > 0) {
          const tile = mapResult.terrain[p.y]?.[p.x];
          if (formation.forbidTerrain.includes(tile)) return false;
        }
        return true;
      });
      const posKeys = positions.map(p => `${p.y},${p.x}`);
      if (valid && new Set(posKeys).size === posKeys.length) { bestCenter = { center, positions }; break; }
    }
    if (!bestCenter) { addLog(fmt.fmtFormationFail(), 'round'); return; }
    const { positions } = bestCenter;
    for (let i = 0; i < playerTroops.length && i < positions.length; i++) {
      const troop = playerTroops[i], target = positions[i];
      clearTroopFromTile(troop);
      troop.y = target.y; troop.x = target.x;
      renderTroopOnTile(troop);
    }
    for (const t of playerTroops) {
      t._formationBuffs = formation.effects;
      if (formation.effects.moveBonus) { t._origMovement = t.movement; t.movement = Math.max(1, (t.movement || 3) + formation.effects.moveBonus); }
      if (formation.effects.rangeBonus) { t._origRange = t.range; t.range = (t.range || 1) + formation.effects.rangeBonus; }
    }
    activeFormationRef.current = formation;
    setActiveFormation(formation);
    addLog(fmt.fmtFormation(formation.name, formation.desc), 'skill');
    // 阵型高亮
    const card = mapCardRef?.current;
    if (card) {
      const allTiles = card.querySelectorAll('.map-grid .tile');
      for (const pos of positions) {
        const tile = allTiles[pos.y * MAP_W + pos.x];
        if (tile) {
          const hl = document.createElement('div'); hl.className = 'move-hl player';
          hl.style.animation = 'hl-fade 2s ease-out forwards';
          tile.appendChild(hl); setTimeout(() => hl.remove(), 2000);
        }
      }
    }
  }, [battleTroops, mapResult, addLog, clearTroopFromTile, renderTroopOnTile, setActiveFormation, mapCardRef]);

  // ── 移除阵型 ──
  const removeFormationBuffs = useCallback(() => {
    const curFormation = activeFormationRef.current;
    if (!curFormation) return;
    const playerTroops = battleTroops.filter(t => t.faction === 'player');
    for (const t of playerTroops) {
      if (t._origMovement != null) { t.movement = t._origMovement; delete t._origMovement; }
      if (t._origRange != null) { t.range = t._origRange; delete t._origRange; }
      delete t._formationBuffs; delete t._formationHandled;
    }
    addLog(fmt.fmtFormationDisband(curFormation.name), 'round');
    activeFormationRef.current = null;
    setActiveFormation(null);
  }, [battleTroops, addLog, setActiveFormation]);

  // ── 阵型整体行动 ──
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
    for (const e of enemies) { const d = Math.abs(e.y - centerY) + Math.abs(e.x - centerX); if (d < closestDist) { closestDist = d; closestEnemy = e; } }
    if (!closestEnemy) return;
    const formationMove = Math.min(...fTroops.map(t => t.movement || 3));

    // ── 辅助：检查阵型中是否有部队可攻击任何敌人 ──
    const canAnyAttack = () => {
      const aliveFT = fTroops.filter(t => t.currentTroops > 0);
      const aliveEn = enemies.filter(e => e.currentTroops > 0);
      for (const atk of aliveFT) {
        for (const e of aliveEn) {
          if (dist(atk, e) <= (atk.range || 1)) return true;
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
          const ny = t.y + dirY; return inB(ny, t.x) ? _getMoveCost(ny, t.x, mapResult) : Infinity;
        }));
        if (maxCost > remainMove || maxCost === Infinity) break;
        addLog(fmt.fmtFormationMove(dirY), 'move');
        const ok = await formationGroupMove(fTroops.filter(t => t.currentTroops > 0), dirY, 0);
        if (!ok) break;
        remainMove -= maxCost;
      }
    }
    if (dirX !== 0 && remainMove > 0) {
      const horizSteps = Math.min(remainMove, Math.abs(closestEnemy.x - centerX));
      for (let i = 0; i < horizSteps && remainMove > 0; i++) {
        const maxCost = Math.max(...fTroops.filter(t => t.currentTroops > 0).map(t => {
          const nx = t.x + dirX; return inB(t.y, nx) ? _getMoveCost(t.y, nx, mapResult) : Infinity;
        }));
        if (maxCost > remainMove || maxCost === Infinity) break;
        addLog(fmt.fmtFormationMoveX(dirX), 'move');
        const ok = await formationGroupMove(fTroops.filter(t => t.currentTroops > 0), 0, dirX);
        if (!ok) break;
        remainMove -= maxCost;
      }
    }
    } // end if (!canAnyAttack)
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
      for (const e of sortedEnemies) { if (e.currentTroops > 0 && dist(atk, e) <= (atk.range || 1)) { anyCanAttack = true; break; } }
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
      for (const e of sortedEnemies) { if (e.currentTroops > 0 && dist(atk, e) <= (atk.range || 1)) { target = e; break; } }
      if (!target) continue;
      await performAttack(atk, target);
      if (target.currentTroops <= 0) await battleKill(target);
    }
    // 敌方反击
    const survivingEnemies = aliveEnemies.filter(e => e.currentTroops > 0);
    const survivingFTroops = aliveFTroops.filter(t => t.currentTroops > 0);
    if (survivingEnemies.length > 0 && survivingFTroops.length > 0) {
      const ce = survivingEnemies[0];
      const ct = survivingFTroops.find(t => dist(ce, t) <= (ce.range || 1));
      if (ct) {
        addLog(fmt.fmtEnemyCounter(), 'attack');
        await sleep(150, speedRef.current);
        await performAttack(ce, ct);
        if (ct.currentTroops <= 0) await battleKill(ct);
      }
    }
    for (const t of fTroops) t._formationHandled = true;
    removeFormationBuffs();
    await sleep(300, speedRef.current);
  }, [battleTroops, mapResult, addLog, formationGroupMove, performAttack, battleKill, removeFormationBuffs]);

  // ── 执行单回合 ──
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
        await formationGroupAction();
        await sleep(300, speedRef.current);
      } else {
        if (manualBattleRef?.current) {
          await manualBattleRef.current.startFormationTurn(
            battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0 && t._formationBuffs),
            activeFormationRef.current
          );
        }
        await sleep(300, speedRef.current);
      }
      // 阵型行动后胜负检查
      const fmtP = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0);
      const fmtE = battleTroops.filter(t => t.faction === 'enemy' && t.currentTroops > 0);
      if (fmtP.length === 0) { addLog(fmt.fmtBattleEnd('enemy_win'), 'death'); return 'enemy_win'; }
      if (fmtE.length === 0) { addLog(fmt.fmtBattleEnd('player_win'), 'round'); return 'player_win'; }
    }

    const turnOrder = [...alive].sort((a, b) => (b.speed || 4) - (a.speed || 4));
    for (const troop of turnOrder) {
      if (troop.currentTroops <= 0) continue;
      if (troop._formationHandled) continue;

      // 回合中途胜负检查：任一方全灭则立即结束
      const midPlayers = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0);
      const midEnemies = battleTroops.filter(t => t.faction === 'enemy' && t.currentTroops > 0);
      if (midPlayers.length === 0) { addLog(fmt.fmtBattleEnd('enemy_win'), 'death'); return 'enemy_win'; }
      if (midEnemies.length === 0) { addLog(fmt.fmtBattleEnd('player_win'), 'round'); return 'player_win'; }

      addLog(fmt.fmtTurnStart(troop), 'round');
      await sleep(200, speedRef.current);

      // ── 手动模式：玩家部队暂停等待操作 ──
      if (!autoBattleRef.current && manualBattleRef?.current && troop.faction === 'player') {
        await manualBattleRef.current.startManualTurn(troop);
        // startManualTurn 返回时，玩家已完成移动+攻击/待机
        await sleep(200, speedRef.current);
        continue;
      }

      // ── AI决策（自动模式 或 敌方部队） ──
      const decision = _findBestMoveTarget(troop, battleTroops, mapResult);
      if (!decision) { addLog(fmt.fmtNoTarget(troop), 'move'); await sleep(200, speedRef.current); continue; }

      if (decision.move && decision.move.length > 0) {
        await battleMove(troop, decision.move);
        if (troop.currentTroops <= 0) continue;
      }

      if (decision.target && decision.target.currentTroops > 0) {
        const d = dist(troop, decision.target);
        if (d <= (troop.range || 1)) {
          await performAttack(troop, decision.target);
          if (decision.target.currentTroops <= 0) await battleKill(decision.target);
          else await performCounterAttack(troop, decision.target);
        } else {
          addLog(fmt.fmtOutOfRange(troop, d, troop.range || 1), 'move');
        }
      } else if (!decision.target) {
        addLog(fmt.fmtStillOutOfRange(troop), 'move');
      }
      await sleep(200, speedRef.current);
    }

    for (const t of battleTroops) delete t._formationHandled;

    const pAlive = battleTroops.filter(t => t.faction === 'player' && t.currentTroops > 0);
    const eAlive = battleTroops.filter(t => t.faction === 'enemy' && t.currentTroops > 0);
    if (pAlive.length === 0) { addLog(fmt.fmtBattleEnd('enemy_win'), 'death'); return 'enemy_win'; }
    if (eAlive.length === 0) { addLog(fmt.fmtBattleEnd('player_win'), 'round'); return 'player_win'; }
    addLog(fmt.fmtRoundEnd(pAlive.length, eAlive.length), 'round');
    return 'continue';
  }, [battleTroops, setRoundNum, autoFormation, mapResult, addLog,
      applyFormationBuffs, formationGroupAction, battleMove, performAttack, battleKill, performCounterAttack]);

  // ── 播放回合 ──
  const playBattleRound = useCallback(async () => {
    if (battlePlaying) return;
    speedRef.current = 2;
    setBattlePlaying(true);

    if (autoBattleRef.current) {
      // 自动战斗：扣银两，循环到结束
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
    while (result === 'continue') {
      // 中途切换为手动：继续以手动模式执行（executeSingleRound内部会暂停等待玩家操作）
      if (!autoBattleRef.current && !takenOver.current) {
        takenOver.current = true;
        addLog('🖐 玩家接管战斗，切换为手动模式', 'round');
        speedRef.current = 1;
      }
      result = await executeSingleRound();
      if (result === 'continue') await sleep(300, speedRef.current);
    }
    takenOver.current = false;
    speedRef.current = 1;
    setBattlePlaying(false);
  }, [battlePlaying, battleTroops, silverAmount, addLog, setSilverAmount, setBattlePlaying, executeSingleRound]);

  // ── Demo 按钮 ──
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
  };
}
