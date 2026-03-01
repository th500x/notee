/**
 * 阅读设置Hook
 * 管理字体、字号、行高等阅读设置
 * 
 * @module hooks/useReadingSettings
 * @description
 * 提供阅读器的所有设置管理功能，包括：
 * - 字体选择（仿宋、楷体、黑体）
 * - 字号调整（12-24px）
 * - 行高调整（1.2-2.5）
 * - 设置重置
 * 
 * @example
 * import { useReadingSettings } from './hooks/useReadingSettings'
 * 
 * function BookReader() {
 *   const {
 *     fontSize,
 *     lineHeight,
 *     fontFamily,
 *     setFontSize,
 *     increaseFontSize,
 *     getCurrentFont
 *   } = useReadingSettings()
 *   
 *   return (
 *     <div style={{ 
 *       fontSize: `${fontSize}px`,
 *       lineHeight,
 *       fontFamily: getCurrentFont()
 *     }}>
 *       内容
 *     </div>
 *   )
 * }
 */

import { useState, useCallback } from 'react'
import { FONT_OPTIONS, FONT_SIZE_RANGE, LINE_HEIGHT_RANGE } from '../constants'

/**
 * 阅读设置Hook
 * 
 * @returns {Object} 阅读设置状态和方法
 * @returns {number} return.fontSize - 当前字号（12-24）
 * @returns {number} return.lineHeight - 当前行高（1.2-2.5）
 * @returns {string} return.fontFamily - 当前字体（fangsong/kaiti/heiti）
 * @returns {Array<Object>} return.fontOptions - 可用字体列表
 * @returns {Function} return.setFontSize - 设置字号
 * @returns {Function} return.setLineHeight - 设置行高
 * @returns {Function} return.setFontFamily - 设置字体
 * @returns {Function} return.increaseFontSize - 增大字号
 * @returns {Function} return.decreaseFontSize - 减小字号
 * @returns {Function} return.increaseLineHeight - 增大行高
 * @returns {Function} return.decreaseLineHeight - 减小行高
 * @returns {Function} return.getCurrentFont - 获取当前字体CSS值
 * @returns {Function} return.resetSettings - 重置所有设置
 */
export function useReadingSettings() {
  const [fontSize, setFontSize] = useState(FONT_SIZE_RANGE.DEFAULT)
  const [lineHeight, setLineHeight] = useState(LINE_HEIGHT_RANGE.DEFAULT)
  const [fontFamily, setFontFamily] = useState('heiti')

  // 增加字号
  const increaseFontSize = useCallback(() => {
    setFontSize(prev => Math.min(FONT_SIZE_RANGE.MAX, prev + 1))
  }, [])

  // 减小字号
  const decreaseFontSize = useCallback(() => {
    setFontSize(prev => Math.max(FONT_SIZE_RANGE.MIN, prev - 1))
  }, [])

  // 增加行高
  const increaseLineHeight = useCallback(() => {
    setLineHeight(prev => Math.min(LINE_HEIGHT_RANGE.MAX, prev + LINE_HEIGHT_RANGE.STEP))
  }, [])

  // 减小行高
  const decreaseLineHeight = useCallback(() => {
    setLineHeight(prev => Math.max(LINE_HEIGHT_RANGE.MIN, prev - LINE_HEIGHT_RANGE.STEP))
  }, [])

  /**
   * 获取当前字体的CSS family值
   * @returns {string} CSS font-family值
   */
  const getCurrentFont = useCallback(() => {
    return FONT_OPTIONS.find(f => f.value === fontFamily)?.family || FONT_OPTIONS[0].family
  }, [fontFamily])

  /**
   * 重置所有设置到默认值
   */
  const resetSettings = useCallback(() => {
    setFontSize(FONT_SIZE_RANGE.DEFAULT)
    setLineHeight(LINE_HEIGHT_RANGE.DEFAULT)
    setFontFamily('heiti')
  }, [])

  return {
    // 状态
    fontSize,
    lineHeight,
    fontFamily,
    fontOptions: FONT_OPTIONS,
    
    // 方法
    setFontSize,
    setLineHeight,
    setFontFamily,
    increaseFontSize,
    decreaseFontSize,
    increaseLineHeight,
    decreaseLineHeight,
    getCurrentFont,
    resetSettings
  }
}
