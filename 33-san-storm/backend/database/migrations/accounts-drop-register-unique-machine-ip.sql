-- 注册防刷改为「冷却窗内禁止、过期放行」；删号物理 DELETE 后立即释放 machineId/clientIP。
-- 去掉 lifetime UNIQUE，保留普通索引供冷却查询。

ALTER TABLE accounts DROP INDEX idx_machine_id;
ALTER TABLE accounts DROP INDEX idx_client_ip;
CREATE INDEX idx_accounts_machine_id ON accounts (machineId);
CREATE INDEX idx_accounts_client_ip ON accounts (clientIP);
