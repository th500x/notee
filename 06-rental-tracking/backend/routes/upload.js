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

// 配置 multer 使用内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 限制2MB
    files: 3 // 最多3个文件
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
 * @body {files} photo - 照片文件（最多3张）
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

    // 上传照片到OSS
    const result = await ossService.uploadPhoto(req.file.buffer, req.file.originalname);

    // 返回照片信息
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
 * 删除OSS上的照片
 * DELETE /api/upload/photos/:photoId
 * 
 * @param {string} photoId - 照片ID（OSS文件名）
 * @returns {Object} { success, message }
 */
router.delete('/photos/:photoId', async (req, res) => {
  try {
    if (!ossService.isOssAvailable()) {
      return res.status(503).json({
        success: false,
        error: '未配置阿里云 OSS 密钥，无法删除远端照片'
      });
    }

    const { photoId } = req.params;

    if (!photoId) {
      return res.status(400).json({
        success: false,
        error: '缺少照片ID'
      });
    }

    await ossService.deletePhoto(photoId);

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

// 错误处理中间件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '照片大小不能超过2MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: '最多只能上传3张照片'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: error.message || '上传失败'
  });
});

module.exports = router;
