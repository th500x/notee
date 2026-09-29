/**
 * 应用配置
 */
function getAuthApiUrl() {
  if (typeof window === 'undefined') {
    return '/api/auth'
  }

  const { protocol, hostname } = window.location

  if (hostname === 'notee.vip' || hostname === 'www.notee.vip') {
    return `${protocol}//${hostname}/api/auth`
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api/auth'
  }

  return `${protocol}//${hostname}/api/auth`
}

export const config = {
  api: {
    auth: getAuthApiUrl(),
    timeout: 30000
  }
}
