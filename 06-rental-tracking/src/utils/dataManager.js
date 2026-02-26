/**
 * 数据管理工具
 * 
 * 功能：
 * - 从 localStorage 加载数据
 * - 保存数据到 localStorage
 * - 提供示例数据
 * 
 * 数据存储键：rental-tracking-data
 */

const STORAGE_KEY = 'rental-tracking-data'

/**
 * 获取示例数据
 */
export const getSampleData = () => {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  return {
    projects: [
      {
        id: 'project-sample-1',
        name: '示例项目A',
        description: '市中心商业区公寓项目',
        expenses: [
          {
            id: 'expense-sample-1',
            name: '物业管理费',
            description: '整个项目的物业管理费用',
            records: [
              {
                date: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
                income: 0,
                expenses: 500,
                note: '月度物业费'
              }
            ]
          }
        ],
        properties: [
          {
            id: 'property-sample-1',
            name: 'A-101',
            status: 'rented',
            monthlyRent: 3000,
            tenant: {
              name: '张三',
              phone: '2',
              startDate: `${currentYear}-01-01`,
              endDate: `${currentYear}-12-31`
            },
            records: [
              {
                date: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
                income: 3000,
                expenses: 200,
                note: '水电费'
              }
            ]
          },
          {
            id: 'property-sample-2',
            name: 'A-102',
            status: 'new-contract',
            monthlyRent: 2800,
            tenant: {
              name: '李四',
              phone: '3',
              startDate: `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
              endDate: `${currentYear + 1}-${String(currentMonth).padStart(2, '0')}-01`
            },
            records: []
          },
          {
            id: 'property-sample-3',
            name: 'A-103',
            status: 'vacant',
            monthlyRent: 2600,
            tenant: null,
            records: []
          }
        ]
      }
    ]
  }
}

/**
 * 从 localStorage 加载数据
 */
export const loadRentalData = () => {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY)
    
    if (savedData) {
      const data = JSON.parse(savedData)
      // 验证数据结构
      if (data && Array.isArray(data.projects)) {
        // 确保每个项目都有 expenses 字段（兼容旧数据）
        data.projects = data.projects.map(project => ({
          ...project,
          expenses: project.expenses || []
        }))
        return data
      }
    }
    
    // 如果没有保存的数据或数据无效，返回示例数据
    const sampleData = getSampleData()
    saveRentalData(sampleData)
    return sampleData
  } catch (error) {
    console.error('加载数据失败:', error)
    return { projects: [] }
  }
}

/**
 * 保存数据到 localStorage
 */
export const saveRentalData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('保存数据失败:', error)
    alert('保存数据失败，请检查浏览器存储空间')
    return false
  }
}

/**
 * 导出数据为 JSON 文件
 */
export const exportData = (data) => {
  try {
    const dataStr = JSON.stringify(data, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rental-tracking-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  } catch (error) {
    console.error('导出数据失败:', error)
    alert('导出数据失败')
    return false
  }
}

/**
 * 导入数据从 JSON 文件
 */
export const importData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        // 验证数据结构
        if (data && Array.isArray(data.projects)) {
          resolve(data)
        } else {
          reject(new Error('无效的数据格式'))
        }
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'))
    }
    
    reader.readAsText(file)
  })
}

/**
 * 清空所有数据
 */
export const clearAllData = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    return true
  } catch (error) {
    console.error('清空数据失败:', error)
    return false
  }
}
