-- ============================================
-- 测试赛季数据统计查询模板
-- 用途：统计和分析测试阶段的用户数据
-- 作者：Kiro AI
-- 日期：2026-03-08
-- ============================================

-- ============================================
-- 1. 基础统计
-- ============================================

-- 1.1 各测试阶段的参与人数
SELECT 
  season_id,
  COUNT(DISTINCT player_id) as player_count,
  COUNT(*) as total_records
FROM season_records
WHERE season_id LIKE 'san_0_%'
GROUP BY season_id
ORDER BY season_id;

-- 1.2 各测试阶段的服务器分布
SELECT 
  season_id,
  server_id,
  COUNT(*) as player_count
FROM season_records
WHERE season_id LIKE 'san_0_%'
GROUP BY season_id, server_id
ORDER BY season_id, server_id;

-- ============================================
-- 2. 用户参与情况统计
-- ============================================

-- 2.1 查看每个用户参与了哪些测试阶段
SELECT 
  p.player_id,
  p.character_name,
  GROUP_CONCAT(DISTINCT sr.season_id ORDER BY sr.season_id) as participated_tests,
  COUNT(DISTINCT sr.season_id) as test_count
FROM players p
LEFT JOIN season_records sr ON p.player_id = sr.player_id
WHERE sr.season_id LIKE 'san_0_%'
GROUP BY p.player_id, p.character_name
ORDER BY test_count DESC, p.player_id;

-- 2.2 统计参与测试阶段数量的分布
SELECT 
  test_count,
  COUNT(*) as player_count
FROM (
  SELECT 
    p.player_id,
    COUNT(DISTINCT sr.season_id) as test_count
  FROM players p
  LEFT JOIN season_records sr ON p.player_id = sr.player_id
  WHERE sr.season_id LIKE 'san_0_%'
  GROUP BY p.player_id
) as test_participation
GROUP BY test_count
ORDER BY test_count;

-- ============================================
-- 3. 用户成绩统计
-- ============================================

-- 3.1 每个用户在各测试阶段的成绩
SELECT 
  p.player_id,
  p.character_name,
  sr.season_id,
  sr.server_id,
  sr.final_reputation,
  sr.final_position,
  sr.final_rank,
  sr.total_battles,
  sr.total_wins,
  ROUND(sr.total_wins * 100.0 / NULLIF(sr.total_battles, 0), 2) as win_rate,
  sr.settled_at
FROM players p
INNER JOIN season_records sr ON p.player_id = sr.player_id
WHERE sr.season_id LIKE 'san_0_%'
ORDER BY p.player_id, sr.season_id;

-- 3.2 每个用户的最佳成绩（跨所有测试阶段）
SELECT 
  p.player_id,
  p.character_name,
  MAX(sr.final_reputation) as best_reputation,
  MIN(sr.final_rank) as best_rank,
  SUM(sr.total_battles) as total_battles,
  SUM(sr.total_wins) as total_wins,
  ROUND(SUM(sr.total_wins) * 100.0 / NULLIF(SUM(sr.total_battles), 0), 2) as overall_win_rate
FROM players p
INNER JOIN season_records sr ON p.player_id = sr.player_id
WHERE sr.season_id LIKE 'san_0_%'
GROUP BY p.player_id, p.character_name
ORDER BY best_reputation DESC, best_rank ASC;

-- 3.3 各测试阶段的平均成绩
SELECT 
  season_id,
  COUNT(*) as player_count,
  ROUND(AVG(final_reputation), 2) as avg_reputation,
  ROUND(AVG(final_rank), 2) as avg_rank,
  ROUND(AVG(total_battles), 2) as avg_battles,
  ROUND(AVG(total_wins * 100.0 / NULLIF(total_battles, 0)), 2) as avg_win_rate
FROM season_records
WHERE season_id LIKE 'san_0_%'
GROUP BY season_id
ORDER BY season_id;

-- ============================================
-- 4. 排行榜统计
-- ============================================

-- 4.1 各测试阶段的前10名
SELECT 
  season_id,
  player_id,
  character_name,
  final_reputation,
  final_rank,
  total_battles,
  total_wins
FROM (
  SELECT 
    sr.season_id,
    p.player_id,
    p.character_name,
    sr.final_reputation,
    sr.final_rank,
    sr.total_battles,
    sr.total_wins,
    ROW_NUMBER() OVER (PARTITION BY sr.season_id ORDER BY sr.final_reputation DESC) as rn
  FROM season_records sr
  INNER JOIN players p ON sr.player_id = p.player_id
  WHERE sr.season_id LIKE 'san_0_%'
) as ranked
WHERE rn <= 10
ORDER BY season_id, rn;

-- 4.2 跨所有测试阶段的综合排名（按最高声望）
SELECT 
  p.player_id,
  p.character_name,
  MAX(sr.final_reputation) as best_reputation,
  MIN(sr.final_rank) as best_rank,
  COUNT(DISTINCT sr.season_id) as test_count,
  SUM(sr.total_battles) as total_battles,
  SUM(sr.total_wins) as total_wins,
  ROUND(SUM(sr.total_wins) * 100.0 / NULLIF(SUM(sr.total_battles), 0), 2) as win_rate
FROM players p
INNER JOIN season_records sr ON p.player_id = sr.player_id
WHERE sr.season_id LIKE 'san_0_%'
GROUP BY p.player_id, p.character_name
ORDER BY best_reputation DESC, best_rank ASC
LIMIT 20;

-- ============================================
-- 5. 进步分析
-- ============================================

-- 5.1 用户在不同测试阶段的进步情况
SELECT 
  p.player_id,
  p.character_name,
  m2.final_reputation as m2_reputation,
  m3.final_reputation as m3_reputation,
  mvp.final_reputation as mvp_reputation,
  COALESCE(m3.final_reputation, 0) - COALESCE(m2.final_reputation, 0) as m2_to_m3_progress,
  COALESCE(mvp.final_reputation, 0) - COALESCE(m3.final_reputation, 0) as m3_to_mvp_progress
FROM players p
LEFT JOIN season_records m2 ON p.player_id = m2.player_id AND m2.season_id = 'san_0_m2'
LEFT JOIN season_records m3 ON p.player_id = m3.player_id AND m3.season_id = 'san_0_m3'
LEFT JOIN season_records mvp ON p.player_id = mvp.player_id AND mvp.season_id = 'san_0_mvp'
WHERE m2.player_id IS NOT NULL 
   OR m3.player_id IS NOT NULL 
   OR mvp.player_id IS NOT NULL
ORDER BY p.player_id;

-- ============================================
-- 6. 活跃度分析
-- ============================================

-- 6.1 各测试阶段的战斗活跃度
SELECT 
  season_id,
  COUNT(*) as player_count,
  SUM(total_battles) as total_battles,
  ROUND(AVG(total_battles), 2) as avg_battles_per_player,
  MAX(total_battles) as max_battles,
  MIN(total_battles) as min_battles
FROM season_records
WHERE season_id LIKE 'san_0_%'
GROUP BY season_id
ORDER BY season_id;

-- 6.2 战斗次数分布
SELECT 
  season_id,
  CASE 
    WHEN total_battles = 0 THEN '0场'
    WHEN total_battles BETWEEN 1 AND 10 THEN '1-10场'
    WHEN total_battles BETWEEN 11 AND 50 THEN '11-50场'
    WHEN total_battles BETWEEN 51 AND 100 THEN '51-100场'
    ELSE '100场以上'
  END as battle_range,
  COUNT(*) as player_count
FROM season_records
WHERE season_id LIKE 'san_0_%'
GROUP BY season_id, battle_range
ORDER BY season_id, 
  CASE battle_range
    WHEN '0场' THEN 1
    WHEN '1-10场' THEN 2
    WHEN '11-50场' THEN 3
    WHEN '51-100场' THEN 4
    ELSE 5
  END;

-- ============================================
-- 7. 导出用于Excel分析的数据
-- ============================================

-- 7.1 完整的用户测试数据（适合导出为CSV）
SELECT 
  p.player_id as '用户ID',
  p.character_name as '角色名',
  sr.season_id as '测试阶段',
  sr.server_id as '服务器',
  sr.final_reputation as '最终声望',
  sr.final_position as '最终官职',
  sr.final_rank as '最终排名',
  sr.total_battles as '总战斗次数',
  sr.total_wins as '总胜利次数',
  ROUND(sr.total_wins * 100.0 / NULLIF(sr.total_battles, 0), 2) as '胜率%',
  DATE_FORMAT(sr.settled_at, '%Y-%m-%d %H:%i:%s') as '结算时间'
FROM players p
INNER JOIN season_records sr ON p.player_id = sr.player_id
WHERE sr.season_id LIKE 'san_0_%'
ORDER BY p.player_id, sr.season_id;

-- ============================================
-- 8. 自定义查询模板
-- ============================================

-- 8.1 查询特定用户的所有测试记录
-- 使用方法：将 'YOUR_PLAYER_ID' 替换为实际的玩家ID
/*
SELECT 
  p.player_id,
  p.character_name,
  sr.season_id,
  sr.final_reputation,
  sr.final_rank,
  sr.total_battles,
  sr.total_wins,
  sr.settled_at
FROM players p
INNER JOIN season_records sr ON p.player_id = sr.player_id
WHERE p.player_id = 'YOUR_PLAYER_ID'
  AND sr.season_id LIKE 'san_0_%'
ORDER BY sr.season_id;
*/

-- 8.2 查询声望达到特定值的用户
-- 使用方法：将 500 替换为你想要的声望值
/*
SELECT 
  p.player_id,
  p.character_name,
  sr.season_id,
  sr.final_reputation,
  sr.final_rank
FROM players p
INNER JOIN season_records sr ON p.player_id = sr.player_id
WHERE sr.season_id LIKE 'san_0_%'
  AND sr.final_reputation >= 500
ORDER BY sr.final_reputation DESC;
*/

-- 8.3 查询参与了所有测试阶段的用户
/*
SELECT 
  p.player_id,
  p.character_name,
  COUNT(DISTINCT sr.season_id) as test_count,
  GROUP_CONCAT(DISTINCT sr.season_id ORDER BY sr.season_id) as tests
FROM players p
INNER JOIN season_records sr ON p.player_id = sr.player_id
WHERE sr.season_id LIKE 'san_0_%'
GROUP BY p.player_id, p.character_name
HAVING test_count = 3  -- 假设有3个测试阶段
ORDER BY p.player_id;
*/
