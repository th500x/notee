/**
 * 聊天 API
 * POST /api/chats  发送
 * GET  /api/chats  列表
 */

const express = require('express');
const chatService = require('../services/chatService');
const { requireAuth } = require('../middleware/auth');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateQuery } = require('../middleware/validation');
const chatSchemas = require('../middleware/validationSchemas/chats');

const router = express.Router();

router.use(requireAuth);

router.get('/meta', validateQuery(chatSchemas.channelQueryBase), async (req, res, next) => {
  try {
    const { playerId, channelType, channelId } = req.query;
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

router.get('/legion-info', validateQuery(chatSchemas.legionInfoQuery), async (req, res, next) => {
  try {
    const { playerId } = req.query;
    const data = await chatService.getLegionForPlayer(playerId);
    res.json({ success: true, data });
  } catch (err) {
    return next(wrap500(err, '查询失败'));
  }
});

router.post('/', validateBody(chatSchemas.sendMessageBody), async (req, res, next) => {
  try {
    const { playerId, channelType, channelId, content } = req.body;
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

router.get('/', validateQuery(chatSchemas.listMessagesQuery), async (req, res, next) => {
  try {
    const { playerId, channelType, channelId, limit } = req.query;
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
