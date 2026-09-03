/**
 * 章节配置 JSON → MySQL（config_chapters / nodes / stages / stories）
 * 用法: node backend/database/import-chapter-data.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { purgeAfterConfigImport } = require('./import-config-purge.js');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '05_san_storm',
  charset: 'utf8mb4',
};

const SHARED = path.join(__dirname, '../../public/data/shared');

function jsonOrNull(v) {
  if (v == null) return null;
  return JSON.stringify(v);
}

async function importAll(connection) {
  const chaptersDoc = JSON.parse(await fs.readFile(path.join(SHARED, 'chapters.json'), 'utf8'));
  const stagesDoc = JSON.parse(await fs.readFile(path.join(SHARED, 'chapterStages.json'), 'utf8'));
  const storiesDoc = JSON.parse(await fs.readFile(path.join(SHARED, 'chapterStories.json'), 'utf8'));
  const chapters = chaptersDoc.chapters || [];
  const nodes = chaptersDoc.nodes || [];
  const stages = stagesDoc.stages || [];
  const stories = storiesDoc.stories || [];

  let c = 0;
  for (const ch of chapters) {
    await connection.query(
      `INSERT INTO config_chapters (
        chapter_id, season, chapter_name, era, description, completion_rewards, sort_order, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        season = VALUES(season),
        chapter_name = VALUES(chapter_name),
        era = VALUES(era),
        description = VALUES(description),
        completion_rewards = VALUES(completion_rewards),
        sort_order = VALUES(sort_order),
        enabled = VALUES(enabled)`,
      [
        ch.id,
        ch.season || 'san_1',
        ch.name,
        ch.era || null,
        ch.description || null,
        jsonOrNull(ch.completionRewards || {}),
        ch.sortOrder ?? 0,
        ch.enabled === false ? 0 : 1,
      ],
    );
    c += 1;
  }

  let n = 0;
  for (const node of nodes) {
    await connection.query(
      `INSERT INTO config_chapter_nodes (
        node_id, chapter_id, sort_order, node_type, ref_id, next_node_id, next_node_ids,
        lineup_slots_override, entry_token_cost, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        chapter_id = VALUES(chapter_id),
        sort_order = VALUES(sort_order),
        node_type = VALUES(node_type),
        ref_id = VALUES(ref_id),
        next_node_id = VALUES(next_node_id),
        next_node_ids = VALUES(next_node_ids),
        lineup_slots_override = VALUES(lineup_slots_override),
        entry_token_cost = VALUES(entry_token_cost),
        notes = VALUES(notes)`,
      [
        node.id,
        node.chapterId,
        node.sortOrder ?? 0,
        node.nodeType,
        node.refId,
        node.nextNodeId || null,
        node.nextNodeIds || null,
        node.lineupSlotsOverride || null,
        node.entryTokenCost ?? 0,
        node.notes || null,
      ],
    );
    n += 1;
  }

  let s = 0;
  for (const st of stages) {
    await connection.query(
      `INSERT INTO config_chapter_stages (
        stage_id, stage_name, chapter_id, map_w, map_h, lineup_slots, deploy_pattern,
        terrain_brief, terrain_ratios, enemy_roster, ally_roster,
        max_rounds, min_rounds, win_condition, lose_condition,
        reward_silver, reward_food, star_1, star_2, star_3, star_rewards,
        map_ref, map_seed, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        stage_name = VALUES(stage_name),
        chapter_id = VALUES(chapter_id),
        map_w = VALUES(map_w),
        map_h = VALUES(map_h),
        lineup_slots = VALUES(lineup_slots),
        deploy_pattern = VALUES(deploy_pattern),
        terrain_brief = VALUES(terrain_brief),
        terrain_ratios = VALUES(terrain_ratios),
        enemy_roster = VALUES(enemy_roster),
        ally_roster = VALUES(ally_roster),
        max_rounds = VALUES(max_rounds),
        min_rounds = VALUES(min_rounds),
        win_condition = VALUES(win_condition),
        lose_condition = VALUES(lose_condition),
        reward_silver = VALUES(reward_silver),
        reward_food = VALUES(reward_food),
        star_1 = VALUES(star_1),
        star_2 = VALUES(star_2),
        star_3 = VALUES(star_3),
        star_rewards = VALUES(star_rewards),
        map_ref = VALUES(map_ref),
        map_seed = VALUES(map_seed),
        notes = VALUES(notes)`,
      [
        st.id,
        st.name,
        st.chapterId,
        st.mapW,
        st.mapH,
        st.lineupSlots || 'main',
        st.deployPattern,
        st.terrainBrief || null,
        st.terrainRatios || null,
        st.enemyRoster || null,
        st.allyRoster || null,
        st.maxRounds ?? 30,
        st.minRounds,
        jsonOrNull(st.winCondition),
        jsonOrNull(st.loseCondition),
        st.rewardSilver ?? 0,
        st.rewardFood ?? 0,
        jsonOrNull(st.star1),
        jsonOrNull(st.star2),
        jsonOrNull(st.star3),
        jsonOrNull(st.starRewards),
        st.mapRef || null,
        st.mapSeed || null,
        st.notes || null,
      ],
    );
    s += 1;
  }

  let y = 0;
  for (const story of stories) {
    await connection.query(
      `INSERT INTO config_chapter_stories (story_id, chapter_id, title, lines_json, notes)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         chapter_id = VALUES(chapter_id),
         title = VALUES(title),
         lines_json = VALUES(lines_json),
         notes = VALUES(notes)`,
      [
        story.id,
        story.chapterId,
        story.title || null,
        jsonOrNull(story.lines || []),
        story.notes || null,
      ],
    );
    y += 1;
  }

  await purgeAfterConfigImport(connection, chapters, 'id', {
    table: 'config_chapters',
    idColumn: 'chapter_id',
    scopeColumn: 'season',
    label: '章节',
  });

  // 子表按 JSON id 集合清理（短 id 如 yc_01 不宜走 purge 的 san_* 族推导）
  const nodeIds = nodes.map((x) => x.id).filter(Boolean);
  if (nodeIds.length) {
    const ph = nodeIds.map(() => '?').join(',');
    await connection.query(`DELETE FROM config_chapter_nodes WHERE node_id NOT IN (${ph})`, nodeIds);
  }
  const stageIds = stages.map((x) => x.id).filter(Boolean);
  if (stageIds.length) {
    const ph = stageIds.map(() => '?').join(',');
    await connection.query(`DELETE FROM config_chapter_stages WHERE stage_id NOT IN (${ph})`, stageIds);
  }
  const storyIds = stories.map((x) => x.id).filter(Boolean);
  if (storyIds.length) {
    const ph = storyIds.map(() => '?').join(',');
    await connection.query(`DELETE FROM config_chapter_stories WHERE story_id NOT IN (${ph})`, storyIds);
  }

  console.log(`章节导入: chapters=${c} nodes=${n} stages=${s} stories=${y}`);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    await importAll(connection);
    console.log('章节配置导入完成');
  } finally {
    await connection.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
