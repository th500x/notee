/**
 * 数据管理工具 - API 版本
 * 
 * 功能：
 * - 从后端 API 加载数据
 * - 保存数据到后端 API
 * - 提供与 localStorage 版本兼容的接口
 */

import * as api from './apiClient';

/**
 * 从 API 加载数据
 */
export const loadRentalData = async () => {
  try {
    const response = await api.getProjects();
    
    if (response.success) {
      return { projects: response.projects };
    }
    
    console.error('加载数据失败:', response.error);
    return { projects: [] };
  } catch (error) {
    console.error('加载数据失败:', error);
    // 如果 API 不可用，返回空数据
    return { projects: [] };
  }
};

/**
 * 保存数据到 API
 * 注意：这个函数保存整个数据结构，实际使用中应该使用更细粒度的 API
 */
export const saveRentalData = async (data) => {
  try {
    // 遍历所有项目并更新
    for (const project of data.projects) {
      try {
        await api.updateProjectData(project.id, project);
      } catch (error) {
        console.error(`保存项目 ${project.id} 失败:`, error);
      }
    }
  } catch (error) {
    console.error('保存数据失败:', error);
    throw error;
  }
};

/**
 * 创建新项目
 */
export const createProject = async (projectData) => {
  try {
    const response = await api.createProject(projectData);
    
    if (response.success) {
      return response.project;
    }
    
    throw new Error(response.error || '创建项目失败');
  } catch (error) {
    console.error('创建项目失败:', error);
    throw error;
  }
};

/**
 * 创建水电单项目（管理员，无项目密码）
 */
export const createUtilityProject = async ({ name, description }) => {
  try {
    const response = await api.createProject({
      name,
      description: description || '',
      projectKind: 'utility',
      visible: true
    });
    if (response.success) {
      return response.project;
    }
    throw new Error(response.error || '创建水电单失败');
  } catch (error) {
    console.error('创建水电单失败:', error);
    throw error;
  }
};

/**
 * 更新项目信息
 */
export const updateProjectInfo = async (projectId, projectData) => {
  try {
    const response = await api.updateProject(projectId, projectData);
    
    if (response.success) {
      return response.project;
    }
    
    throw new Error(response.error || '更新项目失败');
  } catch (error) {
    console.error('更新项目失败:', error);
    throw error;
  }
};

/**
 * 删除项目
 */
export const deleteProject = async (projectId) => {
  try {
    const response = await api.deleteProject(projectId);
    
    if (response.success) {
      return true;
    }
    
    throw new Error(response.error || '删除项目失败');
  } catch (error) {
    console.error('删除项目失败:', error);
    throw error;
  }
};

/**
 * 更新项目数据（包括房源、开支等）
 */
export const updateProjectData = async (project) => {
  try {
    const response = await api.updateProjectData(project.id, project);
    
    if (response.success) {
      return true;
    }
    
    throw new Error(response.error || '更新项目数据失败');
  } catch (error) {
    console.error('更新项目数据失败:', error);
    throw error;
  }
};

/**
 * 只更新项目的收支记录（不触碰基本信息如密码、名称等）
 */
export const updateProjectRecords = async (projectId, records, projectPassword = null) => {
  try {
    const response = await api.updateProjectRecords(projectId, records, projectPassword);
    
    if (response.success) {
      return true;
    }
    
    throw new Error(response.error || '更新收支记录失败');
  } catch (error) {
    console.error('更新收支记录失败:', error);
    throw error;
  }
};

/**
 * 获取项目详情（需要密码）
 */
export const getProjectDetail = async (projectId, projectPassword = null) => {
  try {
    const response = await api.getProject(projectId, projectPassword);
    
    if (response.success) {
      return response.project;
    }
    
    throw new Error(response.error || '获取项目详情失败');
  } catch (error) {
    console.error('获取项目详情失败:', error);
    throw error;
  }
};

/**
 * 导出数据为 JSON 文件
 */
export const exportData = (data) => {
  try {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rental-tracking-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('导出数据失败:', error);
    alert('导出数据失败');
    return false;
  }
};

/**
 * 导入数据从 JSON 文件
 */
export const importData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // 验证数据结构
        if (data && Array.isArray(data.projects)) {
          resolve(data);
        } else {
          reject(new Error('无效的数据格式'));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * 健康检查
 */
export const checkAPIHealth = async () => {
  try {
    const response = await api.healthCheck();
    return response.status === 'ok';
  } catch (error) {
    console.error('API健康检查失败:', error);
    return false;
  }
};
