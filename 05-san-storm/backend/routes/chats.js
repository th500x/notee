/**
 * 聊天 API
 * POST /api/chats  发送
 * GET  /api/chats  列表
 */

const express = require('express');
const chatService = require('../services/chatService');
const { requireAuth } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');

const router = express.Router();

/**
 * 鉴权：聊天全部端点（meta / 历史 / 发送 / 军团信息）依赖 query/body.playerId 鉴定本人；
 * 顶层挂 `requireAuth` 关闭匿名访问，细粒度 `requireSelf` 留下一阶段。
 */
router.use(requireAuth);

/**
 * GET /api/chats/meta?playerId=&channelType=&channelId=
 * 当前频道最大 chat_id（轻量轮询，无列表负载）
 */
router.get('/meta', async (req, res, next) => {
  try {
    const { playerId, channelType, channelId } = req.query;
    if (!playerId) {
      return res.status(400).json({ success: false, error: '缺少 playerId' });
    }
    if (!channelType) {
      return res.status(400).json({ success: false, error: '缺少 channelType' });
    }
    const result = await chatService.getChannelMeta(playerId, {
      channelType,
      channelId: channelId || null,
    });
    if (!result.ok) {
      return res.status(403).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: { maxChatId: result.maxChatId } });
  } catch (err) {
    return next(wrap500(err, '查询失败'));
  }
});

/**
 * GET /api/chats/legion-info?playerId=
 * 当前角色所属军团（用于前端军团频道）
 */
router.get('/legion-info', async (req, res, next) => {
  try {
    const { playerId } = req.query;
    if (!playerId) {
      return res.status(400).json({ success: false, error: '缺少 playerId' });
    }
    const data = await chatService.getLegionForPlayer(playerId);
    res.json({ success: true, data });
  } catch (err) {
    return next(wrap500(err, '查询失败'));
  }
});

/**
 * POST /api/chats
 * body: { playerId, channelType, channelId?, content }
 */
router.post('/', async (req, res, next) => {
  try {
    const { playerId, channelType, channelId, content } = req.body || {};
    if (!playerId) {
      return res.status(400).json({ success: false, error: '缺少 playerId' });
    }
    const result = await chatService.sendMessage(playerId, { channelType, channelId, content });
    if (!result.ok) {
      const status =
        result.code === 'POSITION' || result.code === 'FACTION' || result.code === 'LEGION'
          ? 403
          : result.code === 'COOLDOWN' || result.code === 'DAILY'
            ? 429
            : 400;
      return res.status(status).json({ success: false, error: result.error, code: result.code });
    }
    res.json({ success: true, data: result.message });
  } catch (err) {
    return next(wrap500(err, '发送失败'));
  }
});

/**
 * GET /api/chats?playerId=&channelType=&channelId=&limit=
 */
router.get('/', async (req, res, next) => {
  try {
    const { playerId, channelType, channelId, limit } = req.query;
    if (!playerId) {
      return res.status(400).json({ success: false, error: '缺少 playerId' });
    }
    if (!channelType) {
      return res.status(400).json({ success: false, error: '缺少 channelType' });
    }
    const result = await chatService.listMessages(playerId, {
      channelType,
      channelId: channelId || null,
      limit,
    });
    if (!result.ok) {
      return res.status(403).json({ success: false, error: result.error });
    }
    res.json({
      success: true,
      data: {
        messages: result.messages,
        channelLabel: result.channelLabel,
      },
    });
  } catch (err) {
    return next(wrap500(err, '查询失败'));
  }
});

module.exports = router;
