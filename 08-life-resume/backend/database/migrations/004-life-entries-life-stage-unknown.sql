-- life_stage 仅 unknown（时间未知；与 year 互斥）
-- 若表内仍有旧 enum 值（youth 等），直接 MODIFY 会报 1265；须先把旧值改为 unknown，再改 enum。
-- ⚠️ 严禁 DELETE/TRUNCATE 条目或媒体。2026-10-03 曾因本文件含清空语句，在生产误跑迁移导致数据丢失。

UPDATE life_entries
SET life_stage = 'unknown'
WHERE life_stage IS NOT NULL
  AND life_stage <> 'unknown';

ALTER TABLE life_entries
  MODIFY COLUMN life_stage ENUM('unknown') NULL COMMENT '时间未知；与 year 互斥';
