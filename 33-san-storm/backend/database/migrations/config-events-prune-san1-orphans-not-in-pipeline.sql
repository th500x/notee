-- 数据整理：删除 config_events 中 season=san_1 但 **不在** 当前事件管线
-- （docs/tools/event/event-template.csv → event-csv-to-json.cjs → public/data/shared/events.json）中的「遗留行」。
-- 与 import-events-data.js 的 ON DUPLICATE 仅更新、不删多出的 id 相配合，生产/本地可各执行一次。
-- 执行前务必备份或先 SELECT 核对行数。

-- 预览将删行（可选）:
-- SELECT event_id, event_name FROM config_events
-- WHERE season = 'san_1' AND event_id NOT IN ( ... 同下述 IN 列表 ... );

DELETE FROM `config_events`
WHERE `season` = 'san_1'
  AND `event_id` NOT IN (
    'san_1_event_1001',
    'san_1_event_1002',
    'san_1_event_1003',
    'san_1_event_1004',
    'san_1_event_1005',
    'san_1_event_1006',
    'san_1_event_2001',
    'san_1_event_2002',
    'san_1_event_2003',
    'san_1_event_2004',
    'san_1_event_2005',
    'san_1_event_2006',
    'san_1_event_4001',
    'san_1_event_4002',
    'san_1_event_4003',
    'san_1_event_4004',
    'san_1_event_4005',
    'san_1_event_4006',
    'san_1_event_4007',
    'san_1_event_4008',
    'san_1_event_4009',
    'san_1_event_4010',
    'san_1_event_5001',
    'san_1_event_5002',
    'san_1_event_5003',
    'san_1_event_5004',
    'san_1_event_5005',
    'san_1_event_5006'
  );
