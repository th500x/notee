/**
 * 全站 00 后端已并入 08-life-resume。
 * 本文件只启动 API（管理员口令 + 人生片段），不启动行情工人。
 * 工人在 08-life-resume/ecosystem.config.cjs 的 08-eth-ma-cross-worker。
 * 不要和 08 那份 ecosystem 同时再起一个同名 00-notee-backend。
 */
const path = require('path');
const life = require('./08-life-resume/ecosystem.config.cjs');
const api = life.apps.find((app) => app.name === '00-notee-backend');

if (!api) {
  throw new Error('08-life-resume/ecosystem.config.cjs 里缺少 00-notee-backend');
}

module.exports = {
  apps: [
    {
      ...api,
      cwd: path.join(__dirname, '08-life-resume'),
    },
  ],
};
