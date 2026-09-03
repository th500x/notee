/**
 * 管理员：传书模板 config_texts CRUD + 试发
 * 入口鉴权：前端 useAdmin / AdminPageGate（主站 JWT）。
 */

const express = require('express');
const router = express.Router();
const configTextService = require('../services/configTextService');
const { wrap500 } = require('../utils/httpError');
const { validateBody, validateParams, validateQuery } = require('../middleware/validation');
const configTextSchemas = require('../middleware/validationSchemas/adminConfigTexts');

router.get('/', validateQuery(configTextSchemas.listQuery), async (req, res, next) => {
  try {
    const { enabledOnly } = req.query;
    const list = await configTextService.listTemplates({
      enabledOnly: enabledOnly === '1' || enabledOnly === 'true',
    });
    res.json({ success: true, data: list, total: list.length });
  } catch (err) {
    return next(wrap500(err, '查询失败'));
  }
});

router.post('/trial-send', validateBody(configTextSchemas.trialSendBody), async (req, res, next) => {
  try {
    const result = await configTextService.trialSend(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[admin/config-texts] trial-send:', err);
    res.status(400).json({ success: false, error: err.message || '试发失败' });
  }
});

router.get('/:templateId', validateParams(configTextSchemas.templateIdParam), async (req, res, next) => {
  try {
    const row = await configTextService.getTemplate(req.params.templateId);
    if (!row) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    return next(wrap500(err, '查询失败'));
  }
});

router.post('/', validateBody(configTextSchemas.createTemplateBody), async (req, res, next) => {
  try {
    const row = await configTextService.createTemplate(req.body);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[admin/config-texts] create:', err);
    const code = err.code === 'ER_DUP_ENTRY' ? 409 : 400;
    res.status(code).json({ success: false, error: err.message || '创建失败' });
  }
});

router.put(
  '/:templateId',
  validateParams(configTextSchemas.templateIdParam),
  validateBody(configTextSchemas.updateTemplateBody),
  async (req, res, next) => {
    try {
      const row = await configTextService.updateTemplate(req.params.templateId, req.body);
      if (!row) {
        return res.status(404).json({ success: false, error: '模板不存在' });
      }
      res.json({ success: true, data: row });
    } catch (err) {
      console.error('[admin/config-texts] update:', err);
      res.status(400).json({ success: false, error: err.message || '更新失败' });
    }
  },
);

router.delete('/:templateId', validateParams(configTextSchemas.templateIdParam), async (req, res, next) => {
  try {
    const ok = await configTextService.deleteTemplate(req.params.templateId);
    if (!ok) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }
    res.json({ success: true });
  } catch (err) {
    return next(wrap500(err, '删除失败'));
  }
});

module.exports = router;
