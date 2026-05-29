/**
 * 玩家路由 · 事件 / 道具 / 配额 / 属性随机（O3-B1）
 */
const express = require('express');
const playerExploreEventService = require('../../services/playerExploreEventService');
const playerExploreQuotaService = require('../../services/playerExploreQuotaService');
const playerBanditRaidQuotaService = require('../../services/playerBanditRaidQuotaService');
const playerItemsService = require('../../services/playerItemsService');
const playerEventRewardsService = require('../../services/playerEventRewardsService');
const playerRerollService = require('../../services/playerRerollService');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

router.post('/:playerId/rewards', withRoute('执行奖励失败', async (req, res) => {
  const out = await playerEventRewardsService.executeEventRewards(req.params.playerId, req.body);
  if (!out.ok) return res.status(out.status).json(out.json);
  res.json({ success: true, data: out.data });
}));

router.get('/:playerId/events/explore', withRoute('获取探索事件进度失败', async (req, res) => {
  const result = await playerExploreEventService.getExploreEvents(req.params.playerId);
  res.json({ success: true, data: result });
}));

router.patch('/:playerId/events/explore/session-lock', withRoute('更新探索会话锁失败', async (req, res) => {
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'sessionLock')) {
    return res.status(400).json({ success: false, error: '缺少 sessionLock 字段（清空锁请传 null）' });
  }
  const sessionLock = req.body.sessionLock;
  if (sessionLock !== null && typeof sessionLock !== 'object') {
    return res.status(400).json({ success: false, error: 'sessionLock 须为对象或 null' });
  }
  await playerExploreEventService.setExploreSessionLock(req.params.playerId, sessionLock);
  res.json({ success: true });
}));

router.post('/:playerId/events', withRoute('记录事件进度失败', async (req, res) => {
  const { eventId, eventType, status = 'completed', data = {} } = req.body;
  if (!eventId || !eventType) {
    return res.status(400).json({ success: false, error: '缺少 eventId 或 eventType' });
  }
  const result = await playerExploreEventService.recordEventProgress(
    req.params.playerId, { eventId, eventType, status, data },
  );
  if (result.badRequest) return res.status(400).json({ success: false, error: result.badRequest });
  res.json({
    success: true,
    data: { eventId: result.eventId, field: result.field, status: result.status },
  });
}));

router.get('/:playerId/items', withRoute('获取道具失败', async (req, res) => {
  const result = await playerItemsService.listItems(req.params.playerId);
  if (result.notFound) return res.status(404).json({ success: false, error: '玩家不存在' });
  res.json({ success: true, data: { items: result.items } });
}));

router.post('/:playerId/items', withRoute('添加道具失败', async (req, res) => {
  const { itemId, quantity = 1 } = req.body;
  const result = await playerItemsService.addItem(req.params.playerId, itemId, quantity);
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
  res.json({ success: true, data: { itemId: result.itemId, quantity: result.quantity } });
}));

router.delete('/:playerId/items', withRoute('消耗道具失败', async (req, res) => {
  const { itemId, quantity = 1 } = req.body;
  const result = await playerItemsService.consumeItem(req.params.playerId, itemId, quantity);
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
  res.json({ success: true, data: { itemId: result.itemId, remaining: result.remaining } });
}));

router.get('/:playerId/bandit-raid-quota', withRoute('获取匪寨攻打配额失败', async (req, res) => {
  const banditPoiId = req.query.banditPoiId;
  if (!banditPoiId || String(banditPoiId).trim() === '') {
    return res.status(400).json({ success: false, error: '缺少 banditPoiId（匪寨地图对象 ID，04-1 §15）' });
  }
  return replyServiceOut(res, await playerBanditRaidQuotaService.getRaidQuotaState(req.params.playerId, banditPoiId));
}));

router.post('/:playerId/bandit-raid-quota', withRoute('更新匪寨攻打配额失败', async (req, res) => {
  const { banditPoiId, action } = req.body || {};
  return replyServiceOut(res, await playerBanditRaidQuotaService.applyRaidQuotaAction(
    req.params.playerId,
    banditPoiId,
    action,
  ));
}));

router.get('/:playerId/explore-quota', withRoute('获取探索配额失败', async (req, res) => {
  const data = await playerExploreQuotaService.getExploreQuotaState(req.params.playerId);
  res.json({
    success: true,
    data: {
      remaining: data.remaining,
      lastRefillTs: data.lastRefillTs,
      max: data.max,
      refillPerHour: data.refillPerHour,
    },
  });
}));

router.post('/:playerId/explore-quota', withRoute('更新探索配额失败', async (req, res) => {
  const { action } = req.body;
  if (!['consume', 'refund', 'fillMax'].includes(action)) {
    return res.status(400).json({ success: false, error: '无效的 action' });
  }
  const result = await playerExploreQuotaService.applyExploreQuotaAction(req.params.playerId, action);
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });
  res.json({ success: true, data: result.data });
}));

router.get('/:playerId/reroll-status', withRoute('获取属性随机状态失败', async (req, res) => {
  const result = await playerRerollService.getRerollStatus(req.params.playerId);
  if (result.notFound) return res.status(404).json({ success: false, error: '玩家不存在' });
  res.json({ success: true, data: result.data });
}));

router.post('/:playerId/reroll-attributes', withRoute('属性随机失败', async (req, res) => {
  const result = await playerRerollService.rerollAttributes(req.params.playerId);
  if (result.notFound) return res.status(404).json({ success: false, error: '玩家不存在' });
  if (result.badRequest) return res.status(400).json({ success: false, error: result.badRequest });
  res.json({ success: true, data: result.data });
}));

router.post('/:playerId/reroll-confirm', withRoute('确认属性方案失败', async (req, res) => {
  const { batch, index } = req.body;
  const result = await playerRerollService.rerollConfirm(req.params.playerId, batch, index);
  if (result.notFound) return res.status(404).json({ success: false, error: '玩家不存在' });
  if (result.badRequest) return res.status(400).json({ success: false, error: result.badRequest });
  res.json({ success: true, data: result.data });
}));

module.exports = router;
