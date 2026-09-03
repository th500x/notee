/**
 * 服务器列表 API（san-storm 后端 3005，公开数据）
 *
 * 服务器目录由后端 `routes/servers.js` 维护；前端选服 / 切服时调用。
 *
 * @module services/serversApi
 */

import { API_CONFIG } from '../constants';
import { fetchWithTimeout } from './httpClient';

const devLog = (...args) => {
  if (import.meta.env.DEV) console.log(...args);
};

const devWarn = (...args) => {
  if (import.meta.env.DEV) console.warn(...args);
};

export const serversAPI = {
  getServers: async () => {
    try {
      devLog('[ServersAPI] 获取服务器列表');

      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/servers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        devLog('[ServersAPI] 获取服务器列表成功', data.total);
        return { success: true, data: data.data, total: data.total };
      } else {
        devWarn('[ServersAPI] 获取服务器列表失败', data.error);
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

  getServerDetail: async (serverId) => {
    try {
      devLog('[ServersAPI] 获取服务器详情', { serverId });

      const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}/servers/${serverId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        devLog('[ServersAPI] 获取服务器详情成功');
        return { success: true, data: data.data };
      } else {
        devWarn('[ServersAPI] 获取服务器详情失败', data.error);
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

export default serversAPI;
