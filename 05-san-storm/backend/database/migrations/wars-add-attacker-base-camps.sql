-- PVE 中立城攻城：各攻方势力大本营（与 wars_pvp.base_camp 同形 JSON，按 factionId 分键）
ALTER TABLE wars
  ADD COLUMN attacker_base_camps JSON NULL
    COMMENT '攻方大本营 { factionId: baseCamp }；终局或撤战置 NULL';
