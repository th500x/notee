import { useState } from 'react'

/**
 * 项目列表组件
 * 
 * 功能：
 * - 显示所有项目和房源的树形结构
 * - 支持展开/收起项目
 * - 显示房源状态（已出租/空置）
 * - 添加/删除项目和房源
 */
function ProjectList({ 
  projects, 
  selectedProperty, 
  onPropertySelect, 
  onAddProject, 
  onAddProperty,
  onDeleteProject,
  onDeleteProperty
}) {
  const [expandedProjects, setExpandedProjects] = useState(new Set())

  // 切换项目展开状态
  const toggleProject = (projectId) => {
    const newExpanded = new Set(expandedProjects)
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId)
    } else {
      newExpanded.add(projectId)
    }
    setExpandedProjects(newExpanded)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* 标题和添加按钮 */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-900">项目列表</h2>
        <button
          onClick={onAddProject}
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          title="添加新项目"
        >
          ➕ 项目
        </button>
      </div>

      {/* 项目列表 */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {projects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">暂无项目</p>
            <p className="text-sm">点击上方按钮添加第一个项目</p>
          </div>
        ) : (
          projects.map(project => (
            <div key={project.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* 项目标题 */}
              <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                <div 
                  className="flex items-center gap-2 flex-1 cursor-pointer"
                  onClick={() => toggleProject(project.id)}
                >
                  <span className="text-gray-600">
                    {expandedProjects.has(project.id) ? '📂' : '📁'}
                  </span>
                  <span className="font-medium text-gray-900">{project.name}</span>
                  <span className="text-xs text-gray-500">
                    ({project.properties.length}套)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddProperty(project.id)
                    }}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    title="添加房源"
                  >
                    ➕
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteProject(project.id)
                    }}
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    title="删除项目"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* 房源列表 */}
              {expandedProjects.has(project.id) && (
                <div className="p-2 space-y-1">
                  {project.properties.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      暂无房源
                    </div>
                  ) : (
                    project.properties.map(property => (
                      <div
                        key={property.id}
                        onClick={() => onPropertySelect(property, project)}
                        className={`px-3 py-2 rounded-md cursor-pointer transition-colors flex items-center justify-between ${
                          selectedProperty?.id === property.id
                            ? 'bg-blue-100 border-2 border-blue-500'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <span className={`w-2 h-2 rounded-full ${
                            property.status === 'rented' ? 'bg-green-500' : 'bg-gray-400'
                          }`}></span>
                          <span className="text-sm font-medium">{property.name}</span>
                          {property.status === 'rented' && (
                            <span className="text-xs text-green-600">💰</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            ฿{property.monthlyRent}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteProperty(project.id, property.id)
                            }}
                            className="text-red-500 hover:text-red-700 text-xs"
                            title="删除房源"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ProjectList
