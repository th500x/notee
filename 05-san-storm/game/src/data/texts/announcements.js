/**
 * 游戏公告（前端入口）
 *
 * 数据单源：`shared/config/announcements.cjs`（与后端活动榜共用）。
 * 改公告 / 活动 ranking.endTime / scoreWeights 时只编辑该 cjs 文件，重启后端即可。
 */

export {
  default,
  getLatestAnnouncement,
  getAllAnnouncements,
} from '@shared/config/announcements.cjs';
