-- 标签调整：学业 → 人生；白名单新增「娱乐」（应用层）
-- 与 shared/utils/lifeResumeEntryTags.* 同步：工作 / 游记 / 娱乐 / 家庭 / 人生

USE `00_notee`;

UPDATE life_entries
SET tags = REPLACE(CAST(tags AS CHAR CHARACTER SET utf8mb4), '"学业"', '"人生"')
WHERE CAST(tags AS CHAR CHARACTER SET utf8mb4) LIKE '%"学业"%';
