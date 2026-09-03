/**
 * 人生片段账号认证：读写本库 11_life_resume.accounts（11 掌管）。
 * 05/33 原表仅作历史，不再读写。
 */

const { createAccountAuth } = require('./accountAuthCore');
const { pool } = require('../database/connection');
const { signPlayerToken } = require('../middleware/auth');

const accountAuth = createAccountAuth({
  pool,
  signPlayerToken,
  requireServerId: false,
});

module.exports = accountAuth;
