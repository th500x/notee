-- config_characters：将领性别（male|female；卡面不展示，供特定部队女性带将加成等）
-- 与 docs/tools/character CSV 列 gender、21-1 §4.3 一致

USE 05_san_storm;

ALTER TABLE config_characters
  ADD COLUMN gender VARCHAR(8) NOT NULL DEFAULT 'male'
    COMMENT 'male|female'
    AFTER rarity;

-- 验证
DESCRIBE config_characters;

SELECT '✅ 迁移完成：config_characters.gender 已添加' AS status;
