/**
 * Competitive round ingest. No database.
 *
 * Anonymous rows stay anonymous even when the request carries a token.
 * A leaderboard row is one the client marked with installId. The account id
 * is stamped here from the verified token, never read from the body.
 * login_id is not a key: rename keeps the account, and the old short id
 * can be registered by somebody else.
 */

const { httpError } = require('./httpError');

const GAME_IDS = new Set(['memory_flip', 'candy_spots', 'candy_hour']);
const ROLES = new Set(['host', 'player']);
const OUTCOMES = new Set(['reward', 'clear', 'fail']);
const PENALTIES = new Set(['Sip', 'Half', 'Full']);
const GENDERS = new Set(['male', 'female']);
const BATCH_MAX = 200;
const ELAPSED_MAX = 24 * 60 * 60 * 1000;
const RECORDED_MIN = Date.UTC(2024, 0, 1);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORBIDDEN = ['partyId', 'userId', 'loginId', 'user_id', 'login_id'];

function prepareRounds(rounds, userId, now = Date.now()) {
  if (!Array.isArray(rounds) || rounds.length < 1 || rounds.length > BATCH_MAX) {
    throw httpError(400, '无成绩', 'BAD_ROUNDS');
  }
  return rounds.map((row) => prepareOne(row, userId, now));
}

function prepareOne(row, userId, now) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw httpError(400, '成绩格式不对', 'BAD_ROUND');
  }
  for (const key of FORBIDDEN) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      throw httpError(400, '成绩不能自带身份键', 'BAD_ROUND_KEY');
    }
  }

  const gameId = requiredString(row.gameId, 'BAD_GAME');
  if (!GAME_IDS.has(gameId)) throw httpError(400, '这款游戏不上传成绩', 'BAD_GAME');

  const role = requiredString(row.role, 'BAD_ROLE');
  if (!ROLES.has(role)) throw httpError(400, '成绩角色不对', 'BAD_ROLE');

  const outcome = requiredString(row.outcome, 'BAD_OUTCOME');
  if (!OUTCOMES.has(outcome)) throw httpError(400, '成绩结果不对', 'BAD_OUTCOME');

  const attempts = requiredInt(row.attempts, 0, 100000, 'BAD_ATTEMPTS');
  const elapsedMs = requiredInt(row.elapsedMs, 0, ELAPSED_MAX, 'BAD_ELAPSED');
  const percentile = requiredInt(row.percentile, -1, 100, 'BAD_PERCENTILE');
  const playerCount = requiredInt(row.playerCount, 1, 4, 'BAD_PLAYER_COUNT');
  const recordedAt = requiredInt(row.recordedAt, RECORDED_MIN, now + ELAPSED_MAX, 'BAD_RECORDED_AT');

  const penalty = optionalString(row.penalty);
  if (penalty != null && !PENALTIES.has(penalty)) {
    throw httpError(400, '罚酒类型不对', 'BAD_PENALTY');
  }

  const genderId = requiredString(row.genderId, 'BAD_GENDER');
  if (!GENDERS.has(genderId)) throw httpError(400, '性别不对', 'BAD_GENDER');

  const flagId = optionalString(row.flagId);
  if (flagId != null && !/^[a-z]{2}$/.test(flagId)) {
    throw httpError(400, '国旗不对', 'BAD_FLAG');
  }

  const nickName = optionalString(row.nickName);
  const installId = optionalString(row.installId);
  if (nickName != null && !/^[A-Z]{1,10}$/.test(nickName)) {
    throw httpError(400, '昵称不对', 'BAD_NICK');
  }
  if (installId != null && !UUID_RE.test(installId)) {
    throw httpError(400, '设备标记不对', 'BAD_INSTALL_ID');
  }

  if (role === 'player' && (nickName != null || installId != null)) {
    throw httpError(400, '玩伴成绩不能带身份', 'GUEST_IDENTITY');
  }
  if (role === 'host' && nickName != null && installId == null) {
    throw httpError(400, '昵称只跟排行榜一起上传', 'RANKING_FIELDS');
  }

  const ranked = role === 'host' && installId != null;
  if (ranked && !userId) {
    throw httpError(401, '排行榜成绩需要登录', 'RANKING_AUTH_REQUIRED');
  }

  return {
    userId: ranked ? String(userId) : null,
    gameId,
    role,
    outcome,
    attempts,
    elapsedMs,
    percentile,
    penalty,
    playerCount,
    flagId,
    genderId,
    recordedAt,
    nickName: ranked ? nickName : null,
    installId: ranked ? installId.toLowerCase() : null,
  };
}

function requiredString(value, code) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw httpError(400, '成绩字段缺失', code);
  }
  return value.trim();
}

function optionalString(value) {
  if (value == null) return null;
  if (typeof value !== 'string') throw httpError(400, '成绩字段格式不对', 'BAD_ROUND');
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function requiredInt(value, min, max, code) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw httpError(400, '成绩数值超出范围', code);
  }
  return value;
}

module.exports = {
  GAME_IDS,
  BATCH_MAX,
  prepareRounds,
};
