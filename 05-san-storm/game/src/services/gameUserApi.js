/**
 * 游戏账号 API（san-storm 后端 3005）
 *
 * 覆盖：
 *   - 玩家注册 / 登录 / 验证（写 `playerTokenManager`，后续 `httpClient` 自动附 Bearer）。
 *   - 管理员侧账号操作（封禁 / 解封 / 删除 / 一键清理 / 切服）——仅需主站 `notee-admin-token`；
 *     `httpClient` 对 `/auth/users` 等路径自动附管理员 JWT，**不需要**游戏玩家 Token。
 *
 * @module services/gameUserApi
 */

import { playerTokenManager, stripPlayerTokenFields } from '../utils/playerTokenManager';
import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

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
        if (data.data && data.data.token) {
          playerTokenManager.save({
            token: data.data.token,
            tokenExpiresAt: data.data.tokenExpiresAt,
          });
        }
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
        if (data.data && data.data.token) {
          playerTokenManager.save({
            token: data.data.token,
            tokenExpiresAt: data.data.tokenExpiresAt,
          });
        }
        localStorage.setItem('gameUser', JSON.stringify(stripPlayerTokenFields(data.data)));
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

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: data.error || '需要管理员权限，请在主站重新登录',
        };
      }

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

export default gameUserAPI;
