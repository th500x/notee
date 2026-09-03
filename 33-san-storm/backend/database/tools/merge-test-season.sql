-- ============================================
-- 测试赛季记录合并脚本
-- 用途：将 san_0_m2, san_0_m3, san_0_mvp 等测试记录合并为 san_0
-- 作者：Kiro AI
-- 日期：2026-03-08
-- ============================================

-- ============================================
-- 第一步：检查数据
-- ============================================
SELECT '=== 检查测试赛季记录 ===' AS step;

SELECT season_id, COUNT(*) as player_count, SUM(total_battles) as total_battles
FROM season_records
WHERE season_id LIKE 'san_0_%'
GROUP BY season_id
ORDER BY season_id;

-- ============================================
-- 第二步：备份数据（必须执行！）
-- ============================================
SELECT '=== 备份原始数据 ===' AS step;

-- 创建备份表（带时间戳）
DROP TABLE IF EXISTS season_records_backup_test;
CREATE TABLE season_records_backup_test AS 
SELECT * FROM season_records 
WHERE season_id LIKE 'san_0_%';

-- 验证备份
SELECT COUNT(*) as backup_count FROM season_records_backup_test;

-- ============================================
-- 第三步：合并记录
-- ============================================
SELECT '=== 开始合并记录 ===' AS step;

-- 开始事务
START TRANSACTION;

-- 为每个玩家创建合并后的记录
INSERT INTO season_records (
  player_id, 
  season_id, 
  server_id, 
  final_reputation, 
  final_position, 
  final_rank, 
  total_battles, 
  total_wins, 
  settled_at
)
SELECT 
  player_id,
  'san_0' AS season_id,
  server_id,
  MAX(final_reputation) AS final_reputation,
  (SELECT final_position FROM season_records sr2 
   WHERE sr2.player_id = sr1.player_id 
     AND sr2.season_id LIKE 'san_0_%'
   ORDER BY final_reputation DESC LIMIT 1) AS final_position,
  MIN(final_rank) AS final_rank,
  SUM(total_battles) AS total_battles,
  SUM(total_wins) AS total_wins,
  MAX(settled_at) AS settled_at
FROM season_records sr1
WHERE season_id LIKE 'san_0_%'
GROUP BY player_id, server_id;

-- 删除旧的测试记录
DELETE FROM season_records 
WHERE season_id LIKE 'san_0_%';

-- 提交事务
COMMIT;

-- ============================================
-- 第四步：验证结果
-- ============================================
SELECT '=== 验证合并结果 ===' AS step;

-- 检查合并后的记录数
SELECT 'san_0记录数' AS type, COUNT(*) as count 
FROM season_records 
WHERE season_id = 'san_0';

-- 检查是否还有旧记录
SELECT '旧测试记录数' AS type, COUNT(*) as count 
FROM season_records 
WHERE season_id LIKE 'san_0_%';

-- 查看前10名玩家
SELECT player_id, season_id, server_id, final_reputation, final_rank, total_battles, total_wins
FROM season_records 
WHERE season_id = 'san_0' 
ORDER BY final_reputation DESC 
LIMIT 10;

SELECT '=== 合并完成 ===' AS step;

-- ============================================
-- 如果需要回滚，执行以下命令：
-- ============================================
/*
-- 删除错误的合并记录
DELETE FROM season_records WHERE season_id = 'san_0';

-- 从备份恢复
INSERT INTO season_records 
SELECT * FROM season_records_backup_test;

-- 验证恢复
SELECT season_id, COUNT(*) FROM season_records 
WHERE season_id LIKE 'san_0%' 
GROUP BY season_id;
*/
