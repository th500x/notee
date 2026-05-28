-- 将 faction_reserve_usage 累计行并入 faction_reserve（category 不变）

INSERT INTO faction_reserve (faction_id, category, silver, food)
SELECT faction_id, category, silver_spent, food_spent
FROM faction_reserve_usage
ON DUPLICATE KEY UPDATE
  silver = GREATEST(faction_reserve.silver, VALUES(silver)),
  food = GREATEST(faction_reserve.food, VALUES(food));

DROP TABLE IF EXISTS faction_reserve_usage;
