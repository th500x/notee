/**
 * 数据加载器
 * 
 * @description 负责从JSON文件加载数据，并提供缓存机制
 * @module utils/dataLoader
 */

import { DATA_PATHS } from './constants.js';

// 缓存对象
const cache = new Map();

/**
 * 加载共享数据
 * 
 * @param {string} resource - 资源名称（characters/positions/troops/skills）
 * @returns {Promise<Object>} 数据对象
 * @throws {Error} 加载失败时抛出错误
 * 
 * @example
 * const characters = await loadSharedData('characters');
 */
export async function loadSharedData(resource) {
  const cacheKey = `shared_${resource}`;
  
  // 检查缓存
  if (cache.has(cacheKey)) {
    console.log(`[DataLoader] 从缓存加载: ${cacheKey}`);
    return cache.get(cacheKey);
  }
  
  try {
    console.log(`[DataLoader] 加载数据: ${resource}`);
    const path = DATA_PATHS[resource.toUpperCase()];
    const response = await fetch(path);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 存入缓存
    cache.set(cacheKey, data);
    console.log(`[DataLoader] 加载成功: ${cacheKey}, 数据量: ${JSON.stringify(data).length} bytes`);
    
    return data;
  } catch (error) {
    console.error(`[DataLoader] 加载失败: ${resource}`, error);
    throw new Error(`加载${resource}数据失败: ${error.message}`);
  }
}

/**
 * 加载赛季数据
 * 
 * @param {string} season - 赛季标识（s1/s2/s3）
 * @param {string} resource - 资源名称（factions/servers/events）
 * @returns {Promise<Object>} 数据对象
 * @throws {Error} 加载失败时抛出错误
 * 
 * @example
 * const factions = await loadSeasonData('s1', 'factions');
 */
export async function loadSeasonData(season, resource) {
  const cacheKey = `${season}_${resource}`;
  
  // 检查缓存
  if (cache.has(cacheKey)) {
    console.log(`[DataLoader] 从缓存加载: ${cacheKey}`);
    return cache.get(cacheKey);
  }
  
  try {
    console.log(`[DataLoader] 加载赛季数据: ${season}/${resource}`);
    const path = DATA_PATHS[resource.toUpperCase()](season);
    const response = await fetch(path);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 存入缓存
    cache.set(cacheKey, data);
    console.log(`[DataLoader] 加载成功: ${cacheKey}, 数据量: ${JSON.stringify(data).length} bytes`);
    
    return data;
  } catch (error) {
    console.error(`[DataLoader] 加载失败: ${season}/${resource}`, error);
    throw new Error(`加载${season}/${resource}数据失败: ${error.message}`);
  }
}

/**
 * 清除缓存
 * 
 * @param {string} [key] - 缓存键（可选，不传则清除全部）
 * 
 * @example
 * clearCache('shared_characters'); // 清除指定缓存
 * clearCache(); // 清除全部缓存
 */
export function clearCache(key) {
  if (key) {
    cache.delete(key);
    console.log(`[DataLoader] 清除缓存: ${key}`);
  } else {
    cache.clear();
    console.log('[DataLoader] 清除全部缓存');
  }
}

/**
 * 获取缓存状态
 * 
 * @returns {Object} 缓存状态信息
 */
export function getCacheStatus() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
