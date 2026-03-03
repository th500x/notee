/**
 * 数据同步路由
 * 提供本地和生产环境之间的数据同步功能
 */

const express = require('express');
const router = express.Router();
const db = require('../database/connection');

/**
 * 导出所有数据
 * GET /api/sync/export
 */
router.get('/export', async (req, res) => {
  try {
    console.log('[Sync] 导出数据');
    
    const projects = await db.query(
      'SELECT * FROM projects ORDER BY created_at DESC'
    );
    
    const exportData = {
      version: '2.0',
      exportTime: new Date().toISOString(),
      projectCount: projects.length,
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        password: project.password,
        visible: project.visible,
        // MySQL 返回的是 JSON 字符串，需要解析
        properties: typeof project.properties === 'string' 
          ? JSON.parse(project.properties) 
          : (project.properties || []),
        property_groups: typeof project.property_groups === 'string'
          ? JSON.parse(project.property_groups)
          : (project.property_groups || []),
        expenses: typeof project.expenses === 'string'
          ? JSON.parse(project.expenses)
          : (project.expenses || []),
        version: project.version,
        created_at: project.created_at,
        updated_at: project.updated_at
      }))
    };
    
    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('[Sync] 导出数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 导入数据
 * POST /api/sync/import
 * Body: { data: exportData, mode: 'merge' | 'replace' }
 */
router.post('/import', async (req, res) => {
  try {
    const { data, mode = 'merge' } = req.body;
    
    if (!data || !data.projects) {
      return res.status(400).json({
        success: false,
        error: '无效的导入数据'
      });
    }
    
    console.log('[Sync] 导入数据', { mode, projectCount: data.projects.length });
    
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    // 如果是替换模式，先清空所有数据
    if (mode === 'replace') {
      await db.query('DELETE FROM projects');
      console.log('[Sync] 已清空现有数据');
    }
    
    // 导入每个项目
    for (const project of data.projects) {
      try {
        // 检查项目是否已存在
        const existing = await db.query(
          'SELECT id FROM projects WHERE id = ?',
          [project.id]
        );
        
        if (existing.length > 0) {
          if (mode === 'merge') {
            // 合并模式：更新现有项目
            await db.query(
              `UPDATE projects SET 
                name = ?,
                description = ?,
                password = ?,
                visible = ?,
                properties = ?,
                property_groups = ?,
                expenses = ?,
                version = ?,
                updated_at = NOW()
              WHERE id = ?`,
              [
                project.name,
                project.description,
                project.password,
                project.visible,
                JSON.stringify(project.properties),
                JSON.stringify(project.property_groups),
                JSON.stringify(project.expenses),
                project.version,
                project.id
              ]
            );
            updatedCount++;
            console.log(`[Sync] 更新项目: ${project.name}`);
          } else {
            skippedCount++;
          }
        } else {
          // 插入新项目
          // 转换日期格式：ISO -> MySQL datetime
          const createdAt = project.created_at 
            ? new Date(project.created_at).toISOString().slice(0, 19).replace('T', ' ')
            : new Date().toISOString().slice(0, 19).replace('T', ' ');
          const updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
          
          await db.query(
            `INSERT INTO projects (
              id, name, description, password, visible,
              properties, property_groups, expenses, version,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              project.id,
              project.name,
              project.description,
              project.password,
              project.visible,
              JSON.stringify(project.properties),
              JSON.stringify(project.property_groups),
              JSON.stringify(project.expenses),
              project.version,
              createdAt,
              updatedAt
            ]
          );
          importedCount++;
          console.log(`[Sync] 导入项目: ${project.name}`);
        }
      } catch (error) {
        console.error(`[Sync] 导入项目失败: ${project.name}`, error);
        // 继续处理下一个项目
      }
    }
    
    res.json({
      success: true,
      message: '数据导入完成',
      stats: {
        total: data.projects.length,
        imported: importedCount,
        updated: updatedCount,
        skipped: skippedCount
      }
    });
  } catch (error) {
    console.error('[Sync] 导入数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取数据统计
 * GET /api/sync/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const projects = await db.query('SELECT * FROM projects');
    
    let totalProperties = 0;
    let totalRecords = 0;
    
    projects.forEach(project => {
      // MySQL 返回的是 JSON 字符串，需要解析
      const properties = typeof project.properties === 'string' 
        ? JSON.parse(project.properties) 
        : (project.properties || []);
      
      totalProperties += properties.length;
      
      properties.forEach(property => {
        totalRecords += (property.records || []).length;
      });
    });
    
    res.json({
      success: true,
      stats: {
        projectCount: projects.length,
        propertyCount: totalProperties,
        recordCount: totalRecords,
        lastUpdate: projects.length > 0 
          ? Math.max(...projects.map(p => new Date(p.updated_at).getTime()))
          : null
      }
    });
  } catch (error) {
    console.error('[Sync] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
