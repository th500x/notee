-- 军营部队展示顺序改为与将领一致：仅 obtained_at + 前端按稀有度分组，移除持久化排序列
ALTER TABLE player_cards DROP COLUMN barracks_sort;
