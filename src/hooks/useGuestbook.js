import { useState, useEffect, useCallback } from 'react'
import { guestbookAPI } from '../services/api'
import { handleAsync, logger } from '../utils/errorHandler'
import { validateMessageForm } from '../utils/validation'

/**
 * 留言板自定义 Hook
 * 管理留言板的数据加载、提交和删除功能，支持模块筛选
 * 
 * @param {string} [filterModule='all'] - 筛选的模块，默认为 'all' 显示所有留言
 * @returns {Object} 留言板状态和操作方法
 * @returns {Array} returns.messages - 留言列表数组
 * @returns {boolean} returns.loading - 加载状态，true 表示正在加载
 * @returns {string|null} returns.error - 错误信息，无错误时为 null
 * @returns {Function} returns.loadMessages - 重新加载留言的方法
 * @returns {Function} returns.submitMessage - 提交留言的方法，返回 Promise<{success, error?}>
 * @returns {Function} returns.deleteMessage - 删除留言的方法，返回 Promise<{success, error?}>
 * 
 * @example
 * // 基础使用
 * const { messages, loading, error, submitMessage } = useGuestbook('general')
 * 
 * // 提交留言
 * const handleSubmit = async () => {
 *   const result = await submitMessage('general', '这是一条留言')
 *   if (result.success) {
 *     showNotification('提交成功', 'success')
 *   } else {
 *     showNotification(result.error, 'error')
 *   }
 * }
 * 
 * // 删除留言
 * const handleDelete = async (messageId) => {
 *   const result = await deleteMessage(messageId)
 *   if (result.success) {
 *     showNotification('删除成功', 'success')
 *   }
 * }
 * 
 * // 显示留言列表
 * {loading ? (
 *   <div>加载中...</div>
 * ) : error ? (
 *   <div>错误: {error}</div>
 * ) : (
 *   messages.map(msg => <MessageCard key={msg.id} message={msg} />)
 * )}
 */
export function useGuestbook(filterModule = 'all') {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  /**
   * 加载留言列表
   * 根据当前筛选模块加载留言，最多加载 20 条
   * 
   * @returns {Promise<void>}
   * 
   * @example
   * // 手动重新加载
   * await loadMessages()
   */
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      logger.info('useGuestbook', '加载留言', { filterModule })
      
      const [err, data] = await handleAsync(
        guestbookAPI.getMessages(filterModule, 20),
        'useGuestbook.loadMessages'
      )
      
      if (err) {
        setError(err.message)
        return
      }
      
      setMessages(data.messages || [])
    } catch (err) {
      logger.error('useGuestbook', '加载留言失败', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filterModule])
  
  /**
   * 提交留言
   * 自动验证表单，提交成功后重新加载留言列表
   * 
   * @param {string} module - 留言所属模块（如 'general', '01-news-calendar' 等）
   * @param {string} content - 留言内容，最多 50 个字符
   * @returns {Promise<Object>} 提交结果
   * @returns {boolean} returns.success - 是否提交成功
   * @returns {string} [returns.error] - 错误消息（仅在失败时存在）
   * 
   * @example
   * const result = await submitMessage('general', '这是一条留言')
   * if (result.success) {
   *   console.log('提交成功')
   * } else {
   *   console.error('提交失败:', result.error)
   * }
   */
  const submitMessage = async (module, content) => {
    try {
      // 验证表单
      const validation = validateMessageForm(module, content)
      if (!validation.valid) {
        const firstError = Object.values(validation.errors)[0]
        return { success: false, error: firstError }
      }
      
      logger.info('useGuestbook', '提交留言', { module, content })
      
      const [err, data] = await handleAsync(
        guestbookAPI.createMessage(module, content),
        'useGuestbook.submitMessage'
      )
      
      if (err) {
        return { success: false, error: err.message }
      }
      
      // 重新加载留言列表
      await loadMessages()
      
      return { success: true }
    } catch (err) {
      logger.error('useGuestbook', '提交留言失败', err)
      return { success: false, error: err.message }
    }
  }
  
  /**
   * 删除留言
   * 需要管理员权限（已登录），删除成功后重新加载留言列表
   * 
   * @param {string} messageId - 要删除的留言 ID
   * @returns {Promise<Object>} 删除结果
   * @returns {boolean} returns.success - 是否删除成功
   * @returns {string} [returns.error] - 错误消息（仅在失败时存在）
   * 
   * @example
   * const result = await deleteMessage('1234567890')
   * if (result.success) {
   *   console.log('删除成功')
   * } else {
   *   console.error('删除失败:', result.error)
   * }
   */
  const deleteMessage = async (messageId) => {
    try {
      logger.info('useGuestbook', '删除留言', { messageId })
      
      const [err, data] = await handleAsync(
        guestbookAPI.deleteMessage(messageId),
        'useGuestbook.deleteMessage'
      )
      
      if (err) {
        return { success: false, error: err.message }
      }
      
      // 重新加载留言列表
      await loadMessages()
      
      return { success: true }
    } catch (err) {
      logger.error('useGuestbook', '删除留言失败', err)
      return { success: false, error: err.message }
    }
  }
  
  // 初始加载
  useEffect(() => {
    loadMessages()
  }, [loadMessages])
  
  return {
    messages,
    loading,
    error,
    loadMessages,
    submitMessage,
    deleteMessage
  }
}
