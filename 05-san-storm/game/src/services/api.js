/**
 * services/api.js — 兼容性 barrel（CR C4，2026-04-29 拆分）
 *
 * 历史上这个文件名为"统一 API 服务层"，实际承担：
 *   1. 主站 3001 管理员登录（`authAPI`）；
 *   2. 游戏账号注册 / 登录 / 管理员账号操作（`gameUserAPI`，最大块）；
 *   3. 服务器列表（`serversAPI`）；
 *   4. 排行榜（`rankingsAPI`）；
 *   5. 管理员传书模板（`adminConfigTextsAPI`）；
 *   6. 一个无人使用的通用 `get(url, options)`（已移除）。
 *
 * 与 `playerApi / chatApi / battleApi / textsApi / cardPoolApi / campaignApi / garrisonApi`
 * 等"按业务域命名"的兄弟 service 并列，**职责并不"统一"**——CR 已在第七阶段拆为五个
 * 独立文件（`authApi.js / gameUserApi.js / serversApi.js / rankingsApi.js /
 * adminConfigTextsApi.js`），每个只承担自身业务域。
 *
 * 本文件保留为 **barrel**，仅 re-export 五个命名导出，确保仓库内 14 处现有
 * `import { xxxAPI } from '@/services/api'` 一字不改照常工作。**新代码请直接 import
 * 对应的子文件**，便于后续完全收尾时一次性删除本 barrel。
 *
 * @module services/api
 */

export { authAPI } from './authApi';
export { gameUserAPI } from './gameUserApi';
export { serversAPI } from './serversApi';
export { rankingsAPI } from './rankingsApi';
export { adminConfigTextsAPI } from './adminConfigTextsApi';
