/**
 * 阿里云 OSS（无密钥时不在启动期初始化，便于本地开发）
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local'), override: true });

const OSS = require('ali-oss');

let ossClient = null;
let ossDisabledLogged = false;

function hasOssCredentials() {
  const id = process.env.OSS_ACCESS_KEY_ID && String(process.env.OSS_ACCESS_KEY_ID).trim();
  const secret = process.env.OSS_ACCESS_KEY_SECRET && String(process.env.OSS_ACCESS_KEY_SECRET).trim();
  return !!(id && secret);
}

function getOssClient() {
  if (ossClient !== null) {
    return ossClient;
  }
  if (!hasOssCredentials()) {
    if (!ossDisabledLogged) {
      ossDisabledLogged = true;
      console.warn(
        '[OSS] 未配置 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET，照片上传相关接口将返回错误（其余 API 正常）'
      );
    }
    return null;
  }
  ossClient = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-heyuan',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID.trim(),
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET.trim(),
    bucket: process.env.OSS_BUCKET || '06-rental-tracking'
  });
  return ossClient;
}

function requireOssClient() {
  const client = getOssClient();
  if (!client) {
    throw new Error('本地未配置阿里云 OSS 密钥，无法使用照片上传（请设置 OSS_ACCESS_KEY_ID 与 OSS_ACCESS_KEY_SECRET）');
  }
  return client;
}

function isOssAvailable() {
  return hasOssCredentials();
}

/**
 * 上传照片到OSS
 */
async function uploadPhoto(fileBuffer, fileName) {
  const client = requireOssClient();
  try {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const ext = fileName.split('.').pop();
    const photoId = `${timestamp}-${randomStr}`;
    const uniqueFileName = `photos/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${photoId}.${ext}`;

    const result = await client.put(uniqueFileName, fileBuffer);
    const httpsUrl = result.url.replace(/^http:/, 'https:');

    return {
      id: uniqueFileName,
      url: httpsUrl,
      name: fileName,
      size: fileBuffer.length,
      uploadedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('OSS upload failed:', error);
    throw new Error('照片上传失败: ' + error.message);
  }
}

/**
 * 删除OSS中的照片
 */
async function deletePhoto(fileName) {
  const client = requireOssClient();
  try {
    await client.delete(fileName);
    return {
      success: true,
      message: '照片已删除'
    };
  } catch (error) {
    console.error('OSS delete failed:', error);
    throw new Error('照片删除失败: ' + error.message);
  }
}

/**
 * 批量删除照片
 */
async function deletePhotos(fileNames) {
  const client = requireOssClient();
  try {
    const result = await client.deleteMulti(fileNames);
    return {
      success: true,
      deleted: result.deleted.length,
      message: `成功删除${result.deleted.length}张照片`
    };
  } catch (error) {
    console.error('OSS batch delete failed:', error);
    throw new Error('批量删除失败: ' + error.message);
  }
}

/**
 * 检查OSS连接状态
 */
async function checkConnection() {
  const client = getOssClient();
  if (!client) {
    return {
      success: false,
      message: 'OSS 未配置（缺少密钥）'
    };
  }
  try {
    await client.getBucketInfo();
    return {
      success: true,
      message: 'OSS连接正常',
      bucket: process.env.OSS_BUCKET,
      region: process.env.OSS_REGION
    };
  } catch (error) {
    console.error('OSS check failed:', error);
    return {
      success: false,
      message: 'OSS连接失败: ' + error.message
    };
  }
}

/**
 * 从 OSS 读取对象（供公开图库经后端代理下载，避免浏览器 CORS）
 */
async function getPhotoObject(objectKey) {
  const client = requireOssClient();
  const key = typeof objectKey === 'string' ? objectKey.trim() : '';
  if (!key || !key.startsWith('photos/')) {
    throw new Error('无效的照片路径');
  }
  try {
    const result = await client.get(key);
    const contentType =
      (result.res && result.res.headers && result.res.headers['content-type']) || 'image/jpeg';
    return {
      content: result.content,
      contentType
    };
  } catch (error) {
    console.error('OSS get failed:', error);
    throw new Error('读取照片失败: ' + error.message);
  }
}

module.exports = {
  uploadPhoto,
  deletePhoto,
  deletePhotos,
  getPhotoObject,
  checkConnection,
  isOssAvailable
};
