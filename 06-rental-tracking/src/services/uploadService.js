/**
 * 上传服务
 * 封装所有与文件上传相关的API调用
 */

import { config } from '../config'

/**
 * 上传服务对象
 */
export const uploadService = {
  /**
   * 上传照片到OSS
   * @param {File} file - 要上传的文件
   * @returns {Promise<Object>} 上传结果 { success, url, photoId }
   */
  uploadPhoto: async (file) => {
    // 验证文件大小
    if (file.size > config.oss.maxFileSize) {
      throw new Error(`文件大小不能超过 ${config.oss.maxFileSize / 1024 / 1024}MB`)
    }
    
    // 验证文件类型
    if (!config.oss.allowedTypes.includes(file.type)) {
      throw new Error('只支持 JPG、PNG 格式的图片')
    }
    
    const formData = new FormData()
    formData.append('photo', file)
    
    try {
      const response = await fetch(
        `${config.api.uploadBaseUrl}${config.api.uploadPrefix}/photos`,
        {
          method: 'POST',
          body: formData
        }
      )
      
      if (!response.ok) {
        throw new Error('上传失败')
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || '上传失败')
      }
      
      return data
    } catch (error) {
      console.error('[UploadService] 上传照片失败:', error)
      throw error
    }
  },
  
  /**
   * 删除OSS上的照片
   * @param {string} photoId - 照片ID
   * @returns {Promise<Object>} 删除结果 { success }
   */
  deletePhoto: async (photoId) => {
    try {
      const response = await fetch(
        `${config.api.uploadBaseUrl}${config.api.uploadPrefix}/photos/${photoId}`,
        {
          method: 'DELETE'
        }
      )
      
      if (!response.ok) {
        throw new Error('删除失败')
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || '删除失败')
      }
      
      return data
    } catch (error) {
      console.error('[UploadService] 删除照片失败:', error)
      throw error
    }
  },
  
  /**
   * 批量上传照片
   * @param {File[]} files - 要上传的文件数组
   * @returns {Promise<Object[]>} 上传结果数组
   */
  uploadPhotos: async (files) => {
    // 验证照片数量
    if (files.length > config.oss.maxPhotosPerRecord) {
      throw new Error(`最多只能上传 ${config.oss.maxPhotosPerRecord} 张照片`)
    }
    
    const uploadPromises = files.map(file => uploadService.uploadPhoto(file))
    
    try {
      const results = await Promise.all(uploadPromises)
      return results
    } catch (error) {
      console.error('[UploadService] 批量上传失败:', error)
      throw error
    }
  },

  /**
   * 账目图库：不限张数（逐张调用单文件上传）
   * @param {File[]} files
   */
  uploadPhotosUnlimited: async (files) => {
    if (!files?.length) return []
    const results = []
    for (const file of files) {
      results.push(await uploadService.uploadPhoto(file))
    }
    return results
  },
  
  /**
   * 批量删除照片
   * @param {string[]} photoIds - 照片ID数组
   * @returns {Promise<Object[]>} 删除结果数组
   */
  deletePhotos: async (photoIds) => {
    const deletePromises = photoIds.map(id => uploadService.deletePhoto(id))
    
    try {
      const results = await Promise.all(deletePromises)
      return results
    } catch (error) {
      console.error('[UploadService] 批量删除失败:', error)
      throw error
    }
  }
}

