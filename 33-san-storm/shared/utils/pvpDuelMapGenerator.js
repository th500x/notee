/**
 * PvP 对决地图生成：generateSmallMapV2 + applyPvpDuelRules + Wang/叠层同步
 * @see docs/01-strategic-world/map-design/PVP_DUEL_MAP_RULES.md
 */

import {
  generateSmallMapV2,
  syncMapResultVisualsFromTerrain,
} from './mapGenerator_v2.js';
import { GAMEPLAY_OBJECT_DEFS } from './terrainGameplayObjects.js';
import {
  ZONE,
  TACTICAL_GRID_WIDTH as MAP_WIDTH,
  TACTICAL_GRID_HEIGHT as MAP_HEIGHT,
} from './tacticalBattleGrid.js';
import { PVP_DUEL_GENERATOR_VERSION } from './pvpDuelMapRuleTemplates.js';

const TERRAIN = Object.freeze({
  PLAIN: 'plain',
  FOREST: 'forest',
  HILL: 'hill',
  RIVER: 'river',
});

class SeededRandom {
  constructor(seed) {
    this.seed = seed != null ? seed : Math.floor(Math.random() * 2147483647);
    this._state = this.seed;
  }

  next() {
    this._state = (this._state * 1664525 + 1013904223) & 0xffffffff;
    return (this._state >>> 0) / 0x100000000;
  }

  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

const DEFAULT_RULES = {
  forbidChest: true,
  forbidTrap: true,
  forbidRandom: true,
  forbidFarm: true,
  placementZones: ['deployA', 'deployB'],
  forbidColumns: [0, 7],
  forbidBorderRows: false,
  objectsPerSide: {},
};

function normalizePreset(preset) {
  const rules = { ...DEFAULT_RULES, ...(preset?.rules || {}) };
  return {
    duel_map_id: preset?.duel_map_id ?? null,
    rule_profile: preset?.rule_profile ?? 'balanced',
    generator_version: preset?.generator_version ?? PVP_DUEL_GENERATOR_VERSION,
    seed: preset?.seed ?? null,
    base: { ...(preset?.base || {}) },
    rules,
    canonical: preset?.canonical ?? {
      attackerDeployZone: 'deployA',
      defenderDeployZone: 'deployB',
    },
    notes: preset?.notes ?? '',
  };
}

function rowInZone(y, zoneKey) {
  const rows = ZONE[zoneKey];
  return Array.isArray(rows) && rows.includes(y);
}

function isForbiddenCell(y, x, rules) {
  const forbidColumns = rules.forbidColumns || [];
  if (forbidColumns.includes(x)) return true;
  if (rules.forbidBorderRows && (y === 0 || y === MAP_HEIGHT - 1)) return true;
  return false;
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function zoneKeysFromObjectsPerSide(objectsPerSide) {
  if (!objectsPerSide || typeof objectsPerSide !== 'object') return [];
  return Object.keys(objectsPerSide).filter((k) => ZONE[k]);
}

function countForType(counts, type) {
  const n = counts?.[type];
  return typeof n === 'number' && n > 0 ? Math.floor(n) : 0;
}

/**
 * 横贯河道：在 band.rows 两行上，除左右旱路列外，每列随机 1 或 2 格 river。
 * @param {string[][]} terrain
 * @param {object[]} objects
 * @param {SeededRandom} rng
 * @param {object} band - crossRiverBand
 */
function applyCrossRiverBand(terrain, objects, rng, band) {
  const rows = Array.isArray(band.rows) && band.rows.length ? band.rows : [4, 5];
  const leftPool = band.leftRoadColumnPool ?? [1, 2, 3];
  const rightPool = band.rightRoadColumnPool ?? [4, 5, 6];

  let leftRoad =
    typeof band.leftRoadColumn === 'number' ? band.leftRoadColumn : rng.pick(leftPool);
  let rightRoad =
    typeof band.rightRoadColumn === 'number' ? band.rightRoadColumn : rng.pick(rightPool);
  if (leftRoad === rightRoad && rightPool.length > 1) {
    const alt = rightPool.filter((c) => c !== leftRoad);
    rightRoad = rng.pick(alt.length ? alt : rightPool);
  }

  const riverCells = new Set();

  for (let x = 0; x < MAP_WIDTH; x++) {
    if (x === leftRoad || x === rightRoad) {
      for (const y of rows) {
        if (y >= 0 && y < MAP_HEIGHT) terrain[y][x] = TERRAIN.PLAIN;
      }
      continue;
    }
    const tileCount = rng.int(1, 2);
    if (tileCount === 1) {
      const y = rows[rng.int(0, rows.length - 1)];
      if (y >= 0 && y < MAP_HEIGHT) {
        terrain[y][x] = TERRAIN.RIVER;
        riverCells.add(`${y},${x}`);
      }
    } else {
      for (const y of rows) {
        if (y >= 0 && y < MAP_HEIGHT) {
          terrain[y][x] = TERRAIN.RIVER;
          riverCells.add(`${y},${x}`);
        }
      }
    }
  }

  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    const onRiver = riverCells.has(`${o.y},${o.x}`);
    const onRoad = rows.includes(o.y) && (o.x === leftRoad || o.x === rightRoad);
    if (onRiver || onRoad) objects.splice(i, 1);
  }

  return { leftRoad, rightRoad, rows, riverCellCount: riverCells.size };
}

/**
 * 在 preset.rules 约束下改写 mapResult（原地修改 terrain / objects / meta）
 */
export function applyPvpDuelRules(mapResult, preset, rng) {
  const rules = preset.rules || DEFAULT_RULES;
  const { terrain, objects } = mapResult;
  const placementZones = rules.placementZones || DEFAULT_RULES.placementZones;
  const stripZones = new Set([
    ...placementZones,
    ...zoneKeysFromObjectsPerSide(rules.objectsPerSide),
  ]);

  const filtered = objects.filter((o) => {
    if (rules.forbidChest !== false && o.type === 'chest') return false;
    if (rules.forbidTrap !== false && o.type === 'trap') return false;
    if (rules.forbidRandom !== false && o.type === 'random') return false;
    if (rules.forbidFarm !== false && o.type === 'farm') return false;
    const inStripZone = [...stripZones].some((zk) => rowInZone(o.y, zk));
    if (inStripZone && (o.type === 'rock' || o.type === 'fence' || o.type === 'trap')) {
      return false;
    }
    return true;
  });
  objects.length = 0;
  objects.push(...filtered);

  const occupied = new Set(objects.map((o) => `${o.y},${o.x}`));

  const perSide = rules.objectsPerSide || {};
  for (const zoneKey of zoneKeysFromObjectsPerSide(perSide)) {
    if (!ZONE[zoneKey]) continue;
    const counts = perSide[zoneKey];
    if (!counts || typeof counts !== 'object') continue;

    const candidates = [];
    for (const y of ZONE[zoneKey]) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (isForbiddenCell(y, x, rules)) continue;
        const key = `${y},${x}`;
        if (occupied.has(key)) continue;
        if (terrain[y]?.[x] === TERRAIN.RIVER || terrain[y]?.[x] === 'lake' || terrain[y]?.[x] === 'lava') {
          continue;
        }
        candidates.push([y, x]);
      }
    }
    shuffleInPlace(candidates, rng);

    const typesToPlace = ['rock', 'fence'];
    for (const type of typesToPlace) {
      const n = countForType(counts, type);
      const def = GAMEPLAY_OBJECT_DEFS[type];
      if (!def) continue;
      for (let i = 0; i < n && candidates.length > 0; i++) {
        const idx = rng.int(0, candidates.length - 1);
        const [y, x] = candidates.splice(idx, 1)[0];
        const obj = { type, x, y, ...def };
        objects.push(obj);
        occupied.add(`${y},${x}`);
        if (!def.isPassable) {
          for (let ci = candidates.length - 1; ci >= 0; ci--) {
            const [cy, cx] = candidates[ci];
            if (Math.abs(cy - y) <= 1 && Math.abs(cx - x) <= 1) {
              candidates.splice(ci, 1);
            }
          }
        }
      }
    }
  }

  if (rules.centerBand?.rows?.length) {
    const bias = rules.centerBand.terrainBias === 'hill' ? TERRAIN.HILL : TERRAIN.FOREST;
    for (const y of rules.centerBand.rows) {
      if (y < 0 || y >= MAP_HEIGHT) continue;
      for (let x = 1; x <= 6; x++) {
        if (terrain[y][x] === TERRAIN.PLAIN && rng.chance(0.35)) {
          terrain[y][x] = bias;
        }
      }
    }
  }

  if (rules.combatTerrainBias === 'hill') {
    for (const y of ZONE.combat) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (terrain[y][x] === TERRAIN.FOREST && rng.chance(0.4)) {
          terrain[y][x] = TERRAIN.HILL;
        }
      }
    }
  }

  let crossRiverMeta = null;
  if (rules.crossRiverBand) {
    crossRiverMeta = applyCrossRiverBand(terrain, objects, rng, rules.crossRiverBand);
  }

  mapResult.meta = {
    ...mapResult.meta,
    hasChest: objects.some((o) => o.type === 'chest'),
    hasRandom: objects.some((o) => o.type === 'random'),
    hasFarm: objects.some((o) => o.type === 'farm'),
    obstacleCount: objects.filter((o) => o.type !== 'chest' && o.type !== 'random' && o.type !== 'farm')
      .length,
    pvpDuelRulesApplied: true,
    ...(crossRiverMeta ? { crossRiverBand: crossRiverMeta } : {}),
  };
}

/**
 * @param {object} preset - 固化或模板 preset（含 base / rules）
 * @param {{ seed?: number|null }} [options]
 */
export function generatePvpDuelMap(preset, { seed } = {}) {
  const normalized = normalizePreset(preset);
  const resolvedSeed = seed ?? normalized.seed ?? null;
  const rules = normalized.rules || {};

  // v2 底板：关掉 Shape 河 / 宝箱 / 随机箱 / 农场；横贯河与障碍由规则层写入。
  // preset.base.bgTheme / forceComplexity 为旧字段，v2 忽略（保留在 preset 供文档兼容）。
  const raw = generateSmallMapV2({
    seed: resolvedSeed,
    battleRarity: 'common',
    skipRiver: true,
    skipChest: rules.forbidChest !== false,
    skipRandom: rules.forbidRandom !== false,
    skipFarm: rules.forbidFarm !== false,
  });

  const applySeed = ((Number(resolvedSeed) || raw.meta?.seed || 0) ^ 0x505650) >>> 0;
  applyPvpDuelRules(raw, normalized, new SeededRandom(applySeed));
  syncMapResultVisualsFromTerrain(raw, { seed: applySeed });

  raw.meta = {
    ...raw.meta,
    seed: raw.meta?.seed ?? resolvedSeed,
    generator_version: normalized.generator_version,
    rule_profile: normalized.rule_profile,
    duel_map_id: normalized.duel_map_id,
    pvpDuel: true,
    baseGenerator: 'v2',
  };

  return raw;
}

/** 与旧战役管理页一致（已归档）：\[1, 2147483646\] */
export function randomDuelMapSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    let v = buf[0] % 2147483646;
    return v === 0 ? 1 : v;
  }
  return 1 + Math.floor(Math.random() * 2147483645);
}
