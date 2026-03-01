/**
 * 租赁追踪系统 - 后端服务器
 * 
 * @description 独立的后端 API 服务，使用MySQL数据库
 * @module 06-rental-tracking/backend/server
 */

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3003;

// 全局管理员密码
const GLOBAL_ADMIN_PASSWORD = process.env.GLOBAL_ADMIN_PASSWORD || 'notee.vip.2026';

// MySQL数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'notee_rental_tracking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 创建数据库连接池
let pool;

/**
 * 初始化数据库连接
 */
async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);
    
    // 测试连接
    const connection = await pool.getConnection();
    console.log('✓ MySQL数据库连接成功');
    
    // 创建表（如果不存在）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        password VARCHAR(255),
        visible BOOLEAN DEFAULT TRUE,
        properties JSON,
        expenses JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✓ 数据库表已初始化');
    connection.release();
  } catch (error) {
    console.error('✗ 数据库连接失败:', error.message);
    throw error;
  }
}

// CORS配置 - 开发环境允许所有来源
app.use(cors({
  origin: true, // 允许所有来源（开发环境）
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); // 增加限制以支持照片上传

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
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    
    const [rows] = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    
    const projects = rows.map(project => {
      // 解析JSON字段
      const projectData = {
        ...project,
        properties: JSON.parse(project.properties || '[]'),
        expenses: JSON.parse(project.expenses || '[]'),
        visible: Boolean(project.visible)
      };
      
      if (isAdmin || projectData.visible !== false) {
        const { password, ...safeProject } = projectData;
        return {
          ...safeProject,
          hasPassword: !!password
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
    
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const project = {
      ...rows[0],
      properties: JSON.parse(rows[0].properties || '[]'),
      expenses: JSON.parse(rows[0].expenses || '[]'),
      visible: Boolean(rows[0].visible)
    };
    
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
    
    const newProject = {
      id: `project-${Date.now()}`,
      name: projectData.name || '未命名项目',
      description: projectData.description || '',
      password: projectData.password || null,
      visible: projectData.visible !== false,
      properties: JSON.stringify([]),
      expenses: JSON.stringify([])
    };
    
    await pool.query(
      'INSERT INTO projects (id, name, description, password, visible, properties, expenses) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newProject.id, newProject.name, newProject.description, newProject.password, newProject.visible, newProject.properties, newProject.expenses]
    );
    
    const result = {
      ...newProject,
      properties: [],
      expenses: []
    };
    
    res.json({ success: true, project: result });
  } catch (error) {
    console.error('创建项目失败:', error);
    res.status(500).json({ success: false, error: '创建项目失败' });
  }
});

/**
 * 更新项目基本信息（名称、描述、密码等）
 */
app.put('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { adminPassword, ...updates } = req.body;
    
    if (!verifyAdminPassword(adminPassword)) {
      return res.status(403).json({ success: false, error: '管理员密码错误' });
    }
    
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];
    
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(updates.description);
    }
    if (updates.password !== undefined) {
      updateFields.push('password = ?');
      updateValues.push(updates.password);
    }
    if (updates.visible !== undefined) {
      updateFields.push('visible = ?');
      updateValues.push(updates.visible);
    }
    
    if (updateFields.length > 0) {
      updateValues.push(id);
      await pool.query(
        `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }
    
    // 获取更新后的项目
    const [updatedRows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    const project = {
      ...updatedRows[0],
      properties: JSON.parse(updatedRows[0].properties || '[]'),
      expenses: JSON.parse(updatedRows[0].expenses || '[]'),
      visible: Boolean(updatedRows[0].visible)
    };
    
    res.json({ success: true, project });
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
    
    const [result] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    res.json({ success: true, message: '项目已删除' });
  } catch (error) {
    console.error('删除项目失败:', error);
    res.status(500).json({ success: false, error: '删除项目失败' });
  }
});

/**
 * 更新项目完整数据（包括properties和expenses）
 */
app.put('/projects/:id/data', async (req, res) => {
  try {
    const { id } = req.params;
    const { project, adminPassword, projectPassword } = req.body;
    
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const existingProject = {
      ...rows[0],
      properties: JSON.parse(rows[0].properties || '[]'),
      expenses: JSON.parse(rows[0].expenses || '[]')
    };
    
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    const hasAccess = isAdmin || verifyProjectPassword(existingProject, projectPassword);
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: '密码错误或无权限' });
    }
    
    await pool.query(
      'UPDATE projects SET name = ?, description = ?, password = ?, visible = ?, properties = ?, expenses = ? WHERE id = ?',
      [
        project.name,
        project.description,
        project.password,
        project.visible,
        JSON.stringify(project.properties || []),
        JSON.stringify(project.expenses || []),
        id
      ]
    );
    
    const [updatedRows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    const updatedProject = {
      ...updatedRows[0],
      properties: JSON.parse(updatedRows[0].properties || '[]'),
      expenses: JSON.parse(updatedRows[0].expenses || '[]'),
      visible: Boolean(updatedRows[0].visible)
    };
    
    res.json({ success: true, project: updatedProject });
  } catch (error) {
    console.error('更新项目数据失败:', error);
    res.status(500).json({ success: false, error: '更新项目数据失败' });
  }
});

/**
 * 只更新项目的收支记录（不触碰基本信息如密码、名称等）
 * 这是关键API，用于上传/删除照片、添加/删除收支记录
 */
app.put('/projects/:id/records', async (req, res) => {
  try {
    const { id } = req.params;
    const { properties, expenses, adminPassword, projectPassword } = req.body;
    
    const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const existingProject = {
      ...rows[0],
      properties: JSON.parse(rows[0].properties || '[]'),
      expenses: JSON.parse(rows[0].expenses || '[]')
    };
    
    const isAdmin = adminPassword && verifyAdminPassword(adminPassword);
    const hasAccess = isAdmin || verifyProjectPassword(existingProject, projectPassword);
    
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: '密码错误或无权限' });
    }
    
    // 只更新 properties 和 expenses，不触碰其他字段（包括密码、名称等）
    const updateFields = [];
    const updateValues = [];
    
    if (properties !== undefined) {
      updateFields.push('properties = ?');
      updateValues.push(JSON.stringify(properties));
    }
    if (expenses !== undefined) {
      updateFields.push('expenses = ?');
      updateValues.push(JSON.stringify(expenses));
    }
    
    if (updateFields.length > 0) {
      updateValues.push(id);
      await pool.query(
        `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }
    
    res.json({ success: true, message: '收支记录更新成功' });
  } catch (error) {
    console.error('更新收支记录失败:', error);
    res.status(500).json({ success: false, error: '更新收支记录失败' });
  }
});

/**
 * 健康检查
 */
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      service: 'rental-tracking',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      service: 'rental-tracking',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
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
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🏠 租赁追踪系统后端服务运行在 http://localhost:${PORT}`);
    console.log(`📊 API端点: http://localhost:${PORT}/projects`);
    console.log(`💚 健康检查: http://localhost:${PORT}/health`);
    console.log(`🗄️  数据库: MySQL (${dbConfig.database})`);
  });
}).catch(error => {
  console.error('初始化失败:', error);
  process.exit(1);
});

module.exports = app;
