/**
 * 人生片段认证 API（11 后端 /api/life-resume/auth；校验 05 同一张 accounts 表）。
 * 错误文案原样透传（含 429 冷却、429 限流）。
 */

import { appConfig } from '@/config/appConfig';
import { lifeResumeSession } from '@/utils/lifeResumeSession';

const REQUEST_TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function parseAuthJsonResponse(res, text, fallbackLabel) {
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      return {
        success: false,
        status: res.status,
        error: `${fallbackLabel}（服务暂不可用，HTTP ${res.status}），请稍后重试`,
      };
    }
  }
  if (data.success) {
    return { success: true, status: res.status, data: data.data };
  }
  return {
    success: false,
    status: res.status,
    error: data.error || data.message || fallbackLabel,
    code: data.code,
  };
}

export async function getRegisterCandidates(count = 5, excludeIds = []) {
  try {
    const qs = new URLSearchParams();
    qs.set('count', String(count));
    if (excludeIds.length > 0) {
      qs.set('exclude', excludeIds.join(','));
    }
    const res = await fetchWithTimeout(
      `${appConfig.sanStormAuthBase}/register-candidates?${qs.toString()}`,
      { method: 'GET' }
    );
    const text = await res.text();
    const parsed = parseAuthJsonResponse(res, text, '获取候选ID失败');
    if (!parsed.success) {
      return parsed;
    }
    if (parsed.data && Array.isArray(parsed.data.ids) && parsed.data.ids.length > 0) {
      return {
        success: true,
        status: res.status,
        data: parsed.data,
      };
    }
    return {
      success: false,
      status: res.status,
      error: parsed.error || '获取候选ID失败',
      code: parsed.code,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '请求超时，请检查人生片段后端是否已启动' };
    }
    return { success: false, error: '无法连接认证服务，请确认人生片段后端已运行' };
  }
}

export async function registerAccount(body) {
  try {
    const res = await fetchWithTimeout(`${appConfig.sanStormAuthBase}/register`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return parseAuthJsonResponse(res, text, '注册失败');
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '请求超时，请检查人生片段后端是否已启动' };
    }
    return { success: false, error: '无法连接认证服务，请确认人生片段后端已运行' };
  }
}

export async function loginAccount(id, password) {
  try {
    const res = await fetchWithTimeout(`${appConfig.sanStormAuthBase}/login`, {
      method: 'POST',
      body: JSON.stringify({ id, password }),
    });
    const text = await res.text();
    return parseAuthJsonResponse(res, text, '登录失败');
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '请求超时，请检查人生片段后端是否已启动' };
    }
    return { success: false, error: '无法连接认证服务，请确认人生片段后端已运行' };
  }
}

/** POST /api/life-resume/auth/change-password — 须 JWT；与真三风云同一账号，不校验旧密码 */
export async function changePassword({ password, confirmPassword }) {
  const token = lifeResumeSession.getToken();
  if (!token) {
    return { success: false, error: '请先登录后再修改密码' };
  }
  try {
    const res = await fetchWithTimeout(`${appConfig.sanStormAuthBase}/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password, confirmPassword }),
    });
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        return {
          success: false,
          status: res.status,
          error: `修改密码失败（服务暂不可用，HTTP ${res.status}），请稍后重试`,
        };
      }
    }
    if (data.success) {
      return { success: true, message: data.message || '密码已更新' };
    }
    return {
      success: false,
      status: res.status,
      error: data.error || data.message || '修改密码失败',
      code: data.code,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: '请求超时，请稍后重试' };
    }
    return { success: false, error: '无法连接认证服务，请确认人生片段后端已运行' };
  }
}
