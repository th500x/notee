-- ============================================
-- 合并测试赛季参与记录
-- 用途：将 san_0_m2, san_0_m3, san_0_mvp 等标记合并为 san_0
-- 说明：只更新 players 表的 participated_seasons 字段
-- 作者：Kiro AI
-- 日期：2026-03-08
-- ============================================

-- ============================================
-- 第一步：检查数据
-- ============================================
SELECT '=== 检查参与测试的玩家 ===' AS step;

SELECT 
  player_id,
  character_name,
  participated_seasons
FROM players
WHERE JSON_CONTAINS(participated_seasons, '"san_0_m2"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_m3"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_mvp"')
LIMIT 10;

-- 统计数量
SELECT COUNT(*) as test_player_count
FROM players
WHERE JSON_CONTAINS(participated_seasons, '"san_0_m2"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_m3"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_mvp"');

-- ============================================
-- 第二步：备份数据（必须执行！）
-- ============================================
SELECT '=== 备份玩家数据 ===' AS step;

DROP TABLE IF EXISTS players_backup_test;
CREATE TABLE players_backup_test AS 
SELECT * FROM players
WHERE JSON_CONTAINS(participated_seasons, '"san_0_m2"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_m3"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_mvp"');

SELECT COUNT(*) as backup_count FROM players_backup_test;

-- ============================================
-- 第三步：合并参与记录
-- ============================================
SELECT '=== 开始合并参与记录 ===' AS step;

START TRANSACTION;

-- 创建临时表存储更新后的数据
CREATE TEMPORARY TABLE temp_player_seasons AS
SELECT 
  player_id,
  JSON_ARRAYAGG(season) as new_seasons
FROM (
  -- 保留非测试赛季
  SELECT DISTINCT 
    p.player_id,
    jt.season
  FROM players p
  CROSS JOIN JSON_TABLE(
    p.participated_seasons,
    '$[*]' COLUMNS(season VARCHAR(50) PATH '$')
  ) AS jt
  WHERE jt.season NOT LIKE 'san_0_%'
    AND (
      JSON_CONTAINS(p.participated_seasons, '"san_0_m2"')
      OR JSON_CONTAINS(p.participated_seasons, '"san_0_m3"')
      OR JSON_CONTAINS(p.participated_seasons, '"san_0_mvp"')
    )
  
  UNION
  
  -- 添加 san_0 标记
  SELECT DISTINCT 
    player_id,
    'san_0' as season
  FROM players
  WHERE JSON_CONTAINS(participated_seasons, '"san_0_m2"')
     OR JSON_CONTAINS(participated_seasons, '"san_0_m3"')
     OR JSON_CONTAINS(participated_seasons, '"san_0_mvp"')
) AS merged_seasons
GROUP BY player_id;

-- 更新玩家表
UPDATE players p
INNER JOIN temp_player_seasons t ON p.player_id = t.player_id
SET p.participated_seasons = t.new_seasons;

-- 清理临时表
DROP TEMPORARY TABLE temp_player_seasons;

COMMIT;

-- ============================================
-- 第四步：验证结果
-- ============================================
SELECT '=== 验证合并结果 ===' AS step;

-- 查看更新后的数据
SELECT 
  player_id,
  character_name,
  participated_seasons
FROM players
WHERE JSON_CONTAINS(participated_seasons, '"san_0"')
LIMIT 10;

-- 检查是否还有旧的测试标记
SELECT COUNT(*) as remaining_test_marks
FROM players
WHERE JSON_CONTAINS(participated_seasons, '"san_0_m2"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_m3"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_mvp"');

SELECT '=== 合并完成 ===' AS step;

-- ============================================
-- 如果需要回滚，执行以下命令：
-- ============================================
/*
-- 从备份恢复
UPDATE players p
INNER JOIN players_backup_test b ON p.player_id = b.player_id
SET p.participated_seasons = b.participated_seasons;

-- 验证恢复
SELECT player_id, participated_seasons 
FROM players 
WHERE JSON_CONTAINS(participated_seasons, '"san_0_m2"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_m3"')
   OR JSON_CONTAINS(participated_seasons, '"san_0_mvp"')
LIMIT 10;
*/
