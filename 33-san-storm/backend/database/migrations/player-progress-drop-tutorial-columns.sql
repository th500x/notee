-- M2：新手指引改由 config_events 教程链 + explore_events 记录，不再使用 player_progress 教程列
ALTER TABLE player_progress
  DROP COLUMN tutorial_current_step,
  DROP COLUMN tutorial_completed,
  DROP COLUMN tutorial_completed_at;
