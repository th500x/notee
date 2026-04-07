-- 战役卡片：通关奖励徽章（与 campaign-template.csv completion_reward_badge 对齐）
-- 已存在该列时执行会报错，可忽略或注释掉本文件后改用 import 脚本同步数据

ALTER TABLE config_campaigns
  ADD COLUMN completion_reward_badge VARCHAR(32) NULL
    COMMENT '通关奖励徽章：CSV 填数字表示第 N 枚赛季徽章；空表示无'
    AFTER completion_reward_food;
