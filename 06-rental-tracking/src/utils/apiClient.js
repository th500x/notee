/**
 * API 客户端
 * 
 * @description 与后端 API 通信的工具函数
 */

// API 基础 URL
// 生产环境使用相对路径 /rental-api/，开发环境使用 localhost:3003
const API_BASE_URL = import.meta.env.PROD 
  ? '/rental-api' // 生产环境使用 Nginx 代理路径
  : (import.meta.env.VITE_API_URL || 'http://localhost:3003');
const API_PREFIX = '';

/**
 * 发送 API 请求
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${API_PREFIX}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
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
 * @param {string} adminPassword - 管理员密码（可选）
 */
export async function getProjects(adminPassword = null) {
  const query = adminPassword ? `?adminPassword=${encodeURIComponent(adminPassword)}` : '';
  return apiRequest(`/projects${query}`);
}

/**
 * 获取单个项目详情
 * @param {string} projectId - 项目ID
 * @param {string} password - 项目密码（可选）
 * @param {string} adminPassword - 管理员密码（可选）
 */
export async function getProject(projectId, password = null, adminPassword = null) {
  const params = new URLSearchParams();
  if (password) params.append('password', password);
  if (adminPassword) params.append('adminPassword', adminPassword);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/projects/${projectId}${query}`);
}

/**
 * 创建新项目
 * @param {object} projectData - 项目数据
 * @param {string} adminPassword - 管理员密码
 */
export async function createProject(projectData, adminPassword) {
  return apiRequest('/projects', {
    method: 'POST',
    body: JSON.stringify({
      ...projectData,
      adminPassword
    })
  });
}

/**
 * 更新项目信息
 * @param {string} projectId - 项目ID
 * @param {object} projectData - 项目数据
 * @param {string} adminPassword - 管理员密码
 */
export async function updateProject(projectId, projectData, adminPassword) {
  return apiRequest(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...projectData,
      adminPassword
    })
  });
}

/**
 * 删除项目
 * @param {string} projectId - 项目ID
 * @param {string} adminPassword - 管理员密码
 */
export async function deleteProject(projectId, adminPassword) {
  return apiRequest(`/projects/${projectId}`, {
    method: 'DELETE',
    body: JSON.stringify({ adminPassword })
  });
}

/**
 * 更新整个项目数据（包括房源、开支等）
 * @param {string} projectId - 项目ID
 * @param {object} project - 完整的项目数据
 * @param {string} adminPassword - 管理员密码（可选）
 * @param {string} projectPassword - 项目密码（可选）
 */
export async function updateProjectData(projectId, project, adminPassword = null, projectPassword = null) {
  return apiRequest(`/projects/${projectId}/data`, {
    method: 'PUT',
    body: JSON.stringify({
      project,
      adminPassword,
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
