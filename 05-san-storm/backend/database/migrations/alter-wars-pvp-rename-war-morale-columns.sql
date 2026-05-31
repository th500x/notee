-- 战事竞态士气列重命名（17-3 §7.4 · 50-tables-battle §3.2.18a）
-- 存量战事保留原数值，不 backfill；仅落营激活的新战事写入初始士气。
-- 幂等：列已为新名时 CHANGE 会失败，由 apply-pending-local-ddl 跳过 duplicate/unknown column。

ALTER TABLE wars_pvp
  CHANGE COLUMN attacker_morale attacker_war_morale INT NULL DEFAULT NULL
    COMMENT '攻方战事竞态士气 0～120（与 defender 之和恒120；落营激活写入）',
  CHANGE COLUMN defender_morale defender_war_morale INT NULL DEFAULT NULL
    COMMENT '守方战事竞态士气 0～120';
