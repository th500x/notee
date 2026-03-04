/**
 * 项目服务
 * 封装所有与项目相关的API调用
 */

import * as apiClient from '../utils/apiClient'

/**
 * 项目服务对象
 */
export const projectService = {
  /**
   * 获取所有项目列表
   * @returns {Promise<Object>} 项目列表响应
   */
  getAll: async () => {
    return await apiClient.getProjects()
  },
  
  /**
   * 根据ID获取单个项目
   * @param {string} projectId - 项目ID
   * @param {string} password - 项目密码（可选）
   * @returns {Promise<Object>} 项目详情响应
   */
  getById: async (projectId, password = null) => {
    return await apiClient.getProject(projectId, password)
  },
  
  /**
   * 创建新项目
   * @param {Object} projectData - 项目数据
   * @param {string} projectData.name - 项目名称
   * @param {string} projectData.description - 项目描述
   * @param {string} projectData.password - 项目密码（可选）
   * @param {boolean} projectData.visible - 是否可见
   * @returns {Promise<Object>} 创建结果响应
   */
  create: async (projectData) => {
    return await apiClient.createProject(projectData)
  },
  
  /**
   * 更新项目基本信息
   * @param {string} projectId - 项目ID
   * @param {Object} projectData - 项目数据
   * @returns {Promise<Object>} 更新结果响应
   */
  update: async (projectId, projectData) => {
    return await apiClient.updateProject(projectId, projectData)
  },
  
  /**
   * 删除项目
   * @param {string} projectId - 项目ID
   * @returns {Promise<Object>} 删除结果响应
   */
  delete: async (projectId) => {
    return await apiClient.deleteProject(projectId)
  },
  
  /**
   * 更新整个项目数据（包括房源、开支等）
   * @param {string} projectId - 项目ID
   * @param {Object} project - 完整的项目数据
   * @param {string} projectPassword - 项目密码（可选）
   * @returns {Promise<Object>} 更新结果响应
   */
  updateData: async (projectId, project, projectPassword = null) => {
    return await apiClient.updateProjectData(projectId, project, projectPassword)
  },
  
  /**
   * 只更新项目的收支记录
   * @param {string} projectId - 项目ID
   * @param {Object} records - 收支记录数据
   * @param {Array} records.properties - 房源数据
   * @param {Array} records.expenses - 开支数据
   * @param {string} projectPassword - 项目密码（可选）
   * @returns {Promise<Object>} 更新结果响应
   */
  updateRecords: async (projectId, records, projectPassword = null) => {
    return await apiClient.updateProjectRecords(projectId, records, projectPassword)
  },
  
  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态响应
   */
  healthCheck: async () => {
    return await apiClient.healthCheck()
  }
}

