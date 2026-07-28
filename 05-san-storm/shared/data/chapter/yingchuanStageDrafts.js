/**
 * 颍川章节关卡草稿（与 docs/tools/chapter/chapter-stage-template.csv 对齐）
 * 供调试页 / 生图预览；正式入库仍走 CSV→JSON→MySQL。
 */

export const YINGCHUAN_STAGE_DRAFTS = [
  {
    stage_id: 'san_1_stage_yc_02',
    stage_name: '长社外围接触战',
    chapter_id: 'san_1_chapter_yingchuan_01',
    map_w: 12,
    map_h: 16,
    lineup_slots: 'main',
    deploy_pattern: 'player_south_enemy_north',
    terrain_brief: '南侧开阔推进；北侧近城防与疏林；中部偶见丘冈。',
    terrain_ratios: 'hill:12;forest:18;river:8',
    enemy_roster:
      'enemy|san_1_char_7006|san_1_troop_7004:2|morale:40|role:boss|ai:defense||enemy|san_1_char_7007|san_1_troop_7004:2|morale:40|ai:defense||enemy|san_1_char_7008|san_1_troop_7003:2|morale:20|ai:defense',
    ally_roster:
      'ally1|san_1_char_6004|san_1_troop_6005:2|morale:80|role:hero|ai:attack||ally1|san_1_char_6005|san_1_troop_6004:2|morale:80|ai:attack',
    max_rounds: 20,
    map_seed: '',
  },
  {
    stage_id: 'san_1_stage_yc_04',
    stage_name: '夜袭黄巾草营',
    chapter_id: 'san_1_chapter_yingchuan_01',
    map_w: 10,
    map_h: 14,
    lineup_slots: 'main',
    deploy_pattern: 'ambush_player_edge',
    terrain_brief: '营地散落；枯草与火险地带偏中右；通路须保证可摸到敌营。',
    terrain_ratios: 'forest:10;hill:8;wasteland:25',
    enemy_roster:
      'enemy|san_1_char_7010|san_1_troop_7003:2|morale:20|role:boss|ai:defense||enemy|san_1_char_7011|san_1_troop_7003:2|morale:20|ai:defense||enemy|san_1_char_7012|san_1_troop_7003:2|morale:20|ai:defense',
    ally_roster: '',
    max_rounds: 18,
    map_seed: '',
  },
];

export function getYingchuanStageDraft(stageId) {
  return YINGCHUAN_STAGE_DRAFTS.find((s) => s.stage_id === stageId) || null;
}
