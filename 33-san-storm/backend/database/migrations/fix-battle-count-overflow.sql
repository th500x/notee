-- 修复部队卡耐久度超限数据（battle_count > max_battle_count）
-- 将超限的 battle_count 修正为 max_battle_count

UPDATE player_cards 
SET battle_count = max_battle_count 
WHERE card_type = 'troop' 
  AND battle_count > max_battle_count 
  AND max_battle_count IS NOT NULL;
