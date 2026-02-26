import { useState } from 'react'

/**
 * 项目开支详情组件
 * 
 * 功能：
 * - 显示项目级别的开支信息（不针对具体房源）
 * - 记录和显示收支明细
 * - 支持月度和年度视图
 * - 管理员功能：添加/删除记录
 */
function ProjectExpenseDetail({ expense, project, selectedYear, selectedMonth, viewMode, onExpenseUpdate, isAdmin }) {
  // 如果没有选中项目开支，显示提示
  if (!expense) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="text-center text-gray-500">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-lg">请从左侧选择一个项目开支类别</p>
          <p className="text-sm mt-2">选择后可以查看和管理开支详情</p>
        </div>
      </div>
    )
  }

  // 添加收支记录（管理员功能）
  const addRecord = () => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    const dateStr = viewMode === 'month' 
      ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      : `${selectedYear}-01` // 年度视图默认添加1月

    const income = prompt('请输入收入金额（元）：', 0)
    if (income === null) return

    const expenses = prompt('请输入支出金额（元）：', 0)
    if (expenses === null) return

    const note = prompt('备注（可选）：', '')

    const newRecord = {
      date: dateStr,
      income: parseFloat(income) || 0,
      expenses: parseFloat(expenses) || 0,
      note: note || ''
    }

    const updatedRecords = [...(expense.records || []), newRecord]
    onExpenseUpdate({
      ...expense,
      records: updatedRecords
    })
  }

  // 删除记录（管理员功能）
  const deleteRecord = (index) => {
    if (!isAdmin) {
      alert('请先登录管理员账号')
      return
    }

    if (!confirm('确定要删除这条记录吗？')) return

    const updatedRecords = expense.records.filter((_, i) => i !== index)
    onExpenseUpdate({
      ...expense,
      records: updatedRecords
    })
  }

  // 获取显示的记录（根据视图模式过滤）
  const getDisplayRecords = () => {
    if (!expense.records) return []

    return expense.records.filter(record => {
      const [year, month] = record.date.split('-').map(Number)
      if (viewMode === 'month') {
        return year === selectedYear && month === selectedMonth
      } else {
        return year === selectedYear
      }
    }).sort((a, b) => b.date.localeCompare(a.date))
  }

  const displayRecords = getDisplayRecords()

  // 计算当前视图的总计
  const calculateTotals = () => {
    return displayRecords.reduce((acc, record) => ({
      income: acc.income + (record.income || 0),
      expenses: acc.expenses + (record.expenses || 0)
    }), { income: 0, expenses: 0 })
  }

  const totals = calculateTotals()

  return (
    <div className="space-y-6">
      {/* 基本信息卡片 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{expense.name}</h2>
            <p className="text-sm text-gray-600 mt-1">{project.name} - 项目开支</p>
          </div>
        </div>

        {expense.description && (
          <div className="mt-4">
            <p className="text-sm text-gray-600">说明</p>
            <p className="text-base text-gray-900">{expense.description}</p>
          </div>
        )}
      </div>

      {/* 收支记录卡片 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            收支记录 ({viewMode === 'month' ? `${selectedYear}年${selectedMonth}月` : `${selectedYear}年`})
          </h3>
          {isAdmin && (
            <button
              onClick={addRecord}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
            >
              ➕ 添加记录
            </button>
          )}
        </div>

        {/* 统计汇总 */}
        {displayRecords.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">总收入</p>
              <p className="text-lg font-bold text-blue-600">฿{totals.income.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">总支出</p>
              <p className="text-lg font-bold text-orange-600">฿{totals.expenses.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">净收益</p>
              <p className={`text-lg font-bold ${totals.income - totals.expenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ฿{(totals.income - totals.expenses).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* 记录列表 */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {displayRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无记录</p>
              {isAdmin && <p className="text-sm mt-2">点击上方按钮添加收支记录</p>}
            </div>
          ) : (
            displayRecords.map((record, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {record.date}
                      </span>
                      <span className="text-sm text-blue-600">
                        收入: ฿{record.income.toLocaleString()}
                      </span>
                      <span className="text-sm text-orange-600">
                        支出: ฿{record.expenses.toLocaleString()}
                      </span>
                    </div>
                    {record.note && (
                      <p className="text-sm text-gray-600">备注: {record.note}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => deleteRecord(index)}
                      className="text-red-500 hover:text-red-700 ml-4"
                      title="删除记录"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ProjectExpenseDetail
