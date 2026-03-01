import { CACHE_CONSTANTS } from '../constants'

/**
 * 简单的内存缓存工具
 * 用于缓存API响应数据，减少重复请求
 * 
 * @class SimpleCache
 * @example
 * const cache = new SimpleCache(50, 5 * 60 * 1000)
 * cache.set('key', 'value')
 * const value = cache.get('key')
 */
class SimpleCache {
  /**
   * 创建缓存实例
   * @param {number} maxSize - 最大缓存项数，默认50
   * @param {number} defaultTTL - 默认过期时间（毫秒），默认5分钟
   */
  constructor(maxSize = CACHE_CONSTANTS.MAX_SIZE, defaultTTL = CACHE_CONSTANTS.DURATION) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
  }
  
  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间（毫秒），默认使用defaultTTL
   * @throws {TypeError} 如果参数类型不正确
   */
  set(key, value, ttl = this.defaultTTL) {
    // 参数验证
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('Cache key must be a non-empty string')
    }
    
    if (typeof ttl !== 'number' || ttl < 0 || !isFinite(ttl)) {
      throw new TypeError('TTL must be a non-negative finite number')
    }
    
    // 如果超过最大容量，删除最旧的项（FIFO策略）
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    })
  }
  
  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {any|null} 缓存值，如果不存在或已过期返回null
   * @throws {TypeError} 如果key不是字符串
   */
  get(key) {
    if (typeof key !== 'string') {
      throw new TypeError('Cache key must be a string')
    }
    
    const item = this.cache.get(key)
    if (!item) return null
    
    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return item.value
  }
  
  /**
   * 检查缓存是否存在且有效
   * @param {string} key - 缓存键
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null
  }
  
  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    this.cache.delete(key)
  }
  
  /**
   * 清空所有缓存
   */
  clear() {
    this.cache.clear()
  }
  
  /**
   * 获取缓存大小
   * @returns {number}
   */
  size() {
    return this.cache.size
  }
}

export default SimpleCache
