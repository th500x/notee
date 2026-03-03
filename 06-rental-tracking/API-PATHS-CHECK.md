# 06-租赁追踪系统 API 路径检查清单

**检查日期**: 2026-03-04  
**检查人**: Kiro AI Assistant

---

## ✅ 所有 API 路径已验证正确

### 1. 配置文件 (src/config/index.js)

```javascript
// 生产环境配置
baseUrl: ''  // 空字符串，直接使用根路径
uploadBaseUrl: ''  // 空字符串，直接使用根路径
prefix: '/api/rental-tracking'
uploadPrefix: '/api/upload'
```

---

### 2. 项目管理 API (apiClient.js)

| 功能 | 前端路径 | 实际请求 | Nginx 代理 | 后端端口 | 状态 |
|------|---------|---------|-----------|---------|------|
| 获取项目列表 | `${baseUrl}${prefix}/` | `/api/rental-tracking/` | ✅ | 3003 | ✅ |
| 获取项目详情 | `${baseUrl}${prefix}/:id` | `/api/rental-tracking/:id` | ✅ | 3003 | ✅ |
| 创建项目 | `${baseUrl}${prefix}/` | `/api/rental-tracking/` | ✅ | 3003 | ✅ |
| 更新项目 | `${baseUrl}${prefix}/:id` | `/api/rental-tracking/:id` | ✅ | 3003 | ✅ |
| 删除项目 | `${baseUrl}${prefix}/:id` | `/api/rental-tracking/:id` | ✅ | 3003 | ✅ |
| 更新数据 | `${baseUrl}${prefix}/:id/data` | `/api/rental-tracking/:id/data` | ✅ | 3003 | ✅ |
| 更新记录 | `${baseUrl}${prefix}/:id/records` | `/api/rental-tracking/:id/records` | ✅ | 3003 | ✅ |
| 健康检查 | `${baseUrl}${prefix}/health` | `/api/rental-tracking/health` | ✅ | 3003 | ✅ |

---

### 3. 认证 API (authService.js)

| 功能 | 前端路径 | 实际请求 | Nginx 代理 | 后端端口 | 状态 |
|------|---------|---------|-----------|---------|------|
| 管理员登录 | `${baseUrl}/api/auth/login` | `/api/auth/login` | ✅ | 3001 | ✅ |
| 验证 Token | `${baseUrl}/api/auth/verify` | `/api/auth/verify` | ✅ | 3001 | ✅ |

**注意**: 认证 API 使用主站的认证服务（端口 3001），不是租赁追踪的 API。

---

### 4. 上传 API (uploadService.js)

| 功能 | 前端路径 | 实际请求 | Nginx 代理 | 后端端口 | 状态 |
|------|---------|---------|-----------|---------|------|
| 上传照片 | `${uploadBaseUrl}${uploadPrefix}/photos` | `/api/upload/photos` | ✅ | 3003 | ✅ |
| 删除照片 | `${uploadBaseUrl}${uploadPrefix}/photos/:id` | `/api/upload/photos/:id` | ✅ | 3003 | ✅ |

---

### 5. 同步 API (syncService.js)

| 功能 | 前端路径 | 实际请求 | Nginx 代理 | 后端端口 | 状态 |
|------|---------|---------|-----------|---------|------|
| 导出本地数据 | `${baseUrl}/api/rental-tracking/sync/export` | `/api/rental-tracking/sync/export` | ✅ | 3003 | ✅ |
| 导入本地数据 | `${baseUrl}/api/rental-tracking/sync/import` | `/api/rental-tracking/sync/import` | ✅ | 3003 | ✅ |
| 本地统计 | `${baseUrl}/api/rental-tracking/sync/stats` | `/api/rental-tracking/sync/stats` | ✅ | 3003 | ✅ |
| 导出生产数据 | `${productionUrl}/api/rental-tracking/sync/export` | `https://notee.vip/api/rental-tracking/sync/export` | ✅ | 3003 | ✅ |
| 导入生产数据 | `${productionUrl}/api/rental-tracking/sync/import` | `https://notee.vip/api/rental-tracking/sync/import` | ✅ | 3003 | ✅ |
| 生产统计 | `${productionUrl}/api/rental-tracking/sync/stats` | `https://notee.vip/api/rental-tracking/sync/stats` | ✅ | 3003 | ✅ |

---

## Nginx 配置验证

### 已配置的代理规则：

```nginx
# 1. 认证 API (主站) - 端口 3001
location ^~ /api/auth {
    proxy_pass http://127.0.0.1:3001/api/auth;
}

# 2. 租赁追踪 API - 端口 3003
location ^~ /api/rental-tracking/ {
    proxy_pass http://127.0.0.1:3003/api/rental-tracking/;
}

# 3. 上传 API - 端口 3003
location ^~ /api/upload/ {
    proxy_pass http://127.0.0.1:3003/api/upload/;
    client_max_body_size 10M;
}

# 4. 同步 API - 端口 3003
location ^~ /api/sync/ {
    proxy_pass http://127.0.0.1:3003/api/sync/;
}
```

**注意**: `/api/sync/` 这个配置实际上是多余的，因为同步 API 已经包含在 `/api/rental-tracking/sync/` 中了。

---

## 路径规则总结

### 生产环境路径构建规则：

1. **项目管理 API**:
   ```
   baseUrl (空) + prefix (/api/rental-tracking) + endpoint
   = /api/rental-tracking/xxx
   ```

2. **认证 API**:
   ```
   baseUrl (空) + /api/auth/xxx
   = /api/auth/xxx
   ```

3. **上传 API**:
   ```
   uploadBaseUrl (空) + uploadPrefix (/api/upload) + endpoint
   = /api/upload/xxx
   ```

4. **同步 API**:
   ```
   baseUrl (空) + /api/rental-tracking/sync/xxx
   = /api/rental-tracking/sync/xxx
   ```

---

## 本地开发环境路径

### 本地开发路径构建规则：

1. **项目管理 API**:
   ```
   baseUrl (http://localhost:3003) + prefix (/api/rental-tracking) + endpoint
   = http://localhost:3003/api/rental-tracking/xxx
   ```

2. **认证 API**:
   ```
   baseUrl (http://localhost:3003) + /api/auth/xxx
   = http://localhost:3003/api/auth/xxx
   ```
   **注意**: 本地开发时，认证 API 也指向 3003 端口（租赁追踪后端），而不是 3001（主站后端）。

3. **上传 API**:
   ```
   uploadBaseUrl (http://localhost:3003) + uploadPrefix (/api/upload) + endpoint
   = http://localhost:3003/api/upload/xxx
   ```

4. **同步 API**:
   ```
   baseUrl (http://localhost:3003) + /api/rental-tracking/sync/xxx
   = http://localhost:3003/api/rental-tracking/sync/xxx
   ```

---

## ✅ 检查结论

所有 API 路径配置正确，无需修改！

### 已验证的文件：
- ✅ `src/config/index.js` - 配置正确
- ✅ `src/utils/apiClient.js` - 路径正确
- ✅ `src/services/authService.js` - 路径正确
- ✅ `src/services/uploadService.js` - 路径正确
- ✅ `src/services/syncService.js` - 路径正确（已修复）

### Nginx 配置：
- ✅ 所有代理规则配置正确
- ⚠️ `/api/sync/` 配置可以删除（已被 `/api/rental-tracking/sync/` 包含）

---

**最后更新**: 2026-03-04  
**状态**: ✅ 所有路径验证通过
