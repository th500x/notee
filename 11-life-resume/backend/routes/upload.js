/**
 * OSS upload sign — POST /api/life-resume/upload/sign
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateAccountIdFormat } = require('../../../05-san-storm/shared/utils/lifeResumeUsername.cjs');
const { validateMediaUploadRequest } = require('../../../05-san-storm/shared/utils/lifeResumeMediaRules.cjs');
const { createUploadSign, isOssAvailable } = require('../services/ossService');
const { getEntryForOwner, EntryServiceError } = require('../services/lifeEntryService');

const router = express.Router();

router.post('/sign', requireAuth, async (req, res) => {
  try {
    if (!isOssAvailable()) {
      return res.status(503).json({
        success: false,
        error: '未配置阿里云 OSS，媒体上传不可用（请填写 OSS 密钥并重启后端）',
        code: 'OSS_NOT_CONFIGURED',
      });
    }

    const accountId = String(req.player.sub).trim().toUpperCase();
    if (!validateAccountIdFormat(accountId)) {
      return res.status(400).json({ success: false, error: '账号无效', code: 'INVALID_ACCOUNT_ID' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const mediaCheck = validateMediaUploadRequest({
      mediaType: body.mediaType,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
    });
    if (!mediaCheck.ok) {
      return res.status(400).json({
        success: false,
        error: mediaCheck.error,
        code: mediaCheck.code,
      });
    }

    let entryId = null;
    if (body.entryId != null && body.entryId !== '') {
      entryId = Number(body.entryId);
      if (!Number.isInteger(entryId) || entryId <= 0) {
        return res.status(400).json({ success: false, error: 'entryId 无效', code: 'INVALID_ENTRY_ID' });
      }
      await getEntryForOwner(accountId, entryId);
    }

    const sortOrder = Number(body.sortOrder) > 0 ? Number(body.sortOrder) : 1;
    const stagingToken = body.stagingToken ? String(body.stagingToken).trim().slice(0, 64) : null;

    const data = await createUploadSign({
      accountId,
      entryId,
      stagingToken,
      mediaType: mediaCheck.mediaType,
      mimeType: mediaCheck.mimeType,
      sortOrder,
    });

    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof EntryServiceError) {
      return res.status(err.status).json({ success: false, error: err.message, code: err.code });
    }
    console.error('[life-resume/upload/sign]', err);
    return res.status(500).json({ success: false, error: err.message || '签名失败' });
  }
});

module.exports = router;
