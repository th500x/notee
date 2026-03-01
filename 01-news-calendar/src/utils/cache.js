/**
 * 简单的内存缓存工具
 * 用于缓存API响应数据，减少重复请求
 */
class SimpleCache {
  constructor(maxSize = 50, defaultTTL = 5 * 60 * 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL // 默认5分钟过期
  }
  
  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间（毫秒），默认使用defaultTTL
   */
  set(key, value, ttl = this.defaultTTL) {
    // 如果超过最大容量，删除最旧的项
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
   */
  get(key) {
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
