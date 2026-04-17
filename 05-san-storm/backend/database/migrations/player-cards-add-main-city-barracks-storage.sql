-- 主城驻军所仓库：部队卡从编组/驻地「军营」池移入后标记为 1，不计入军营 20 张上限统计
ALTER TABLE player_cards
  ADD COLUMN main_city_barracks_storage TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1=存于主城驻军所仓库，不参与编组/驻地军营展示池'
  AFTER last_troops_lost_at;
