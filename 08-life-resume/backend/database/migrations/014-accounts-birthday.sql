-- 账号生日：年、日 + 一次改正标记（月列 birthMonth 已有）
-- 数据库: 11_life_resume
-- 老用户 year/day 可空；新注册由应用层必填

ALTER TABLE accounts
  ADD COLUMN birthYear SMALLINT NULL COMMENT '出生年；老用户可空，新注册必填' AFTER password,
  ADD COLUMN birthDay TINYINT NULL COMMENT '出生日；老用户可空，新注册必填' AFTER birthMonth,
  ADD COLUMN birthdayChangedAt DATETIME NULL COMMENT '已用过一次生日改正；空=还可改正一次';
