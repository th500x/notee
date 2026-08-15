/**
 * 人生片段账号认证：复用 05 accountAuthCore，读写 05_san_storm.accounts。
 * 不启动 05 进程；JWT 用 11 自己的 JWT_SECRET（须与 05 相同）。
 */

const { createAccountAuth } = require('../../../05-san-storm/backend/services/accountAuthCore');
const { accountsPool } = require('../database/sanStormAccountsConnection');
const { signPlayerToken } = require('../middleware/auth');

const accountAuth = createAccountAuth({
  pool: accountsPool,
  signPlayerToken,
  requireServerId: false,
});

module.exports = accountAuth;
