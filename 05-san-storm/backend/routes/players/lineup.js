/**
 * 玩家路由 · 编组 / 装备套装（O3-B1）
 */
const express = require('express');
const playerCardLineupService = require('../../services/playerCardLineupService');
const equipmentSetService = require('../../services/equipmentSetService');
const { validateBody, validateParams } = require('../../middleware/validation');
const lineupSchemas = require('../../middleware/validationSchemas/playersLineup');
const { replyServiceOut, withRoute } = require('../../utils/routeAdapter');
const { wrap500 } = require('../../utils/httpError');

const router = express.Router();

function sendEquipmentSetError(res, error, next, label) {
  const mapped = equipmentSetService.mapHttpError(error);
  if (mapped) return res.status(mapped.status).json(mapped.body);
  return next(wrap500(error, label));
}

router.post(
  '/:playerId/cards/equip',
  validateBody(lineupSchemas.equipCardBody),
  withRoute('装备卡牌失败', async (req, res) => {
    return replyServiceOut(res, await playerCardLineupService.equipCard(req.params.playerId, req.body));
  }),
);

router.post(
  '/:playerId/cards/unequip',
  validateBody(lineupSchemas.unequipCardBody),
  withRoute('卸下卡牌失败', async (req, res) => {
    return replyServiceOut(res, await playerCardLineupService.unequipCard(req.params.playerId, req.body));
  }),
);

router.get('/:playerId/equipment-set/draft', withRoute('获取草稿套装失败', async (req, res) => {
  const row = await equipmentSetService.getOrCreateDraftSet(req.params.playerId);
  res.json({ success: true, data: equipmentSetService.formatSetRow(row) });
}));

router.get(
  '/:playerId/equipment-set/:setInstanceId',
  validateParams(lineupSchemas.setInstanceIdParam),
  async (req, res, next) => {
    try {
      const row = await equipmentSetService.getEquipmentSetById(req.params.playerId, req.params.setInstanceId);
      res.json({ success: true, data: equipmentSetService.formatSetRow(row) });
    } catch (error) {
      return sendEquipmentSetError(res, error, next, '读取套装失败');
    }
  },
);

router.post(
  '/:playerId/equipment-set/rename',
  validateBody(lineupSchemas.renameSetBody),
  async (req, res, next) => {
    try {
      const { setInstanceId, displayName } = req.body;
      const data = await equipmentSetService.renameEquipmentSet(req.params.playerId, setInstanceId, displayName);
      res.json({ success: true, data: { equipment_set_data: data } });
    } catch (error) {
      return sendEquipmentSetError(res, error, next, '重命名失败');
    }
  },
);

router.post(
  '/:playerId/equipment-set/slot',
  validateBody(lineupSchemas.assignSlotBody),
  async (req, res, next) => {
    try {
      const { setInstanceId, slot, equipmentInstanceId } = req.body;
      const data = await equipmentSetService.assignSlot(
        req.params.playerId, setInstanceId, slot, equipmentInstanceId || null,
      );
      res.json({ success: true, data: { equipment_set_data: data } });
    } catch (error) {
      return sendEquipmentSetError(res, error, next, '更新套装槽位失败');
    }
  },
);

router.post(
  '/:playerId/equipment-set/finalize',
  validateBody(lineupSchemas.finalizeSetBody),
  async (req, res, next) => {
    try {
      const { setInstanceId, displayName } = req.body;
      const data = await equipmentSetService.finalizeSet(req.params.playerId, setInstanceId, displayName);
      res.json({ success: true, data: { equipment_set_data: data } });
    } catch (error) {
      return sendEquipmentSetError(res, error, next, '命名套装失败');
    }
  },
);

module.exports = router;
