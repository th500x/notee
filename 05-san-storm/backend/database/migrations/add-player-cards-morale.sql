-- player_cards.morale：将领/上阵士气（0–120），与 01-1 §3.2.3、playerProfileService 查询一致
-- 若列已存在，执行会报错，可忽略或先查 INFORMATION_SCHEMA.COLUMNS

ALTER TABLE player_cards
  ADD COLUMN morale INT NULL DEFAULT 70 COMMENT '当前士气（0-120），将领卡等；战后保持'
  AFTER current_troops;
