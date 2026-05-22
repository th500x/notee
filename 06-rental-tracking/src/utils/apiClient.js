/**
 * API 客户端
 * 
 * @description 与后端 API 通信的工具函数
 */

import { config } from '../config'
import { tokenManager } from './tokenManager'

// API 基础 URL 和前缀
const API_BASE_URL = config.api.baseUrl
const API_PREFIX = config.api.prefix

/**
 * 发送 API 请求
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${API_PREFIX}${endpoint}`;
  
  // 获取 Token
  const token = tokenManager.get();
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
  };
  
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || '请求失败');
    }
    
    return data;
  } catch (error) {
    console.error('API请求失败:', error);
    throw error;
  }
}

/**
 * 获取所有项目列表
 */
export async function getProjects() {
  return apiRequest('/');
}

/**
 * 验证密码并获取可访问的项目列表
 * @param {string} password - 项目密码
 */
export async function verifyPasswordAndGetProjects(password) {
  return apiRequest('/verify-password', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
}

/**
 * 获取单个项目详情
 * @param {string} projectId - 项目ID
 * @param {string} password - 项目密码（可选）
 */
export async function getProject(projectId, password = null) {
  const params = new URLSearchParams();
  if (password) params.append('password', password);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/${projectId}${query}`);
}

/**
 * 创建新项目
 * @param {object} projectData - 项目数据
 */
export async function createProject(projectData) {
  return apiRequest('/', {
    method: 'POST',
    body: JSON.stringify(projectData)
  });
}

/**
 * 保存水电单表格（管理员 Token）
 */
export async function updateUtilitySheet(projectId, utilitySheet) {
  return apiRequest(`/${projectId}/utility-sheet`, {
    method: 'PUT',
    body: JSON.stringify({ utilitySheet })
  });
}

/**
 * 保存账目单 JSON（管理员 Token）
 */
export async function updateAccountingSheet(projectId, accountingSheet) {
  return apiRequest(`/${projectId}/accounting-sheet`, {
    method: 'PUT',
    body: JSON.stringify({ accountingSheet })
  });
}

/**
 * 保存税费单 JSON（管理员 Token）
 */
export async function updateTaxSheet(projectId, taxSheet) {
  return apiRequest(`/${projectId}/tax-sheet`, {
    method: 'PUT',
    body: JSON.stringify({ taxSheet })
  });
}

/**
 * 更新项目信息
 * @param {string} projectId - 项目ID
 * @param {object} projectData - 项目数据
 */
export async function updateProject(projectId, projectData) {
  return apiRequest(`/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(projectData)
  });
}

/**
 * 删除项目
 * @param {string} projectId - 项目ID
 */
export async function deleteProject(projectId) {
  return apiRequest(`/${projectId}`, {
    method: 'DELETE'
  });
}

/**
 * 更新整个项目数据（包括房源、开支等）
 * @param {string} projectId - 项目ID
 * @param {object} project - 完整的项目数据
 * @param {string} projectPassword - 项目密码（可选）
 */
export async function updateProjectData(projectId, project, projectPassword = null) {
  return apiRequest(`/${projectId}/data`, {
    method: 'PUT',
    body: JSON.stringify({
      project,
      projectPassword
    })
  });
}

/**
 * 只更新项目的收支记录（不触碰基本信息如密码、名称等）
 * @param {string} projectId - 项目ID
 * @param {object} records - 收支记录数据 { properties, expenses }
 * @param {string} projectPassword - 项目密码（可选）
 */
export async function updateProjectRecords(projectId, records, projectPassword = null) {
  return apiRequest(`/${projectId}/records`, {
    method: 'PUT',
    body: JSON.stringify({
      ...records,
      projectPassword
    })
  });
}

/**
 * 健康检查
 */
export async function healthCheck() {
  return apiRequest('/health');
}
