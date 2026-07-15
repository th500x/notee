/**
 * PVP 战术对决 · 房间 HTTP 路由（17-5-DUEL_SYSTEM §12.9；17-5-2 步骤 6）
 *
 * 挂载：`server.js` → `app.use('/api/pvp/tactical-rooms', router)`。
 * 鉴权：全部接口要求合法 JWT；操作主体 = `req.player.sub`（admin 例外可代他人）。
 *
 * 端点（§12.9）：
 *   GET    /pending            待应战列表（被邀战方视角）
 *   POST   /                   创建邀战（opponentPlayerId, duelMapId?）
 *   POST   /:id/accept         应战 + 门闸 + 冻快照 → both_ready（并后台触发推演）
 *   POST   /:id/cancel         取消邀战（仅 invited）
 *   POST   /:id/start          双方 ready 后触发推演（幂等；accept 已自动触发）
 *   GET    /:id                房间元数据 + 视角信息（参与者）
 *   GET    /:id/events?afterSeq=N  增量事件（含 heartbeat 在线打点）
 *   GET    /:id/result         结算摘要 + 本方战报 id
 *
 * 错误：service 抛 `Error{ code, httpStatus }`；本层透传为 `{ success:false, error, code }`。
 * 详见 docs/00-base/02-architecture-split/13-pvp-tactical-api.md。
 *
 * @module backend/routes/pvp/tacticalRooms
 */

const express = require('express');
const router = express.Router();
const roomService = require('../../services/pvp/tactical/pvpTacticalRoomService');
const simRunner = require('../../services/pvp/tactical/pvpTacticalSimRunner');
const { requireAuth } = require('../../middleware/auth');
const { wrap500 } = require('../../utils/httpError');

router.use(requireAuth);

/** 当前操作主体 player_id（dev bypass 时可能为 null） */
function selfId(req) {
  return req.player && req.player.sub != null ? String(req.player.sub) : null;
}

function isAdmin(req) {
  return req.player && req.player.role === 'admin';
}

/** service 错误透传：4xx 直接回；5xx / 未知交给 errorHandler */
function sendServiceError(res, next, err, fallbackMsg) {
  const status = Number(err && err.httpStatus);
  if (Number.isFinite(status) && status >= 400 && status < 500) {
    return res.status(status).json({ success: false, error: err.message, code: err.code || 'ERROR' });
  }
  return next(wrap500(err, fallbackMsg));
}

/** 参与者鉴权：返回 room（404/403 时已 res 响应并返回 null） */
function authorizeParticipant(req, res, room) {
  if (!room) {
    res.status(404).json({ success: false, error: '房间不存在', code: 'ROOM_NOT_FOUND' });
    return false;
  }
  const me = selfId(req);
  if (isAdmin(req)) return true;
  if (me == null) {
    res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
    return false;
  }
  if (room.playerAId !== me && room.playerBId !== me) {
    res.status(403).json({ success: false, error: '非房间参与者', code: 'FORBIDDEN' });
    return false;
  }
  return true;
}

/** 视角信息（§12.4：己方→player，对手→enemy 的镜像由客户端完成；此处给出 side 归属） */
function buildView(room, me) {
  const selfSide = room.playerAId === me ? 'a' : room.playerBId === me ? 'b' : null;
  const opponentSide = selfSide === 'a' ? 'b' : selfSide === 'b' ? 'a' : null;
  const snaps = room.lineupSnapshots || null;
  return {
    selfSide,
    opponentSide,
    selfId: selfSide ? room[selfSide === 'a' ? 'playerAId' : 'playerBId'] : null,
    opponentId: opponentSide ? room[opponentSide === 'a' ? 'playerAId' : 'playerBId'] : null,
    selfLineup: snaps && selfSide ? snaps[selfSide] || null : null,
    opponentLineup: snaps && opponentSide ? snaps[opponentSide] || null : null,
  };
}

/** 本方战报 id（resolved 后） */
function selfBattleId(room, me) {
  if (room.playerAId === me) return room.battleIdA;
  if (room.playerBId === me) return room.battleIdB;
  return null;
}

/**
 * GET /api/pvp/tactical-rooms/pending
 * 待应战列表（被邀战方视角，invited 未过期）。须在 `/:id` 之前注册。
 */
router.get('/pending', async (req, res, next) => {
  try {
    const me = selfId(req);
    if (me == null) {
      return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
    }
    const rooms = await roomService.listPendingForPlayer(me);
    res.json({ success: true, rooms });
  } catch (error) {
    return sendServiceError(res, next, error, '获取待应战列表失败');
  }
});

/**
 * POST /api/pvp/tactical-rooms
 * body: { opponentPlayerId, duelMapId?, season?, inviteTtlSec? }
 */
router.post('/', async (req, res, next) => {
  try {
    const me = selfId(req);
    if (me == null) {
      return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
    }
    const { opponentPlayerId, duelMapId, season, inviteTtlSec } = req.body || {};
    if (!opponentPlayerId) {
      return res.status(400).json({ success: false, error: '缺少 opponentPlayerId', code: 'BAD_REQUEST' });
    }
    const room = await roomService.createRoom({
      inviterId: me,
      opponentId: String(opponentPlayerId),
      duelMapId: duelMapId ? String(duelMapId) : undefined,
      season: season != null ? String(season) : null,
      inviteTtlSec,
    });
    res.status(201).json({ success: true, room });
  } catch (error) {
    return sendServiceError(res, next, error, '创建对决邀战失败');
  }
});

/**
 * POST /api/pvp/tactical-rooms/:id/accept
 * 仅被邀战方；成功后后台触发推演（accept 后自动，§12.9）。
 */
router.post('/:id/accept', async (req, res, next) => {
  try {
    const me = selfId(req);
    if (me == null) {
      return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
    }
    const room = await roomService.acceptRoom({ roomId: req.params.id, playerId: me });
    // accept 即承诺出战：后台触发推演（幂等 + 自补偿；不阻塞响应）
    Promise.resolve(simRunner.startRoom({ roomId: room.roomId })).catch((e) => {
      console.error('[tacticalRooms] 后台推演触发失败', { roomId: room.roomId, message: e && e.message });
    });
    res.json({ success: true, room });
  } catch (error) {
    return sendServiceError(res, next, error, '应战失败');
  }
});

/**
 * POST /api/pvp/tactical-rooms/:id/cancel
 * body: { reason? }；仅参与者、仅 invited。
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const me = selfId(req);
    if (me == null) {
      return res.status(401).json({ success: false, error: '未登录或会话已失效', code: 'NO_TOKEN' });
    }
    const reason = req.body && req.body.reason ? String(req.body.reason) : 'withdraw';
    const room = await roomService.cancelRoom({ roomId: req.params.id, playerId: me, reason });
    res.json({ success: true, room });
  } catch (error) {
    return sendServiceError(res, next, error, '取消邀战失败');
  }
});

/**
 * POST /api/pvp/tactical-rooms/:id/start
 * 双方 ready 后触发推演；幂等（已 resolved 返回既有结果）。
 */
router.post('/:id/start', async (req, res, next) => {
  try {
    const room = await roomService.getRoom(req.params.id);
    if (!authorizeParticipant(req, res, room)) return;
    const result = await simRunner.startRoom({ roomId: req.params.id });
    res.json({ success: true, result });
  } catch (error) {
    return sendServiceError(res, next, error, '触发推演失败');
  }
});

/**
 * GET /api/pvp/tactical-rooms/:id/events?afterSeq=N
 * 增量事件 + heartbeat 在线打点（§12.6/§12.7）。
 */
router.get('/:id/events', async (req, res, next) => {
  try {
    const room = await roomService.getRoom(req.params.id);
    if (!authorizeParticipant(req, res, room)) return;
    const me = selfId(req);
    const afterSeq = Number(req.query.afterSeq) || 0;
    const events = await simRunner.getRoomEvents(req.params.id, afterSeq);
    if (me != null) {
      roomService.markEventPoll({ roomId: req.params.id, playerId: me }).catch(() => {});
    }
    res.json({
      success: true,
      status: room.status,
      eventSeq: room.eventSeq,
      winnerSide: room.winnerSide,
      winnerPlayerId: room.winnerPlayerId,
      viewerSide: me === room.playerAId ? 'a' : me === room.playerBId ? 'b' : null,
      events,
    });
  } catch (error) {
    return sendServiceError(res, next, error, '拉取对决事件失败');
  }
});

/**
 * GET /api/pvp/tactical-rooms/:id/result
 * 结算摘要 + 本方战报 id（未结算时 resolved=false）。
 */
router.get('/:id/result', async (req, res, next) => {
  try {
    const room = await roomService.getRoom(req.params.id);
    if (!authorizeParticipant(req, res, room)) return;
    const me = selfId(req);
    const resolved = room.status === roomService.STATUS.RESOLVED;
    res.json({
      success: true,
      resolved,
      status: room.status,
      winnerSide: room.winnerSide,
      winnerPlayerId: room.winnerPlayerId,
      viewerSide: me === room.playerAId ? 'a' : me === room.playerBId ? 'b' : null,
      battleId: selfBattleId(room, me),
      eventSeq: room.eventSeq,
    });
  } catch (error) {
    return sendServiceError(res, next, error, '获取对决结果失败');
  }
});

/**
 * GET /api/pvp/tactical-rooms/:id
 * 房间元数据 + 视角信息（参与者）。
 */
router.get('/:id', async (req, res, next) => {
  try {
    const room = await roomService.getRoom(req.params.id);
    if (!authorizeParticipant(req, res, room)) return;
    const me = selfId(req);
    res.json({ success: true, room, view: buildView(room, me) });
  } catch (error) {
    return sendServiceError(res, next, error, '获取房间失败');
  }
});

module.exports = router;
