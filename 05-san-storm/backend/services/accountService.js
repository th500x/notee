/**
 * 账号域业务逻辑（accounts 表及关联运维操作）
 * 由 routes/auth.js 调用，避免路由文件堆积 SQL 与事务。
 */

const bcrypt = require('bcrypt');
const { pool } = require('../database/connection');
const { signPlayerToken } = require('../middleware/auth');

/** 系统占位账号（传书 sender_id 外键），禁止注册与登录 */
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

/**
 * 冷却窗内是否已有同 machineId / clientIP 的注册（仅查仍存在的账号行；删号即释放）。
 * @param {'machineId'|'clientIP'} field
 */
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
 * 随机抽取当前未被 accounts 占用的游戏 ID（服务端权威，排除「已注册」）。
 *
 * 实现：每轮在内存生成一批候选（去重、排除参数），用单条 `IN (?)` 一次性查 DB 哪些已占用，
 * 剩余即可用；最多 8 轮即可拿到目标数量。DB 调用从原 ~2500 次串行降至 ≤8 次。
 *
 * @param {{ count?: number, excludeIds?: string[] }} opts
 * @returns {Promise<{ ok: true, ids: string[], partial: boolean } | { ok: false, status: number, error: string }>}
 */
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

/**
 * 注册账号
 * @param {object} body
 * @param {{ requestIp?: string }} [opts] Express req.ip（Nginx 反代 + trust proxy）
 * @returns {{ ok: true, accountData: object } | { ok: false, status: number, error: string, message?: string }}
 */
async function register(body, opts = {}) {
  const {
    id,
    password,
    birthMonth,
    serverId,
    machineId,
    clientIP,
    province,
    city,
  } = body;

  if (!id || !password || birthMonth == null || !serverId) {
    return { ok: false, status: 400, error: '缺少必填字段' };
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

  const [serverConfig] = await pool.query(
    'SELECT current_season FROM config_servers WHERE server_id = ?',
    [serverId]
  );
  const currentSeason =
    serverConfig.length > 0 ? serverConfig[0].current_season : 'san_0_m1/san_1';

  /**
   * 事务包裹 accounts INSERT（注册与创角分两步；players 初始化见 PlayerService.createCharacter）。
   */
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    try {
      await connection.query(
        `
        INSERT INTO accounts (
          id, password, birthMonth, serverId,
          current_season, machineId, clientIP,
          province, city, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `,
        [
          id,
          hashedPassword,
          birthMonth,
          serverId,
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

/**
 * 验证账号是否存在（不含密码）
 */
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

/**
 * 登录：校验密码并更新登录信息
 */
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
  return {
    ok: true,
    accountData: { ...accountData, token: tokenInfo.token, tokenExpiresAt: tokenInfo.expiresAt },
  };
}

async function listAccountsWithServerName() {
  const [accounts] = await pool.query(`
    SELECT
      a.id, a.birthMonth, a.serverId, a.current_season,
      a.machineId, a.clientIP, a.province, a.city,
      a.status, a.banReason, a.banUntil,
      a.registeredAt, a.lastLoginAt, a.lastActiveAt, a.loginCount,
      p.last_active_at AS playerLastActiveAt,
      COALESCE(s.server_name, a.serverId) as serverName
    FROM accounts a
    LEFT JOIN config_servers s ON a.serverId = s.server_id
    LEFT JOIN players p ON p.player_id = a.id
    ORDER BY a.registeredAt DESC
  `);
  return accounts;
}

/**
 * 批量封禁「游戏内最后活跃」已超过若干天的账号（仅 status=active，排除 sys1）。
 * 判定与 playerActivity 一致：取 max(账号 lastActiveAt, 玩家 last_active_at)，
 * 缺失时用 registeredAt 兜底；二者均早于 cutoff 则封禁。
 * @param {number} [inactiveDays=14]
 * @param {string} [reason]
 * @returns {Promise<{ bannedCount: number, userIds: string[] }>}
 */
async function banAccountsInactiveLongerThan(inactiveDays = 14, reason) {
  const days = Math.min(Math.max(parseInt(inactiveDays, 10) || 14, 1), 365);
  const banReason = reason || '长期未活跃（一键标记）';

  const [targets] = await pool.query(
    `
    SELECT a.id
    FROM accounts a
    LEFT JOIN players p ON p.player_id = a.id
    WHERE a.status = 'active'
      AND a.id != ?
      AND GREATEST(
        COALESCE(a.lastActiveAt, a.registeredAt),
        COALESCE(p.last_active_at, a.registeredAt)
      ) < DATE_SUB(NOW(), INTERVAL ? DAY)
    `,
    [SYSTEM_ACCOUNT_ID, days]
  );

  if (targets.length === 0) {
    return { bannedCount: 0, userIds: [] };
  }

  const ids = targets.map((r) => r.id);
  const ph = ids.map(() => '?').join(',');
  await pool.query(
    `UPDATE accounts SET status = 'banned', banReason = ?, banUntil = NULL WHERE id IN (${ph})`,
    [banReason, ...ids]
  );

  return { bannedCount: ids.length, userIds: ids };
}

async function banUser(userId, reason, durationDays) {
  let banUntil = null;
  if (durationDays && durationDays > 0) {
    banUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  }
  await pool.query(
    `
    UPDATE accounts
    SET status = 'banned', banReason = ?, banUntil = ?
    WHERE id = ?
  `,
    [reason || '违反用户协议', banUntil, userId]
  );
}

async function unbanUser(userId) {
  await pool.query(
    `
    UPDATE accounts
    SET status = 'active', banReason = NULL, banUntil = NULL
    WHERE id = ?
  `,
    [userId]
  );
}

/**
 * 清除某账号玩家级数据（保留账号）
 */
async function clearPlayerGameData(userId) {
  const [users] = await pool.query('SELECT id FROM accounts WHERE id = ?', [userId]);
  if (users.length === 0) {
    return { ok: false, status: 404, error: '用户不存在' };
  }

  const playerTables = [
    'player_cards',
    'player_events',
    'player_garrison',
    'player_progress',
    'player_synthesis',
    'player_statistics',
    'season_records',
    'temp_character_creation',
    'players',
  ];

  const deletedCounts = {};
  for (const table of playerTables) {
    try {
      const [result] = await pool.query(`DELETE FROM ${table} WHERE player_id = ?`, [userId]);
      deletedCounts[table] = result.affectedRows;
    } catch (err) {
      deletedCounts[table] = 0;
    }
  }

  const worldTables = [
    { table: 'legion_members', column: 'player_id' },
    { table: 'battles', column: 'player_id' },
    { table: 'texts', column: 'sender_id' },
    { table: 'chats', column: 'sender_id' },
  ];

  const nullifiedCounts = {};
  for (const { table, column } of worldTables) {
    try {
      const [result] = await pool.query(
        `UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`,
        [userId]
      );
      nullifiedCounts[table] = result.affectedRows;
    } catch (err) {
      nullifiedCounts[table] = 0;
    }
  }

  return { ok: true, deletedCounts, nullifiedCounts };
}

/**
 * 删除账号。chats/texts → players 已为 ON DELETE CASCADE（见 migrations/alter-texts-chats-fk-on-delete-cascade.sql）；
 * 删 accounts 会级联删 players，再级联清理聊天与传书。
 * temp_character_ranking 无 FK，仍手动删。
 */
async function deleteAccount(userId) {
  const [users] = await pool.query('SELECT id FROM accounts WHERE id = ?', [userId]);
  if (users.length === 0) {
    return { ok: false, status: 404, error: '用户不存在' };
  }

  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    try {
      await connection.query('DELETE FROM temp_character_ranking WHERE player_id = ?', [
        userId,
      ]);
    } catch (e) {
      /* 表可能未创建 */
    }

    await connection.query('DELETE FROM accounts WHERE id = ?', [userId]);
    await connection.commit();
    connection.release();
    return { ok: true };
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {
      console.error('[accountService] deleteAccount rollback:', rbErr.message);
    }
    connection.release();
    console.error('[accountService] deleteAccount:', err.code, err.message);
    throw err;
  }
}

async function deleteAllBannedAccounts() {
  const [bannedUsers] = await pool.query('SELECT id FROM accounts WHERE status = ?', ['banned']);
  if (bannedUsers.length === 0) {
    return { ok: true, deletedCount: 0, message: '没有被封禁的账号' };
  }

  const bannedIds = bannedUsers.map((u) => u.id);

  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    try {
      await connection.query('DELETE FROM temp_character_ranking WHERE player_id IN (?)', [
        bannedIds,
      ]);
    } catch (e) {
      /* 表可能未创建 */
    }

    const [result] = await connection.query('DELETE FROM accounts WHERE status = ?', ['banned']);
    await connection.commit();
    connection.release();

    return {
      ok: true,
      deletedCount: result.affectedRows,
      message: `已删除 ${result.affectedRows} 个封禁账号`,
    };
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {
      console.error('[accountService] deleteAllBannedAccounts rollback:', rbErr.message);
    }
    connection.release();
    console.error('[accountService] deleteAllBannedAccounts:', err.code, err.message);
    throw err;
  }
}

async function purgeAllPlayerData() {
  const deletedCounts = {};
  const nullifiedCounts = {};

  const playerTables = [
    'player_cards',
    'player_events',
    'player_garrison',
    'player_progress',
    'player_synthesis',
    'player_statistics',
    'season_records',
    'temp_character_creation',
    'players',
  ];
  for (const table of playerTables) {
    try {
      const [result] = await pool.query(`DELETE FROM ${table}`);
      deletedCounts[table] = result.affectedRows;
    } catch (err) {
      deletedCounts[table] = 0;
    }
  }

  const worldTables = [
    { table: 'legion_members', column: 'player_id' },
    { table: 'battles', column: 'player_id' },
    { table: 'texts', column: 'sender_id' },
    { table: 'chats', column: 'sender_id' },
  ];
  for (const { table, column } of worldTables) {
    try {
      const [result] = await pool.query(
        `UPDATE ${table} SET ${column} = NULL WHERE ${column} IS NOT NULL`
      );
      nullifiedCounts[table] = result.affectedRows;
    } catch (err) {
      nullifiedCounts[table] = 0;
    }
  }

  return { deletedCounts, nullifiedCounts };
}

/**
 * 切换服务器（事务）
 */
async function switchServer(userId, newServerId) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const [users] = await connection.query('SELECT * FROM accounts WHERE id = ?', [userId]);
    if (users.length === 0) {
      await connection.rollback();
      connection.release();
      return { ok: false, status: 404, error: '用户不存在' };
    }

    const user = users[0];
    if (user.serverId === newServerId) {
      await connection.rollback();
      connection.release();
      return { ok: false, status: 400, error: '已在目标服务器' };
    }

    await connection.query(
      `
      UPDATE accounts
      SET serverId = ?
      WHERE id = ?
    `,
      [newServerId, userId]
    );

    await connection.query('DELETE FROM players WHERE player_id = ?', [userId]);

    await connection.commit();
    connection.release();

    return {
      ok: true,
      data: {
        userId,
        oldServerId: user.serverId,
        newServerId,
      },
    };
  } catch (err) {
    try {
      await connection.rollback();
    } catch (rbErr) {
      console.error('[accountService] switchServer rollback:', rbErr.message);
    }
    connection.release();
    throw err;
  }
}

module.exports = {
  SYSTEM_ACCOUNT_ID,
  pickRegisterIdCandidates,
  register,
  verifyExists,
  login,
  listAccountsWithServerName,
  banUser,
  unbanUser,
  banAccountsInactiveLongerThan,
  clearPlayerGameData,
  deleteAccount,
  deleteAllBannedAccounts,
  purgeAllPlayerData,
  switchServer,
};
