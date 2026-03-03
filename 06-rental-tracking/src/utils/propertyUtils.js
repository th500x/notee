/**
 * 房源工具函数
 * 
 * 提供房源相关的通用工具函数
 */

/**
 * 获取项目的所有房源（包括默认分组和自定义分组）
 * 
 * @param {Object} project - 项目对象
 * @returns {Array} 所有房源列表
 */
export function getAllProperties(project) {
  const allProperties = [...(project.properties || [])]
  
  if (project.propertyGroups && project.propertyGroups.length > 0) {
    project.propertyGroups.forEach(group => {
      if (group.properties && group.properties.length > 0) {
        allProperties.push(...group.properties)
      }
    })
  }
  
  return allProperties
}
