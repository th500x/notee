-- 迁移 faction_bonuses JSON key 名称（简化冗余前缀）
-- 生成日期：2026-03-20

UPDATE config_factions SET faction_bonuses = REPLACE(faction_bonuses, '"faction_politics_bonus"', '"politics_bonus"');
UPDATE config_factions SET faction_bonuses = REPLACE(faction_bonuses, '"faction_charm_bonus"', '"charm_bonus"');
UPDATE config_factions SET faction_bonuses = REPLACE(faction_bonuses, '"troop_max_troops_bonus"', '"max_troops_bonus"');
UPDATE config_factions SET faction_bonuses = REPLACE(faction_bonuses, '"troop_speed_bonus"', '"speed_bonus"');
UPDATE config_factions SET faction_bonuses = REPLACE(faction_bonuses, '"troop_epic_legendary_attack_bonus"', '"epic_legendary_attack_bonus"');
UPDATE config_factions SET faction_bonuses = REPLACE(faction_bonuses, '"troop_epic_legendary_defense_bonus"', '"epic_legendary_defense_bonus"');
UPDATE config_factions SET faction_bonuses = REPLACE(faction_bonuses, '"troop_common_rare_attack_bonus"', '"common_rare_attack_bonus"');
UPDATE config_factions SET faction_bonuses = REPLACE(faction_bonuses, '"faction_salary_resource_bonus"', '"salary_resource_bonus"');
UPDATE config_factions SET faction_bonuses = REPLACE(faction_bonuses, '"faction_salary_troop_card_bonus"', '"salary_troop_card_bonus"');

-- 验证结果
SELECT faction_id, faction_name, faction_bonuses FROM config_factions;
