/**
 * 上传服务
 * 封装所有与文件上传相关的API调用
 */

import { config } from '../config'

/** 单张图片上传的整体超时（含浏览器→服务器→OSS 全程） */
const PHOTO_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000

/**
 * 用 XHR 发送 FormData，以便拿到真实的字节级上传进度。
 * fetch 无法获知请求体发送进度，会让大图上传看起来「卡住不动」。
 *
 * @param {FormData} formData
 * @param {{ onByteProgress?: (p: { loaded: number, total: number, stage: 'sending'|'server' }) => void, timeoutMs?: number }} [options]
 * @returns {Promise<Object>}
 */
function postPhotoWithProgress(formData, options = {}) {
  const url = `${config.api.uploadBaseUrl}${config.api.uploadPrefix}/photos`
  const timeoutMs = options.timeoutMs || PHOTO_UPLOAD_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.timeout = timeoutMs

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return
      options.onByteProgress?.({ loaded: e.loaded, total: e.total, stage: 'sending' })
    }
    // 请求体发完后仍需等服务器转存到 OSS，这段时间字节进度不再变化
    xhr.upload.onload = () => {
      options.onByteProgress?.({ loaded: 1, total: 1, stage: 'server' })
    }

    xhr.onload = () => {
      let data = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        data = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.success) {
        resolve(data)
        return
      }
      reject(new Error(data?.error || `上传失败（HTTP ${xhr.status}）`))
    }
    xhr.onerror = () => reject(new Error('网络中断，上传失败'))
    xhr.onabort = () => reject(new Error('上传已取消'))
    xhr.ontimeout = () =>
      reject(new Error(`上传超时（超过 ${Math.round(timeoutMs / 1000)} 秒），请检查网络后重试`))

    xhr.send(formData)
  })
}

/**
 * 上传服务对象
 */
export const uploadService = {
  /**
   * 上传照片到OSS
   * @param {File} file - 要上传的文件
   * @param {{ purpose?: 'gallery'|'receipt', room?: string, fileName?: string,
   *   onByteProgress?: (p: { loaded: number, total: number, stage: 'sending'|'server' }) => void,
   *   timeoutMs?: number }} [options]
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
    if (options.fileName) {
      formData.append('fileName', options.fileName)
    }
    if (options.purpose === 'gallery') {
      formData.append('purpose', 'gallery')
      formData.append('room', options.room || '')
    }
    // 文件放最后：文本字段先到达，服务端无需等整个文件即可读取参数
    formData.append('photo', file)

    const startedAt = Date.now()
    try {
      const data = await postPhotoWithProgress(formData, {
        onByteProgress: options.onByteProgress,
        timeoutMs: options.timeoutMs
      })
      if (config.features.enableLogging) {
        console.info(
          `[UploadService] ${options.fileName || file.name} ${(file.size / 1024 / 1024).toFixed(2)}MB 耗时 ${Date.now() - startedAt}ms`,
          data.timings || ''
        )
      }
      return data
    } catch (error) {
      console.error(
        `[UploadService] 上传照片失败（耗时 ${Date.now() - startedAt}ms）:`,
        error
      )
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
   * 中途失败时 Error.partialResults 带已成功结果，便于前端保留并清理 OSS 孤儿
   *
   * 进度以「已传字节 / 总字节」上报，避免只按文件序号跳动而看起来卡死。
   * @param {File[]} files
   * @param {(p: { done: number, total: number, fileName: string, stage: 'sending'|'server',
   *   fileLoaded: number, fileTotal: number, bytesLoaded: number, bytesTotal: number }) => void} [onProgress]
   * @param {{ room: string, fileNames?: string[] }} options
   */
  uploadPhotosUnlimited: async (files, onProgress, options = {}) => {
    if (!files?.length) return []
    const room = String(options.room || '').trim()
    if (!room) {
      throw new Error('请先填写房号（ROOM）再上传图库图片')
    }
    const results = []
    const uploadedFiles = []
    const total = files.length
    const sizes = files.map((f) => f?.size || 0)
    const bytesTotal = sizes.reduce((sum, n) => sum + n, 0)
    let bytesDone = 0

    for (let i = 0; i < total; i += 1) {
      const file = files[i]
      const fileName = options.fileNames?.[i] || file.name || `图片 ${i + 1}`
      const report = (stage, fileLoaded) => {
        onProgress?.({
          done: i,
          total,
          fileName,
          stage,
          fileLoaded,
          fileTotal: sizes[i],
          bytesLoaded: bytesDone + Math.min(fileLoaded, sizes[i]),
          bytesTotal
        })
      }
      report('sending', 0)
      try {
        const data = await uploadService.uploadPhoto(file, {
          purpose: 'gallery',
          room,
          fileName,
          onByteProgress: ({ loaded, total: fileTotal, stage }) => {
            report(stage, stage === 'server' ? sizes[i] : Math.round(loaded * (sizes[i] / (fileTotal || sizes[i] || 1))))
          }
        })
        results.push(data)
        uploadedFiles.push(file)
        bytesDone += sizes[i]
      } catch (error) {
        error.partialResults = results
        error.partialFiles = uploadedFiles
        throw error
      }
    }
    return results
  },

  /**
   * 清理 ROOM 图库目录中不在 keepKeys 内的 OSS 对象
   * @param {string} room
   * @param {string[]} keepKeys photo.id 列表
   */
  syncGalleryFolder: async (room, keepKeys = []) => {
    const keep = (keepKeys || []).filter(Boolean)
    // 空清单会误删整个 ROOM 目录，这里直接拒绝
    if (keep.length === 0) return { success: true, deleted: 0, skipped: true }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    try {
      const response = await fetch(
        `${config.api.uploadBaseUrl}${config.api.uploadPrefix}/photos/sync-gallery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room, keepKeys: keep }),
          signal: controller.signal
        }
      )
      let data = {}
      try {
        data = await response.json()
      } catch {
        data = {}
      }
      if (!response.ok || !data.success) {
        throw new Error(data.error || '同步图库目录失败')
      }
      return data
    } finally {
      clearTimeout(timer)
    }
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
