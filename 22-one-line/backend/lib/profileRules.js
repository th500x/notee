/**
 * Profile validation aligned with Notee Go Bar:
 * BarNickName / NationalFlags / Gender / Avatars.
 * No silent defaults — invalid or mismatched input is rejected.
 */

const NICK_MAX = 10;

const FLAG_IDS = new Set([
  'private',
  'th',
  'my',
  'cn',
  'in',
  'ru',
  'kr',
  'jp',
  'gb',
  'us',
  'tw',
  'sg',
  'de',
  'la',
  'fr',
  'au',
  'id',
  'ph',
  'mm',
  'vn',
  'hk',
  'il',
]);

const GENDERS = new Set(['male', 'female']);

const AVATARS_BY_GENDER = {
  male: new Set(['m01', 'm02', 'm03', 'm04', 'm05', 'm06']),
  female: new Set(['f01', 'f02', 'f03', 'f04', 'f05', 'f06']),
};

function normalizeNickName(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'string') {
    const err = new Error('nickName 无效');
    err.status = 400;
    err.code = 'BAD_NICK';
    throw err;
  }
  const nick = raw
    .split('')
    .filter((ch) => ch >= 'A' && ch <= 'Z' || ch >= 'a' && ch <= 'z')
    .join('')
    .toUpperCase()
    .slice(0, NICK_MAX);
  if (nick.length < 1 || nick.length > NICK_MAX || !/^[A-Z]+$/.test(nick)) {
    const err = new Error('昵称须为 1–10 位英文字母');
    err.status = 400;
    err.code = 'BAD_NICK';
    throw err;
  }
  return nick;
}

function assertFlagId(flagId) {
  if (typeof flagId !== 'string' || !FLAG_IDS.has(flagId)) {
    const err = new Error('国旗无效');
    err.status = 400;
    err.code = 'BAD_FLAG';
    throw err;
  }
  return flagId;
}

function assertGender(gender) {
  if (typeof gender !== 'string' || !GENDERS.has(gender)) {
    const err = new Error('性别无效');
    err.status = 400;
    err.code = 'BAD_GENDER';
    throw err;
  }
  return gender;
}

function assertAvatarForGender(avatarId, gender) {
  const set = AVATARS_BY_GENDER[gender];
  if (!set || typeof avatarId !== 'string' || !set.has(avatarId)) {
    const err = new Error('Avatar 与性别不匹配');
    err.status = 400;
    err.code = 'BAD_AVATAR';
    throw err;
  }
  return avatarId;
}

/**
 * Merge PATCH body onto current row fields (DB snake_case in / out camel for API layer).
 * @returns {{ nick_name?, flag_id?, gender?, avatar_id? }}
 */
function mergeProfilePatch(current, body) {
  const next = {
    nick_name: current.nick_name,
    flag_id: current.flag_id,
    gender: current.gender,
    avatar_id: current.avatar_id,
  };

  if (body.nickName !== undefined) {
    next.nick_name = normalizeNickName(body.nickName);
  }
  if (body.flagId !== undefined) {
    next.flag_id = assertFlagId(body.flagId);
  }
  if (body.gender !== undefined) {
    next.gender = assertGender(body.gender);
  }
  if (body.avatarId !== undefined) {
    if (!next.gender && body.gender === undefined && !current.gender) {
      const err = new Error('设置 Avatar 前须指定 gender');
      err.status = 400;
      err.code = 'GENDER_REQUIRED';
      throw err;
    }
    const gender = body.gender !== undefined ? assertGender(body.gender) : next.gender;
    next.avatar_id = assertAvatarForGender(body.avatarId, gender);
  } else if (body.gender !== undefined && next.avatar_id) {
    const set = AVATARS_BY_GENDER[next.gender];
    if (!set.has(next.avatar_id)) {
      const err = new Error('更换性别时请同时提交匹配的 avatarId');
      err.status = 400;
      err.code = 'AVATAR_GENDER_MISMATCH';
      throw err;
    }
  }

  return next;
}

module.exports = {
  NICK_MAX,
  FLAG_IDS,
  GENDERS,
  AVATARS_BY_GENDER,
  normalizeNickName,
  assertFlagId,
  assertGender,
  assertAvatarForGender,
  mergeProfilePatch,
};
