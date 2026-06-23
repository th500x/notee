const ERROR_MESSAGES = {
  PROFILE_NOT_AVAILABLE: '页面不存在或暂无内容',
  PROFILE_DEACTIVATED: '账号处于注销冷静期',
  NO_TOKEN: '请先登录',
  TOKEN_EXPIRED: '会话已失效，请重新登录',
  BAD_TOKEN: '会话已失效，请重新登录',
  USERNAME_CHANGE_COOLDOWN: '用户名修改冷却中',
  USERNAME_TAKEN: '该用户名已被占用',
  INVALID_USERNAME: '用户名格式不符合要求',
  INVALID_GRANTEE_ACCOUNT_ID: '特定可见对象 ID 格式错误',
  INVALID_GOOGLE_DRIVE_URL: '请粘贴有效的 Google 云盘链接',
  INVALID_LOCATION: '位置信息无效',
  GEOCODE_FAILED: '无法解析位置',
  OSS_NOT_CONFIGURED: '媒体上传未配置，请联系管理员',
  ALREADY_DEACTIVATED: '已处于注销冷静期',
  NOT_DEACTIVATED: '当前未处于注销冷静期',
  PURGE_DEADLINE_PASSED: '冷静期已结束，无法撤销注销',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
};

export function formatLifeResumeError(err) {
  if (!err) return '请稍后重试';
  if (err.code && ERROR_MESSAGES[err.code]) {
    return ERROR_MESSAGES[err.code];
  }
  if (err.status === 401) {
    return ERROR_MESSAGES.NO_TOKEN;
  }
  if (err.status === 429 || err.code === 'RATE_LIMITED') {
    return ERROR_MESSAGES.RATE_LIMITED;
  }
  if (err.status >= 500) {
    return '服务暂不可用，请稍后重试';
  }
  return err.message || '请稍后重试';
}

export function isAuthError(err) {
  if (!err) return false;
  return (
    err.status === 401 ||
    err.code === 'NO_TOKEN' ||
    err.code === 'TOKEN_EXPIRED' ||
    err.code === 'BAD_TOKEN'
  );
}

export function isNetworkError(err) {
  if (!err) return false;
  return err.message === 'Failed to fetch' || err.name === 'TypeError';
}
