/**
 * 查询服务器配置
 */

const { pool } = require('../connection');

async function queryServers() {
  try {
    console.log(`\n========== 服务器配置 ==========`);
    
    // 查询所有服务器
    const [servers] = await pool.query(`
      SELECT 
        server_id, server_name, description, current_season,
        status, is_new, is_recommended,
        max_real_players, max_ai_players,
        season_start_time, season_end_time,
        opened_at, created_at
      FROM config_servers
      ORDER BY opened_at DESC
    `);

    if (servers.length === 0) {
      console.log('没有服务器配置');
      return;
    }

    servers.forEach((server, index) => {
      console.log(`\n--- 服务器 ${index + 1} ---`);
      console.log(`服务器ID: ${server.server_id}`);
      console.log(`服务器名称: ${server.server_name}`);
      console.log(`描述: ${server.description}`);
      console.log(`当前赛季: ${server.current_season}`);
      console.log(`状态: ${server.status}`);
      console.log(`是否新服: ${server.is_new ? '是' : '否'}`);
      console.log(`是否推荐: ${server.is_recommended ? '是' : '否'}`);
      console.log(`最大真人玩家: ${server.max_real_players}`);
      console.log(`最大AI玩家: ${server.max_ai_players}`);
      console.log(`赛季开始: ${server.season_start_time}`);
      console.log(`赛季结束: ${server.season_end_time}`);
      console.log(`开服时间: ${server.opened_at}`);
      console.log(`创建时间: ${server.created_at}`);
    });

    console.log(`\n========================================\n`);

  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await pool.end();
  }
}

queryServers();
