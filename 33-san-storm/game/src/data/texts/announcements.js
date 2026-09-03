/**
 * 游戏公告（前端入口）
 *
 * 数据单源：`shared/config/announcements.json`（与后端 activityRankingEvents 共用）。
 * 改公告 / 活动 ranking.endTime / scoreWeights 时只编辑该 JSON，重启后端即可。
 */

import doc from '@shared/config/announcements.json';

const announcements = doc.announcements || [];

export function getLatestAnnouncement() {
  return announcements.length > 0 ? announcements[0] : null;
}

export function getAllAnnouncements() {
  return announcements;
}

export default announcements;
