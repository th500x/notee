-- 11-life-resume 注册：允许尚未选 05 区服的账号（serverId / current_season 可空）
-- 游戏内注册仍传 serverId，行为不变

ALTER TABLE accounts
  MODIFY COLUMN serverId VARCHAR(20) NULL COMMENT '所选服务器；11注册可为空';

ALTER TABLE accounts
  MODIFY COLUMN current_season VARCHAR(50) NULL COMMENT '当前赛季；未选服可为空';
