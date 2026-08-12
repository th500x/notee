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
   * @param {{ purpose?: 'gallery'|'receipt', room?: string }} [options]
   * @returns {Promise<Object>} 上传结果 { success, photo }
   */
  uploadPhoto: async (file, options = {}) => {
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
    if (options.purpose === 'gallery') {
      formData.append('purpose', 'gallery')
      formData.append('room', options.room || '')
    }
    
    try {
      const response = await fetch(
        `${config.api.uploadBaseUrl}${config.api.uploadPrefix}/photos`,
        {
          method: 'POST',
          body: formData
        }
      )
      
      if (!response.ok) {
        let msg = '上传失败'
        try {
          const errData = await response.json()
          if (errData?.error) msg = errData.error
        } catch {
          /* ignore */
        }
        throw new Error(msg)
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
    if (!photoId) throw new Error('缺少照片 ID')
    try {
      const url = `${config.api.uploadBaseUrl}${config.api.uploadPrefix}/photos?key=${encodeURIComponent(photoId)}`
      const response = await fetch(url, { method: 'DELETE' })
      
      if (!response.ok) {
        let msg = '删除失败'
        try {
          const data = await response.json()
          if (data?.error) msg = data.error
        } catch {
          /* ignore */
        }
        throw new Error(msg)
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
   * 账目图库：不限张数（逐张调用单文件上传，按 ROOM 目录）
   * @param {File[]} files
   * @param {(p: { current: number, total: number, fileName: string }) => void} [onProgress]
   * @param {{ room: string }} options
   */
  uploadPhotosUnlimited: async (files, onProgress, options = {}) => {
    if (!files?.length) return []
    const room = String(options.room || '').trim()
    if (!room) {
      throw new Error('请先填写房号（ROOM）再上传图库图片')
    }
    const results = []
    const total = files.length
    for (let i = 0; i < total; i += 1) {
      const file = files[i]
      if (onProgress) {
        onProgress({ current: i + 1, total, fileName: file.name || `图片 ${i + 1}` })
      }
      results.push(
        await uploadService.uploadPhoto(file, { purpose: 'gallery', room })
      )
    }
    return results
  },

  /**
   * 图库 ROOM 更名后迁移 OSS 目录
   * @param {string} room
   * @param {object[]} photos
   */
  relocateGalleryPhotos: async (room, photos) => {
    const response = await fetch(
      `${config.api.uploadBaseUrl}${config.api.uploadPrefix}/photos/relocate-gallery`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, photos: photos || [] })
      }
    )
    let data = {}
    try {
      data = await response.json()
    } catch {
      data = {}
    }
    if (!response.ok || !data.success) {
      throw new Error(data.error || '迁移图库目录失败')
    }
    return data.photos || []
  },
  
  /**
   * 批量删除照片
   * @param {string[]} photoIds - 照片ID数组
   * @returns {Promise<Object[]>} 删除结果数组
   */
  deletePhotos: async (photoIds) => {
    const keys = (photoIds || []).filter((id) => typeof id === 'string' && id.trim())
    if (keys.length === 0) return { success: true, deleted: 0 }
    if (keys.length === 1) {
      return uploadService.deletePhoto(keys[0])
    }
    try {
      const response = await fetch(
        `${config.api.uploadBaseUrl}${config.api.uploadPrefix}/photos/batch-delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys })
        }
      )
      if (!response.ok) {
        let msg = '批量删除失败'
        try {
          const data = await response.json()
          if (data?.error) msg = data.error
        } catch {
          /* ignore */
        }
        throw new Error(msg)
      }
      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || '批量删除失败')
      }
      return data
    } catch (error) {
      console.error('[UploadService] 批量删除失败:', error)
      throw error
    }
  }
}
