/**
 * 11-life-resume 用户名规则（展示昵称）
 * 须与 lifeResumeUsername.cjs 同步
 */

export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

const ACCOUNT_ID_RE = /^[0-9][A-Z0-9]{3}$/;
const DIGIT_TO_LETTER = 'abcdefghij';
const HAN_ONLY_RE = /^[\p{Script=Han}]+$/u;
const LATIN_ONLY_RE = /^[A-Za-z]+$/;

function encodeAccountIdChar(ch) {
  if (/^[0-9]$/.test(ch)) {
    return DIGIT_TO_LETTER[parseInt(ch, 10)];
  }
  return ch.toLowerCase();
}

/**
 * 懒创建 profile 时的系统默认英文名（accountId 含数字，不能直接当昵称）
 * @param {string} accountId
 */
export function defaultUsernameFromAccountId(accountId) {
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

export function isDefaultUsernameForAccount(accountId, usernameNormalized) {
  const def = defaultUsernameFromAccountId(accountId);
  return def.usernameNormalized === String(usernameNormalized || '');
}

/**
 * @param {string} raw
 * @returns {{ ok: true, username: string, usernameNormalized: string, kind: 'chinese'|'english' } | { ok: false, error: string, code?: string }}
 */
export function validateUsername(raw) {
  const value = String(raw ?? '').trim();
  if (!value) {
    return { ok: false, error: '请输入用户名', code: 'INVALID_USERNAME' };
  }

  let hasHan = false;
  let hasLatin = false;
  for (const ch of value) {
    if (/\p{Script=Han}/u.test(ch)) {
      hasHan = true;
    } else if (/[A-Za-z]/.test(ch)) {
      hasLatin = true;
    } else {
      return {
        ok: false,
        error: '用户名只能为纯中文或纯英文，不能含数字、空格或符号',
        code: 'INVALID_USERNAME',
      };
    }
  }

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
    if (value.length < 1 || value.length > 16) {
      return { ok: false, error: '英文用户名须为 1–16 个字母', code: 'INVALID_USERNAME' };
    }
    if (!LATIN_ONLY_RE.test(value)) {
      return { ok: false, error: '英文用户名须为 1–16 个字母', code: 'INVALID_USERNAME' };
    }
    return {
      ok: true,
      username: value,
      usernameNormalized: value.toLowerCase(),
      kind: 'english',
    };
  }

  return { ok: false, error: '请输入用户名', code: 'INVALID_USERNAME' };
}

/**
 * @param {string|Date|null|undefined} usernameChangedAt
 * @param {Date} [now]
 */
export function assessUsernameChangeCooldown(usernameChangedAt, now = new Date()) {
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

export function validateAccountIdFormat(id) {
  const normalized = String(id || '')
    .trim()
    .toUpperCase();
  return ACCOUNT_ID_RE.test(normalized);
}
