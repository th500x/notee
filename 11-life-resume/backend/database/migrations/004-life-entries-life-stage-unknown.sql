-- life_stage 仅 unknown（时间未知；与 year 互斥）
-- 若表内仍有旧 enum 值（youth 等），直接 MODIFY 会报 1265；须先清条目或先改值。
-- 生产尚无真实片段数据：先删媒体与条目，再改 enum。

DELETE FROM life_entry_media;
DELETE FROM life_entries;

ALTER TABLE life_entries
  MODIFY COLUMN life_stage ENUM('unknown') NULL COMMENT '时间未知；与 year 互斥';
