-- config_titles：移除未实装的 display_name / display_position；展示统一用 title_name
-- 与 docs/tools/title-achievement/title-template.csv、25-1 对齐

ALTER TABLE config_titles DROP COLUMN display_name;
ALTER TABLE config_titles DROP COLUMN display_position;
