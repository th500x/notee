-- trigger_probability：NULL = 与同 location 池内事件均等随机；1 = 必出桶（见 configService.formatTriggerProbability、game eventUtils.pickRandomEvent）
ALTER TABLE config_events
  MODIFY COLUMN trigger_probability DECIMAL(4,2) NULL DEFAULT NULL;
