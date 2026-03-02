import { useState, useCallback } from 'react'
import { NOTIFICATION_TYPES } from '../constants'

/**
 * 通知系统自定义Hook
 * 
 * @returns {Object} 通知状态和操作方法
 */
export function useNotification() {
  const [notifications, setNotifications] = useState([])
  
  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型 (success|error|info|warning)
   * @param {number} duration - 显示时长（毫秒），默认3000
   */
  const showNotification = useCallback((message, type = NOTIFICATION_TYPES.INFO, duration = 3000) => {
    const id = Date.now() + Math.random()
    
    const notification = {
      id,
      message,
      type,
      visible: false
    }
    
    // 添加通知
    setNotifications(prev => [...prev, notification])
    
    // 延迟显示（触发动画）
    setTimeout(() => {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, visible: true } : n)
      )
    }, 100)
    
    // 自动隐藏
    setTimeout(() => {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, visible: false } : n)
      )
      
      // 移除通知
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }, 300)
    }, duration)
  }, [])
  
  /**
   * 手动关闭通知
   * @param {number} id - 通知ID
   */
  const closeNotification = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, visible: false } : n)
    )
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 300)
  }, [])
  
  /**
   * 清除所有通知
   */
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])
  
  return {
    notifications,
    showNotification,
    closeNotification,
    clearAll
  }
}
