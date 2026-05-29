/**
 * 玩家路由 · 角色创建与创角辅助（O3-B1 自 players.js 拆分）
 */
const express = require('express');
const Player = require('../../models/Player');
const PlayerService = require('../../services/playerService');
const playerCreationService = require('../../services/playerCreationService');
const {
  validateBody,
  validateQuery,
  validateBodyIsPlainObject,
} = require('../../middleware/validation');
const creationSchemas = require('../../middleware/validationSchemas/playersCreation');
const { withRoute } = require('../../utils/routeAdapter');

const router = express.Router();

router.post(
  '/generate-attributes',
  validateBody(creationSchemas.generateAttributesBody),
  withRoute('生成属性方案失败', async (req, res) => {
    const { rarity = 'common' } = req.body;
    const options = await PlayerService.generateAttributeOptions(rarity);
    res.json({ success: true, data: { options } });
  }),
);

router.post(
  '/validate-name',
  validateBody(creationSchemas.validateNameBody),
  withRoute('验证角色名失败', async (req, res) => {
    const { characterName, serverId } = req.body;
    const validation = PlayerService.validateCharacterName(characterName);
    if (!validation.valid) {
      return res.json({ success: true, data: { valid: false, error: validation.error } });
    }
    const nameTaken = await Player.isNameTaken(characterName, serverId);
    if (nameTaken) {
      return res.json({ success: true, data: { valid: false, error: '该角色名已被使用，请重新输入' } });
    }
    res.json({ success: true, data: { valid: true } });
  }),
);

router.post(
  '/create',
  validateBody(creationSchemas.createCharacterBody),
  withRoute('创建角色失败', async (req, res) => {
    const {
      playerId, characterName, factionId, factionName,
      attributes, skills, initialTroops, serverId, initialSilver, avatar,
    } = req.body;

    const devBypass = req.player._devBypass && req.player.sub == null;
    if (!devBypass && req.player.role !== 'admin' && String(playerId) !== String(req.player.sub)) {
      return res.status(403).json({ success: false, error: '无权为他人创建角色', code: 'FORBIDDEN' });
    }

    const player = await PlayerService.createCharacter({
      playerId, characterName, factionId, factionName, attributes,
      skills: skills || null, serverId, initialSilver: initialSilver || 0, avatar: avatar || null,
      initialTroops: initialTroops || [],
    });

    res.json({ success: true, message: '角色创建成功', data: player });
  }),
);

router.get('/:playerId/factions/available', withRoute('获取可用势力失败', async (req, res) => {
  const result = await playerCreationService.getAvailableFactions(req.params.playerId);
  if (result.notFound) return res.status(404).json({ success: false, error: '账号不存在' });
  res.json({ success: true, data: { factions: result.factions } });
}));

router.get(
  '/:playerId/troops/initial',
  validateQuery(creationSchemas.initialTroopsQuery),
  withRoute('获取初始部队选项失败', async (req, res) => {
    const { factionId } = req.query;
    const result = await playerCreationService.getInitialTroopOptions(factionId);
    res.json({ success: true, data: result });
  }),
);

router.get('/:playerId/creation-progress', withRoute('获取角色创建进度失败', async (req, res) => {
  const progress = await playerCreationService.getCreationProgress(req.params.playerId);
  res.json({ success: true, data: progress });
}));

router.post(
  '/:playerId/creation-progress',
  validateBodyIsPlainObject(),
  withRoute('保存角色创建进度失败', async (req, res) => {
    await playerCreationService.saveCreationProgress(req.params.playerId, req.body);
    res.json({ success: true, message: '进度已保存' });
  }),
);

router.post(
  '/:playerId/generate-attributes-batch',
  validateBody(creationSchemas.generateAttributesBody),
  withRoute('生成属性批次失败', async (req, res) => {
    const { rarity = 'common' } = req.body;
    const result = await playerCreationService.generateAttributesBatch(req.params.playerId, rarity);
    if (result.notFound) return res.status(404).json({ success: false, error: '未找到角色创建进度' });
    if (result.insufficientSilver) {
      return res.status(400).json({ success: false, error: `银两不足，需要${result.cost}银两才能重新随机` });
    }
    res.json({ success: true, data: result.data });
  }),
);

router.post(
  '/:playerId/select-option',
  validateBody(creationSchemas.selectOptionBody),
  withRoute('选择属性方案失败', async (req, res) => {
    const { batch, index } = req.body;
    await playerCreationService.selectAttributeOption(req.params.playerId, batch, index);
    res.json({ success: true, message: '方案已选择' });
  }),
);

router.delete('/:playerId/creation-progress', withRoute('删除角色创建进度失败', async (req, res) => {
  await playerCreationService.deleteCreationProgress(req.params.playerId);
  res.json({ success: true, message: '进度已删除' });
}));

module.exports = router;
