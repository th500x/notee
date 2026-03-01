import { useState, useEffect, useCallback } from 'react'

/**
 * 统一的异步数据加载Hook
 * 提供加载状态、错误处理和重试功能
 * 
 * @param {Function} fetchFn - 异步数据加载函数
 * @param {Array} deps - 依赖数组，当依赖变化时重新加载
 * @returns {Object} { data, loading, error, refetch }
 * 
 * @example
 * const { data, loading, error, refetch } = useAsyncData(
 *   () => loadNewsData(),
 *   []
 * )
 */
export function useAsyncData(fetchFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchFn()
      setData(result)
    } catch (err) {
      console.error('[useAsyncData] 加载失败:', err)
      setError(err.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    let cancelled = false
    
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await fetchFn()
        if (!cancelled) {
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[useAsyncData] 加载失败:', err)
          setError(err.message || '加载数据失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    
    load()
    
    return () => {
      cancelled = true
    }
  }, deps)

  return { data, loading, error, refetch: fetchData }
}
