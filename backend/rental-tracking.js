/**
 * 租赁追踪系统 API
 * 
 * @description 处理租赁项目、房源、收支记录的增删改查
 * @module backend/rental-tracking
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// 数据文件路径
const DATA_FILE = path.join(__dirname, 'data', 'rental-tracking.json');

// 全局管理员密码
const GLOBAL_ADMIN_PASSWORD = process.env.GLOBAL_ADMIN_PASSWORD || 'notee.vip.2026';

/**
 * 初始化数据文件
 */
async function initDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    // 文件不存在，创建初始数据
    const dataDir = path.dirname(DATA_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    const initialData = {
      projects: [
        {
          id: 'project-sample-1',
          name: '示例项目A',
          description: '市中心商业区公寓项目',
          password: '',
          visible: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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
    };
    
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

/**
 * 读取数据
 */
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取数据失败:', error);
    return { projects: [] };
  }
}

/**
 * 写入数据
 */
async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
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
  // 如果项目没有密码，直接通过
  if (!project.password) return true;
  // 验证密码
  return project.password === password;
}

/**
 * 过滤项目数据（根据权限）
 */
function filterProjects(projects, isAdmin) {
  if (isAdmin) {
    // 管理员可以看到所有项目
    return projects;
  }
  // 普通用户只能看到可见的项目
  return projects.filter(p => p.visible !== false);
}

/**
 * 健康检查
 * GET /api/rental-tracking/health
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'rental-tracking',
    timestamp: new Date().toISOString()
  });
});

/**
 * 获取所有项目列表
 * GET /api/rental-tracking/projects
 * Query: adminPassword (可选，用于获取所有项目包括隐藏的)
 */
router.get('/projects', async (req, res) => {
  try {
    const { adminPassword } = req.query;
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    
    const data = await readData();
    const projects = filterProjects(data.projects, isAdmin);
    
    // 移除敏感信息（项目密码）
    const safeProjects = projects.map(p => {
      const { password, ...rest } = p;
      return {
        ...rest,
        hasPassword: !!password
      };
    });
    
    res.json({ 
      success: true, 
      projects: safeProjects 
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取项目列表失败' 
    });
  }
});

/**
 * 获取单个项目详情
 * GET /api/rental-tracking/projects/:id
 * Query: password (项目密码), adminPassword (管理员密码)
 */
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, adminPassword } = req.query;
    
    const data = await readData();
    const project = data.projects.find(p => p.id === id);
    
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        error: '项目不存在' 
      });
    }
    
    // 检查权限
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    const hasProjectAccess = isAdmin || verifyProjectPassword(project, password);
    
    if (!hasProjectAccess) {
      return res.status(403).json({ 
        success: false, 
        error: '密码错误或无权限访问' 
      });
    }
    
    // 移除密码字段
    const { password: _, ...safeProject } = project;
    
    res.json({ 
      success: true, 
      project: safeProject 
    });
  } catch (error) {
    console.error('获取项目详情失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取项目详情失败' 
    });
  }
});

/**
 * 创建新项目
 * POST /api/rental-tracking/projects
 * Body: { name, description, password, visible, adminPassword }
 */
router.post('/projects', async (req, res) => {
  try {
    const { name, description, password, visible, adminPassword } = req.body;
    
    // 验证管理员权限
    if (!verifyAdminPassword(adminPassword)) {
      return res.status(403).json({ 
        success: false, 
        error: '需要管理员权限' 
      });
    }
    
    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: '项目名称不能为空' 
      });
    }
    
    const data = await readData();
    
    const newProject = {
      id: `project-${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || '',
      password: password || '',
      visible: visible !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expenses: [],
      properties: []
    };
    
    data.projects.push(newProject);
    await writeData(data);
    
    // 返回不含密码的项目信息
    const { password: _, ...safeProject } = newProject;
    
    res.json({ 
      success: true, 
      message: '项目创建成功',
      project: safeProject 
    });
  } catch (error) {
    console.error('创建项目失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '创建项目失败' 
    });
  }
});

/**
 * 更新项目
 * PUT /api/rental-tracking/projects/:id
 * Body: { name, description, password, visible, adminPassword }
 */
router.put('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, password, visible, adminPassword } = req.body;
    
    // 验证管理员权限
    if (!verifyAdminPassword(adminPassword)) {
      return res.status(403).json({ 
        success: false, 
        error: '需要管理员权限' 
      });
    }
    
    const data = await readData();
    const projectIndex = data.projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: '项目不存在' 
      });
    }
    
    // 更新项目信息
    const project = data.projects[projectIndex];
    if (name !== undefined) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();
    // 只有当 password 字段存在时才更新密码（允许设置为空字符串来清除密码）
    if (password !== undefined) project.password = password;
    if (visible !== undefined) project.visible = visible;
    project.updatedAt = new Date().toISOString();
    
    await writeData(data);
    
    // 返回不含密码的项目信息
    const { password: _, ...safeProject } = project;
    
    res.json({ 
      success: true, 
      message: '项目更新成功',
      project: safeProject 
    });
  } catch (error) {
    console.error('更新项目失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '更新项目失败' 
    });
  }
});

/**
 * 删除项目
 * DELETE /api/rental-tracking/projects/:id
 * Body: { adminPassword }
 */
router.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminPassword } = req.body;
    
    // 验证管理员权限
    if (!verifyAdminPassword(adminPassword)) {
      return res.status(403).json({ 
        success: false, 
        error: '需要管理员权限' 
      });
    }
    
    const data = await readData();
    const projectIndex = data.projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: '项目不存在' 
      });
    }
    
    data.projects.splice(projectIndex, 1);
    await writeData(data);
    
    res.json({ 
      success: true, 
      message: '项目删除成功' 
    });
  } catch (error) {
    console.error('删除项目失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '删除项目失败' 
    });
  }
});

/**
 * 更新整个项目数据（包括房源、开支等）
 * PUT /api/rental-tracking/projects/:id/data
 * Body: { project, adminPassword, projectPassword }
 */
router.put('/projects/:id/data', async (req, res) => {
  try {
    const { id } = req.params;
    const { project: updatedProject, adminPassword, projectPassword } = req.body;
    
    const data = await readData();
    const projectIndex = data.projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: '项目不存在' 
      });
    }
    
    const project = data.projects[projectIndex];
    
    // 检查权限
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    const hasProjectAccess = isAdmin || verifyProjectPassword(project, projectPassword);
    
    if (!hasProjectAccess) {
      return res.status(403).json({ 
        success: false, 
        error: '密码错误或无权限访问' 
      });
    }
    
    // 保留原有的元数据和密码
    // 明确排除 password 字段，防止前端意外覆盖
    const { id: _, createdAt, password, ...projectData } = updatedProject;
    
    // 更新项目数据，但保留原有的密码
    data.projects[projectIndex] = {
      ...project,
      ...projectData,
      id: project.id,
      createdAt: project.createdAt,
      password: project.password,  // 始终保留原密码，不受前端影响
      updatedAt: new Date().toISOString()
    };
    
    await writeData(data);
    
    res.json({ 
      success: true, 
      message: '项目数据更新成功' 
    });
  } catch (error) {
    console.error('更新项目数据失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '更新项目数据失败' 
    });
  }
});

// 初始化
initDataFile().catch(console.error);

module.exports = router;
