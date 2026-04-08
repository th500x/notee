-- 与 public/data/shared/troops.json 一致：压缩各稀有度「标准」兵力上限（2026-04）
-- 普通 200 不动；稀有 330→280；史诗 330/460→360；传奇 460/600→440（低编、事件兵等除外由 JSON 控制）
-- 核心：800→520；保留 max_troops=600 的核心单位
-- 勿改：流民/7x 系列 max_troops=990、troop_weight=0.2 等由数据行区分

UPDATE config_troops SET max_troops = 280 WHERE rarity = 'rare' AND max_troops = 330;
UPDATE config_troops SET max_troops = 360 WHERE rarity = 'epic' AND max_troops IN (330, 460);
UPDATE config_troops SET max_troops = 440 WHERE rarity = 'legendary' AND max_troops IN (460, 600);
UPDATE config_troops SET max_troops = 520 WHERE rarity = 'core' AND max_troops = 800;
