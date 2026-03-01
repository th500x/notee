/**
 * 阅读设置Hook
 * 管理字体、字号、行高等阅读设置
 */

import { useState, useCallback } from 'react'
import { FONT_OPTIONS, FONT_SIZE_RANGE, LINE_HEIGHT_RANGE } from '../constants'

/**
 * 阅读设置Hook
 * @returns {Object} 阅读设置状态和方法
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

  // 获取当前字体family
  const getCurrentFont = useCallback(() => {
    return FONT_OPTIONS.find(f => f.value === fontFamily)?.family || FONT_OPTIONS[0].family
  }, [fontFamily])

  // 重置设置
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
