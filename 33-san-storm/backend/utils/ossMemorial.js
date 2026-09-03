/**
 * 阿里云 OSS：战斗纪念图上传（与 milestone/daily 共用同一 Bucket，以 key 前缀区分目录）
 * 需在环境变量中配置 OSS_REGION、OSS_BUCKET、OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET
 */

const OSS = require('ali-oss');

function requireOssConfig() {
  const region = process.env.OSS_REGION;
  const bucket = process.env.OSS_BUCKET;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    const err = new Error(
      'OSS 未配置：请设置 OSS_REGION、OSS_BUCKET、OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET'
    );
    err.code = 'OSS_CONFIG';
    throw err;
  }
  return { region, bucket, accessKeyId, accessKeySecret };
}

function createOssClient() {
  const { region, bucket, accessKeyId, accessKeySecret } = requireOssConfig();
  return new OSS({ region, accessKeyId, accessKeySecret, bucket });
}

/** 公共读直链：优先 OSS_PUBLIC_BASE_URL（自定义域/CDN），否则 https://{bucket}.{region}.aliyuncs.com/{key} */
function publicObjectUrl(ossKey) {
  const custom = process.env.OSS_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (custom) {
    return `${custom}/${ossKey}`;
  }
  const bucket = process.env.OSS_BUCKET;
  const region = process.env.OSS_REGION;
  return `https://${bucket}.${region}.aliyuncs.com/${ossKey}`;
}

/**
 * @param {Buffer} buffer
 * @param {string} ossKey 如 battle/xxx.png
 * @returns {Promise<string>} 可写入 image_url 的 HTTPS 地址
 */
async function putPngBuffer(buffer, ossKey) {
  const client = createOssClient();
  const result = await client.put(ossKey, buffer, {
    headers: { 'Content-Type': 'image/png' },
  });
  if (result && typeof result.url === 'string' && result.url.startsWith('http')) {
    return result.url;
  }
  return publicObjectUrl(ossKey);
}

module.exports = {
  putPngBuffer,
  publicObjectUrl,
  requireOssConfig,
};
