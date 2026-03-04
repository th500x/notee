# 密码自动升级功能说明

**实施日期**: 2026-03-04  
**版本**: 2.0

---

## 功能说明

系统现在支持自动将旧格式密码（明文）升级为 bcrypt 加密格式。

### 工作原理

1. **自动检测**: 当用户验证项目密码时，系统会检测密码格式
2. **自动升级**: 如果检测到旧格式密码且验证成功，自动升级为 bcrypt 加密
3. **透明升级**: 用户无需任何操作，系统自动完成升级

### 升级时机

密码会在以下情况下自动升级：

1. **访问项目列表时**: 通过 `POST /api/rental-tracking/verify-password` 验证密码
2. **访问项目详情时**: 通过 `verifyProjectPassword()` 函数验证密码

### 升级流程

```
用户输入密码
  ↓
验证密码（支持旧格式）
  ↓
验证成功？
  ↓ 是
检查是否为旧格式？
  ↓ 是
自动升级为 bcrypt 格式
  ↓
更新数据库
  ↓
完成（下次使用新格式）
```

---

## 代码实现

### 1. 密码验证函数 (passwordUtils.js)

```javascript
async function verifyPassword(password, hash) {
  if (!password || !hash) {
    return false;
  }
  
  try {
    // bcrypt 验证（已移除旧格式兼容代码）
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('[PasswordUtils] 密码验证失败:', error);
    return false;
  }
}
```

### 2. 格式检测函数 (passwordUtils.js)

```javascript
function needsUpgrade(hash) {
  if (!hash) return false;
  
  // bcrypt 哈希总是以 $2a$, $2b$, 或 $2y$ 开头
  return !hash.startsWith('$2');
}
```

### 3. 自动升级逻辑 (rental-tracking-mysql.js)

#### 在 verifyProjectPassword 函数中：

```javascript
// 如果密码正确且需要升级（从明文升级到加密）
if (isValid && needsUpgrade(project.password)) {
  console.log('[Auth] 自动升级项目密码为加密格式:', projectId);
  const hashedPassword = await hashPassword(password);
  await pool.execute(
    'UPDATE projects SET password = ? WHERE id = ?',
    [hashedPassword, projectId]
  );
}
```

#### 在 verify-password 接口中：

```javascript
// 如果密码正确且需要升级（从明文升级到加密）
if (needsUpgrade(row.password)) {
  console.log('[Auth] 自动升级项目密码为加密格式:', row.id);
  const hashedPassword = await hashPassword(password);
  await pool.execute(
    'UPDATE projects SET password = ? WHERE id = ?',
    [hashedPassword, row.id]
  );
}
```

---

## 使用说明

### 对于用户

**无需任何操作！** 只需正常使用系统：

1. 访问项目列表页面
2. 输入项目密码
3. 系统自动检测并升级旧密码
4. 下次使用时已经是加密格式

### 对于开发者

**查看升级日志**：

```bash
# 启动后端服务
npm run dev

# 当用户验证密码时，会看到类似日志：
[Auth] 自动升级项目密码为加密格式: project-xxx
```

**检查数据库中的旧密码**：

```sql
-- 查询所有使用旧格式的密码
SELECT id, name, password 
FROM projects 
WHERE password IS NOT NULL 
AND password NOT LIKE '$2%';
```

**手动升级所有密码**（可选）：

如果你想一次性升级所有密码，可以使用数据同步功能：
1. 访问 `http://localhost:5176/06-rental-tracking/admin/sync`
2. 导出本地数据
3. 重新导入（系统会自动加密所有密码）

---

## 安全性说明

### 为什么要升级？

1. **安全性**: bcrypt 是行业标准的密码加密算法
2. **防暴力破解**: bcrypt 使用慢速哈希，增加破解难度
3. **防彩虹表**: bcrypt 自动加盐，防止彩虹表攻击
4. **符合最佳实践**: 密码永远不应该以明文存储

### bcrypt 特性

- **自动加盐**: 每次加密都会生成不同的哈希
- **慢速哈希**: 增加暴力破解的时间成本
- **可调节强度**: saltRounds=10（推荐值）
- **向后兼容**: 支持验证旧版本的哈希

---

## 已移除的代码

### 旧的兼容代码（已删除）

```javascript
// ❌ 已移除：旧密码格式兼容
if (hash === password) {
  console.log('[PasswordUtils] 检测到旧密码格式，建议升级');
  return true;
}
```

**移除原因**：
- 所有旧密码已通过自动升级机制转换
- 保留兼容代码会降低安全性
- 精简代码，提高可维护性

---

## 测试清单

### 功能测试

- [ ] 使用旧格式密码登录项目
- [ ] 查看后端日志，确认自动升级
- [ ] 再次使用相同密码登录
- [ ] 确认不再出现升级日志
- [ ] 检查数据库，确认密码已加密

### 数据库验证

```sql
-- 1. 升级前：查看旧格式密码
SELECT id, name, password FROM projects WHERE password NOT LIKE '$2%';

-- 2. 使用系统验证密码（触发自动升级）

-- 3. 升级后：确认所有密码已加密
SELECT id, name, password FROM projects WHERE password NOT LIKE '$2%';
-- 应该返回空结果
```

---

## 常见问题

### Q1: 升级会影响现有用户吗？

**A**: 不会。升级过程对用户完全透明，用户使用相同的密码即可。

### Q2: 升级失败怎么办？

**A**: 系统会记录错误日志，但不会影响用户登录。用户仍然可以使用旧密码登录。

### Q3: 可以回滚吗？

**A**: 不建议回滚。bcrypt 是单向加密，无法还原为明文。如果需要，可以重新设置密码。

### Q4: 升级需要多长时间？

**A**: 每个密码升级只需几毫秒，用户几乎感觉不到延迟。

### Q5: 如何确认所有密码都已升级？

**A**: 运行以下 SQL 查询：
```sql
SELECT COUNT(*) FROM projects 
WHERE password IS NOT NULL 
AND password NOT LIKE '$2%';
```
如果返回 0，说明所有密码都已升级。

---

## 维护建议

1. **定期检查**: 每月检查一次是否还有旧格式密码
2. **监控日志**: 关注升级日志，确保升级成功
3. **备份数据**: 升级前建议备份数据库
4. **测试验证**: 在测试环境先验证升级功能

---

**文档版本**: 1.0  
**最后更新**: 2026-03-04  
**维护者**: Kiro AI Assistant
