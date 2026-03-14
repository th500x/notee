/**
 * 创建 config_servers 表
 */

const { pool } = require('../database/connection');

async function createTable() {
  try {
    console.log('========== 创建 config_servers 表 ==========\n');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS config_servers (
        server_id VARCHAR(20) PRIMARY KEY COMMENT '服务器ID（如：S1-01）',
        server_name VARCHAR(50) NOT NULL COMMENT '服务器名称（如：群雄逐鹿）',
        server_icon VARCHAR(255) DEFAULT '🏰' COMMENT '服务器图标（emoji或图片URL）',
        server_color VARCHAR(20) DEFAULT '#FF6B6B' COMMENT '服务器主题色（hex）',
        description VARCHAR(200) COMMENT '服务器描述',
        
        -- 赛季信息
        current_season VARCHAR(50) NOT NULL COMMENT '当前赛季（如：san_1）',
        season_start_time DATETIME COMMENT '赛季开始时间',
        season_end_time DATETIME COMMENT '赛季结束时间',
        
        -- 容量配置
        max_real_players INT DEFAULT 700 COMMENT '最大真人玩家数',
        max_ai_players INT DEFAULT 300 COMMENT '最大AI玩家数',
        
        -- 服务器状态
        status ENUM('open', 'maintenance', 'closed') DEFAULT 'open' COMMENT '服务器状态',
        is_new BOOLEAN DEFAULT TRUE COMMENT '是否新服（开服7天内）',
        is_recommended BOOLEAN DEFAULT FALSE COMMENT '是否推荐服务器',
        
        -- 时间信息
        opened_at DATETIME NOT NULL COMMENT '开服时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        
        INDEX idx_season (current_season),
        INDEX idx_status (status),
        INDEX idx_opened_at (opened_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='服务器配置表'
    `);

    console.log('✅ config_servers 表创建成功\n');
    console.log('========== 完成 ==========');
    await pool.end();
    
  } catch (error) {
    console.error('创建表失败:', error);
    process.exit(1);
  }
}

createTable();
