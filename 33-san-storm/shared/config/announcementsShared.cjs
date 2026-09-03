/**
 * 游戏公告 + 活动榜（Node 后端读 shared/config/announcements.json）
 * @see game/src/data/texts/announcements.js（前端同源 JSON）
 */
const path = require('path');

const doc = require('./announcements.json');

const announcements = doc.announcements || [];

function getLatestAnnouncement() {
  return announcements.length > 0 ? announcements[0] : null;
}

function getAllAnnouncements() {
  return announcements;
}

/** @param {string} eventId */
function findAnnouncementById(eventId) {
  return announcements.find((a) => a.id === eventId) || null;
}

module.exports = {
  announcements,
  getLatestAnnouncement,
  getAllAnnouncements,
  findAnnouncementById,
};
