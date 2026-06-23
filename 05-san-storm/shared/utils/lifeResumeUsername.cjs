/**
 * 11-life-resume 用户名规则（展示昵称）
 * 须与 lifeResumeUsername.js 同步
 */

const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

const ACCOUNT_ID_RE = /^[0-9][A-Z0-9]{3}$/;
const DIGIT_TO_LETTER = 'abcdefghij';
const HAN_ONLY_RE = /^[\p{Script=Han}]+$/u;
const ENGLISH_PLAIN_RE = /^[A-Za-z]{1,16}$/;
const ENGLISH_WITH_FLAG_RE = /^[A-Za-z]{1,14}[\u{1F1E6}-\u{1F1FF}]{2}$/u;

function encodeAccountIdChar(ch) {
  if (/^[0-9]$/.test(ch)) {
    return DIGIT_TO_LETTER[parseInt(ch, 10)];
  }
  return ch.toLowerCase();
}

function defaultUsernameFromAccountId(accountId) {
  const id = String(accountId || '').trim().toUpperCase();
  if (!ACCOUNT_ID_RE.test(id)) {
    throw new Error('invalid account id for default username');
  }
  const encoded = `u${id.split('').map(encodeAccountIdChar).join('')}`;
  return {
    username: encoded,
    usernameNormalized: encoded,
  };
}

function isDefaultUsernameForAccount(accountId, usernameNormalized) {
  const def = defaultUsernameFromAccountId(accountId);
  return def.usernameNormalized === String(usernameNormalized || '');
}

function validateUsername(raw) {
  const value = String(raw ?? '').trim();
  if (!value) {
    return { ok: false, error: '请输入用户名', code: 'INVALID_USERNAME' };
  }

  const hasHan = /\p{Script=Han}/u.test(value);
  const hasLatin = /[A-Za-z]/.test(value);

  if (hasHan && hasLatin) {
    return { ok: false, error: '用户名禁止中英混排', code: 'INVALID_USERNAME' };
  }

  if (hasHan) {
    if (value.length < 1 || value.length > 4) {
      return { ok: false, error: '中文用户名须为 1–4 个汉字', code: 'INVALID_USERNAME' };
    }
    if (!HAN_ONLY_RE.test(value)) {
      return { ok: false, error: '中文用户名须为 1–4 个汉字', code: 'INVALID_USERNAME' };
    }
    return { ok: true, username: value, usernameNormalized: value, kind: 'chinese' };
  }

  if (hasLatin) {
    if (ENGLISH_PLAIN_RE.test(value)) {
      return {
        ok: true,
        username: value,
        usernameNormalized: value.toLowerCase(),
        kind: 'english',
      };
    }

    if (ENGLISH_WITH_FLAG_RE.test(value)) {
      const flag = value.slice(-2);
      const letters = value.slice(0, -2);
      return {
        ok: true,
        username: value,
        usernameNormalized: letters.toLowerCase() + flag,
        kind: 'english',
      };
    }

    return {
      ok: false,
      error: '英文用户名须为 1–16 个字母，或在 1–14 个字母后加一个国旗 emoji（如 CHRIS🇹🇭）',
      code: 'INVALID_USERNAME',
    };
  }

  return {
    ok: false,
    error: '用户名只能为纯中文或纯英文，不能含数字、空格或符号',
    code: 'INVALID_USERNAME',
  };
}

function assessUsernameChangeCooldown(usernameChangedAt, now = new Date()) {
  if (!usernameChangedAt) {
    return { ok: true, availableAt: null, daysRemaining: 0 };
  }
  const changedAt = usernameChangedAt instanceof Date ? usernameChangedAt : new Date(usernameChangedAt);
  if (Number.isNaN(changedAt.getTime())) {
    return { ok: true, availableAt: null, daysRemaining: 0 };
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  const elapsedDays = (now.getTime() - changedAt.getTime()) / msPerDay;
  if (elapsedDays >= USERNAME_CHANGE_COOLDOWN_DAYS) {
    return { ok: true, availableAt: null, daysRemaining: 0 };
  }
  const daysRemaining = Math.ceil(USERNAME_CHANGE_COOLDOWN_DAYS - elapsedDays);
  const availableAt = new Date(changedAt.getTime() + USERNAME_CHANGE_COOLDOWN_DAYS * msPerDay);
  return { ok: false, availableAt, daysRemaining };
}

function validateAccountIdFormat(id) {
  const normalized = String(id || '')
    .trim()
    .toUpperCase();
  return ACCOUNT_ID_RE.test(normalized);
}

module.exports = {
  USERNAME_CHANGE_COOLDOWN_DAYS,
  defaultUsernameFromAccountId,
  isDefaultUsernameForAccount,
  validateUsername,
  assessUsernameChangeCooldown,
  validateAccountIdFormat,
};
