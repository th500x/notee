/**
 * 数据服务
 * 
 * @description 封装所有数据加载逻辑
 * @module services/dataService
 */

import { get } from './api';
import { dataConfig, apiConfig } from '@/config';

// 数据缓存
const cache = new Map();

/**
 * 获取缓存键
 * @param {string} resource - 资源名称
 * @param {string} season - 赛季标识（可选）
 * @returns {string} 缓存键
 */
function getCacheKey(resource, season = null) {
  return season ? `${season}:${resource}` : resource;
}

/**
 * 检查缓存是否有效
 * @param {string} key - 缓存键
 * @returns {boolean} 是否有效
 */
function isCacheValid(key) {
  if (!dataConfig.cacheEnabled) {
    return false;
  }
  
  const cached = cache.get(key);
  if (!cached) {
    return false;
  }
  
  const now = Date.now();
  return now - cached.timestamp < dataConfig.cacheDuration;
}

/**
 * 获取缓存数据
 * @param {string} key - 缓存键
 * @returns {any} 缓存的数据
 */
function getCache(key) {
  const cached = cache.get(key);
  return cached ? cached.data : null;
}

/**
 * 设置缓存数据
 * @param {string} key - 缓存键
 * @param {any} data - 数据
 */
function setCache(key, data) {
  if (dataConfig.cacheEnabled) {
    cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
}

/**
 * 清除缓存
 * @param {string} key - 缓存键（可选，不传则清除所有）
 */
export function clearCache(key = null) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/**
 * 加载共享数据
 * @param {string} resource - 资源名称（如：characters, troops）
 * @param {Object} options - 加载选项
 * @param {string} options.season - 赛季过滤（可选）
 * @returns {Promise<any>} 数据
 */
export async function loadSharedData(resource, options = {}) {
  const { season = null } = options;
  const cacheKey = getCacheKey(resource, season);
  
  // 检查缓存
  if (isCacheValid(cacheKey)) {
    return getCache(cacheKey);
  }
  
  let data;
  
  // 部队和将领数据从API加载
  if (resource === 'troops') {
    const apiUrl = `${apiConfig.baseUrl}/api/config/troops${season ? `?season=${season}` : ''}`;
    const response = await get(apiUrl);
    
    if (!response.success) {
      throw new Error(response.message || 'API加载失败');
    }
    
    data = { troops: response.troops };
  } else if (resource === 'characters') {
    const apiUrl = `${apiConfig.baseUrl}/api/config/characters${season ? `?season=${season}` : ''}`;
    const response = await get(apiUrl);
    
    if (!response.success) {
      throw new Error(response.message || 'API加载失败');
    }
    
    data = { characters: response.characters };
  } else {
    // 其他数据从JSON文件加载
    const url = `${dataConfig.basePath}data/shared/${resource}.json`;
    data = await get(url);
  }
  
  // 缓存数据
  setCache(cacheKey, data);
  
  return data;
}

/**
 * 加载赛季数据
 * @param {string} season - 赛季标识（如：s1）
 * @param {string} resource - 资源名称（如：factions, servers）
 * @returns {Promise<any>} 数据
 */
export async function loadSeasonData(season, resource) {
  const cacheKey = getCacheKey(resource, season);
  
  // 检查缓存
  if (isCacheValid(cacheKey)) {
    return getCache(cacheKey);
  }
  
  // 加载数据
  const url = `${dataConfig.basePath}data/seasons/${season}/${resource}.json`;
  const data = await get(url);
  
  // 缓存数据
  setCache(cacheKey, data);
  
  return data;
}

/**
 * 批量加载共享数据
 * @param {string[]} resources - 资源名称数组
 * @returns {Promise<Object>} 数据对象，键为资源名称
 */
export async function loadMultipleSharedData(resources) {
  const promises = resources.map(resource => 
    loadSharedData(resource).then(data => ({ resource, data }))
  );
  
  const results = await Promise.all(promises);
  
  return results.reduce((acc, { resource, data }) => {
    acc[resource] = data;
    return acc;
  }, {});
}

/**
 * 批量加载赛季数据
 * @param {string} season - 赛季标识
 * @param {string[]} resources - 资源名称数组
 * @returns {Promise<Object>} 数据对象，键为资源名称
 */
export async function loadMultipleSeasonData(season, resources) {
  const promises = resources.map(resource => 
    loadSeasonData(season, resource).then(data => ({ resource, data }))
  );
  
  const results = await Promise.all(promises);
  
  return results.reduce((acc, { resource, data }) => {
    acc[resource] = data;
    return acc;
  }, {});
}

// 默认导出
export default {
  loadSharedData,
  loadSeasonData,
  loadMultipleSharedData,
  loadMultipleSeasonData,
  clearCache,
};
