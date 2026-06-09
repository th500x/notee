/**
 * 服务器维护态门禁（关服窗口拦登录/进游戏）
 *
 * 当玩家所属服务器 `config_servers.status` 为 `maintenance` / `closed` 时，
 * 该玩家的所有 `/:playerId/*` 请求一律 503 `MAINTENANCE_MODE`（含 GET），
 * 前端据此显示「服务器维护中」屏。用于关服切换窗口（如 13:30–14:00）真正阻止进游戏。
 *
 * 运营把 status 设回 `open` 后立即放行。挂在玩家聚合路由、`seasonSettlementGate` 之前。
 *
 * @module middleware/serverMaintenanceGate
 */
const { pool } = require('../database/connection');

function serverMaintenanceGate() {
  return async function (req, res, next) {
    const playerId = req.params.playerId;
    if (!playerId) return next();
    try {
      const [rows] = await pool.query(
        `SELECT s.status AS st
         FROM accounts a JOIN config_servers s ON s.server_id = a.serverId
         WHERE a.id = ? LIMIT 1`,
        [playerId]
      );
      const st = rows.length ? String(rows[0].st || '').toLowerCase() : null;
      if (st === 'maintenance' || st === 'closed') {
        return res.status(503).json({
          success: false,
          code: 'MAINTENANCE_MODE',
          error: '服务器维护中，请稍后再试。',
        });
      }
      return next();
    } catch (e) {
      // 门禁查询异常不应整服锁死：记录后放行（与其它轻量门禁一致）
      console.error('[serverMaintenanceGate] 状态查询失败，放行：', e.message);
      return next();
    }
  };
}

module.exports = { serverMaintenanceGate };
