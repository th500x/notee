/**
 * API 服务
 * 
 * @description 封装所有 API 调用，提供统一的错误处理和重试机制
 * @module services/api
 */

import { apiConfig } from '@/config';

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * 通用 API 调用函数
 * @param {string} url - API 端点
 * @param {Object} options - fetch 选项
 * @returns {Promise<any>} API 响应数据
 */
export async function apiCall(url, options = {}) {
  const { timeout = apiConfig.timeout, ...fetchOptions } = options;
  
  // 创建超时控制器
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData
      );
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new ApiError('请求超时', 408, { timeout });
    }
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      error.message || '网络请求失败',
      0,
      { originalError: error }
    );
  }
}

/**
 * GET 请求
 * @param {string} url - API 端点
 * @param {Object} options - 请求选项
 * @returns {Promise<any>} API 响应数据
 */
export async function get(url, options = {}) {
  // 添加缓存破坏参数（仅用于静态JSON文件）
  const cacheBuster = url.includes('.json') ? `?_t=${Date.now()}` : '';
  
  return apiCall(url + cacheBuster, {
    ...options,
    method: 'GET',
  });
}

/**
 * POST 请求
 * @param {string} url - API 端点
 * @param {Object} data - 请求数据
 * @param {Object} options - 请求选项
 * @returns {Promise<any>} API 响应数据
 */
export async function post(url, data, options = {}) {
  return apiCall(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  });
}

/**
 * PUT 请求
 * @param {string} url - API 端点
 * @param {Object} data - 请求数据
 * @param {Object} options - 请求选项
 * @returns {Promise<any>} API 响应数据
 */
export async function put(url, data, options = {}) {
  return apiCall(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  });
}

/**
 * DELETE 请求
 * @param {string} url - API 端点
 * @param {Object} options - 请求选项
 * @returns {Promise<any>} API 响应数据
 */
export async function del(url, options = {}) {
  return apiCall(url, {
    ...options,
    method: 'DELETE',
  });
}

// 默认导出
export default {
  get,
  post,
  put,
  delete: del,
  apiCall,
};
