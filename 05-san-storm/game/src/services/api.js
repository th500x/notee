/**
 * 统一API服务层
 * 提供认证相关的API调用和数据加载
 */

import { tokenManager } from '../utils/tokenManager';
import { API_CONFIG } from '../constants';

/**
 * 带超时的fetch请求
 */
async function fetchWithTimeout(url, options = {}, timeout = API_CONFIG.TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw error;
  }
}

/**
 * GET 请求 - 用于加载数据文件
 */
export async function get(url, options = {}) {
  try {
    const response = await fetchWithTimeout(url, {
      ...options,
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[API] GET请求失败:', url, error);
    throw error;
  }
}

/**
 * 认证 API 服务
 */
export const authAPI = {
  /**
   * 管理员登录
   */
  login: async (password, project = 'san-storm-game') => {
    try {
      console.log('[AuthAPI] 管理员登录', { project });
      
      const response = await fetchWithTimeout(`${API_CONFIG.AUTH_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password, project })
      });
      
      const data = await response.json();
      
      if (data.success && data.token) {
        tokenManager.save(data.token);
        console.log('[AuthAPI] 登录成功');
        return { success: true, token: data.token };
      } else {
        console.warn('[AuthAPI] 登录失败', data.error);
        return { 
          success: false, 
          error: data.error || '登录失败' 
        };
      }
    } catch (error) {
      console.error('[AuthAPI] 登录请求失败', error);
      
      if (error.message.includes('超时')) {
        return { 
          success: false, 
          error: '登录请求超时，请检查网络连接' 
        };
      }
      
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  },
  
  /**
   * 登出
   */
  logout: () => {
    tokenManager.clear();
    console.log('[AuthAPI] 已登出');
  },
  
  /**
   * 检查是否已登录
   */
  isAuthenticated: () => {
    return tokenManager.isValid();
  }
};

/**
 * 游戏用户 API 服务
 */
export const gameUserAPI = {
  /**
   * 验证账号是否存在（轻量级，用于恢复登录状态时校验）
   */
  verifyUser: async (userId) => {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/verify/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[GameUserAPI] 验证账号失败', error);
      throw error;
    }
  },

  /**
   * 获取注册用候选 ID（服务端排除已占用；失败时前端可回退本地 generateIdOptions）
   * @param {number} count
   * @param {string[]} [excludeIds] 刷新时传入当前已展示 ID，避免重复
   */
  getRegisterCandidates: async (count = 5, excludeIds = []) => {
    try {
      const qs = new URLSearchParams();
      qs.set('count', String(count));
      if (excludeIds.length > 0) {
        qs.set('exclude', excludeIds.join(','));
      }
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/auth/register-candidates?${qs.toString()}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          console.warn('[GameUserAPI] 候选ID响应非 JSON', response.status);
          return { success: false, error: '获取候选ID失败' };
        }
      }
      if (data.success && data.data && Array.isArray(data.data.ids) && data.data.ids.length > 0) {
        return {
          success: true,
          ids: data.data.ids,
          partial: !!data.data.partial,
          source: 'server',
        };
      }
      return {
        success: false,
        error: data.error || '获取候选ID失败',
      };
    } catch (error) {
      console.error('[GameUserAPI] 获取候选ID请求失败', error);
      if (error.message && error.message.includes('超时')) {
        return { success: false, error: '请求超时' };
      }
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 用户注册
   */
  register: async (userData) => {
    try {
      console.log('[GameUserAPI] 用户注册', { id: userData.id });
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseErr) {
          console.warn('[GameUserAPI] 注册响应非 JSON', response.status, text.slice(0, 120));
          return {
            success: false,
            error: `注册失败（服务暂不可用，HTTP ${response.status}），请稍后重试`,
          };
        }
      }
      
      if (data.success) {
        console.log('[GameUserAPI] 注册成功');
        return { success: true, data: data.data };
      }
      console.warn('[GameUserAPI] 注册失败', data.error);
      return { 
        success: false, 
        error: data.error || data.message || '注册失败' 
      };
    } catch (error) {
      console.error('[GameUserAPI] 注册请求失败', error);
      
      if (error.message.includes('超时')) {
        return { 
          success: false, 
          error: '注册请求超时，请检查网络连接' 
        };
      }
      
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  },

  /**
   * 用户登录
   */
  login: async (id, password) => {
    try {
      console.log('[GameUserAPI] 用户登录', { id });
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[GameUserAPI] 登录成功');
        // 保存用户信息到localStorage
        localStorage.setItem('gameUser', JSON.stringify(data.data));
        return { success: true, data: data.data };
      } else {
        console.warn('[GameUserAPI] 登录失败', data.error);
        return { 
          success: false, 
          error: data.error || '登录失败' 
        };
      }
    } catch (error) {
      console.error('[GameUserAPI] 登录请求失败', error);
      
      if (error.message.includes('超时')) {
        return { 
          success: false, 
          error: '登录请求超时，请检查网络连接' 
        };
      }
      
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
        };
    }
  },

  /**
   * 找回账号 - 通过密码查找账号ID
   */
  recoverAccount: async (password) => {
    try {
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (data.success) {
        return { success: true, data: data.data };
      }
      return { success: false, error: data.error || '未找到匹配的账号' };
    } catch (error) {
      if (error.message.includes('超时')) {
        return { success: false, error: '请求超时，请检查网络连接' };
      }
      return { success: false, error: '网络错误，请检查后端服务是否运行' };
    }
  },

  /**
   * 获取所有用户列表（管理员功能）
   */
  getAllUsers: async () => {
    try {
      console.log('[GameUserAPI] 获取用户列表');
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[GameUserAPI] 获取用户列表成功', data.total);
        return { success: true, data: data.data, total: data.total };
      } else {
        console.warn('[GameUserAPI] 获取用户列表失败', data.error);
        return { 
          success: false, 
          error: data.error || '获取用户列表失败' 
        };
      }
    } catch (error) {
      console.error('[GameUserAPI] 获取用户列表请求失败', error);
      
      if (error.message.includes('超时')) {
        return { 
          success: false, 
          error: '请求超时，请检查网络连接' 
        };
      }
      
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  },

  /**
   * 封禁用户（管理员功能）
   */
  banUser: async (userId, reason, duration) => {
    try {
      console.log('[GameUserAPI] 封禁用户', { userId });
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, reason, duration })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[GameUserAPI] 封禁成功');
        return { success: true };
      } else {
        console.warn('[GameUserAPI] 封禁失败', data.error);
        return { 
          success: false, 
          error: data.error || '封禁失败' 
        };
      }
    } catch (error) {
      console.error('[GameUserAPI] 封禁请求失败', error);
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  },

  /**
   * 解封用户（管理员功能）
   */
  unbanUser: async (userId) => {
    try {
      console.log('[GameUserAPI] 解封用户', { userId });
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/unban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[GameUserAPI] 解封成功');
        return { success: true };
      } else {
        console.warn('[GameUserAPI] 解封失败', data.error);
        return { 
          success: false, 
          error: data.error || '解封失败' 
        };
      }
    } catch (error) {
      console.error('[GameUserAPI] 解封请求失败', error);
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  },

  /**
   * 删除用户（管理员功能）
   */
  deleteUser: async (userId) => {
    try {
      console.log('[GameUserAPI] 删除用户', { userId });
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/user/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[GameUserAPI] 删除成功');
        return { success: true };
      } else {
        console.warn('[GameUserAPI] 删除失败', data.error);
        return { 
          success: false, 
          error: data.error || '删除失败' 
        };
      }
    } catch (error) {
      console.error('[GameUserAPI] 删除请求失败', error);
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  },

  /**
   * 清除用户游戏数据（管理员功能，保留账号）
   */
  clearUserData: async (userId) => {
    try {
      console.log('[GameUserAPI] 清除用户游戏数据', { userId });
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/user/${userId}/game-data`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[GameUserAPI] 清除成功', data.deletedCounts);
        return { success: true, deletedCounts: data.deletedCounts };
      } else {
        console.warn('[GameUserAPI] 清除失败', data.error);
        return { 
          success: false, 
          error: data.error || '清除失败' 
        };
      }
    } catch (error) {
      console.error('[GameUserAPI] 清除请求失败', error);
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  },

  /**
   * 一键封禁：最后游戏活跃超过指定天数的账号（管理员功能）
   * @param {{ days?: number, reason?: string }} opts
   */
  banInactiveUsers: async (opts = {}) => {
    try {
      const days = opts.days != null ? opts.days : 14;
      const reason = opts.reason;
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/users/ban-inactive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, reason }),
      });
      const data = await response.json();
      if (data.success) {
        return {
          success: true,
          bannedCount: data.bannedCount ?? 0,
          userIds: data.userIds || [],
        };
      }
      return { success: false, error: data.error || '操作失败' };
    } catch (error) {
      console.error('[GameUserAPI] banInactiveUsers 失败', error);
      return { success: false, error: '网络错误，请检查后端服务是否运行' };
    }
  },

  /**
   * 一键删除所有banned账号（管理员功能）
   */
  deleteBannedUsers: async () => {
    try {
      console.log('[GameUserAPI] 一键删除封禁账号');
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/users/banned`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[GameUserAPI] 删除封禁账号成功', data.deletedCount);
        return { success: true, deletedCount: data.deletedCount, message: data.message };
      } else {
        console.warn('[GameUserAPI] 删除封禁账号失败', data.error);
        return { success: false, error: data.error || '操作失败' };
      }
    } catch (error) {
      console.error('[GameUserAPI] 删除封禁账号请求失败', error);
      return { success: false, error: '网络错误，请检查后端服务是否运行' };
    }
  },

  /**
   * 一键清除所有用户的玩家数据（管理员功能）
   */
  purgeAllUsers: async () => {
    try {
      console.log('[GameUserAPI] 一键清除所有玩家数据');
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/users/purge-all`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[GameUserAPI] 一键清除成功');
        return { success: true, deletedCounts: data.deletedCounts, nullifiedCounts: data.nullifiedCounts };
      } else {
        console.warn('[GameUserAPI] 一键清除失败', data.error);
        return { success: false, error: data.error || '操作失败' };
      }
    } catch (error) {
      console.error('[GameUserAPI] 一键清除请求失败', error);
      return { success: false, error: '网络错误，请检查后端服务是否运行' };
    }
  },

  /**
   * 切换服务器（清除当前赛季数据）
   */
  switchServer: async (userId, newServerId) => {
    try {
      console.log('[GameUserAPI] 切换服务器', { userId, newServerId });
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/auth/switch-server`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, newServerId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[GameUserAPI] 切换服务器成功');
        return { success: true, data: data.data };
      } else {
        console.warn('[GameUserAPI] 切换服务器失败', data.error);
        return { 
          success: false, 
          error: data.error || '切换服务器失败' 
        };
      }
    } catch (error) {
      console.error('[GameUserAPI] 切换服务器请求失败', error);
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  }
};

/**
 * 服务器 API 服务
 */
export const serversAPI = {
  /**
   * 获取服务器列表
   */
  getServers: async () => {
    try {
      console.log('[ServersAPI] 获取服务器列表');
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/servers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[ServersAPI] 获取服务器列表成功', data.total);
        return { success: true, data: data.data, total: data.total };
      } else {
        console.warn('[ServersAPI] 获取服务器列表失败', data.error);
        return { 
          success: false, 
          error: data.error || '获取服务器列表失败' 
        };
      }
    } catch (error) {
      console.error('[ServersAPI] 获取服务器列表请求失败', error);
      
      if (error.message.includes('超时')) {
        return { 
          success: false, 
          error: '请求超时，请检查网络连接' 
        };
      }
      
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  },

  /**
   * 获取服务器详情
   */
  getServerDetail: async (serverId) => {
    try {
      console.log('[ServersAPI] 获取服务器详情', { serverId });
      
      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/servers/${serverId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('[ServersAPI] 获取服务器详情成功');
        return { success: true, data: data.data };
      } else {
        console.warn('[ServersAPI] 获取服务器详情失败', data.error);
        return { 
          success: false, 
          error: data.error || '获取服务器详情失败' 
        };
      }
    } catch (error) {
      console.error('[ServersAPI] 获取服务器详情请求失败', error);
      
      if (error.message.includes('超时')) {
        return { 
          success: false, 
          error: '请求超时，请检查网络连接' 
        };
      }
      
      return { 
        success: false, 
        error: '网络错误，请检查后端服务是否运行' 
      };
    }
  }
};

/**
 * 排行榜 API 服务
 */
export const rankingsAPI = {
  /**
   * 获取活动排行榜
   * @param {string} eventId - 活动ID（公告ID）
   * @param {object} options - { limit, playerId }
   */
  getRankings: async (eventId, { limit = 10, playerId = null } = {}) => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (playerId) params.set('playerId', playerId);

      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/rankings/${eventId}?${params}`,
        { method: 'GET' }
      );

      const data = await response.json();

      if (data.success) {
        return { success: true, data: data.data };
      } else {
        return { success: false, error: data.error || '获取排行榜失败' };
      }
    } catch (error) {
      console.error('[RankingsAPI] 获取排行榜失败', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 常驻 · 总体排名（27-2）
   * @param {{ limit?: number, playerId?: string, serverId?: string }} options
   */
  getOverall: async ({ limit = 30, playerId = null, serverId = null, sort = null } = {}) => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (playerId) params.set('playerId', playerId);
      if (serverId) params.set('serverId', serverId);
      if (sort) params.set('sort', String(sort));
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/rankings/overall?${params}`,
        { method: 'GET' }
      );
      const data = await response.json();
      if (data.success) return { success: true, data: data.data };
      return { success: false, error: data.error || '获取总体排行失败' };
    } catch (error) {
      console.error('[RankingsAPI] overall', error);
      return { success: false, error: '网络错误' };
    }
  },

  /**
   * 常驻 · 战役最高分（27-2）
   * @param {{ campaignId: string, limit?: number, playerId?: string, serverId?: string }} options
   */
  getCampaign: async ({ campaignId, limit = 30, playerId = null, serverId = null }) => {
    try {
      const params = new URLSearchParams({
        campaignId: String(campaignId),
        limit: String(limit),
      });
      if (playerId) params.set('playerId', playerId);
      if (serverId) params.set('serverId', serverId);
      const response = await fetchWithTimeout(
        `${API_CONFIG.BASE_URL}/rankings/campaign?${params}`,
        { method: 'GET' }
      );
      const data = await response.json();
      if (data.success) return { success: true, data: data.data };
      return { success: false, error: data.error || '获取战役排行失败' };
    } catch (error) {
      console.error('[RankingsAPI] campaign', error);
      return { success: false, error: '网络错误' };
    }
  },
};

/**
 * 管理员：传书模板 config_texts（游戏后端 3005）
 */
export const adminConfigTextsAPI = {
  list: async (params = {}) => {
    const q = new URLSearchParams();
    if (params.enabledOnly) q.set('enabledOnly', '1');
    const url = `${API_CONFIG.BASE_URL}/admin/config-texts${q.toString() ? `?${q}` : ''}`;
    const response = await fetchWithTimeout(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    if (data.success) return { success: true, data: data.data, total: data.total };
    return { success: false, error: data.error || '加载模板失败' };
  },

  get: async (templateId) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts/${encodeURIComponent(templateId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) return { success: true, data: data.data };
    return { success: false, error: data.error || '获取模板失败' };
  },

  create: async (body) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (response.ok && data.success) return { success: true, data: data.data };
    return { success: false, error: data.error || '创建失败' };
  },

  update: async (templateId, body) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts/${encodeURIComponent(templateId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (data.success) return { success: true, data: data.data };
    return { success: false, error: data.error || '更新失败' };
  },

  remove: async (templateId) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) return { success: true };
    return { success: false, error: data.error || '删除失败' };
  },

  trialSend: async (payload) => {
    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/admin/config-texts/trial-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) return { success: true, data: data.data };
    return { success: false, error: data.error || '试发失败' };
  }
};
