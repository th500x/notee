-- 真三日报 · 28 日签到（32-6 §3.2）
-- 扩 players，不新建独立表；命名与 attr_reroll_date / road_reserve_date 同风格。

ALTER TABLE players
  ADD COLUMN daily_report_checkin_date DATE NULL DEFAULT NULL
    COMMENT '真三日报：最近签到自然日（幂等/红点）',
  ADD COLUMN daily_report_checkin_cycle TINYINT UNSIGNED NOT NULL DEFAULT 1
    COMMENT '真三日报：下一轮将领取的第几天（1-28，签满循环回 1）';
