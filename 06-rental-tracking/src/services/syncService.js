/**
 * 数据同步服务
 * 处理本地和生产环境之间的数据同步
 */

import { config } from '../config'

export const syncService = {
  /**
   * 从本地导出数据
   * @returns {Promise<Object>} 导出的数据
   */
  exportLocal: async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/sync/export`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '导出失败')
      }
      
      return result.data
    } catch (error) {
      console.error('[SyncService] 导出本地数据失败:', error)
      throw error
    }
  },

  /**
   * 导入数据到本地
   * @param {Object} data - 要导入的数据
   * @param {string} mode - 导入模式 ('merge' | 'replace')
   * @returns {Promise<Object>} 导入结果
   */
  importLocal: async (data, mode = 'merge') => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/sync/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data, mode })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '导入失败')
      }
      
      return result
    } catch (error) {
      console.error('[SyncService] 导入数据失败:', error)
      throw error
    }
  },

  /**
   * 获取本地数据统计
   * @returns {Promise<Object>} 统计信息
   */
  getLocalStats: async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/sync/stats`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '获取统计失败')
      }
      
      return result.stats
    } catch (error) {
      console.error('[SyncService] 获取统计失败:', error)
      throw error
    }
  },

  /**
   * 从生产环境导出数据
   * @param {string} productionUrl - 生产环境地址
   * @returns {Promise<Object>} 导出的数据
   */
  exportProduction: async (productionUrl) => {
    try {
      const response = await fetch(`${productionUrl}/api/sync/export`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '导出失败')
      }
      
      return result.data
    } catch (error) {
      console.error('[SyncService] 从生产环境导出数据失败:', error)
      throw error
    }
  },

  /**
   * 导入数据到生产环境
   * @param {string} productionUrl - 生产环境地址
   * @param {Object} data - 要导入的数据
   * @param {string} mode - 导入模式 ('merge' | 'replace')
   * @returns {Promise<Object>} 导入结果
   */
  importProduction: async (productionUrl, data, mode = 'merge') => {
    try {
      const response = await fetch(`${productionUrl}/api/sync/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data, mode })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '导入失败')
      }
      
      return result
    } catch (error) {
      console.error('[SyncService] 导入到生产环境失败:', error)
      throw error
    }
  },

  /**
   * 获取生产环境数据统计
   * @param {string} productionUrl - 生产环境地址
   * @returns {Promise<Object>} 统计信息
   */
  getProductionStats: async (productionUrl) => {
    try {
      const response = await fetch(`${productionUrl}/api/sync/stats`)
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '获取统计失败')
      }
      
      return result.stats
    } catch (error) {
      console.error('[SyncService] 获取生产环境统计失败:', error)
      throw error
    }
  },

  /**
   * 同步到生产环境（本地 → 生产）
   * @param {string} productionUrl - 生产环境地址
   * @param {string} mode - 同步模式 ('merge' | 'replace')
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} 同步结果
   */
  syncToProduction: async (productionUrl, mode = 'merge', onProgress) => {
    try {
      // 1. 导出本地数据
      onProgress?.({ step: 1, message: '正在导出本地数据...' })
      const localData = await syncService.exportLocal()
      
      // 2. 导入到生产环境
      onProgress?.({ step: 2, message: '正在上传到生产环境...' })
      const result = await syncService.importProduction(productionUrl, localData, mode)
      
      onProgress?.({ step: 3, message: '同步完成！' })
      return result
    } catch (error) {
      console.error('[SyncService] 同步到生产环境失败:', error)
      throw error
    }
  },

  /**
   * 从生产环境同步（生产 → 本地）
   * @param {string} productionUrl - 生产环境地址
   * @param {string} mode - 同步模式 ('merge' | 'replace')
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} 同步结果
   */
  syncFromProduction: async (productionUrl, mode = 'merge', onProgress) => {
    try {
      // 1. 从生产环境导出数据
      onProgress?.({ step: 1, message: '正在从生产环境下载数据...' })
      const productionData = await syncService.exportProduction(productionUrl)
      
      // 2. 导入到本地
      onProgress?.({ step: 2, message: '正在导入到本地...' })
      const result = await syncService.importLocal(productionData, mode)
      
      onProgress?.({ step: 3, message: '同步完成！' })
      return result
    } catch (error) {
      console.error('[SyncService] 从生产环境同步失败:', error)
      throw error
    }
  },

  /**
   * 下载数据为 JSON 文件
   * @param {Object} data - 要下载的数据
   * @param {string} filename - 文件名
   */
  downloadAsJson: (data, filename = 'rental-tracking-backup.json') => {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
