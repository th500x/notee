/**
 * Entry routes — owner CRUD at /api/life-resume/entries
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listEntriesForOwner,
  getEntryForOwner,
  createEntry,
  updateEntry,
  deleteEntry,
  EntryServiceError,
} = require('../services/lifeEntryService');
const { MediaServiceError } = require('../services/lifeEntryMediaService');

const router = express.Router();

function handleEntryError(res, err) {
  if (err instanceof EntryServiceError || err instanceof MediaServiceError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }
  console.error('[life-resume/entries]', err);
  return res.status(500).json({ success: false, error: '服务器内部错误' });
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await listEntriesForOwner(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleEntryError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = await createEntry(accountId, body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleEntryError(res, err);
  }
});

router.get('/:entryId', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await getEntryForOwner(accountId, req.params.entryId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleEntryError(res, err);
  }
});

router.put('/:entryId', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = await updateEntry(accountId, req.params.entryId, body);
    return res.json({ success: true, data });
  } catch (err) {
    return handleEntryError(res, err);
  }
});

router.delete('/:entryId', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await deleteEntry(accountId, req.params.entryId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleEntryError(res, err);
  }
});

module.exports = router;
