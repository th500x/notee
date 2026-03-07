/**
 * 数据服务
 * 
 * @description 封装所有数据加载逻辑
 * @module services/dataService
 */

import { get } from './api';
import { dataConfig } from '@/config';

// 数据缓存
const cache = new Map();

/**
 * 获取缓存键
 * @param {string} resource - 资源名称
 * @param {string} season - 赛季标识（可选）
 * @returns {string} 缓存键
 * @throws {TypeError} 当resource不是字符串时
 */
function getCacheKey(resource, season = null) {
  if (typeof resource !== 'string' || !resource) {
    throw new TypeError('Resource must be a non-empty string');
  }
  if (season !== null && (typeof season !== 'string' || !season)) {
    throw new TypeError('Season must be null or a non-empty string');
  }
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
 * @returns {Promise<any>} 数据
 * @throws {TypeError} 当resource不是字符串或为空时
 * @throws {Error} 当数据加载失败时
 */
export async function loadSharedData(resource) {
  // 输入验证
  if (!resource || typeof resource !== 'string') {
    throw new TypeError('Resource name must be a non-empty string');
  }
  
  const cacheKey = getCacheKey(resource);
  
  // 检查缓存
  if (isCacheValid(cacheKey)) {
    return getCache(cacheKey);
  }
  
  try {
    // 加载数据
    const url = `${dataConfig.basePath}data/shared/${resource}.json`;
    const data = await get(url);
    
    // 验证数据
    if (data === null || data === undefined) {
      throw new Error(`No data returned for resource: ${resource}`);
    }
    
    // 缓存数据
    setCache(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error(`[DataService] Failed to load shared data: ${resource}`, error);
    throw new Error(`Failed to load ${resource}: ${error.message}`);
  }
}

/**
 * 加载赛季数据
 * @param {string} season - 赛季标识（如：san_1）
 * @param {string} resource - 资源名称（如：factions, servers）
 * @returns {Promise<any>} 数据
 * @throws {TypeError} 当参数不是字符串或为空时
 * @throws {Error} 当数据加载失败时
 */
export async function loadSeasonData(season, resource) {
  // 输入验证
  if (!season || typeof season !== 'string') {
    throw new TypeError('Season must be a non-empty string');
  }
  if (!resource || typeof resource !== 'string') {
    throw new TypeError('Resource name must be a non-empty string');
  }
  
  const cacheKey = getCacheKey(resource, season);
  
  // 检查缓存
  if (isCacheValid(cacheKey)) {
    return getCache(cacheKey);
  }
  
  try {
    // 加载数据
    const url = `${dataConfig.basePath}data/seasons/${season}/${resource}.json`;
    const data = await get(url);
    
    // 验证数据
    if (data === null || data === undefined) {
      throw new Error(`No data returned for season: ${season}, resource: ${resource}`);
    }
    
    // 缓存数据
    setCache(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error(`[DataService] Failed to load season data: ${season}/${resource}`, error);
    throw new Error(`Failed to load ${season}/${resource}: ${error.message}`);
  }
}

/**
 * 批量加载共享数据
 * @param {string[]} resources - 资源名称数组
 * @returns {Promise<Object>} 数据对象，键为资源名称
 * @throws {TypeError} 当resources不是数组或包含非字符串元素时
 * @throws {Error} 当任何数据加载失败时
 */
export async function loadMultipleSharedData(resources) {
  // 输入验证
  if (!Array.isArray(resources)) {
    throw new TypeError('Resources must be an array');
  }
  if (resources.length === 0) {
    return {};
  }
  if (!resources.every(r => typeof r === 'string' && r.length > 0)) {
    throw new TypeError('All resources must be non-empty strings');
  }
  
  try {
    const promises = resources.map(resource => 
      loadSharedData(resource)
        .then(data => ({ resource, data, success: true }))
        .catch(error => ({ resource, error, success: false }))
    );
    
    const results = await Promise.all(promises);
    
    // 检查是否有失败的请求
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.warn('[DataService] Some resources failed to load:', failures);
    }
    
    // 只返回成功加载的数据
    return results
      .filter(r => r.success)
      .reduce((acc, { resource, data }) => {
        acc[resource] = data;
        return acc;
      }, {});
  } catch (error) {
    console.error('[DataService] Failed to load multiple shared data', error);
    throw new Error(`Failed to load multiple resources: ${error.message}`);
  }
}

/**
 * 批量加载赛季数据
 * @param {string} season - 赛季标识
 * @param {string[]} resources - 资源名称数组
 * @returns {Promise<Object>} 数据对象，键为资源名称
 * @throws {TypeError} 当参数类型不正确时
 * @throws {Error} 当任何数据加载失败时
 */
export async function loadMultipleSeasonData(season, resources) {
  // 输入验证
  if (!season || typeof season !== 'string') {
    throw new TypeError('Season must be a non-empty string');
  }
  if (!Array.isArray(resources)) {
    throw new TypeError('Resources must be an array');
  }
  if (resources.length === 0) {
    return {};
  }
  if (!resources.every(r => typeof r === 'string' && r.length > 0)) {
    throw new TypeError('All resources must be non-empty strings');
  }
  
  try {
    const promises = resources.map(resource => 
      loadSeasonData(season, resource)
        .then(data => ({ resource, data, success: true }))
        .catch(error => ({ resource, error, success: false }))
    );
    
    const results = await Promise.all(promises);
    
    // 检查是否有失败的请求
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.warn(`[DataService] Some season resources failed to load for ${season}:`, failures);
    }
    
    // 只返回成功加载的数据
    return results
      .filter(r => r.success)
      .reduce((acc, { resource, data }) => {
        acc[resource] = data;
        return acc;
      }, {});
  } catch (error) {
    console.error(`[DataService] Failed to load multiple season data for ${season}`, error);
    throw new Error(`Failed to load multiple resources for ${season}: ${error.message}`);
  }
}

// 默认导出
export default {
  loadSharedData,
  loadSeasonData,
  loadMultipleSharedData,
  loadMultipleSeasonData,
  clearCache,
};
