-- 与 public/data/shared/troops.json 一致：S1 四条 core 部队 max_troops 990 → 800
-- 用法（XAMPP / MariaDB）：在目标库执行本脚本，或运行 node import-config-data.js troops 全量同步

UPDATE config_troops
SET max_troops = 800
WHERE troop_id IN (
  'san_1_troop_0009',
  'san_1_troop_0010',
  'san_1_troop_0011',
  'san_1_troop_0012'
);
