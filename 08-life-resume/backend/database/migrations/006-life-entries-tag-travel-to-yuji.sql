-- 标签「旅行」更名为「游记」

USE `00_notee`;

UPDATE life_entries
SET tags = REPLACE(CAST(tags AS CHAR CHARACTER SET utf8mb4), '"旅行"', '"游记"')
WHERE CAST(tags AS CHAR CHARACTER SET utf8mb4) LIKE '%"旅行"%';
