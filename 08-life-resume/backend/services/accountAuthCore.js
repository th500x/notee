/**
 * 人生片段账号认证核心（登录 / 注册 / 候选 ID / 改密）
 * 11 掌管 Notee 账号；读写本库 accounts。
 * 由调用方注入 accounts 所在库的 pool。
 */

const bcrypt = require('bcrypt');
const { validateNewAccountPassword } = require('../../shared/utils/accountPasswordRules.cjs');
const { validateBirthDate, toPublicBirthday } = require('../../shared/utils/lifeResumeBirthday.cjs');

/** 系统占位账号（游戏传书 sender_id 外键），禁止注册与登录 */
const SYSTEM_ACCOUNT_ID = 'sys1';

const BCRYPT_ROUNDS = 10;

function isDuplicateKeyError(err) {
  return err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062);
}

/** MySQL 唯一键冲突 → 用户可见文案（勿一律写成「ID 已被使用」） */
function registerDuplicateKeyMessage(err) {
  const msg = String(err?.sqlMessage || err?.message || '');
  if (/PRIMARY|'id'|`id`/i.test(msg)) {
    return '该游戏ID已被注册，请返回重新选择ID';
  }
  return '注册信息与他人账号冲突，请更换游戏ID或稍后再试';
}

/** 注册冷却小时数；0 = 关闭 machineId / clientIP 冷却检查 */
function parseRegisterCooldownHours() {
  const h = parseInt(process.env.REGISTER_MACHINE_COOLDOWN_HOURS ?? '720', 10);
  return Number.isFinite(h) && h > 0 ? h : 0;
}

function isPlaceholderRegisterIp(ip) {
  const s = String(ip || '').trim();
  return !s || s === '0.0.0.0' || s === 'unknown' || s === '::1' || s === '127.0.0.1';
}

/** 优先 body，其次 Express req.ip（trust proxy 已开）；均无效则 0.0.0.0 */
function resolveRegisterClientIP(bodyClientIP, requestIp) {
  const fromBody = bodyClientIP != null ? String(bodyClientIP).trim() : '';
  if (fromBody && !isPlaceholderRegisterIp(fromBody)) return fromBody;
  const fromReq = requestIp != null ? String(requestIp).trim().replace(/^::ffff:/i, '') : '';
  if (fromReq && !isPlaceholderRegisterIp(fromReq)) return fromReq;
  return '0.0.0.0';
}

/** 与前端 authUtils 一致：首位批次 0–9，后三位 A–Z / 0–9 */
const REGISTER_ID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomRegisterCandidateId() {
  const batch = Math.floor(Math.random() * 10);
  let s = String(batch);
  for (let i = 0; i < 3; i += 1) {
    s += REGISTER_ID_CHARSET[Math.floor(Math.random() * REGISTER_ID_CHARSET.length)];
  }
  return s;
}

/**
 * @param {{
 *   pool: import('mysql2/promise').Pool,
 *   signPlayerToken: (account: { id: string, role?: string }) => { token: string, expiresAt: number },
 *   requireServerId?: boolean,
 *   onPremiumLogin?: (accountId: string) => void,
 * }} deps
 */
function createAccountAuth(deps) {
  const pool = deps.pool;
  const signPlayerToken = deps.signPlayerToken;
  const requireServerId = deps.requireServerId !== false;
  const onPremiumLogin = typeof deps.onPremiumLogin === 'function' ? deps.onPremiumLogin : null;

  async function findAccountRegisteredWithinCooldown(field, value, cooldownHours) {
    if (!value || cooldownHours <= 0) return null;
    if (field === 'machineId' && value === 'unknown') return null;
    if (field === 'clientIP' && isPlaceholderRegisterIp(value)) return null;
    const col = field === 'machineId' ? 'machineId' : 'clientIP';
    const [rows] = await pool.query(
      `SELECT id FROM accounts WHERE ${col} = ? AND registeredAt > DATE_SUB(NOW(), INTERVAL ? HOUR) LIMIT 1`,
      [value, cooldownHours],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async function pickRegisterIdCandidates(opts = {}) {
    const want = Math.min(Math.max(parseInt(opts.count, 10) || 5, 1), 20);
    const exclude = new Set(
      [SYSTEM_ACCOUNT_ID, ...(opts.excludeIds || [])]
        .map((x) => String(x).trim())
        .filter(Boolean)
    );

    const picked = [];
    const seen = new Set();

    for (let round = 0; round < 8 && picked.length < want; round += 1) {
      const batchSize = Math.max(want * 4, 20);
      const batch = [];
      let inMemAttempts = 0;
      while (batch.length < batchSize && inMemAttempts < batchSize * 20) {
        inMemAttempts += 1;
        const id = randomRegisterCandidateId();
        if (exclude.has(id) || seen.has(id)) continue;
        batch.push(id);
        seen.add(id);
      }
      if (batch.length === 0) break;

      const placeholders = batch.map(() => '?').join(',');
      const [rows] = await pool.query(
        `SELECT id FROM accounts WHERE id IN (${placeholders})`,
        batch
      );
      const taken = new Set(rows.map((r) => String(r.id)));
      for (const id of batch) {
        if (!taken.has(id) && picked.length < want) picked.push(id);
      }
    }

    if (picked.length === 0) {
      return {
        ok: false,
        status: 503,
        error: '暂无法分配可用ID，请稍后重试',
      };
    }

    return {
      ok: true,
      ids: picked,
      partial: picked.length < want,
    };
  }

  async function register(body, opts = {}) {
    const {
      id,
      password,
      birthYear,
      birthMonth,
      birthDay,
      serverId,
      machineId,
      clientIP,
      province,
      city,
    } = body;

    if (!id || !password || (requireServerId && !serverId)) {
      return { ok: false, status: 400, error: '缺少必填字段' };
    }

    const birthCheck = validateBirthDate({ birthYear, birthMonth, birthDay });
    if (!birthCheck.ok) {
      return { ok: false, status: 400, error: birthCheck.error };
    }

    const resolvedMachineId = (machineId && String(machineId).trim()) || 'unknown';
    const resolvedClientIP = resolveRegisterClientIP(clientIP, opts.requestIp);
    const cooldownHours = parseRegisterCooldownHours();

    if (id === SYSTEM_ACCOUNT_ID) {
      return { ok: false, status: 400, error: '该ID不可注册' };
    }

    const [existingId] = await pool.query('SELECT id FROM accounts WHERE id = ?', [id]);
    if (existingId.length > 0) {
      return { ok: false, status: 400, error: '该游戏ID已被注册，请返回重新选择ID' };
    }

    if (await findAccountRegisteredWithinCooldown('machineId', resolvedMachineId, cooldownHours)) {
      return {
        ok: false,
        status: 429,
        error: '该设备在冷却期内已注册过账号，请使用已有账号登录或稍后再试',
      };
    }

    if (await findAccountRegisteredWithinCooldown('clientIP', resolvedClientIP, cooldownHours)) {
      return {
        ok: false,
        status: 429,
        error: '当前网络在冷却期内已注册过账号，请使用已有账号登录或稍后再试',
      };
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const resolvedServerId = serverId || null;
    const currentSeason = null;

    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      try {
        await connection.query(
          `
        INSERT INTO accounts (
          id, password, birthYear, birthMonth, birthDay, serverId,
          current_season, machineId, clientIP,
          province, city, account_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'real', 'active')
      `,
          [
            id,
            hashedPassword,
            birthCheck.birthYear,
            birthCheck.birthMonth,
            birthCheck.birthDay,
            resolvedServerId,
            currentSeason,
            resolvedMachineId,
            resolvedClientIP,
            province || null,
            city || null,
          ]
        );
      } catch (err) {
        await connection.rollback();
        connection.release();
        if (isDuplicateKeyError(err)) {
          return {
            ok: false,
            status: 409,
            error: registerDuplicateKeyMessage(err),
          };
        }
        throw err;
      }

      const [newAccount] = await connection.query('SELECT * FROM accounts WHERE id = ?', [id]);
      if (!newAccount.length) {
        await connection.rollback();
        connection.release();
        throw new Error('注册后读取账号失败');
      }

      await connection.commit();
      connection.release();

      const { password: _, ...accountData } = newAccount[0];
      const tokenInfo = signPlayerToken({ id: accountData.id, role: 'player' });
      return {
        ok: true,
        accountData: { ...accountData, token: tokenInfo.token, tokenExpiresAt: tokenInfo.expiresAt },
      };
    } catch (err) {
      try { await connection.rollback(); } catch (_) { /* ignore */ }
      connection.release();
      throw err;
    }
  }

  async function verifyExists(id) {
    if (id === SYSTEM_ACCOUNT_ID) {
      return { exists: false };
    }
    const [rows] = await pool.query('SELECT id, status FROM accounts WHERE id = ?', [id]);
    if (rows.length === 0) {
      return { exists: false };
    }
    return { exists: true, status: rows[0].status };
  }

  async function login(id, password) {
    if (!id || !password) {
      return { ok: false, status: 400, error: '请输入ID和密码' };
    }
    if (id === SYSTEM_ACCOUNT_ID) {
      return { ok: false, status: 403, error: '该账号无法登录' };
    }

    const [accounts] = await pool.query('SELECT * FROM accounts WHERE id = ?', [id]);
    if (accounts.length === 0) {
      return { ok: false, status: 401, error: 'ID或密码错误' };
    }

    const account = accounts[0];
    if (account.account_type === 'ai') {
      return { ok: false, status: 403, error: '该账号无法登录' };
    }
    if (account.status === 'banned') {
      return {
        ok: false,
        status: 403,
        error: '账号已被封禁',
        banReason: account.banReason,
        banUntil: account.banUntil,
      };
    }

    const passwordMatch = await bcrypt.compare(password, account.password);
    if (!passwordMatch) {
      return { ok: false, status: 401, error: 'ID或密码错误' };
    }

    await pool.query(
      `
    UPDATE accounts
    SET
      lastLoginAt = NOW(),
      lastActiveAt = NOW(),
      loginCount = loginCount + 1,
      status = 'active'
    WHERE id = ?
  `,
      [id]
    );

    const { password: _, ...accountData } = account;
    const tokenInfo = signPlayerToken({ id: accountData.id, role: 'player' });
    if (account.hasPremium && onPremiumLogin) {
      onPremiumLogin(accountData.id);
    }
    return {
      ok: true,
      accountData: { ...accountData, token: tokenInfo.token, tokenExpiresAt: tokenInfo.expiresAt },
    };
  }

  async function changePassword(accountId, body) {
    const id = String(accountId || '').trim();
    if (!id) {
      return { ok: false, status: 400, error: '缺少账号 ID' };
    }
    if (id === SYSTEM_ACCOUNT_ID) {
      return { ok: false, status: 400, error: '该账号不可修改密码' };
    }

    const validation = validateNewAccountPassword(body?.password, body?.confirmPassword);
    if (!validation.ok) {
      return { ok: false, status: 400, error: validation.error };
    }

    const [rows] = await pool.query('SELECT id, status FROM accounts WHERE id = ?', [id]);
    if (!rows.length) {
      return { ok: false, status: 404, error: '账号不存在' };
    }
    if (rows[0].status !== 'active') {
      return { ok: false, status: 403, error: '账号已封禁，无法修改密码' };
    }

    const hashedPassword = await bcrypt.hash(String(body.password), BCRYPT_ROUNDS);
    await pool.query('UPDATE accounts SET password = ? WHERE id = ?', [hashedPassword, id]);
    return { ok: true };
  }

  async function getPublicBirthday(accountId) {
    const id = String(accountId || '').trim();
    if (!id) {
      return { ok: false, status: 400, error: '缺少账号 ID' };
    }
    const [rows] = await pool.query(
      'SELECT birthYear, birthMonth, birthDay, birthdayChangedAt FROM accounts WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      return { ok: false, status: 404, error: '账号不存在' };
    }
    return { ok: true, data: toPublicBirthday(rows[0]) };
  }

  async function changeBirthday(accountId, body) {
    const id = String(accountId || '').trim();
    if (!id) {
      return { ok: false, status: 400, error: '缺少账号 ID' };
    }
    if (id === SYSTEM_ACCOUNT_ID) {
      return { ok: false, status: 400, error: '该账号不可修改生日' };
    }

    const birthCheck = validateBirthDate(body || {});
    if (!birthCheck.ok) {
      return { ok: false, status: 400, error: birthCheck.error };
    }

    const [rows] = await pool.query(
      'SELECT id, status, birthdayChangedAt FROM accounts WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      return { ok: false, status: 404, error: '账号不存在' };
    }
    if (rows[0].status !== 'active') {
      return { ok: false, status: 403, error: '账号已封禁，无法修改生日' };
    }
    if (rows[0].birthdayChangedAt) {
      return {
        ok: false,
        status: 403,
        error: '生日仅可改正一次',
        code: 'BIRTHDAY_LOCKED',
      };
    }

    await pool.query(
      'UPDATE accounts SET birthYear = ?, birthMonth = ?, birthDay = ?, birthdayChangedAt = NOW() WHERE id = ?',
      [birthCheck.birthYear, birthCheck.birthMonth, birthCheck.birthDay, id]
    );

    const [updated] = await pool.query(
      'SELECT birthYear, birthMonth, birthDay, birthdayChangedAt FROM accounts WHERE id = ?',
      [id]
    );
    return { ok: true, data: toPublicBirthday(updated[0]) };
  }

  return {
    pickRegisterIdCandidates,
    register,
    verifyExists,
    login,
    changePassword,
    getPublicBirthday,
    changeBirthday,
  };
}

module.exports = {
  SYSTEM_ACCOUNT_ID,
  createAccountAuth,
};
