/**
 * 初始化服务器数据
 * 将服务器配置插入到 config_servers 表
 */

const { pool } = require('../database/connection');

async function initServers() {
  try {
    console.log('========== 初始化服务器数据 ==========\n');

    // 服务器配置数据
    const servers = [
      {
        server_id: 'San_1_Chaos',
        server_name: 'San_1_Chaos',
        server_icon: '🎮',
        server_color: '#FFD700',
        description: '黄巾之乱（公元184-189年）- 测试赛季',
        current_season: 'san_0_m1',
        season_start_time: '2026-03-08 00:00:00',
        season_end_time: '2026-09-08 00:00:00',
        max_real_players: 660,
        max_ai_players: 990,
        status: 'open',
        is_new: true,
        is_recommended: true,
        opened_at: '2026-03-08 00:00:00',
        game_time_start_year: 184,
        game_time_start_month: 1,
        game_time_start_day: 1,
        game_time_real_hours_per_game_day: 1,
      }
    ];

    // 插入服务器数据
    for (const server of servers) {
      console.log(`插入服务器: ${server.server_name}`);
      
      await pool.query(`
        INSERT INTO config_servers (
          server_id, server_name, server_icon, server_color, description,
          current_season, season_start_time, season_end_time,
          max_real_players, max_ai_players,
          status, is_new, is_recommended, opened_at,
          game_time_start_year, game_time_start_month, game_time_start_day,
          game_time_real_hours_per_game_day
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          server_name = VALUES(server_name),
          server_icon = VALUES(server_icon),
          server_color = VALUES(server_color),
          description = VALUES(description),
          current_season = VALUES(current_season),
          season_start_time = VALUES(season_start_time),
          season_end_time = VALUES(season_end_time),
          max_real_players = VALUES(max_real_players),
          max_ai_players = VALUES(max_ai_players),
          status = VALUES(status),
          is_new = VALUES(is_new),
          is_recommended = VALUES(is_recommended),
          game_time_start_year = VALUES(game_time_start_year),
          game_time_start_month = VALUES(game_time_start_month),
          game_time_start_day = VALUES(game_time_start_day),
          game_time_real_hours_per_game_day = VALUES(game_time_real_hours_per_game_day)
      `, [
        server.server_id,
        server.server_name,
        server.server_icon,
        server.server_color,
        server.description,
        server.current_season,
        server.season_start_time,
        server.season_end_time,
        server.max_real_players,
        server.max_ai_players,
        server.status,
        server.is_new,
        server.is_recommended,
        server.opened_at,
        server.game_time_start_year,
        server.game_time_start_month,
        server.game_time_start_day,
        server.game_time_real_hours_per_game_day,
      ]);
      
      console.log(`✅ ${server.server_name} 插入成功\n`);
    }

    console.log('========== 初始化完成 ==========');
    await pool.end();
    
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

initServers();
