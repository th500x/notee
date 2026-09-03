-- 玩法二 P2：章节进度 JSON（对齐 campaign_progress / bandit_progress）
-- 键约定：by chapter_id → completed_nodes / nodes[nodeId].{status,clear_count,best_stars} / chapter_reward_claimed

ALTER TABLE player_progress
  ADD COLUMN chapter_progress JSON NULL COMMENT '章节战棋进度 JSON：by chapter_id';
