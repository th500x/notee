/**
 * 租赁追踪系统 - 后端服务器
 * 
 * @description 独立的后端 API 服务
 * @module 06-rental-tracking/backend/server
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data', 'rental-tracking.json');

// 全局管理员密码
const GLOBAL_ADMIN_PASSWORD = process.env.GLOBAL_ADMIN_PASSWORD || 'notee.vip.2026';

// CORS配置 - 开发环境允许所有来源
app.use(cors({
  origin: true, // 允许所有来源（开发环境）
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

/**
 * 初始化数据文件
 */
async function initDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const dataDir = path.dirname(DATA_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    const initialData = {
      projects: [],
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    console.log('✓ 数据文件已初始化');
  }
}

/**
 * 读取数据
 */
async function readData() {
  const content = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * 写入数据
 */
async function writeData(data) {
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 验证管理员密码
 */
function verifyAdminPassword(password) {
  return password === GLOBAL_ADMIN_PASSWORD;
}

/**
 * 验证项目密码
 */
function verifyProjectPassword(project, password) {
  if (!project.password) return true;
  return project.password === password;
}

// ==================== API 路由 ====================

/**
 * 获取所有项目列表
 */
app.get('/projects', async (req, res) => {
  try {
    const { adminPassword } = req.query;
    const data = await readData();
    
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    
    // 返回完整的项目数据（包括 properties 和 expenses）
    const projects = data.projects.map(project => {
      if (isAdmin || project.visible !== false) {
        // 返回完整项目数据，但隐藏密码字段，并确保 hasPassword 是布尔值
        const { password, hasPassword: _, ...projectData } = project;
        return {
          ...projectData, // 先展开其他数据
          properties: project.properties || [],
          expenses: project.expenses || [],
          hasPassword: !!password // 最后设置 hasPassword，确保覆盖任何旧值
        };
      }
      return null;
    }).filter(Boolean);
    
    res.json({ success: true, projects });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({ success: false, error: '获取项目列表失败' });
  }
});

/**
 * 获取单个项目详情
 */
app.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, adminPassword } = req.query;
    const data = await readData();
    
    const project = data.projects.find(p => p.id === id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    const hasAccess = isAdmin || verifyProjectPassword(project, password);
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: '密码错误或无权限访问' });
    }
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('获取项目详情失败:', error);
    res.status(500).json({ success: false, error: '获取项目详情失败' });
  }
});

/**
 * 创建新项目
 */
app.post('/projects', async (req, res) => {
  try {
    const { adminPassword, ...projectData } = req.body;
    
    if (!verifyAdminPassword(adminPassword)) {
      return res.status(403).json({ success: false, error: '管理员密码错误' });
    }
    
    const data = await readData();
    const newProject = {
      id: `project-${Date.now()}`,
      ...projectData,
      properties: [],
      expenses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    data.projects.push(newProject);
    await writeData(data);
    
    res.json({ success: true, project: newProject });
  } catch (error) {
    console.error('创建项目失败:', error);
    res.status(500).json({ success: false, error: '创建项目失败' });
  }
});

/**
 * 更新项目信息
 */
app.put('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminPassword, ...updates } = req.body;
    
    if (!verifyAdminPassword(adminPassword)) {
      return res.status(403).json({ success: false, error: '管理员密码错误' });
    }
    
    const data = await readData();
    const projectIndex = data.projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    data.projects[projectIndex] = {
      ...data.projects[projectIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await writeData(data);
    res.json({ success: true, project: data.projects[projectIndex] });
  } catch (error) {
    console.error('更新项目失败:', error);
    res.status(500).json({ success: false, error: '更新项目失败' });
  }
});

/**
 * 删除项目
 */
app.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminPassword } = req.body;
    
    if (!verifyAdminPassword(adminPassword)) {
      return res.status(403).json({ success: false, error: '管理员密码错误' });
    }
    
    const data = await readData();
    const projectIndex = data.projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    data.projects.splice(projectIndex, 1);
    await writeData(data);
    
    res.json({ success: true, message: '项目已删除' });
  } catch (error) {
    console.error('删除项目失败:', error);
    res.status(500).json({ success: false, error: '删除项目失败' });
  }
});

/**
 * 更新项目完整数据
 */
app.put('/projects/:id/data', async (req, res) => {
  try {
    const { id } = req.params;
    const { project, adminPassword, projectPassword } = req.body;
    
    const data = await readData();
    const existingProject = data.projects.find(p => p.id === id);
    
    if (!existingProject) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    const hasAccess = isAdmin || verifyProjectPassword(existingProject, projectPassword);
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: '密码错误或无权限' });
    }
    
    const projectIndex = data.projects.findIndex(p => p.id === id);
    data.projects[projectIndex] = {
      ...project,
      updatedAt: new Date().toISOString()
    };
    
    await writeData(data);
    res.json({ success: true, project: data.projects[projectIndex] });
  } catch (error) {
    console.error('更新项目数据失败:', error);
    res.status(500).json({ success: false, error: '更新项目数据失败' });
  }
});

/**
 * 只更新项目的收支记录（不触碰基本信息）
 */
app.put('/projects/:id/records', async (req, res) => {
  try {
    const { id } = req.params;
    const { properties, expenses, adminPassword, projectPassword } = req.body;
    
    const data = await readData();
    const existingProject = data.projects.find(p => p.id === id);
    
    if (!existingProject) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    const hasAccess = isAdmin || verifyProjectPassword(existingProject, projectPassword);
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: '密码错误或无权限' });
    }
    
    const projectIndex = data.projects.findIndex(p => p.id === id);
    
    // 只更新 properties 和 expenses，保留其他所有字段（包括密码、名称等）
    if (properties !== undefined) {
      data.projects[projectIndex].properties = properties;
    }
    if (expenses !== undefined) {
      data.projects[projectIndex].expenses = expenses;
    }
    data.projects[projectIndex].updatedAt = new Date().toISOString();
    
    await writeData(data);
    res.json({ success: true, message: '收支记录更新成功' });
  } catch (error) {
    console.error('更新收支记录失败:', error);
    res.status(500).json({ success: false, error: '更新收支记录失败' });
  }
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'rental-tracking',
    timestamp: new Date().toISOString()
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

// 启动服务器
initDataFile().then(() => {
  app.listen(PORT, () => {
    console.log(`🏠 租赁追踪系统后端服务运行在 http://localhost:${PORT}`);
    console.log(`📊 API端点: http://localhost:${PORT}/projects`);
    console.log(`💚 健康检查: http://localhost:${PORT}/health`);
  });
}).catch(error => {
  console.error('初始化失败:', error);
  process.exit(1);
});

module.exports = app;
