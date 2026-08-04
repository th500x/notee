/**
 * 大型图战斗：
 *   - 玩家部队来自编组（`playerUnits`），初始落位在部署矩形内。
 *   - `enemy` 格子 NPC → `faction: 'enemy'`，由 AI 控制，作为对手。
 *   - `ally1`/`ally2` 格子 NPC → `faction: 'ally'`，由 AI 控制，以 enemy 为目标；
 *     不参与部署拖动，不计入银两消耗，不影响胜负判定（仅辅助战力）。
 * 全部使用全局格坐标：x = col，y = row（与 `cells[row][col]` 一致）。
 */

import { getBattleFieldTroopPortraitUrlAttempts, getMapTroopPortraitUrlAttempts } from '@shared/utils/troopIconUrls';
import { initialMoraleFromCharacter } from '@/utils/npcMorale';
import { listPassableDeployCellsInRect } from '@/utils/largeMapDeployRect';
import { enrichBattleUnitWithSkillPhases } from '@shared/utils/battleSkillAssembly';
import {
  buildTroopCatalogById,
  flattenPlayerUnitToBattleTroop,
} from '@shared/utils/resolveTroopBattleCaps';
import { initBattlePhase2Runtime } from '@shared/utils/skillPhase2Passive';
import { initBattlePhase3HealRuntime } from '@shared/utils/skillPhase3ActiveHeal';
import { initBattlePhase4DamageRuntime } from '@shared/utils/skillPhase4ActiveDamage';
import { initBattlePhase5CompositeRuntime } from '@shared/utils/skillPhase5CompositeDamage';
const base = () => import.meta.env.BASE_URL;

/**
 * @param {object} opts
 * @param {Array} opts.playerUnits
 * @param {{ cells: object[][] }} opts.mapSim
 * @param {object|null} opts.deployRect — `getPlayerDeployRectGlobal` 结果；用于我方初始落位
 * @param {Array} opts.allTroops
 * @param {Array} opts.allCharacters
 * @param {Record<string, object>} [opts.skillsMap] skills.json 字典；有则 NPC 将领叠阶段1～5（与玩家同源）
 */
export function buildLargeMapBattleTroopsFromSim({
  playerUnits,
  mapSim,
  deployRect,
  allTroops,
  allCharacters,
  skillsMap = null,
}) {
  const catalogById = buildTroopCatalogById(allTroops);
  const passable =
    deployRect && mapSim?.cells
      ? listPassableDeployCellsInRect(mapSim.cells, deployRect)
      : [];

  const playerResult = playerUnits.slice(0, 5).map((unit, i) => {
    const cell = passable[i];
    const x = cell?.col ?? 0;
    const y = cell?.row ?? 0;
    return flattenPlayerUnitToBattleTroop(unit, i, {
      pos: { y, x },
      catalogById,
      baseUrl: base(),
      getPortraitAttempts: (trMeta, bUrl) =>
        getBattleFieldTroopPortraitUrlAttempts(trMeta, bUrl),
    });
  });

  let npcSeq = 0;
  const npcResult = [];

  const cells = mapSim.cells;
  for (let rowG = 0; rowG < cells.length; rowG++) {
    const rowCells = cells[rowG];
    if (!rowCells) continue;
    for (let col = 0; col < rowCells.length; col++) {
      const cell = rowCells[col];
      const cu = cell?.mapUnit;
      if (!cu) continue;
      const fac = cu.faction;
      // 仅处理 enemy、ally1、ally2；player 格子由 playerUnits 参数处理
      if (fac !== 'enemy' && fac !== 'ally1' && fac !== 'ally2') continue;

      const tr = allTroops.find((t) => t.id === cu.troopId);
      if (!tr) {
        if (import.meta.env.DEV) {
          console.warn(
            '[buildLargeMapBattleTroopsFromSim] 跳过格子 NPC：部队库中无 troopId',
            cu.troopId,
            'faction:', fac,
          );
        }
        continue;
      }

      const raw = allCharacters.find((c) => c.id === cu.charId);
      const charName = raw
        ? raw.courtesyName || raw.courtesy_name || raw.name || raw.character_name || raw.characterName
        : null;
      const traitPts = Number(raw?.trait_modifier ?? raw?.traitModifier ?? 0);
      const morale = Number.isFinite(Number(cu.morale))
        ? Math.max(0, Math.min(120, Number(cu.morale) + traitPts * 2))
        : initialMoraleFromCharacter(raw);

      // ally1/ally2 → faction:'ally'，AI 控制以 enemy 为目标；enemy → 保持 enemy 阵营
      const battleFaction = fac === 'enemy' ? 'enemy' : 'ally';

      // 立绘：enemy 用事件战斗函数（enemy/子目录），ally1/ally2 用大型图函数保留原始 ally1(ally2)/子目录
      const attempts = fac === 'enemy'
        ? getBattleFieldTroopPortraitUrlAttempts({ ...tr, faction: 'enemy' }, base())
        : getMapTroopPortraitUrlAttempts(cu.troopId, base(), fac);

      // characters.json / DB 中将领属性已是 0–10 量纲（如 combat:8.3）；
      // 战斗公式直接使用该量纲，不再 /10。fallback 与公式默认值对齐（= 5）。
      const luck     = raw?.luck        != null ? Number(raw.luck)         : 5;
      const courage  = raw?.courage     != null ? Number(raw.courage)      : 5;
      const combat   = raw?.combat      != null ? Number(raw.combat)       : 5;
      const command  = raw?.command     != null ? Number(raw.command)      : 5;
      const intel    = raw?.intelligence != null ? Number(raw.intelligence) : 5;
      const pol      = raw?.politics    != null ? Number(raw.politics)     : 5;
      const charm    = raw?.charm       != null ? Number(raw.charm)        : 5;

      const charBase = raw && charName
        ? {
            name: charName,
            courtesyName: charName,
            luck, courage, combat, command,
            intelligence: intel, politics: pol, charm,
            trait: raw?.trait,
            traitModifier: raw?.trait_modifier ?? raw?.traitModifier,
          }
        : null;
      const { troop: enrichedTroop, character: battleChar } = enrichBattleUnitWithSkillPhases({
        troop: tr,
        character: charBase,
        skillIdSource: raw,
        skillsMap,
      });

      npcResult.push({
        ...enrichedTroop,
        id: `${cu.troopId}_cnpc_${npcSeq}`,
        faction: battleFaction,
        npcForce: fac,
        /** 关卡将领 id；友军 hero 多 stack 时用于「该将领全部 hero stack 灭尽才败」 */
        commanderCharId: cu.charId,
        y: rowG,
        x: col,
        currentTroops: tr.maxTroops,
        initialTroops: tr.maxTroops,
        maxTroops: tr.maxTroops,
        ...(cu.commanderRole ? { commanderRole: cu.commanderRole } : {}),
        ...(cu.battleAiStyle ? { battleAiStyle: cu.battleAiStyle } : {}),
        character: battleChar,
        displayName: charName || tr.name,
        morale,
        imgSrc: attempts[0],
        imgPortraitAttempts: attempts,
        imgFallback: attempts[attempts.length - 1],
        _npcIndex: npcSeq,
      });
      npcSeq += 1;
    }
  }

  const merged = [...playerResult, ...npcResult];
  initBattlePhase2Runtime(merged);
  const mapH = cells.length || 10;
  const mapW = (cells[0] && cells[0].length) || 8;
  initBattlePhase3HealRuntime(merged, mapH, mapW);
  initBattlePhase4DamageRuntime(merged, mapH, mapW);
  initBattlePhase5CompositeRuntime(merged, mapH, mapW);
  return merged;
}
