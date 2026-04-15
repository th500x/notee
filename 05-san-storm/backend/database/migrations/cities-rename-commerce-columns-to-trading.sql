-- cities: 商业相关列统一重命名为 trading（API / JSON 与 DB 一致，不再保留 commerce 别名）
-- 生产 / 已有库：在目标库执行本文件（或 mysql 客户端重定向）；列已为新名时可跳过。

ALTER TABLE cities
  CHANGE COLUMN commerce trading INT NOT NULL DEFAULT 0 COMMENT '商业值',
  CHANGE COLUMN special_resource_commerce special_resource_trading INT NOT NULL DEFAULT 0 COMMENT '特色资源商业加成',
  CHANGE COLUMN final_commerce final_trading INT NOT NULL DEFAULT 0 COMMENT '最终商业值';
