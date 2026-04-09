/**
 * 管理员：传书模板 config_texts CRUD + 试发
 * 安全级别与 GET /api/auth/users 一致（由前端管理员入口控制）；生产环境建议加鉴权
 */

const express = require('express');
const router = express.Router();
const configTextService = require('../services/configTextService');

router.get('/', async (req, res) => {
  try {
    const { enabledOnly } = req.query;
    const list = await configTextService.listTemplates({
      enabledOnly: enabledOnly === '1' || enabledOnly === 'true'
    });
    res.json({ success: true, data: list, total: list.length });
  } catch (err) {
    console.error('[admin/config-texts] list:', err);
    res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
});

router.post('/trial-send', async (req, res) => {
  try {
    // 须透传 target_type、faction_id 等，否则「全部/势力」试发拿不到参数
    const result = await configTextService.trialSend(req.body || {});
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[admin/config-texts] trial-send:', err);
    res.status(400).json({ success: false, error: err.message || '试发失败' });
  }
});

router.get('/:templateId', async (req, res) => {
  try {
    const row = await configTextService.getTemplate(req.params.templateId);
    if (!row) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('[admin/config-texts] get:', err);
    res.status(500).json({ success: false, error: err.message || '查询失败' });
  }
});

router.post('/', async (req, res) => {
  try {
    const row = await configTextService.createTemplate(req.body);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('[admin/config-texts] create:', err);
    const code = err.code === 'ER_DUP_ENTRY' ? 409 : 400;
    res.status(code).json({ success: false, error: err.message || '创建失败' });
  }
});

router.put('/:templateId', async (req, res) => {
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
});

router.delete('/:templateId', async (req, res) => {
  try {
    const ok = await configTextService.deleteTemplate(req.params.templateId);
    if (!ok) {
      return res.status(404).json({ success: false, error: '模板不存在' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[admin/config-texts] delete:', err);
    res.status(500).json({ success: false, error: err.message || '删除失败' });
  }
});

module.exports = router;
