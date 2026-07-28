-- 废止城级荒郊/集市探索开关（入口改战场双面板；导入与 API 不再读写）

ALTER TABLE cities
  DROP COLUMN wilderness_enabled,
  DROP COLUMN market_enabled;
