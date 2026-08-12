/**
 * 阿里云 OSS（无密钥时不在启动期初始化，便于本地开发）
 *
 * 路径约定：
 * - 租赁凭证等：`photos/YYYY/MM/{timestamp}-{rand}.ext`（历史）
 * - 账目图库：`photos/gallery/{ROOM}/{原文件名}`（按房号目录，尽量保留原名）
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

/** ROOM → OSS 目录名（如 TG A109 → TG_A109） */
function sanitizeRoomFolderName(room) {
  let s = String(room || '').trim();
  s = s.replace(/[/\\?%*:|"<>#&=+\0]/g, '_').replace(/\s+/g, '_');
  s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (!s || s === '.' || s === '..') s = '_unassigned';
  return s.slice(0, 100);
}

/** 保留可读原名，去掉路径与危险字符 */
function sanitizeOriginalBaseName(fileName) {
  const raw = path.basename(String(fileName || 'photo'));
  const extMatch = raw.match(/(\.[a-zA-Z0-9]{1,8})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : '';
  let base = extMatch ? raw.slice(0, -extMatch[1].length) : raw;
  base = base.replace(/[/\\?%*:|"<>#&=+\0]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_');
  base = base.replace(/^_+|_+$/g, '').slice(0, 80);
  if (!base) base = 'photo';
  return { base, ext: ext || '.jpg' };
}

function publicObjectUrl(objectKey) {
  const client = requireOssClient();
  const region = process.env.OSS_REGION || 'oss-cn-heyuan';
  const bucket = process.env.OSS_BUCKET || '06-rental-tracking';
  try {
    const u = client.generateObjectUrl(objectKey);
    return String(u).replace(/^http:/, 'https:');
  } catch {
    return `https://${bucket}.${region}.aliyuncs.com/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  }
}

async function objectExists(objectKey) {
  const client = requireOssClient();
  try {
    await client.head(objectKey);
    return true;
  } catch (err) {
    if (err && (err.status === 404 || err.code === 'NoSuchKey')) return false;
    throw err;
  }
}

async function allocateUniqueObjectKey(folderPrefix, originalFileName) {
  const { base, ext } = sanitizeOriginalBaseName(originalFileName);
  const prefix = folderPrefix.endsWith('/') ? folderPrefix : `${folderPrefix}/`;
  let candidate = `${prefix}${base}${ext}`;
  if (!(await objectExists(candidate))) return candidate;
  for (let i = 2; i <= 999; i += 1) {
    candidate = `${prefix}${base}_${i}${ext}`;
    if (!(await objectExists(candidate))) return candidate;
  }
  const stamp = `${Date.now().toString(36)}`;
  return `${prefix}${base}_${stamp}${ext}`;
}

/**
 * 上传照片到 OSS
 * @param {Buffer} fileBuffer
 * @param {string} fileName 原始文件名
 * @param {{ purpose?: 'gallery'|'receipt', room?: string }} [options]
 */
async function uploadPhoto(fileBuffer, fileName, options = {}) {
  const client = requireOssClient();
  try {
    const purpose = options.purpose === 'gallery' ? 'gallery' : 'receipt';
    let uniqueFileName;

    if (purpose === 'gallery') {
      const roomFolder = sanitizeRoomFolderName(options.room);
      uniqueFileName = await allocateUniqueObjectKey(`photos/gallery/${roomFolder}`, fileName);
    } else {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 9);
      const { ext } = sanitizeOriginalBaseName(fileName);
      const photoId = `${timestamp}-${randomStr}`;
      const y = new Date().getFullYear();
      const m = (new Date().getMonth() + 1).toString().padStart(2, '0');
      uniqueFileName = `photos/${y}/${m}/${photoId}${ext.startsWith('.') ? ext : `.${ext}`}`;
    }

    const result = await client.put(uniqueFileName, fileBuffer);
    const httpsUrl = result.url.replace(/^http:/, 'https:');

    return {
      id: uniqueFileName,
      url: httpsUrl,
      name: path.basename(String(fileName || 'photo')),
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

/** 公开图库下载默认：最长边 1080（原图仍保留在 OSS） */
const GALLERY_DOWNLOAD_PROCESS = 'image/resize,l_1080/quality,q_85';

/**
 * 从 OSS 读取对象（供公开图库经后端代理下载，避免浏览器 CORS）
 * @param {string} objectKey
 * @param {{ process?: string|null }} [options] process 为 falsy 时读原图
 */
async function getPhotoObject(objectKey, options = {}) {
  const client = requireOssClient();
  const key = typeof objectKey === 'string' ? objectKey.trim() : '';
  if (!key || !key.startsWith('photos/')) {
    throw new Error('无效的照片路径');
  }
  const process =
    options && Object.prototype.hasOwnProperty.call(options, 'process')
      ? options.process
      : null;
  try {
    const result = process
      ? await client.get(key, { process })
      : await client.get(key);
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

/**
 * 将图库照片迁到新 ROOM 目录（copy + delete），返回更新后的 photos 元数据
 * @param {Array<{ id: string, url?: string, name?: string }>} photos
 * @param {string} newRoom
 */
async function relocateGalleryPhotosToRoom(photos, newRoom) {
  const client = requireOssClient();
  const roomFolder = sanitizeRoomFolderName(newRoom);
  const targetPrefix = `photos/gallery/${roomFolder}/`;
  const list = Array.isArray(photos) ? photos : [];
  const next = [];

  for (const photo of list) {
    const oldKey = typeof photo?.id === 'string' ? photo.id.trim() : '';
    if (!oldKey || !oldKey.startsWith('photos/')) {
      next.push(photo);
      continue;
    }
    if (oldKey.startsWith(targetPrefix)) {
      next.push(photo);
      continue;
    }

    const preferredName = photo.name || path.basename(oldKey);
    const newKey = await allocateUniqueObjectKey(`photos/gallery/${roomFolder}`, preferredName);

    try {
      await client.copy(newKey, oldKey);
      await client.delete(oldKey);
      next.push({
        ...photo,
        id: newKey,
        url: publicObjectUrl(newKey),
        name: photo.name || path.basename(preferredName)
      });
    } catch (error) {
      console.error('OSS relocate failed:', oldKey, '->', newKey, error);
      throw new Error(`迁移图片失败（${path.basename(oldKey)}）: ${error.message}`);
    }
  }

  return next;
}

function galleryFolderPrefixForRoom(room) {
  return `photos/gallery/${sanitizeRoomFolderName(room)}/`;
}

module.exports = {
  uploadPhoto,
  deletePhoto,
  deletePhotos,
  getPhotoObject,
  GALLERY_DOWNLOAD_PROCESS,
  checkConnection,
  isOssAvailable,
  sanitizeRoomFolderName,
  sanitizeOriginalBaseName,
  relocateGalleryPhotosToRoom,
  galleryFolderPrefixForRoom,
  publicObjectUrl
};
