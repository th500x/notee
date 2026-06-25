/**
 * lifePath — 生成、预览、发布
 */

const { query } = require('../database/connection');
const { validateAccountIdFormat } = require('../../../05-san-storm/shared/utils/lifeResumeUsername.cjs');
const {
  validateLifePathDraft,
  parseLifePathDraftJson,
  renderPublishedLifePathText,
  resolvePublishedLifePathForPublic,
} = require('../../../05-san-storm/shared/utils/lifeResumeLifePath.cjs');
const { findProfileByAccountId, getProfileForAccount, ProfileServiceError } = require('./lifeProfileService');
const { listEntriesForOwner, EntryServiceError } = require('./lifeEntryService');
const { chatCompletionJson, isDashScopeConfigured } = require('./dashscopeClient');
const { SYSTEM_PROMPT, buildUserPrompt } = require('./lifePathPrompt');

const COOLDOWN_HOURS = parseInt(process.env.LIFE_PATH_COOLDOWN_HOURS || '24', 10);
const MAX_ENTRIES = parseInt(process.env.LIFE_PATH_MAX_ENTRIES || '80', 10);
const BODY_MAX_CHARS = parseInt(process.env.LIFE_PATH_BODY_MAX_CHARS || '400', 10);
const {
  LIFE_PATH_NODE_MIN,
  LIFE_PATH_NODE_MAX,
} = require('../../../05-san-storm/shared/utils/lifeResumeLifePath.cjs');

class LifePathServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'LifePathServiceError';
    this.code = code;
    this.status = status;
  }
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function assertActiveProfile(row) {
  if (!row || row.profile_status !== 'active') {
    throw new LifePathServiceError('PROFILE_DEACTIVATED', '账号处于注销冷静期', 403);
  }
}

function formatLifePathState(row) {
  return {
    lifePathStatus: row.life_path_status || 'none',
    lifePathDraft: parseLifePathDraftJson(row.life_path_draft_json),
    publishedLifePath: row.life_path_published_text || null,
    lifePathGeneratedAt: toIso(row.life_path_generated_at),
    lifePathPublishedAt: toIso(row.life_path_published_at),
    dashScopeConfigured: isDashScopeConfigured(),
  };
}

async function countPublicPublishedEntries(accountId) {
  const rows = await query(
    `SELECT COUNT(*) AS c FROM life_entries
     WHERE account_id = ? AND status = 'published' AND visibility = 'public'`,
    [accountId]
  );
  return Number(rows[0]?.c || 0);
}

function selectEntriesForAi(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length <= MAX_ENTRIES) return list;
  const head = list.slice(0, Math.ceil(MAX_ENTRIES / 2));
  const tail = list.slice(-Math.floor(MAX_ENTRIES / 2));
  const seen = new Set();
  const merged = [];
  for (const entry of [...head, ...tail]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }
  return merged.sort((a, b) => a.timelineSortKey - b.timelineSortKey || a.id - b.id);
}

function assessGenerateCooldown(generatedAt) {
  if (!generatedAt) return { ok: true };
  const last = new Date(generatedAt);
  if (Number.isNaN(last.getTime())) return { ok: true };
  const elapsedMs = Date.now() - last.getTime();
  const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
  if (elapsedMs >= cooldownMs) return { ok: true };
  const remainHours = Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000));
  return {
    ok: false,
    message: `生成轨迹冷却中，请约 ${remainHours} 小时后再试`,
  };
}

async function getLifePathForOwner(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new LifePathServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }
  const row = await findProfileByAccountId(id);
  if (!row) {
    throw new LifePathServiceError('PROFILE_NOT_FOUND', '资料不存在', 404);
  }
  assertActiveProfile(row);
  const entryCountRows = await query(
    'SELECT COUNT(*) AS c FROM life_entries WHERE account_id = ?',
    [id]
  );
  return {
    ...formatLifePathState(row),
    entryCount: Number(entryCountRows[0]?.c || 0),
  };
}

async function generateLifePathForOwner(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!validateAccountIdFormat(id)) {
    throw new LifePathServiceError('INVALID_ACCOUNT_ID', '账号 ID 格式无效', 400);
  }
  if (!isDashScopeConfigured()) {
    throw new LifePathServiceError('LIFE_PATH_NOT_CONFIGURED', '轨迹生成功能未开通', 503);
  }

  await getProfileForAccount(id);
  const row = await findProfileByAccountId(id);
  assertActiveProfile(row);

  const cooldown = assessGenerateCooldown(row.life_path_generated_at);
  if (!cooldown.ok) {
    throw new LifePathServiceError('LIFE_PATH_COOLDOWN', cooldown.message, 429);
  }

  let entries;
  try {
    entries = await listEntriesForOwner(id);
  } catch (err) {
    if (err instanceof EntryServiceError) {
      throw new LifePathServiceError(err.code, err.message, err.status);
    }
    throw err;
  }

  if (!entries.length) {
    throw new LifePathServiceError('LIFE_PATH_NO_ENTRIES', '还没有任何片段，无法生成轨迹', 400);
  }

  const aiEntries = selectEntriesForAi(entries);
  const baseUserPrompt = buildUserPrompt({
    username: row.username,
    entries: aiEntries,
    bodyMaxChars: BODY_MAX_CHARS,
  });

  let aiResult;
  let validated = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const userPrompt =
      attempt === 1
        ? baseUserPrompt
        : `${baseUserPrompt}\n\n【重试】上一轮 JSON 中 nodes[].text 过短或超长。每个 text 必须 ${LIFE_PATH_NODE_MIN}～${LIFE_PATH_NODE_MAX} 个可见字符，请重新输出完整 JSON。`;

    try {
      aiResult = await chatCompletionJson({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      });
    } catch (err) {
      if (err.code === 'LIFE_PATH_NOT_CONFIGURED') {
        throw new LifePathServiceError(err.code, err.message, 503);
      }
      throw new LifePathServiceError(
        err.code || 'LIFE_PATH_AI_FAILED',
        err.message || 'AI 生成失败',
        err.status || 502
      );
    }

    const draftPayload = {
      ...aiResult.parsed,
      sourceEntryIds: aiEntries.map((entry) => String(entry.id)),
      model: aiResult.model,
      generatedAt: new Date().toISOString(),
    };

    validated = validateLifePathDraft(draftPayload);
    if (validated.ok) break;
    if (attempt === 2) {
      throw new LifePathServiceError(validated.code, validated.error, 400);
    }
  }

  await query(
    `UPDATE life_profiles SET
      life_path_draft_json = ?,
      life_path_status = 'draft',
      life_path_generated_at = CURRENT_TIMESTAMP(3)
     WHERE account_id = ?`,
    [JSON.stringify(validated.draft), id]
  );

  const updated = await findProfileByAccountId(id);
  return formatLifePathState(updated);
}

async function publishLifePathForOwner(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  const row = await findProfileByAccountId(id);
  if (!row) {
    throw new LifePathServiceError('PROFILE_NOT_FOUND', '资料不存在', 404);
  }
  assertActiveProfile(row);

  const draft = parseLifePathDraftJson(row.life_path_draft_json);
  if (!draft) {
    throw new LifePathServiceError('LIFE_PATH_NOTHING_TO_PUBLISH', '没有可发布的轨迹草稿', 400);
  }

  const validated = validateLifePathDraft(draft);
  if (!validated.ok) {
    throw new LifePathServiceError(validated.code, validated.error, 400);
  }

  const publishedText = renderPublishedLifePathText(validated.draft);
  if (!publishedText) {
    throw new LifePathServiceError('LIFE_PATH_INVALID_DRAFT', '轨迹草稿格式无效', 400);
  }

  await query(
    `UPDATE life_profiles SET
      life_path_published_text = ?,
      life_path_status = 'published',
      life_path_published_at = CURRENT_TIMESTAMP(3)
     WHERE account_id = ?`,
    [publishedText, id]
  );

  const updated = await findProfileByAccountId(id);
  return formatLifePathState(updated);
}

async function discardLifePathDraftForOwner(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  const row = await findProfileByAccountId(id);
  if (!row) {
    throw new LifePathServiceError('PROFILE_NOT_FOUND', '资料不存在', 404);
  }
  assertActiveProfile(row);

  const nextStatus = row.life_path_published_text ? 'published' : 'none';
  await query(
    `UPDATE life_profiles SET
      life_path_draft_json = NULL,
      life_path_status = ?
     WHERE account_id = ?`,
    [nextStatus, id]
  );

  const updated = await findProfileByAccountId(id);
  return formatLifePathState(updated);
}

async function unpublishLifePathForOwner(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  const row = await findProfileByAccountId(id);
  if (!row) {
    throw new LifePathServiceError('PROFILE_NOT_FOUND', '资料不存在', 404);
  }
  assertActiveProfile(row);

  const nextStatus = row.life_path_draft_json ? 'draft' : 'none';
  await query(
    `UPDATE life_profiles SET
      life_path_published_text = NULL,
      life_path_published_at = NULL,
      life_path_status = ?
     WHERE account_id = ?`,
    [nextStatus, id]
  );

  const updated = await findProfileByAccountId(id);
  return formatLifePathState(updated);
}

async function getPublishedLifePathForPublicProfile(profileRow) {
  const publicCount = await countPublicPublishedEntries(profileRow.account_id);
  return resolvePublishedLifePathForPublic(profileRow, publicCount > 0);
}

module.exports = {
  LifePathServiceError,
  formatLifePathState,
  getLifePathForOwner,
  generateLifePathForOwner,
  publishLifePathForOwner,
  discardLifePathDraftForOwner,
  unpublishLifePathForOwner,
  getPublishedLifePathForPublicProfile,
  countPublicPublishedEntries,
  resolvePublishedLifePathForPublic,
};
