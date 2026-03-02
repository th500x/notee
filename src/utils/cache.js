/**
 * LRU缓存实现（增强版）
 * 最近最少使用（Least Recently Used）缓存
 * 支持智能失效和模式匹配
 */
class LRUCache {
  /**
   * @param {number} maxSize - 最大缓存数量
   * @param {number} defaultTTL - 默认过期时间（毫秒）
   */
  constructor(maxSize = 50, defaultTTL = 5 * 60 * 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    }
  }
  
  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间（毫秒），默认使用defaultTTL
   */
  set(key, value, ttl = this.defaultTTL) {
    // 如果已存在，先删除（更新顺序）
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    
    // 如果超过最大容量，删除最旧的
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    })
    
    this.stats.sets++
  }
  
  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {any|null} 缓存值，如果不存在或已过期返回null
   */
  get(key) {
    const item = this.cache.get(key)
    if (!item) {
      this.stats.misses++
      return null
    }
    
    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }
    
    // 更新访问顺序（LRU）
    this.cache.delete(key)
    this.cache.set(key, item)
    
    this.stats.hits++
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
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.stats.deletes++
    }
    return deleted
  }
  
  /**
   * 智能失效：根据模式匹配删除缓存
   * @param {string|RegExp} pattern - 匹配模式（字符串或正则表达式）
   * @returns {number} 删除的缓存数量
   * 
   * @example
   * // 删除所有general模块的缓存
   * cache.invalidate('messages_general')
   * 
   * // 使用正则表达式
   * cache.invalidate(/^messages_general_/)
   */
  invalidate(pattern) {
    let count = 0
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)
    
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key)
        count++
      }
    }
    
    this.stats.deletes += count
    return count
  }
  
  /**
   * 清空所有缓存
   */
  clear() {
    const size = this.cache.size
    this.cache.clear()
    this.stats.deletes += size
  }
  
  /**
   * 获取缓存大小
   * @returns {number}
   */
  size() {
    return this.cache.size
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0
    
    return {
      ...this.stats,
      total,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.maxSize
    }
  }
  
  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    }
  }
  
  /**
   * 清理过期缓存
   * @returns {number} 清理的缓存数量
   */
  cleanup() {
    let count = 0
    const now = Date.now()
    
    for (const [key, item] of this.cache) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
        count++
      }
    }
    
    return count
  }
}

export default LRUCache
