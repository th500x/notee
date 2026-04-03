-- Activity ranking: frozen deltas after event end (see routes/rankings.js, config/activityRankingEvents.js)
-- Use UTF-8 when piping to mysql.exe; COMMENT kept ASCII-only for Windows CLI compatibility.

ALTER TABLE temp_ranking_snapshots
  ADD COLUMN frozen_at DATETIME NULL DEFAULT NULL COMMENT 'set when scores frozen',
  ADD COLUMN frozen_delta_battle INT NULL,
  ADD COLUMN frozen_delta_events INT NULL,
  ADD COLUMN frozen_delta_rep_contrib INT NULL,
  ADD COLUMN frozen_delta_silver_food INT NULL;
