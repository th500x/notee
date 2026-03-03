/**
 * 阿里云OSS服务
 * 
 * @description 处理照片上传到阿里云OSS
 * @module backend/services/ossService
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const OSS = require('ali-oss');

// OSS客户端配置
const client = new OSS({
  region: process.env.OSS_REGION || 'oss-cn-heyuan',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET || '06-rental-tracking'
});

/**
 * 上传照片到OSS
 * @param {Buffer} fileBuffer - 文件Buffer
 * @param {string} fileName - 文件名
 * @returns {Promise<Object>} 上传结果
 */
async function uploadPhoto(fileBuffer, fileName) {
  try {
    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const ext = fileName.split('.').pop();
    const photoId = `${timestamp}-${randomStr}`;
    const uniqueFileName = `photos/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${photoId}.${ext}`;
    
    // 上传到OSS
    const result = await client.put(uniqueFileName, fileBuffer);
    
    // 返回结果
    return {
      id: uniqueFileName, // 使用OSS路径作为ID，方便删除
      url: result.url, // OSS URL
      name: fileName, // 原始文件名
      size: fileBuffer.length,
      uploadedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ OSS上传失败:', error);
    throw new Error('照片上传失败: ' + error.message);
  }
}

/**
 * 删除OSS中的照片
 * @param {string} fileName - OSS中的文件名（不含域名）
 * @returns {Promise<Object>} 删除结果
 */
async function deletePhoto(fileName) {
  try {
    await client.delete(fileName);
    return {
      success: true,
      message: '照片已删除'
    };
  } catch (error) {
    console.error('❌ OSS删除失败:', error);
    throw new Error('照片删除失败: ' + error.message);
  }
}

/**
 * 批量删除照片
 * @param {Array<string>} fileNames - 文件名数组
 * @returns {Promise<Object>} 删除结果
 */
async function deletePhotos(fileNames) {
  try {
    const result = await client.deleteMulti(fileNames);
    return {
      success: true,
      deleted: result.deleted.length,
      message: `成功删除${result.deleted.length}张照片`
    };
  } catch (error) {
    console.error('❌ OSS批量删除失败:', error);
    throw new Error('批量删除失败: ' + error.message);
  }
}

/**
 * 检查OSS连接状态
 * @returns {Promise<Object>} 连接状态
 */
async function checkConnection() {
  try {
    await client.getBucketInfo();
    return {
      success: true,
      message: 'OSS连接正常',
      bucket: process.env.OSS_BUCKET,
      region: process.env.OSS_REGION
    };
  } catch (error) {
    console.error('❌ OSS连接失败:', error);
    return {
      success: false,
      message: 'OSS连接失败: ' + error.message
    };
  }
}

module.exports = {
  uploadPhoto,
  deletePhoto,
  deletePhotos,
  checkConnection
};
