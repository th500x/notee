/**
 * 租赁追踪系统 API 路由 (MySQL版本)
 * 
 * @description 提供租赁项目管理、房源管理、收支追踪等功能的API
 * @module backend/rental-tracking-mysql
 * @version 2.0 - MySQL数据库存储版本
 */

const express = require('express');
const router = express.Router();
const { pool } = require('./database/connection');
const { validate, createProjectSchema, updateProjectSchema, projectDataSchema, recordsSchema } = require('./middleware/validation');
const { auditLog } = require('./middleware/auditLog');
const { hashPassword, verifyPassword } = require('./utils/passwordUtils');
const { verifyToken } = require('./middleware/auth');

/**
 * 验证项目密码（支持 bcrypt 加密）
 */
async function verifyProjectPassword(projectId, password) {
  try {
    const [rows] = await pool.execute(
      'SELECT password FROM projects WHERE id = ?',
      [projectId]
    );
    
    if (rows.length === 0) {
      return false;
    }
    
    const project = rows[0];
    
    // 如果项目没有设置密码，返回true
    if (!project.password) {
      return true;
    }
    
    // 使用 bcrypt 验证密码
    const isValid = await verifyPassword(password, project.password);
    return isValid;
  } catch (error) {
    console.error('[Auth] 验证项目密码失败:', error);
    return false;
  }
}

// ==================== API 路由 ====================

// 应用审计日志中间件到所有路由
router.use(auditLog);

/**
 * 健康检查
 * GET /api/rental-tracking/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'rental-tracking',
    version: '2.0-mysql',
    storage: 'MySQL',
    timestamp: new Date().toISOString()
  });
});

/**
 * 获取所有项目列表
 * GET /api/rental-tracking/
 */
router.get('/', async (req, res) => {
  try {
    // 管理员通过 Token 验证，不再使用密码参数
    // Token 验证在需要管理员权限的路由中使用 verifyToken 中间件
    
    // 查询所有可见项目
    const sql = 'SELECT * FROM projects WHERE visible = TRUE ORDER BY created_at DESC';
    
    const [rows] = await pool.execute(sql);
    
    // 处理JSON字段 - MySQL2 可能返回字符串或已解析的对象
    const projects = rows.map(row => {
      // 统一处理函数：确保返回解析后的对象
      const parseJSON = (value, defaultValue) => {
        if (!value) return defaultValue;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch (e) {
            console.error('[JSON Parse Error]', e);
            return defaultValue;
          }
        }
        return value;
      };

      return {
        ...row,
        properties: parseJSON(row.properties, []),
        propertyGroups: parseJSON(row.property_groups, []),
        expenses: parseJSON(row.expenses, []),
        // 移除密码字段（安全）
        password: undefined,
        property_groups: undefined,
        // 添加hasPassword标志
        hasPassword: !!row.password
      };
    });
    
    res.json({
      success: true,
      projects,
      count: projects.length
    });
  } catch (error) {
    console.error('[API] 获取项目列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取项目列表失败'
    });
  }
});

/**
 * 验证密码并获取可访问的项目列表
 * POST /api/rental-tracking/verify-password
 */
router.post('/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: '密码不能为空'
      });
    }
    
    // 查询所有可见项目
    const [rows] = await pool.execute(
      'SELECT * FROM projects WHERE visible = TRUE ORDER BY created_at DESC'
    );
    
    // 验证密码并过滤可访问的项目
    const accessibleProjects = [];
    
    for (const row of rows) {
      // 没有密码的项目，所有人都可以访问
      if (!row.password || row.password === '') {
        accessibleProjects.push(row);
        continue;
      }
      
      // 验证密码
      const isValid = await verifyPassword(password, row.password);
      if (isValid) {
        accessibleProjects.push(row);
      }
    }
    
    // 处理JSON字段 - MySQL2 可能返回字符串或已解析的对象
    const parseJSON = (value, defaultValue) => {
      if (!value) return defaultValue;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          console.error('[JSON Parse Error]', e);
          return defaultValue;
        }
      }
      return value;
    };

    const projects = accessibleProjects.map(row => ({
      ...row,
      properties: parseJSON(row.properties, []),
      propertyGroups: parseJSON(row.property_groups, []),
      expenses: parseJSON(row.expenses, []),
      // 移除密码字段（安全）
      password: undefined,
      property_groups: undefined,
      // 添加hasPassword标志
      hasPassword: !!row.password
    }));
    
    res.json({
      success: true,
      projects,
      count: projects.length
    });
  } catch (error) {
    console.error('[API] 验证密码失败:', error);
    res.status(500).json({
      success: false,
      error: '验证密码失败'
    });
  }
});

/**
 * 获取单个项目详情
 * GET /api/rental-tracking/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.query;
    
    // 查询项目
    const [rows] = await pool.execute(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }
    
    const project = rows[0];
    
    // 验证项目密码
    const hasProjectPassword = await verifyProjectPassword(id, password);
    
    if (!hasProjectPassword) {
      return res.status(403).json({
        success: false,
        error: '密码错误或无权限访问'
      });
    }
    
    // 处理JSON字段 - MySQL2 可能返回字符串或已解析的对象
    const parseJSON = (value, defaultValue) => {
      if (!value) return defaultValue;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          console.error('[JSON Parse Error]', e);
          return defaultValue;
        }
      }
      return value;
    };

    const result = {
      ...project,
      properties: parseJSON(project.properties, []),
      propertyGroups: parseJSON(project.property_groups, []),
      expenses: parseJSON(project.expenses, []),
      // 移除密码字段
      password: undefined,
      property_groups: undefined,
      hasPassword: !!project.password
    };
    
    res.json({
      success: true,
      project: result
    });
  } catch (error) {
    console.error('[API] 获取项目详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取项目详情失败'
    });
  }
});

/**
 * 创建新项目
 * POST /api/rental-tracking/
 */
router.post('/', verifyToken, validate(createProjectSchema), async (req, res) => {
  try {
    const { name, description, password, visible } = req.body;
    
    // Token 已通过 verifyToken 中间件验证
    
    // 生成项目ID
    const id = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 加密密码（如果提供了密码）
    const hashedPassword = password ? await hashPassword(password) : null;
    
    // 插入项目
    const sql = `
      INSERT INTO projects (id, name, description, password, visible, properties, property_groups, expenses, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await pool.execute(sql, [
      id,
      name,
      description || null,
      hashedPassword,
      visible !== false,
      '[]',
      '[]',
      '[]',
      1
    ]);
    
    res.json({
      success: true,
      project: {
        id,
        name,
        description,
        visible: visible !== false,
        hasPassword: !!password,
        properties: [],
        propertyGroups: [],
        expenses: [],
        version: 1
      }
    });
  } catch (error) {
    console.error('[API] 创建项目失败:', error);
    res.status(500).json({
      success: false,
      error: '创建项目失败'
    });
  }
});

/**
 * 更新项目基本信息
 * PUT /api/rental-tracking/:id
 */
router.put('/:id', verifyToken, validate(updateProjectSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, password, visible } = req.body;
    
    // Token 已通过 verifyToken 中间件验证
    
    // 构建动态SQL：只有提供了新密码才更新密码字段
    let sql;
    let params;
    
    if (password && password.trim() !== '') {
      // 用户提供了新密码，加密后更新
      const hashedPassword = await hashPassword(password);
      sql = `
        UPDATE projects 
        SET name = ?, description = ?, password = ?, visible = ?, version = version + 1
        WHERE id = ?
      `;
      params = [
        name,
        description || null,
        hashedPassword,
        visible !== false,
        id
      ];
    } else {
      // 用户没有提供新密码，不更新密码字段（保留原密码）
      sql = `
        UPDATE projects 
        SET name = ?, description = ?, visible = ?, version = version + 1
        WHERE id = ?
      `;
      params = [
        name,
        description || null,
        visible !== false,
        id
      ];
    }
    
    const [result] = await pool.execute(sql, params);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }
    
    res.json({
      success: true,
      message: '项目更新成功'
    });
  } catch (error) {
    console.error('[API] 更新项目失败:', error);
    res.status(500).json({
      success: false,
      error: '更新项目失败'
    });
  }
});

/**
 * 删除项目
 * DELETE /api/rental-tracking/:id
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Token 已通过 verifyToken 中间件验证
    
    // 删除项目
    const [result] = await pool.execute(
      'DELETE FROM projects WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }
    
    res.json({
      success: true,
      message: '项目删除成功'
    });
  } catch (error) {
    console.error('[API] 删除项目失败:', error);
    res.status(500).json({
      success: false,
      error: '删除项目失败'
    });
  }
});

/**
 * 更新整个项目数据（包括房源、开支等）
 * PUT /api/rental-tracking/:id/data
 * 仅管理员可访问（需要 Token）
 */
router.put('/:id/data', verifyToken, validate(projectDataSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { project } = req.body;
    
    // Token 已通过 verifyToken 中间件验证
    
    // 获取当前项目（用于版本控制）
    const [rows] = await pool.execute(
      'SELECT version FROM projects WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }
    
    const currentVersion = rows[0].version;
    
    // 暂时禁用版本控制（单用户系统不需要）
    // if (project.version !== undefined && project.version !== null && project.version !== currentVersion) {
    //   return res.status(409).json({
    //     success: false,
    //     error: '数据已被其他用户修改，请刷新后重试',
    //     currentVersion
    //   });
    // }
    
    // 更新项目数据
    const sql = `
      UPDATE projects 
      SET properties = ?, property_groups = ?, expenses = ?, version = version + 1
      WHERE id = ?
    `;
    
    await pool.execute(sql, [
      JSON.stringify(project.properties || []),
      JSON.stringify(project.propertyGroups || []),  // 改为数组
      JSON.stringify(project.expenses || []),
      id
    ]);
    
    res.json({
      success: true,
      message: '项目数据更新成功',
      version: currentVersion + 1
    });
  } catch (error) {
    console.error('[API] 更新项目数据失败:', error);
    res.status(500).json({
      success: false,
      error: '更新项目数据失败'
    });
  }
});

/**
 * 只更新项目的收支记录
 * PUT /api/rental-tracking/:id/records
 * 仅管理员可访问（需要 Token）
 */
router.put('/:id/records', verifyToken, validate(recordsSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { properties, expenses } = req.body;
    
    // Token 已通过 verifyToken 中间件验证
    
    // 更新收支记录
    const sql = `
      UPDATE projects 
      SET properties = ?, expenses = ?, version = version + 1
      WHERE id = ?
    `;
    
    const [result] = await pool.execute(sql, [
      JSON.stringify(properties || []),
      JSON.stringify(expenses || []),
      id
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }
    
    res.json({
      success: true,
      message: '收支记录更新成功'
    });
  } catch (error) {
    console.error('[API] 更新收支记录失败:', error);
    res.status(500).json({
      success: false,
      error: '更新收支记录失败'
    });
  }
});

module.exports = router;

