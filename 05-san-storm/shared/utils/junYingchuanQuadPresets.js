/**
 * 颍川郡四象限 preset（仅用于主界面大地图无 merged 文件时的内存回退）。
 * 与 `shared/data/worldmap/san_1_jun_yingchuan_quad_*.preset.json` 同源。
 */
import junA from '../data/worldmap/san_1_jun_yingchuan_quad_A.preset.json' with { type: 'json' };
import junB from '../data/worldmap/san_1_jun_yingchuan_quad_B.preset.json' with { type: 'json' };
import junC from '../data/worldmap/san_1_jun_yingchuan_quad_C.preset.json' with { type: 'json' };
import junD from '../data/worldmap/san_1_jun_yingchuan_quad_D.preset.json' with { type: 'json' };

/** @type {Record<'A'|'B'|'C'|'D', object>} */
export const YINGCHUAN_QUAD_PRESETS_BY_LETTER = {
  A: junA,
  B: junB,
  C: junC,
  D: junD,
};
