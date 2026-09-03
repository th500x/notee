-- 废止城级驻军所容量上限（不再由 CSV / 种子写入；UI 亦不展示上限）

ALTER TABLE cities
  DROP COLUMN player_garrison_capacity;
