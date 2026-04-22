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
const { validate, createProjectSchema, updateProjectSchema, projectDataSchema, recordsSchema, utilitySheetUpdateSchema } = require('./middleware/validation');
const { auditLog } = require('./middleware/auditLog');
const { hashPassword, verifyPassword } = require('./utils/passwordUtils');
const { verifyToken, decodeTokenOptional } = require('./middleware/auth');
const { parseJSON } = require('./utils/jsonParser');

function defaultUtilitySheet() {
  return {
    pricePerKwh: 0,
    pricePerWaterUnit: 0,
    readingMonthText: '',
    readingDateText: '',
    rows: []
  };
}

function normalizeUtilitySheet(raw) {
  const obj = typeof raw === 'object' && raw !== null ? raw : {};
  return {
    pricePerKwh: Number(obj.pricePerKwh) || 0,
    pricePerWaterUnit: Number(obj.pricePerWaterUnit) || 0,
    readingMonthText: typeof obj.readingMonthText === 'string' ? obj.readingMonthText : '',
    readingDateText: typeof obj.readingDateText === 'string' ? obj.readingDateText : '',
    rows: Array.isArray(obj.rows) ? obj.rows : []
  };
}

function mapProjectRow(row) {
  const kind = row.project_kind || 'rental';
  const mapped = {
    ...row,
    projectKind: kind,
    properties: parseJSON(row.properties, []),
    propertyGroups: parseJSON(row.property_groups, []),
    expenses: parseJSON(row.expenses, []),
    password: undefined,
    property_groups: undefined,
    utility_sheet: undefined,
    project_kind: undefined,
    hasPassword: kind === 'utility' ? false : !!row.password
  };
  if (kind === 'utility') {
    mapped.utilitySheet = normalizeUtilitySheet(parseJSON(row.utility_sheet, {}));
  } else {
    mapped.utilitySheet = undefined;
  }
  return mapped;
}

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
    const auth = decodeTokenOptional(req);
    const isGlobalAdmin = !!auth;

    const sql = isGlobalAdmin
      ? 'SELECT * FROM projects WHERE visible = TRUE ORDER BY created_at DESC'
      : `SELECT * FROM projects WHERE visible = TRUE AND COALESCE(project_kind, 'rental') = 'rental' ORDER BY created_at DESC`;

    const [rows] = await pool.execute(sql);

    const projects = rows.map(mapProjectRow);

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
    
    const [rows] = await pool.execute(
      `SELECT * FROM projects WHERE visible = TRUE AND COALESCE(project_kind, 'rental') = 'rental' ORDER BY created_at DESC`
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
    
    const projects = accessibleProjects.map(mapProjectRow);
    
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
 * 保存水电单表格（仅 project_kind = utility）
 * PUT /api/rental-tracking/:id/utility-sheet
 */
router.put('/:id/utility-sheet', verifyToken, validate(utilitySheetUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { utilitySheet } = req.body;

    const [rows] = await pool.execute(
      'SELECT project_kind FROM projects WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '项目不存在'
      });
    }

    if ((rows[0].project_kind || 'rental') !== 'utility') {
      return res.status(400).json({
        success: false,
        error: '该项目不是水电单'
      });
    }

    await pool.execute(
      'UPDATE projects SET utility_sheet = ?, version = version + 1 WHERE id = ?',
      [JSON.stringify(utilitySheet), id]
    );

    res.json({
      success: true,
      message: '水电单已保存'
    });
  } catch (error) {
    console.error('[API] 保存水电单失败:', error);
    res.status(500).json({
      success: false,
      error: '保存水电单失败'
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
    const kind = project.project_kind || 'rental';

    if (kind === 'utility') {
      const auth = decodeTokenOptional(req);
      if (!auth) {
        return res.status(403).json({
          success: false,
          error: '需要管理员登录后才能访问水电单'
        });
      }
    } else {
      const hasProjectPassword = await verifyProjectPassword(id, password);
      
      if (!hasProjectPassword) {
        return res.status(403).json({
          success: false,
          error: '密码错误或无权限访问'
        });
      }
    }
    
    const result = mapProjectRow(project);
    
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
    const { name, description, password, visible, projectKind } = req.body;
    const kind = projectKind === 'utility' ? 'utility' : 'rental';
    
    // 生成项目ID
    const id = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (kind === 'utility') {
      const sheetJson = JSON.stringify(defaultUtilitySheet());
      const sql = `
        INSERT INTO projects (
          id, name, description, password, visible, project_kind,
          properties, property_groups, expenses, utility_sheet, version
        )
        VALUES (?, ?, ?, NULL, ?, 'utility', '[]', '[]', '[]', ?, 1)
      `;
      await pool.execute(sql, [
        id,
        name,
        description || null,
        visible !== false,
        sheetJson
      ]);
      
      res.json({
        success: true,
        project: {
          id,
          name,
          description,
          visible: visible !== false,
          projectKind: 'utility',
          hasPassword: false,
          properties: [],
          propertyGroups: [],
          expenses: [],
          utilitySheet: defaultUtilitySheet(),
          version: 1
        }
      });
      return;
    }
    
    const hashedPassword = password ? await hashPassword(password) : null;
    
    const sql = `
      INSERT INTO projects (
        id, name, description, password, visible, project_kind,
        properties, property_groups, expenses, utility_sheet, version
      )
      VALUES (?, ?, ?, ?, ?, 'rental', ?, ?, ?, NULL, ?)
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
        projectKind: 'rental',
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

