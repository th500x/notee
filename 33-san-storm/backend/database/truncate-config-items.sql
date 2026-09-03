-- 清空道具配置表（仅 config_items；玩家背包不在此表）
-- 生产执行前请备份库；确认无其它表 FOREIGN KEY 指向 config_items（当前工程未见）
TRUNCATE TABLE config_items;
