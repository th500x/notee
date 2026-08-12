/**
 * 检测微信 / LINE 等内置浏览器，并尽量引导到系统浏览器
 * （这些 WebView 常禁止文件下载与 Web Share files）
 */

/** @typedef {'wechat'|'line'|'facebook'|'instagram'|'tiktok'|'qq'|'other'|null} InAppName */
/** @typedef {'ios'|'android'|null} MobileOs */

/**
 * @returns {{ restricted: boolean, app: InAppName, os: MobileOs, label: string }}
 */
export function detectRestrictedInAppBrowser() {
  if (typeof navigator === 'undefined') {
    return { restricted: false, app: null, os: null, label: '' };
  }
  const ua = navigator.userAgent || '';
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? 'ios'
    : /Android/i.test(ua)
      ? 'android'
      : null;

  /** @type {{ re: RegExp, app: InAppName, label: string }[]} */
  const rules = [
    { re: /MicroMessenger/i, app: 'wechat', label: 'WeChat' },
    { re: /\bLine\//i, app: 'line', label: 'LINE' },
    { re: /FBAN|FBAV|FB_IAB/i, app: 'facebook', label: 'Facebook' },
    { re: /Instagram/i, app: 'instagram', label: 'Instagram' },
    { re: /BytedanceWebview|TikTok/i, app: 'tiktok', label: 'TikTok' },
    { re: /\bQQ\//i, app: 'qq', label: 'QQ' }
  ];

  for (const rule of rules) {
    if (rule.re.test(ua)) {
      return { restricted: true, app: rule.app, os, label: rule.label };
    }
  }

  return { restricted: false, app: null, os, label: '' };
}

/**
 * Android：尝试用 Chrome Intent 打开同一页（需用户手势；部分 App 仍会拦截）
 * @param {string} [href]
 * @returns {boolean} 是否已发起跳转
 */
export function tryOpenInSystemBrowser(href) {
  if (typeof window === 'undefined') return false;
  const url = href || window.location.href;
  const info = detectRestrictedInAppBrowser();
  if (!info.restricted || info.os !== 'android') return false;

  try {
    const parsed = new URL(url);
    const pathAndQuery = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const fallback = encodeURIComponent(url);
    // 优先 Chrome；无 Chrome 时由系统解析 https intent
    const intent = `intent://${parsed.host}${pathAndQuery}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
    window.location.href = intent;
    return true;
  } catch {
    return false;
  }
}

/** 复制当前页链接，便于粘贴到 Safari / Chrome */
export async function copyCurrentPageUrl() {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  if (!url) throw new Error('无链接');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return url;
  }
  const ta = document.createElement('textarea');
  ta.value = url;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return url;
}
