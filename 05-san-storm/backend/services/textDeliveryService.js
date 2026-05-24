/**
 * 传书写入（奖励型 / 系统型），供 AI 君主、管理端试发等复用
 */

const { pool } = require('../database/connection');

/**
 * @param {import('mysql2/promise').PoolConnection} [connection] 可选；不传则自建连接
 * @param {object} opts
 */
async function insertRewardText(opts, connection = null) {
  const receiverId = String(opts.receiverId || '').trim();
  const senderId = String(opts.senderId || 'sys1').trim();
  const senderName = String(opts.senderName || '系统').slice(0, 50);
  const senderPosition = opts.senderPosition != null ? String(opts.senderPosition).slice(0, 50) : null;
  const subject = String(opts.subject || '').slice(0, 100);
  const content = String(opts.content || '').slice(0, 1000);
  const mailType = opts.mailType === 'system' ? 'system' : 'reward';
  const expireHours = Number(opts.expireHours) || 24;

  if (!receiverId || !subject) {
    throw new Error('insertRewardText: 缺少 receiverId 或 subject');
  }

  let attachmentsJson = null;
  if (mailType === 'reward' && opts.attachments != null) {
    attachmentsJson = JSON.stringify(opts.attachments);
  }

  const textId = opts.textId
    || `text_${mailType}_kd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const sql = `INSERT INTO texts (
      text_id, type, sender_id, sender_name, sender_position,
      receiver_id, target_legion_id, subject, content, attachments,
      is_claimed, is_read, is_deleted, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, FALSE, FALSE, FALSE, DATE_ADD(NOW(), INTERVAL ? HOUR))`;
  const params = [
    textId,
    mailType,
    senderId,
    senderName,
    senderPosition,
    receiverId,
    subject,
    content,
    attachmentsJson,
    expireHours,
  ];

  if (connection) {
    await connection.query(sql, params);
  } else {
    await pool.query(sql, params);
  }

  return textId;
}

module.exports = {
  insertRewardText,
};
