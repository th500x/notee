/**
 * 插入系统占位账号 sys1（传书 sender_id 外键用）
 * 运行：在 backend 目录执行  node database/migrations/seed-system-player-sys1.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const SYS_ID = 'sys1';
// 与迁移 SQL 中一致；勿用于登录（auth 层应拒绝 sys1）
const PASSWORD_HASH = bcrypt.hashSync('__SYS1_NO_LOGIN__', 10);
const PLACEHOLDER_IP = '240.0.0.254';
const PLACEHOLDER_MACHINE = 'san-storm-sys1-machine-placeholder-v1';

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '05_san_storm',
  });

  const [[sample]] = await pool.query(
    'SELECT faction_id, faction_name FROM players WHERE player_id <> ? LIMIT 1',
    [SYS_ID]
  );
  const factionId = sample?.faction_id || 'san_1_faction_1001';
  const factionName = sample?.faction_name || '系统占位';

  await pool.query(
    `INSERT INTO accounts (id, password, birthMonth, serverId, account_type, clientIP, machineId, status)
     VALUES (?, ?, 1, 'SYS0', 'real', ?, ?, 'inactive')
     ON DUPLICATE KEY UPDATE id = id`,
    [SYS_ID, PASSWORD_HASH, PLACEHOLDER_IP, PLACEHOLDER_MACHINE]
  );

  await pool.query(
    `INSERT INTO players (
       player_id, character_name, faction_id, faction_name, avatar,
       combat, intelligence, command, politics, charm, courage, luck,
       skill_1, skill_2, current_position_id, current_position_name, position_level,
       reputation, reputation_to_next, silver, food, morale, on_duty,
       last_login_at, last_active_at
     ) VALUES (
       ?, '【系统】', ?, ?, NULL,
       50, 50, 50, 50, 50, 50, 50,
       NULL, NULL, NULL, NULL, 8,
       0, 10, 0, 0, 70, 0,
       NOW(), NOW()
     )
     ON DUPLICATE KEY UPDATE player_id = player_id`,
    [SYS_ID, factionId, factionName]
  );

  await pool.query(
    `INSERT INTO player_progress (player_id)
     VALUES (?)
     ON DUPLICATE KEY UPDATE player_id = player_id`,
    [SYS_ID]
  );

  await pool.query(
    `INSERT INTO player_events (player_id) VALUES (?)
     ON DUPLICATE KEY UPDATE player_id = player_id`,
    [SYS_ID]
  );

  await pool.query(
    `INSERT INTO statistics (player_id) VALUES (?)
     ON DUPLICATE KEY UPDATE player_id = player_id`,
    [SYS_ID]
  );

  console.log('✅ sys1 占位账号与 players 行已就绪（若已存在则跳过更新）');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
