-- 储备列已迁至 faction_reserve（category=pool）

ALTER TABLE factions DROP COLUMN reserve_silver;
ALTER TABLE factions DROP COLUMN reserve_food;
ALTER TABLE factions DROP COLUMN reserve_recovery_applied_date;
