/**
 * 阿里云 OSS 图片处理 URL（仅展示用；原图仍存 OSS）
 * thumb：网格；view：大图（最长边约 1080）
 */

const PROCESS = {
  thumb: 'image/resize,l_540/quality,q_80',
  view: 'image/resize,l_1080/quality,q_85'
};

function isAliyunOssUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('aliyuncs.com') || host.includes('aliyun.com');
  } catch {
    return false;
  }
}

/**
 * @param {string} url
 * @param {'thumb'|'view'} variant
 * @returns {string}
 */
export function buildOssImageUrl(url, variant = 'view') {
  if (!url || !isAliyunOssUrl(url)) return url || '';
  const process = PROCESS[variant] || PROCESS.view;
  const sep = url.includes('?') ? '&' : '?';
  // 避免重复叠加 process
  if (/[?&]x-oss-process=/.test(url)) return url;
  return `${url}${sep}x-oss-process=${process}`;
}
