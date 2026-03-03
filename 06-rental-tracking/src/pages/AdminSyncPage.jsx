import { useState, useEffect } from 'react'
import { useAdmin } from '../hooks/useAdmin'
import { syncService } from '../services/syncService'

/**
 * 管理员数据同步页面
 * 提供本地和生产环境之间的数据同步功能
 */
export default function AdminSyncPage() {
  const { isLoggedIn, login } = useAdmin()
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  
  // 生产环境配置
  const [productionUrl, setProductionUrl] = useState(
    localStorage.getItem('production_url') || 'https://notee.vip'
  )
  
  // 统计数据
  const [localStats, setLocalStats] = useState(null)
  const [productionStats, setProductionStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  
  // 同步状态
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ step: 0, message: '' })
  const [syncResult, setSyncResult] = useState(null)
  
  // 同步模式
  const [syncMode, setSyncMode] = useState('merge') // 'merge' | 'replace'

  // 加载统计数据
  useEffect(() => {
    if (isLoggedIn) {
      loadStats()
    }
  }, [isLoggedIn])

  // 保存生产环境地址
  useEffect(() => {
    localStorage.setItem('production_url', productionUrl)
  }, [productionUrl])

  // 管理员登录
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginLoading(true)
    
    const result = await login(password)
    
    if (!result.success) {
      alert(result.error || '登录失败')
    }
    
    setLoginLoading(false)
  }

  // 加载统计数据
  const loadStats = async () => {
    setStatsLoading(true)
    
    try {
      // 加载本地统计
      const local = await syncService.getLocalStats()
      setLocalStats(local)
      
      // 加载生产环境统计
      try {
        const production = await syncService.getProductionStats(productionUrl)
        setProductionStats(production)
      } catch (error) {
        console.error('加载生产环境统计失败:', error)
        setProductionStats(null)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
      alert('加载统计失败：' + error.message)
    } finally {
      setStatsLoading(false)
    }
  }

  // 同步到生产环境
  const handleSyncToProduction = async () => {
    if (!confirm(`确定要将本地数据同步到生产环境吗？\n\n模式：${syncMode === 'merge' ? '合并（保留生产环境现有数据）' : '替换（清空生产环境数据）'}`)) {
      return
    }
    
    setSyncing(true)
    setSyncResult(null)
    
    try {
      const result = await syncService.syncToProduction(
        productionUrl,
        syncMode,
        (progress) => setSyncProgress(progress)
      )
      
      setSyncResult({
        success: true,
        message: '同步成功！',
        stats: result.stats
      })
      
      // 重新加载统计
      await loadStats()
    } catch (error) {
      setSyncResult({
        success: false,
        message: '同步失败：' + error.message
      })
    } finally {
      setSyncing(false)
      setSyncProgress({ step: 0, message: '' })
    }
  }

  // 从生产环境同步
  const handleSyncFromProduction = async () => {
    if (!confirm(`确定要从生产环境同步数据到本地吗？\n\n模式：${syncMode === 'merge' ? '合并（保留本地现有数据）' : '替换（清空本地数据）'}`)) {
      return
    }
    
    setSyncing(true)
    setSyncResult(null)
    
    try {
      const result = await syncService.syncFromProduction(
        productionUrl,
        syncMode,
        (progress) => setSyncProgress(progress)
      )
      
      setSyncResult({
        success: true,
        message: '同步成功！',
        stats: result.stats
      })
      
      // 重新加载统计
      await loadStats()
    } catch (error) {
      setSyncResult({
        success: false,
        message: '同步失败：' + error.message
      })
    } finally {
      setSyncing(false)
      setSyncProgress({ step: 0, message: '' })
    }
  }

  // 导出本地数据
  const handleExportLocal = async () => {
    try {
      const data = await syncService.exportLocal()
      const filename = `rental-tracking-backup-${new Date().toISOString().split('T')[0]}.json`
      syncService.downloadAsJson(data, filename)
      alert('✅ 数据已导出')
    } catch (error) {
      alert('导出失败：' + error.message)
    }
  }

  // 如果未登录，显示登录表单
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-gray-900">管理员登录</h1>
            <p className="text-gray-600 mt-2">数据同步管理</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                管理员密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="请输入管理员密码"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loginLoading ? '登录中...' : '登录'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <a
              href="/06-rental-tracking/"
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              ← 返回主页
            </a>
          </div>
        </div>
      </div>
    )
  }

  // 已登录，显示同步界面
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">数据同步管理</h1>
              <p className="text-gray-600 mt-2">本地 ⇄ 生产环境</p>
            </div>
            <a
              href="/06-rental-tracking/"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← 返回主页
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 生产环境配置 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">⚙️ 生产环境配置</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                生产环境地址
              </label>
              <input
                type="url"
                value={productionUrl}
                onChange={(e) => setProductionUrl(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="https://notee.vip"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadStats}
                disabled={statsLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {statsLoading ? '测试中...' : '测试连接'}
              </button>
            </div>
          </div>
        </div>

        {/* 数据统计 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* 本地环境 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">💻 本地环境</h3>
            {localStats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">项目数量</span>
                  <span className="font-semibold">{localStats.projectCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">房源数量</span>
                  <span className="font-semibold">{localStats.propertyCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">记录数量</span>
                  <span className="font-semibold">{localStats.recordCount}</span>
                </div>
                {localStats.lastUpdate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">最后更新</span>
                    <span className="text-gray-500">
                      {new Date(localStats.lastUpdate).toLocaleString('zh-CN')}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">加载中...</p>
            )}
          </div>

          {/* 生产环境 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">☁️ 生产环境</h3>
            {productionStats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">项目数量</span>
                  <span className="font-semibold">{productionStats.projectCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">房源数量</span>
                  <span className="font-semibold">{productionStats.propertyCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">记录数量</span>
                  <span className="font-semibold">{productionStats.recordCount}</span>
                </div>
                {productionStats.lastUpdate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">最后更新</span>
                    <span className="text-gray-500">
                      {new Date(productionStats.lastUpdate).toLocaleString('zh-CN')}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">
                {statsLoading ? '连接中...' : '无法连接到生产环境'}
              </p>
            )}
          </div>
        </div>

        {/* 同步模式选择 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🔄 同步模式</h2>
          <div className="space-y-3">
            <label className="flex items-start cursor-pointer">
              <input
                type="radio"
                name="syncMode"
                value="merge"
                checked={syncMode === 'merge'}
                onChange={(e) => setSyncMode(e.target.value)}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-semibold text-gray-900">合并模式（推荐）</div>
                <div className="text-sm text-gray-600">
                  保留目标环境的现有数据，只更新相同ID的项目
                </div>
              </div>
            </label>
            <label className="flex items-start cursor-pointer">
              <input
                type="radio"
                name="syncMode"
                value="replace"
                checked={syncMode === 'replace'}
                onChange={(e) => setSyncMode(e.target.value)}
                className="mt-1 mr-3"
              />
              <div>
                <div className="font-semibold text-gray-900">替换模式（危险）</div>
                <div className="text-sm text-gray-600">
                  清空目标环境的所有数据，完全替换为源环境的数据
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* 同步操作 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🚀 同步操作</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleSyncToProduction}
              disabled={syncing || !productionStats}
              className="px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <div className="text-2xl mb-2">📤</div>
              <div className="font-semibold">同步到生产</div>
              <div className="text-sm opacity-90">本地 → 生产</div>
            </button>
            
            <button
              onClick={handleSyncFromProduction}
              disabled={syncing || !productionStats}
              className="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <div className="text-2xl mb-2">📥</div>
              <div className="font-semibold">从生产同步</div>
              <div className="text-sm opacity-90">生产 → 本地</div>
            </button>
            
            <button
              onClick={handleExportLocal}
              disabled={syncing}
              className="px-6 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <div className="text-2xl mb-2">💾</div>
              <div className="font-semibold">导出备份</div>
              <div className="text-sm opacity-90">下载 JSON</div>
            </button>
          </div>
        </div>

        {/* 同步进度 */}
        {syncing && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl animate-spin">⏳</div>
              <div className="flex-1">
                <div className="font-semibold text-blue-900 mb-2">
                  {syncProgress.message}
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(syncProgress.step / 3) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 同步结果 */}
        {syncResult && (
          <div className={`border rounded-lg p-6 ${
            syncResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-4">
              <div className="text-4xl">
                {syncResult.success ? '✅' : '❌'}
              </div>
              <div className="flex-1">
                <div className={`font-semibold mb-2 ${
                  syncResult.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {syncResult.message}
                </div>
                {syncResult.stats && (
                  <div className="text-sm text-gray-700 space-y-1">
                    <div>总计：{syncResult.stats.total} 个项目</div>
                    <div>新增：{syncResult.stats.imported} 个</div>
                    <div>更新：{syncResult.stats.updated} 个</div>
                    <div>跳过：{syncResult.stats.skipped} 个</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
