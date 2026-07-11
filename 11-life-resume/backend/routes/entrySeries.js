/**
 * Entry series routes — /api/life-resume/entry-series
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  EntrySeriesServiceError,
  listEntrySeriesForOwner,
  createEntrySeriesForOwner,
  updateEntrySeriesForOwner,
  deleteEntrySeriesForOwner,
  countEntriesInSeries,
} = require('../services/lifeEntrySeriesService');

const router = express.Router();

function handleError(res, err) {
  if (err instanceof EntrySeriesServiceError) {
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }
  console.error('[life-resume/entry-series]', err);
  return res.status(500).json({ success: false, error: '服务器内部错误' });
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const data = await listEntrySeriesForOwner(accountId);
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = await createEntrySeriesForOwner(accountId, { name: body.name });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const seriesId = req.params.id;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const data = await updateEntrySeriesForOwner(accountId, seriesId, { name: body.name });
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err);
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const accountId = String(req.player.sub);
    const seriesId = req.params.id;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const confirm = body.confirm === true || body.confirm === 'true';
    const entryCount = await countEntriesInSeries(
      String(accountId).trim().toUpperCase(),
      Number(seriesId)
    );
    const data = await deleteEntrySeriesForOwner(accountId, seriesId, { confirm });
    return res.json({
      success: true,
      data: {
        ...data,
        entryCount,
      },
    });
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;
