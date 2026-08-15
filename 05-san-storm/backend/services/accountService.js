/**
 * 账号域业务逻辑（accounts 表及关联运维操作）
 * 由 routes/auth.js 调用，避免路由文件堆积 SQL 与事务。
 */

const { pool } = require('../database/connection');
const { signPlayerToken } = require('../middleware/auth');
const { createAccountAuth, SYSTEM_ACCOUNT_ID } = require('./accountAuthCore');

const {
  pickRegisterIdCandidates,
  register,
  verifyExists,
  login,
  changePassword,
} = createAccountAuth({
  pool,
  signPlayerToken,
  requireServerId: true,
  onPremiumLogin: (accountId) => {
    const { reconcilePremiumOnLogin } = require('./seasonPremiumService');
    reconcilePremiumOnLogin(accountId).catch((err) => {
      console.warn('[accountService] premium reconcile on login failed', accountId, err?.message || err);
    });
  },
});

/**
 * 启动幂等：历史注册未写 account_type 的真人号补为 real（不动 sys1 / 已是 ai 的行）
 */
async function backfillMissingAccountTypeReal() {
  const [result] = await pool.query(
    `UPDATE accounts SET account_type = 'real'
     WHERE id <> ?
       AND (account_type IS NULL OR TRIM(account_type) = '')`,
    [SYSTEM_ACCOUNT_ID],
  );
  return Number(result.affectedRows) || 0;
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
    'player_lineup_sets',
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
    'player_lineup_sets',
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
  backfillMissingAccountTypeReal,
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
  changePassword,
};
