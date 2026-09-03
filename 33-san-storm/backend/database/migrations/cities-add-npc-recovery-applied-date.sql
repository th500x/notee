-- NPC 守军每日 0:00 损兵恢复幂等标记（13-2 §6.2 · 15-2）
-- 有损耗的城恢复 round(编制上限×10%) 后写入 CURDATE；中立/已占统一

ALTER TABLE cities
  ADD COLUMN npc_recovery_applied_date DATE NULL
    COMMENT 'NPC损兵日恢复已应用的服务器日历日（CURDATE）' AFTER attr_growth_applied_date;
