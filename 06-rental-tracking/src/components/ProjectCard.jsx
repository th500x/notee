/**
 * 项目卡片组件
 */
function ProjectCard({
  project,
  stats,
  isUnlocked,
  hasPassword,
  onSelect,
  onUnlock,
  onEdit,
  isAdmin,
  isUtilityProject = false
}) {
  // 如果项目被锁定，显示锁定状态
  if (!isUnlocked) {
    return (
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        {/* 卡片头部 - 锁定状态 */}
        <div className="bg-gradient-to-r from-gray-400 to-gray-500 p-6 text-white">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-gray-200 line-clamp-2">{project.description}</p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
                className="text-white hover:text-gray-200 ml-2 px-2 py-1 rounded hover:bg-white/10 transition-colors"
                title={isUtilityProject ? '编辑水电单' : '编辑项目'}
                >
                ⚙️
              </button>
            )}
          </div>
        </div>

        {/* 锁定内容区域 */}
        <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-gray-600 mb-4 text-center">此项目需要密码访问</p>
          <button
            onClick={onUnlock}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            输入密码解锁
          </button>
        </div>
      </div>
    )
  }

  // 解锁状态 - 显示完整信息
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      {/* 卡片头部 - 渐变背景 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold">{project.name}</h3>
              {isUtilityProject && (
                <span className="text-xs bg-white/25 px-2 py-0.5 rounded" title="水电单（管理员）">
                  💡
                </span>
              )}
              {hasPassword && !isUtilityProject && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded" title="此项目有密码保护">
                  🔐
                </span>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-blue-100 line-clamp-2">{project.description}</p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="text-white hover:text-blue-200 ml-2 px-2 py-1 rounded hover:bg-white/10 transition-colors"
              title={isUtilityProject ? '编辑水电单' : '编辑项目'}
            >
              ⚙️
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div>
            <span className="text-blue-100">{isUtilityProject ? '计费行数' : '房源数'}</span>
            <span className="ml-2 font-bold text-lg">{stats.totalProperties}</span>
          </div>
          {!isUtilityProject && (
            <div>
              <span className="text-blue-100">缴租率</span>
              <span className="ml-2 font-bold text-lg">{stats.paymentRate}%</span>
            </div>
          )}
        </div>
      </div>

      {/* 卡片内容 - 统计数据 */}
      <div className="p-6">
        {isUtilityProject ? (
          <p className="text-gray-600 text-sm">
            Last / current electric and water readings; one rate for the whole sheet; open the page for
            English UI, totals, and export.
          </p>
        ) : null}
        <div className={`grid grid-cols-2 gap-4 ${isUtilityProject ? 'hidden' : ''}`}>
          {/* 左列：上月数据 */}
          <div className="space-y-3">
            <div className="text-xs text-gray-500 font-medium mb-2">上月数据</div>
            
            {/* 上月收入 */}
            <div>
              <div className="text-xs text-gray-500">收入</div>
              <div className="text-base font-bold text-blue-600">
                ฿{stats.lastMonthIncome.toLocaleString()}
              </div>
            </div>

            {/* 上月支出 */}
            <div>
              <div className="text-xs text-gray-500">支出</div>
              <div className="text-base font-bold text-orange-600">
                ฿{stats.lastMonthExpenses.toLocaleString()}
              </div>
            </div>

            {/* 上月净利润 */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500">净利润</div>
              <div className={`text-base font-bold ${stats.lastMonthProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ฿{stats.lastMonthProfit.toLocaleString()}
              </div>
            </div>
          </div>

          {/* 右列：本月数据 */}
          <div className="space-y-3">
            <div className="text-xs text-gray-500 font-medium mb-2">本月数据</div>
            
            {/* 本月收入 */}
            <div>
              <div className="text-xs text-gray-500">收入</div>
              <div className="text-base font-bold text-blue-600">
                ฿{stats.monthlyIncome.toLocaleString()}
              </div>
            </div>

            {/* 本月支出 */}
            <div>
              <div className="text-xs text-gray-500">支出</div>
              <div className="text-base font-bold text-orange-600">
                ฿{stats.monthlyExpenses.toLocaleString()}
              </div>
            </div>

            {/* 本月净利润 */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500">净利润</div>
              <div className={`text-base font-bold ${stats.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ฿{stats.monthlyProfit.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* 查看详情 / 进入水电单：固定高度，避免英文换行撑高 */}
        <button
          type="button"
          onClick={onSelect}
          className="w-full mt-6 h-10 shrink-0 inline-flex items-center justify-center px-4 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          {isUtilityProject ? 'Open utility bill →' : '查看详情 →'}
        </button>
      </div>
    </div>
  )
}

export default ProjectCard;
