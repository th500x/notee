/**
 * 传书模板 config_texts 与试发写入 texts
 */

const { pool } = require('../database/connection');

const SYS_SENDER_ID = 'sys1';

/** 单次试发最多写入传书条数（防误操作全服爆库） */
const TRIAL_MAX_RECEIVERS = 2000;

function normalizeAttachments(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      throw new Error('attachments_json 不是合法 JSON');
    }
  }
  return null;
}

function rowToApi(row) {
  if (!row) return null;
  let attachments_json = row.attachments_json;
  if (attachments_json != null && typeof attachments_json === 'string') {
    try {
      attachments_json = JSON.parse(attachments_json);
    } catch {
      /* keep string */
    }
  }
  return { ...row, attachments_json };
}

async function listTemplates({ season, enabledOnly } = {}) {
  let sql = 'SELECT * FROM config_texts WHERE 1=1';
  const params = [];
  if (season) {
    sql += ' AND (season IS NULL OR season = ?)';
    params.push(season);
  }
  if (enabledOnly) {
    sql += ' AND is_enabled = 1';
  }
  sql += ' ORDER BY sort_order ASC, template_id ASC';
  const [rows] = await pool.query(sql, params);
  return rows.map(rowToApi);
}

async function getTemplate(templateId) {
  const [rows] = await pool.query('SELECT * FROM config_texts WHERE template_id = ?', [templateId]);
  return rowToApi(rows[0] || null);
}

async function createTemplate(data) {
  const {
    template_id,
    mail_type,
    subject,
    body,
    attachments_json,
    season,
    is_enabled = 1,
    sort_order = 0,
    remark
  } = data;
  if (!template_id || !mail_type || subject == null || body == null) {
    throw new Error('缺少 template_id、mail_type、subject 或 body');
  }
  if (!['system', 'reward'].includes(mail_type)) {
    throw new Error('mail_type 须为 system 或 reward');
  }
  const att = normalizeAttachments(attachments_json);
  await pool.query(
    `INSERT INTO config_texts (
      template_id, mail_type, subject, body, attachments_json, season, is_enabled, sort_order, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      template_id,
      mail_type,
      subject,
      body,
      att != null ? JSON.stringify(att) : null,
      season || null,
      is_enabled ? 1 : 0,
      Number(sort_order) || 0,
      remark || null
    ]
  );
  return getTemplate(template_id);
}

async function updateTemplate(templateId, data) {
  const existing = await getTemplate(templateId);
  if (!existing) return null;
  const mail_type = data.mail_type != null ? data.mail_type : existing.mail_type;
  if (!['system', 'reward'].includes(mail_type)) {
    throw new Error('mail_type 须为 system 或 reward');
  }
  let att = existing.attachments_json;
  if (Object.prototype.hasOwnProperty.call(data, 'attachments_json')) {
    att = normalizeAttachments(data.attachments_json);
  }
  await pool.query(
    `UPDATE config_texts SET
      mail_type = ?,
      subject = ?,
      body = ?,
      attachments_json = ?,
      season = ?,
      is_enabled = ?,
      sort_order = ?,
      remark = ?
    WHERE template_id = ?`,
    [
      mail_type,
      data.subject != null ? data.subject : existing.subject,
      data.body != null ? data.body : existing.body,
      att != null ? JSON.stringify(att) : null,
      data.season !== undefined ? (data.season || null) : existing.season,
      data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : existing.is_enabled,
      data.sort_order !== undefined ? Number(data.sort_order) || 0 : existing.sort_order,
      data.remark !== undefined ? (data.remark || null) : existing.remark,
      templateId
    ]
  );
  return getTemplate(templateId);
}

async function deleteTemplate(templateId) {
  const [r] = await pool.query('DELETE FROM config_texts WHERE template_id = ?', [templateId]);
  return r.affectedRows > 0;
}

async function resolveTrialReceiverIds({ target_type, faction_id, receiver_id }) {
  let tt = target_type;
  if (!tt && receiver_id) tt = 'user';
  if (!tt) {
    throw new Error('请选择接收类型或填写用户 ID');
  }

  if (tt === 'user') {
    const rid = (receiver_id && String(receiver_id).trim()) || '';
    if (!rid) throw new Error('请填写用户 ID');
    const [[row]] = await pool.query('SELECT player_id FROM players WHERE player_id = ?', [rid]);
    if (!row) throw new Error('接收玩家不存在');
    return [rid];
  }

  if (tt === 'all') {
    const [rows] = await pool.query(
      "SELECT player_id FROM players WHERE player_id <> ? ORDER BY player_id",
      [SYS_SENDER_ID]
    );
    return rows.map((r) => r.player_id);
  }

  if (tt === 'faction') {
    const fid = faction_id && String(faction_id).trim();
    if (!fid) throw new Error('请选择势力');
    const [rows] = await pool.query(
      "SELECT player_id FROM players WHERE faction_id = ? AND player_id <> ? ORDER BY player_id",
      [fid, SYS_SENDER_ID]
    );
    return rows.map((r) => r.player_id);
  }

  throw new Error('无效的接收类型');
}

function buildTrialPayload(template, subjectOverride, contentOverride) {
  const subject = (subjectOverride != null && subjectOverride !== '')
    ? String(subjectOverride).slice(0, 100)
    : template.subject;
  const rawContent = contentOverride != null && contentOverride !== '' ? String(contentOverride) : template.body;
  const content = rawContent.slice(0, 1000);
  const mailType = template.mail_type;
  let attachments = template.attachments_json;
  if (attachments != null && typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments);
    } catch {
      attachments = null;
    }
  }
  if (mailType === 'system') {
    attachments = null;
  }
  return {
    subject,
    content,
    mailType,
    attachmentsJson: attachments != null ? JSON.stringify(attachments) : null
  };
}

async function insertTrialTextForReceiver(receiverId, senderName, payload) {
  const textId = `text_${payload.mailType}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await pool.query(
    `INSERT INTO texts (
      text_id, type, sender_id, sender_name, sender_position,
      receiver_id, target_legion_id, subject, content, attachments,
      is_claimed, is_read, is_deleted, expires_at
    ) VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, FALSE, FALSE, FALSE, DATE_ADD(NOW(), INTERVAL 14 DAY))`,
    [
      textId,
      payload.mailType,
      SYS_SENDER_ID,
      senderName,
      receiverId,
      payload.subject,
      payload.content,
      payload.attachmentsJson
    ]
  );
  return textId;
}

/**
 * 试发：target_type = all | faction | user（兼容仅传 receiver_id → user）
 */
async function trialSend(body = {}) {
  const template_id = body.template_id;
  if (!template_id) {
    throw new Error('缺少 template_id');
  }
  const template = await getTemplate(template_id);
  if (!template) {
    throw new Error('模板不存在');
  }

  const [[sysPlayer]] = await pool.query(
    'SELECT character_name FROM players WHERE player_id = ?',
    [SYS_SENDER_ID]
  );
  if (!sysPlayer) {
    throw new Error('系统占位账号 sys1 不存在，请先执行 seed-system-player-sys1.sql');
  }
  const senderName = sysPlayer.character_name || '系统';

  const receiverIds = await resolveTrialReceiverIds({
    target_type: body.target_type,
    faction_id: body.faction_id,
    receiver_id: body.receiver_id
  });

  if (receiverIds.length === 0) {
    throw new Error('没有符合条件的接收玩家');
  }
  if (receiverIds.length > TRIAL_MAX_RECEIVERS) {
    throw new Error(`接收人数超过上限 ${TRIAL_MAX_RECEIVERS}，请缩小范围`);
  }

  const payload = buildTrialPayload(template, body.subject, body.content);
  const textIds = [];
  for (const rid of receiverIds) {
    const tid = await insertTrialTextForReceiver(rid, senderName, payload);
    textIds.push(tid);
  }

  return {
    count: textIds.length,
    template_id,
    target_type: body.target_type || (body.receiver_id ? 'user' : undefined),
    sample_text_ids: textIds.slice(0, 5),
    first_text_id: textIds[0]
  };
}

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  trialSend
};
