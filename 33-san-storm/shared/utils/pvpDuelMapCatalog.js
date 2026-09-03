/**
 * PvP 对决地图 catalog（固化 preset 登记）
 * 新增 JSON 后在此追加 id，与 shared/data/pvp-duel/*.preset.json 同步。
 */

import presetDuelMapDevFlat from '../data/pvp-duel/duel_map_dev_flat.preset.json' with { type: 'json' };
import presetBalanced from '../data/pvp-duel/san_1_duel_balanced_1953079403.preset.json' with { type: 'json' };
import presetChoke from '../data/pvp-duel/san_1_duel_choke_1283695747.preset.json' with { type: 'json' };
import presetRiver from '../data/pvp-duel/san_1_duel_river_1785919740.preset.json' with { type: 'json' };
import presetHillFocus from '../data/pvp-duel/san_1_duel_hill_focus_1359467968.preset.json' with { type: 'json' };
import presetObstacleRich from '../data/pvp-duel/san_1_duel_obstacle_rich_1334821748.preset.json' with { type: 'json' };
import { generatePvpDuelMap } from './pvpDuelMapGenerator.js';

export const DUEL_MAP_PRESETS_BY_ID = {
  duel_map_dev_flat: presetDuelMapDevFlat,
  san_1_duel_balanced_1953079403: presetBalanced,
  san_1_duel_choke_1283695747: presetChoke,
  san_1_duel_river_1785919740: presetRiver,
  san_1_duel_hill_focus_1359467968: presetHillFocus,
  san_1_duel_obstacle_rich_1334821748: presetObstacleRich,
};

export const DUEL_MAP_PRESET_IDS = Object.keys(DUEL_MAP_PRESETS_BY_ID);

/** 正式对战随机池（不含开发占位） */
export const DUEL_MAP_POOL_IDS = DUEL_MAP_PRESET_IDS.filter((id) => id !== 'duel_map_dev_flat');

export function getDuelMapPresetById(duelMapId) {
  return DUEL_MAP_PRESETS_BY_ID[duelMapId] ?? null;
}

export function buildDuelMapFromPreset(duelMapIdOrPreset) {
  const preset =
    typeof duelMapIdOrPreset === 'string'
      ? getDuelMapPresetById(duelMapIdOrPreset)
      : duelMapIdOrPreset;
  if (!preset) {
    throw new Error(`Unknown PvP duel map preset: ${duelMapIdOrPreset}`);
  }
  return generatePvpDuelMap(preset, { seed: preset.seed });
}

/** @param {{ excludeDev?: boolean }} [opts] */
export function randomPickDuelMapId(opts = {}) {
  const ids = opts.excludeDev !== false ? DUEL_MAP_POOL_IDS : DUEL_MAP_PRESET_IDS;
  if (!ids.length) return null;
  const idx = Math.floor(Math.random() * ids.length);
  return ids[idx];
}
