/**
 * 照片上传路由
 * 
 * @description 处理照片上传到阿里云OSS
 * @module 06-rental-tracking/backend/routes/upload
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const ossService = require('../services/ossService');
const { isValidPhotoObjectKey } = require('../utils/publicGallery');

// 配置 multer 使用内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // 只允许图片
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

/**
 * 上传照片到OSS
 * POST /api/upload/photos
 *
 * @body {files} photo - 照片文件（单张，≤10MB）
 * @body {string} [purpose] - `gallery` 时按 ROOM 目录存放并尽量保留原文件名；默认凭证月份目录
 * @body {string} [room] - purpose=gallery 时的房号（ROOM）
 * @returns {Object} { success, photo: { id, url, name, size } }
 */
router.post(
  '/photos',
  (req, res, next) => {
    if (!ossService.isOssAvailable()) {
      return res.status(503).json({
        success: false,
        error: '未配置阿里云 OSS 密钥，照片上传不可用（本地可忽略，填写 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET 后重启）'
      });
    }
    next();
  },
  upload.single('photo'),
  async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请选择要上传的照片'
      });
    }

    const purpose = String(req.body?.purpose || '').trim() === 'gallery' ? 'gallery' : 'receipt';
    const room = typeof req.body?.room === 'string' ? req.body.room : '';
    if (purpose === 'gallery' && !String(room).trim()) {
      return res.status(400).json({
        success: false,
        error: '图库上传需要填写房号（ROOM）'
      });
    }

    const result = await ossService.uploadPhoto(req.file.buffer, req.file.originalname, {
      purpose,
      room
    });

    const photo = {
      id: result.id,
      url: result.url,
      name: result.name,
      size: result.size,
      uploadedAt: result.uploadedAt
    };

    res.json({
      success: true,
      photo
    });
  } catch (error) {
    console.error('照片上传失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '照片上传失败'
    });
  }
  }
);

/**
 * 图库照片随 ROOM 更名迁移目录
 * POST /api/upload/photos/relocate-gallery
 * Body: { room: string, photos: [{ id, url, name, ... }] }
 */
router.post('/photos/relocate-gallery', express.json(), async (req, res) => {
  try {
    if (!ossService.isOssAvailable()) {
      return res.status(503).json({
        success: false,
        error: '未配置阿里云 OSS 密钥，无法迁移照片'
      });
    }
    const room = typeof req.body?.room === 'string' ? req.body.room.trim() : '';
    const photos = Array.isArray(req.body?.photos) ? req.body.photos : [];
    if (!room) {
      return res.status(400).json({ success: false, error: '缺少房号（ROOM）' });
    }
    for (const p of photos) {
      if (p?.id && !isValidPhotoObjectKey(String(p.id))) {
        return res.status(400).json({ success: false, error: `无效的照片路径: ${p.id}` });
      }
    }
    const nextPhotos = await ossService.relocateGalleryPhotosToRoom(photos, room);
    return res.json({ success: true, photos: nextPhotos });
  } catch (error) {
    console.error('图库照片迁移失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '迁移失败'
    });
  }
});

/**
 * 同步 ROOM 图库目录：删除 OSS 中不在 keepKeys 内的对象（清理中断上传残留）
 * POST /api/upload/photos/sync-gallery
 * Body: { room: string, keepKeys: string[] }
 */
router.post('/photos/sync-gallery', express.json(), async (req, res) => {
  try {
    if (!ossService.isOssAvailable()) {
      return res.status(503).json({
        success: false,
        error: '未配置阿里云 OSS 密钥，无法同步图库目录'
      });
    }
    const room = typeof req.body?.room === 'string' ? req.body.room.trim() : '';
    if (!room) {
      return res.status(400).json({ success: false, error: '缺少房号（ROOM）' });
    }
    const rawKeep = Array.isArray(req.body?.keepKeys) ? req.body.keepKeys : [];
    const keepKeys = [];
    for (const item of rawKeep) {
      if (typeof item !== 'string') continue;
      const k = item.trim();
      if (!isValidPhotoObjectKey(k) || keepKeys.includes(k)) continue;
      keepKeys.push(k);
    }
    const result = await ossService.syncGalleryFolderKeep(room, keepKeys);
    return res.json({
      success: true,
      deleted: result.deleted,
      deletedKeys: result.deletedKeys
    });
  } catch (error) {
    console.error('同步图库目录失败:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '同步失败'
    });
  }
});

/**
 * 删除 OSS 上的照片
 * DELETE /api/upload/photos?key=photos/YYYY/MM/filename.jpg
 *
 * photo.id 为完整 OSS 对象键（含 photos/ 前缀与斜杠），不可用路径参数拼接。
 */
router.delete('/photos', async (req, res) => {
  try {
    if (!ossService.isOssAvailable()) {
      return res.status(503).json({
        success: false,
        error: '未配置阿里云 OSS 密钥，无法删除远端照片'
      });
    }

    const key = typeof req.query.key === 'string' ? req.query.key.trim() : '';
    if (!isValidPhotoObjectKey(key)) {
      return res.status(400).json({
        success: false,
        error: '无效的照片路径'
      });
    }

    await ossService.deletePhoto(key);

    res.json({
      success: true,
      message: '照片已删除'
    });
  } catch (error) {
    console.error('删除照片失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '删除照片失败'
    });
  }
});

/**
 * 批量删除 OSS 照片
 * POST /api/upload/photos/batch-delete  Body: { keys: string[] }
 */
router.post('/photos/batch-delete', express.json(), async (req, res) => {
  try {
    if (!ossService.isOssAvailable()) {
      return res.status(503).json({
        success: false,
        error: '未配置阿里云 OSS 密钥，无法删除远端照片'
      });
    }

    const rawKeys = Array.isArray(req.body?.keys) ? req.body.keys : [];
    const keys = [];
    for (const item of rawKeys) {
      if (typeof item !== 'string') continue;
      const k = item.trim();
      if (!isValidPhotoObjectKey(k) || keys.includes(k)) continue;
      keys.push(k);
    }

    if (keys.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有可删除的照片'
      });
    }

    await ossService.deletePhotos(keys);

    res.json({
      success: true,
      message: `已删除 ${keys.length} 张照片`,
      deleted: keys.length
    });
  } catch (error) {
    console.error('批量删除照片失败:', error);
    res.status(500).json({
      success: false,
      error: error.message || '批量删除失败'
    });
  }
});

/** @deprecated 旧客户端可能仍拼 /photos/:id；单段 id 无法对应 OSS 全路径，保留仅作 400 提示 */
router.delete('/photos/:photoId', async (req, res) => {
  const legacy = typeof req.params.photoId === 'string' ? req.params.photoId.trim() : '';
  if (legacy && isValidPhotoObjectKey(legacy)) {
    try {
      if (!ossService.isOssAvailable()) {
        return res.status(503).json({ success: false, error: '未配置阿里云 OSS 密钥，无法删除远端照片' });
      }
      await ossService.deletePhoto(legacy);
      return res.json({ success: true, message: '照片已删除' });
    } catch (error) {
      console.error('删除照片失败:', error);
      return res.status(500).json({ success: false, error: error.message || '删除照片失败' });
    }
  }
  return res.status(400).json({
    success: false,
    error: '无效的照片路径，请刷新页面后重试'
  });
});

// 错误处理中间件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '照片大小不能超过10MB'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: error.message || '上传失败'
  });
});

module.exports = router;
