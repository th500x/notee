/**
 * 不要在本目录启动旧留言板进程。
 * 全站 00 与仓库根 ecosystem.config.cjs 是同一个应用，二选一。
 */
const path = require('path');
const life = require('../08-life-resume/ecosystem.config.cjs');
const api = life.apps.find((app) => app.name === '00-notee-backend');

module.exports = {
  apps: [
    {
      ...api,
      cwd: path.join(__dirname, '../08-life-resume'),
    },
  ],
};
