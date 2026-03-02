# 部署标准与编码规范

**版本**: v1.7  
**更新时间**: 2026-03-02  
**适用范围**: notee.vip 所有项目

---

## 📋 目录

1. [项目结构规范](#项目结构规范)（🔥🔥🔥 最重要！铁律！必读！）
2. [文件管理规范](#文件管理规范)（🔥 最重要！必读！）
3. [Git同步规范](#git同步规范)（⚠️ 重要！必读！）
4. [Nginx配置规范](#nginx配置规范)（⚠️ 重要！必读！）
5. [文件编码规范](#文件编码规范)（⚠️ 重要！）
6. [密码管理规范](#密码管理规范)（⚠️ 重要！必读！）
7. [配置规范](#配置规范)
8. [编码规范](#编码规范)
9. [数据加载规范](#数据加载规范)
10. [部署检查清单](#部署检查清单)

---

## 🔥🔥🔥 项目结构规范（铁律！必读！）

### 🚨 绝对禁止：私自建立或迁移项目级别的文件夹/项目

> **这是最高优先级的铁律！违反此规范会导致严重的混乱和大量返工！**

---

### 问题案例（2026-03-02 - 主页项目重构）

#### 症状
- ❌ 错误地创建了 `00-homepage/` 子目录
- ❌ 导致目录结构重复和混乱
- ❌ 违反了项目结构简化、条理清晰的目标
- ❌ 需要大量时间进行迁移和修正

#### 根本原因
1. **未经授权创建新目录**：
   - AI助手自作主张创建了 `00-homepage/` 子目录
   - 应该直接在根目录重构主页项目
   - 没有事先询问用户意见

2. **目录结构混乱**：
   - `00-homepage/` 与根目录的 `src/` 重复
   - 配置文件分散在两个位置
   - 文档文件位置混乱

3. **浪费时间**：
   - 需要将所有文件从 `00-homepage/` 迁移到根目录
   - 需要更新配置文件
   - 需要重新安装依赖
   - 需要验证所有功能

---

### ✅ 正确的项目结构

```
/notee/                          # 根目录（主页项目）
├── src/                         # 主页React源代码
│   ├── components/             # 主页组件
│   ├── hooks/                  # 主页Hooks
│   ├── services/               # 主页API服务
│   └── utils/                  # 主页工具函数
├── backend/                     # 共享后端服务
│   ├── routes/                 # API路由
│   ├── middleware/             # 中间件
│   └── server.js              # 服务器入口
├── docs/                        # 项目文档
├── 01-news-calendar/           # 子项目1
│   ├── src/                    # 子项目源代码
│   ├── backend/                # 子项目后端（如果有）
│   └── dist/                   # 子项目构建输出
├── 02-tale-historical/         # 子项目2
├── 04-coin-index/              # 子项目3
├── 05-san-storm/               # 子项目4
├── 06-rental-tracking/         # 子项目5
├── index.html                  # 主页入口
├── package.json                # 主页依赖
├── vite.config.js             # 主页Vite配置
└── README.md                   # 项目说明
```

### ❌ 错误的项目结构（严重违规）

```
/notee/
├── 00-homepage/                # ❌ 严重错误！不要创建这个目录！
│   ├── src/                    # ❌ 与根目录src重复
│   ├── index.html             # ❌ 与根目录index.html重复
│   └── package.json           # ❌ 与根目录package.json重复
├── src/                        # ✅ 主页源代码应该直接在这里
├── index.html                  # ✅ 主页入口应该直接在这里
└── package.json               # ✅ 主页配置应该直接在这里
```

**为什么这样组织是错误的？**
1. 目录结构重复，违反DRY原则
2. 配置文件分散，难以管理
3. 路径引用混乱，容易出错
4. 违反项目结构简化的目标
5. 需要大量时间修正

---

### 核心铁律

#### 🚨 铁律1：严禁私自创建项目级别的目录

**什么是项目级别的目录？**
- 包含完整项目结构的目录（src/, dist/, package.json等）
- 与现有项目平级的新目录
- 任何形式的项目子目录（如 `00-homepage/`, `new-project/`等）

**正确做法：**
```
❌ 错误：创建 00-homepage/ 目录
✅ 正确：直接在根目录重构主页

❌ 错误：创建 new-feature/ 目录
✅ 正确：在现有项目的 src/ 下创建功能模块

❌ 错误：创建 temp-project/ 目录
✅ 正确：询问用户应该在哪里创建
```

#### 🚨 铁律2：任何目录结构变更必须事先询问用户

**必须询问的情况：**
- 创建新的项目目录
- 移动现有项目到新位置
- 重组目录结构
- 合并或拆分项目

**询问模板：**
```
"我需要为[功能]创建文件。有以下几个选项：
1. 在根目录的 src/ 下创建
2. 在现有项目 XX/ 下创建
3. 创建新的项目目录

您希望我采用哪种方式？"
```

#### 🚨 铁律3：遵循现有项目结构

**主页项目（根目录）：**
```
/notee/
├── src/              # 主页源代码
├── index.html        # 主页入口
├── package.json      # 主页依赖
└── vite.config.js   # 主页配置
```

**子项目（编号目录）：**
```
/notee/XX-project-name/
├── src/              # 子项目源代码
├── index.html        # 子项目入口
├── package.json      # 子项目依赖
└── vite.config.js   # 子项目配置
```

**共享服务：**
```
/notee/backend/       # 共享后端服务
/notee/docs/          # 项目文档
```

---

### 预防措施

#### 1. 创建任何目录前先思考

```
创建目录前问自己：
1. 这个目录是否会与现有结构重复？
2. 这个目录是否符合项目规范？
3. 用户是否明确要求创建这个目录？
4. 是否有更好的方式组织这些文件？
```

#### 2. 优先使用现有结构

```javascript
// ✅ 正确：使用现有的src目录
fsWrite({
  path: "src/components/NewComponent.jsx",
  text: "..."
});

// ❌ 错误：创建新的项目目录
fsWrite({
  path: "00-homepage/src/components/NewComponent.jsx",
  text: "..."
});
```

#### 3. 不确定时询问用户

```
当遇到以下情况时，必须询问用户：
- 需要创建新目录
- 需要移动文件到新位置
- 需要重组项目结构
- 不确定文件应该放在哪里
```

#### 4. 参考现有项目

```
在创建新内容前，先查看现有项目的结构：
- 01-news-calendar/ 的结构
- 02-tale-historical/ 的结构
- 根目录的结构

确保新内容符合现有规范
```

---

### 修正错误结构的步骤

如果已经错误地创建了项目目录，按以下步骤修正：

**步骤1：停止继续开发**
- 不要在错误的目录中继续添加内容
- 立即通知用户

**步骤2：制定迁移计划**
- 列出需要迁移的文件
- 确定正确的目标位置
- 识别需要更新的配置

**步骤3：执行迁移**
- 备份重要文件
- 移动文件到正确位置
- 更新配置文件
- 安装依赖

**步骤4：验证功能**
- 测试所有功能
- 检查路径引用
- 验证构建过程

**步骤5：清理旧目录**
- 删除错误的目录
- 更新文档
- 提交到Git

---

### 常见错误和解决方案

| 错误 | 原因 | 解决方案 | 预防措施 |
|------|------|---------|---------|
| 创建了重复的项目目录 | 未理解现有结构 | 迁移到正确位置 | 先查看现有结构 |
| 配置文件分散 | 在多个位置创建配置 | 合并到统一位置 | 使用现有配置 |
| 路径引用错误 | 目录结构混乱 | 统一路径引用 | 遵循现有规范 |
| 依赖重复安装 | 多个package.json | 使用统一依赖 | 不创建新项目目录 |

---

### 经验教训总结

1. **永远不要私自创建项目目录**
   - 任何项目级别的目录变更必须事先询问用户
   - 不要假设用户想要某种目录结构

2. **遵循现有项目规范**
   - 主页项目直接在根目录
   - 子项目使用编号目录（01-, 02-等）
   - 不要创建额外的嵌套层级

3. **保持结构简单清晰**
   - 避免不必要的目录嵌套
   - 每个项目的文件都在自己的目录下
   - 配置文件不要分散

4. **不确定时询问用户**
   - 宁可多问一句，也不要自作主张
   - 用户的明确指示优先于AI的判断

5. **及时修正错误**
   - 发现错误立即停止
   - 制定修正计划
   - 彻底清理错误内容

---

## 🔥 文件管理规范（最重要！必读！）

### 🚨 铁律：项目文件必须且只能放在项目目录下

> **这是最重要的规范！违反此规范会导致严重的问题，浪费大量时间！**

---

### 问题案例（2026-02-28 - 租赁追踪系统）

#### 症状
- ❌ 新添加的 API 路由返回 404
- ❌ 代码明明已经写好并同步到 GitHub
- ❌ 服务重启后仍然无法访问新路由
- ❌ 浪费大量时间排查问题

#### 根本原因
1. **文件放错位置**：
   - 错误地在 `/notee/backend/` 目录下创建了 `rental-tracking.js` 和 `rental-tracking-server.js`
   - 这些文件不属于根目录的共享后端服务

2. **实际运行的文件**：
   - PM2 运行的是 `/notee/06-rental-tracking/backend/server.js`
   - 这才是租赁追踪系统真正使用的后端文件

3. **修改了错误的文件**：
   - 一直在修改 `/notee/backend/rental-tracking.js`
   - 但这个文件根本没有被使用
   - 导致所有修改都无效

4. **配置混乱**：
   - 根目录的 `ecosystem.config.cjs` 包含了错误的租赁追踪配置
   - 应该使用 `06-rental-tracking/ecosystem.config.cjs`

---

### ✅ 正确的文件组织结构

```
/notee/                          # 根目录
├── backend/                     # 🔵 共享后端（仅用于跨项目服务）
│   ├── server.js               # 留言板服务器（端口3002）
│   └── guestbook.js            # 留言板路由
│
├── 01-news-calendar/           # 📰 新闻日历项目
│   ├── backend/                # ✅ 项目专属后端
│   │   └── server.js          # 新闻日历服务器（端口3001）
│   ├── src/                    # ✅ 项目前端代码
│   ├── dist/                   # ✅ 项目构建输出
│   └── ecosystem.config.cjs    # ✅ 项目PM2配置
│
├── 06-rental-tracking/         # 🏠 租赁追踪项目
│   ├── backend/                # ✅ 项目专属后端
│   │   ├── server.js          # ✅ 租赁追踪服务器（端口3003）
│   │   └── data/              # ✅ 项目数据文件
│   ├── src/                    # ✅ 项目前端代码
│   │   ├── components/        # ✅ 项目组件
│   │   ├── pages/             # ✅ 项目页面
│   │   └── utils/             # ✅ 项目工具函数
│   ├── dist/                   # ✅ 项目构建输出
│   ├── ecosystem.config.cjs    # ✅ 项目PM2配置
│   └── package.json           # ✅ 项目依赖
│
├── ecosystem.config.cjs        # 🔵 根目录PM2配置（仅包含共享服务）
├── index.html                  # 🔵 主页
└── package.json               # 🔵 根目录依赖
```

### ❌ 错误的文件组织（导致严重问题）

```
/notee/
├── backend/
│   ├── server.js
│   ├── guestbook.js
│   ├── rental-tracking.js       # ❌ 严重错误！不属于这里！
│   ├── rental-tracking-server.js # ❌ 严重错误！不属于这里！
│   └── test-routes.js           # ❌ 严重错误！测试文件不应该在这里！
│
├── 06-rental-tracking/
│   ├── backend/
│   │   └── server.js            # ✅ 这才是实际运行的文件
│   └── ...
│
├── rental-tracking-config.js    # ❌ 严重错误！应该在06-rental-tracking/下
└── ecosystem.config.cjs          # ❌ 包含了错误的租赁追踪配置
```

**为什么这样组织是错误的？**
1. 文件位置混乱，无法快速定位
2. 修改了错误的文件，浪费时间
3. PM2运行的不是修改的文件
4. 配置文件引用错误
5. 团队协作困难

### 核心原则

#### 1. 项目独立性原则

**每个项目的所有文件必须放在项目目录下**

```
✅ 正确：
/notee/06-rental-tracking/backend/server.js
/notee/06-rental-tracking/src/App.jsx
/notee/06-rental-tracking/ecosystem.config.cjs

❌ 错误：
/notee/backend/rental-tracking.js        # 不要放在根目录backend下
/notee/rental-tracking-config.js         # 不要放在根目录下
/notee/ecosystem.config.cjs              # 不要在根配置中包含子项目
```

#### 2. 后端服务分离原则

| 服务类型 | 位置 | 端口 | 说明 |
|---------|------|------|------|
| 共享服务 | `/notee/backend/` | 3002 | 留言板等跨项目服务 |
| 项目服务 | `/notee/XX-project/backend/` | 独立端口 | 每个项目独立后端 |

**示例**：
```
留言板服务：/notee/backend/server.js (端口 3002)
新闻日历：/notee/01-news-calendar/backend/server.js (端口 3001)
租赁追踪：/notee/06-rental-tracking/backend/server.js (端口 3003)
```

#### 3. PM2配置分离原则

**根目录 `ecosystem.config.cjs`**：
```javascript
module.exports = {
  apps: [
    // ✅ 只包含共享服务
    {
      name: 'notee-guestbook',
      script: './backend/server.js',
      cwd: '/www/wwwroot/notee',
      env: { PORT: 3002 }
    }
  ]
}
```

**项目目录 `06-rental-tracking/ecosystem.config.cjs`**：
```javascript
module.exports = {
  apps: [
    // ✅ 只包含本项目服务
    {
      name: 'rental-tracking-backend',
      script: './backend/server.js',
      cwd: '/www/wwwroot/notee/06-rental-tracking',
      env: { PORT: 3003 }
    }
  ]
}
```

### 文件创建和修改规范

#### 创建新文件时

**步骤1：确认文件应该放在哪里**
```
问自己：这个文件属于哪个项目？
- 如果是06项目的后端代码 → /notee/06-rental-tracking/backend/
- 如果是06项目的前端代码 → /notee/06-rental-tracking/src/
- 如果是06项目的配置文件 → /notee/06-rental-tracking/
- 如果是跨项目的共享代码 → /notee/backend/ 或 /notee/shared/
```

**步骤2：使用正确的路径创建**
```javascript
// ✅ 正确
fsWrite({
  path: "06-rental-tracking/backend/server.js",
  text: "..."
});

// ❌ 错误
fsWrite({
  path: "backend/rental-tracking.js",  // 不要放在根目录backend下
  text: "..."
});
```

#### 修改现有文件时

**步骤1：确认要修改的文件**
```bash
# 查找实际运行的文件
pm2 describe rental-tracking-backend | grep script

# 输出示例：
# script: /www/wwwroot/notee/06-rental-tracking/backend/server.js
```

**步骤2：修改正确的文件**
```javascript
// ✅ 正确：修改实际运行的文件
strReplace({
  path: "06-rental-tracking/backend/server.js",
  oldStr: "...",
  newStr: "..."
});

// ❌ 错误：修改了不相关的文件
strReplace({
  path: "backend/rental-tracking.js",  // 这个文件根本没有被使用
  oldStr: "...",
  newStr: "..."
});
```

### 诊断文件位置问题

#### 症状识别

| 症状 | 可能原因 |
|------|---------|
| API返回404但代码已写好 | 修改了错误的文件 |
| 重启服务后问题依旧 | PM2运行的不是修改的文件 |
| 本地测试正常但服务器不行 | 文件位置不一致 |
| 找不到模块或文件 | 文件放错了目录 |

#### 诊断步骤

**步骤1：确认PM2运行的文件**
```bash
pm2 list  # 查看所有进程
pm2 describe <process-name>  # 查看详细信息
```

**步骤2：检查文件是否存在**
```bash
ls -la /www/wwwroot/notee/06-rental-tracking/backend/
```

**步骤3：检查文件内容**
```bash
grep -n "router.put('/projects/:id/records'" /www/wwwroot/notee/06-rental-tracking/backend/server.js
```

**步骤4：检查PM2配置**
```bash
cat /www/wwwroot/notee/06-rental-tracking/ecosystem.config.cjs
```

### 清理错误文件

#### 识别错误文件

```bash
# 查找可能放错位置的文件
find /www/wwwroot/notee/backend -name "*rental*"
find /www/wwwroot/notee -maxdepth 1 -name "*rental*"
```

#### 删除错误文件

```javascript
// 删除放错位置的文件
deleteFile({ targetFile: "backend/rental-tracking.js" });
deleteFile({ targetFile: "backend/rental-tracking-server.js" });
```

#### 更新配置文件

```javascript
// 从根目录ecosystem.config.cjs中删除子项目配置
strReplace({
  path: "ecosystem.config.cjs",
  oldStr: "包含rental-tracking的配置",
  newStr: "删除该配置"
});
```

### 预防措施

#### 1. 创建文件前先思考

```
创建文件前问自己：
1. 这个文件属于哪个项目？
2. 这个项目的根目录在哪里？
3. 这类文件应该放在项目的哪个子目录？
4. 是否有类似的文件可以参考位置？
```

#### 2. 使用项目相对路径

```javascript
// ✅ 正确：使用项目相对路径
const projectRoot = "06-rental-tracking";
fsWrite({
  path: `${projectRoot}/backend/server.js`,
  text: "..."
});

// ❌ 错误：使用根目录相对路径
fsWrite({
  path: "backend/server.js",  // 不清楚是哪个项目的backend
  text: "..."
});
```

#### 3. 验证文件位置

```javascript
// 创建文件后验证
listDirectory({ path: "06-rental-tracking/backend" });

// 确认文件在正确的位置
readFile({ path: "06-rental-tracking/backend/server.js" });
```

#### 4. 文档化项目结构

在项目README中明确说明文件组织：

```markdown
## 项目结构

```
06-rental-tracking/
├── backend/          # 后端服务（端口3003）
│   ├── server.js    # Express服务器
│   └── data/        # 数据文件
├── src/             # 前端源代码
├── dist/            # 构建输出
└── ecosystem.config.cjs  # PM2配置
```

所有项目文件必须放在 `06-rental-tracking/` 目录下！
```

### 常见错误和解决方案

| 错误 | 原因 | 解决方案 | 预防措施 |
|------|------|---------|---------|
| API 404但代码存在 | 修改了错误的文件 | 检查PM2运行的文件路径 | 创建前确认文件位置 |
| 模块找不到 | 文件放错目录 | 移动到正确的项目目录 | 使用项目相对路径 |
| 配置不生效 | 使用了错误的配置文件 | 使用项目专属配置 | 分离项目配置 |
| 服务启动失败 | 路径引用错误 | 检查require/import路径 | 使用相对路径 |

### 经验教训总结

1. **永远不要把项目文件放在根目录**
   - 每个项目的文件必须在项目目录下
   - 包括后端代码、配置文件、数据文件

2. **修改前先确认文件位置**
   - 检查PM2实际运行的文件
   - 不要假设文件在某个位置

3. **保持项目独立性**
   - 每个项目有自己的backend目录
   - 每个项目有自己的PM2配置
   - 每个项目有自己的端口

4. **定期清理错误文件**
   - 删除放错位置的文件
   - 更新错误的配置引用
   - 保持目录结构清晰

5. **文档化项目结构**
   - 在README中说明文件组织
   - 提供文件位置示例
   - 标注关键文件路径

---

## ⚠️ Git同步规范（重要！必读！）

### 🚨 关键教训：必须完整同步所有修改到GitHub

#### 问题案例（2026-02-11）
在修复04-coin-index项目时，周一（2月9日）的修复从未提交到git，导致：
1. 本地有最新代码，但GitHub没有
2. 后续修改时从GitHub拉取，覆盖了本地的修复
3. 模拟演练和年终总结功能丢失
4. 需要重新修复相同的问题

#### ✅ 正确的同步流程

**当用户要求"全部同步到GitHub"时，必须执行以下步骤：**

```bash
# 1. 检查所有项目的状态
cd /path/to/notee
git status

# 2. 查看所有修改的文件
git diff --name-only

# 3. 添加所有修改
git add -A

# 4. 再次确认状态
git status

# 5. 提交（使用清晰的提交信息）
git commit -m "feat: 描述所有修改的内容"

# 6. 推送到GitHub
git push origin main

# 7. 验证推送成功
git log -1
```

#### ⚠️ 关键原则

1. **永远不要假设某个项目已经同步**
   - 即使刚刚修改过，也要检查 `git status`
   - 不要依赖记忆，因为AI不记得上次同步时间

2. **用户说"全部同步"就是全部同步**
   - 检查根目录和所有子目录
   - 使用 `git add -A` 而不是 `git add .`
   - 确保没有遗漏任何文件

3. **提交前必须验证**
   - 运行 `git status` 确认所有修改都已暂存
   - 运行 `git diff --cached` 查看即将提交的内容
   - 确认提交信息准确描述了所有修改

4. **推送后必须验证**
   - 检查 `git log` 确认提交成功
   - 如果可能，在GitHub网页上验证文件已更新

#### 📋 完整同步检查清单

使用此清单确保完整同步：

- [ ] 运行 `git status` 检查工作区状态
- [ ] 运行 `git diff --name-only` 查看所有修改的文件
- [ ] 运行 `git add -A` 添加所有修改
- [ ] 运行 `git status` 再次确认（应该显示 "Changes to be committed"）
- [ ] 运行 `git commit -m "..."` 提交修改
- [ ] 运行 `git push origin main` 推送到GitHub
- [ ] 运行 `git log -1` 验证最新提交
- [ ] 运行 `git status` 最终确认（应该显示 "nothing to commit, working tree clean"）

#### 🔍 常见遗漏场景

| 场景 | 问题 | 解决方案 |
|------|------|---------|
| 只修改了一个项目 | 以为只需要同步这个项目 | 使用 `git add -A` 同步所有修改 |
| 修改了多个文件 | 只添加了部分文件 | 检查 `git status` 确保所有文件都已添加 |
| 本地测试通过 | 以为已经同步了 | 推送前运行 `git log` 确认提交存在 |
| 修改了配置文件 | 忘记提交配置文件 | 使用 `git diff --name-only` 查看所有修改 |

#### 💡 最佳实践

1. **每次修改后立即同步**
   - 不要积累多个修改再一起同步
   - 每个功能完成后立即提交

2. **使用清晰的提交信息**
   - 格式：`类型: 简短描述`
   - 类型：feat（新功能）、fix（修复）、refactor（重构）、docs（文档）
   - 示例：`feat: 04项目添加利率指标和修复个人评级颜色`

3. **定期验证GitHub状态**
   - 在GitHub网页上查看最新提交时间
   - 确认关键文件的修改已经同步

4. **遇到冲突立即解决**
   - 不要忽略 `git pull` 的冲突提示
   - 手动解决冲突后再推送

---

## ⚠️ Nginx配置规范（重要！必读！）

### 🚨 关键错误：全局静态资源规则导致404

#### 问题描述
在nginx配置中添加全局的静态资源缓存规则会导致子项目的JS/CSS文件返回404，页面显示空白。

#### ❌ 错误配置（会导致空白页）
```nginx
server {
    listen 443 ssl;
    server_name notee.vip;
    root /www/wwwroot/notee;
    
    # 子项目配置
    location /02-tale-historical/ {
        alias /www/wwwroot/notee/02-tale-historical/dist/;
        try_files $uri $uri/ /02-tale-historical/index.html;
    }
    
    # ❌ 错误：这个规则会拦截所有.js/.css文件
    # 导致子项目的assets/index.js返回404
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
```

#### 为什么会出错？
1. nginx按照配置顺序匹配location
2. 正则表达式location（`~*`）的优先级高于前缀location
3. 当访问 `/02-tale-historical/assets/index.js` 时：
   - 先匹配到 `~* \.(js|...)$` 规则
   - 这个规则没有指定root或alias
   - 导致nginx在错误的路径查找文件
   - 返回404错误

#### ✅ 正确配置方案

**方案1：删除全局静态资源规则（推荐）**
```nginx
server {
    listen 443 ssl;
    server_name notee.vip;
    root /www/wwwroot/notee;
    
    # 主页
    location = / {
        try_files /index.html =404;
    }
    
    # 子项目配置
    location /01-news-calendar/ {
        alias /www/wwwroot/notee/01-news-calendar/dist/;
        try_files $uri $uri/ /01-news-calendar/index.html;
    }
    
    location /02-tale-historical/ {
        alias /www/wwwroot/notee/02-tale-historical/dist/;
        try_files $uri $uri/ /02-tale-historical/index.html;
    }
    
    location /05-san-storm/ {
        alias /www/wwwroot/notee/05-san-storm/dist/;
        try_files $uri $uri/ /05-san-storm/index.html;
    }
    
    # ✅ 不添加全局静态资源规则
    # 让每个location自己处理静态文件
}
```

**方案2：在每个location内部添加缓存（如果需要）**
```nginx
location /02-tale-historical/ {
    alias /www/wwwroot/notee/02-tale-historical/dist/;
    try_files $uri $uri/ /02-tale-historical/index.html;
    
    # ✅ 在location内部添加缓存头
    location ~ \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**方案3：使用^~前缀提高优先级**
```nginx
# 使用^~确保子项目location优先匹配
location ^~ /02-tale-historical/ {
    alias /www/wwwroot/notee/02-tale-historical/dist/;
    try_files $uri $uri/ /02-tale-historical/index.html;
}

# 全局静态资源规则放在最后
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Nginx Location匹配优先级

理解优先级可以避免配置错误：

```
1. = 精确匹配（最高优先级）
   location = /path

2. ^~ 前缀匹配（高优先级，匹配后不再检查正则）
   location ^~ /path/

3. ~ 和 ~* 正则匹配（按配置顺序）
   location ~ \.js$
   location ~* \.(js|css)$

4. 普通前缀匹配（最低优先级）
   location /path/
```

### 诊断步骤

当子项目显示空白页时：

**步骤1：检查浏览器控制台**
- 按F12打开开发者工具
- 查看Console标签是否有错误
- 查看Network标签，找到404的请求

**步骤2：测试文件访问**
```bash
# 测试index.html（应该返回200）
curl -I https://notee.vip/02-tale-historical/

# 测试JS文件（应该返回200，如果返回404就是nginx配置问题）
curl -I https://notee.vip/02-tale-historical/assets/index-xxx.js
```

**步骤3：检查nginx配置**
```bash
# 查看配置
cat /www/server/panel/vhost/nginx/your-site.conf

# 查找全局静态资源规则
grep -n "location.*\.(js|css" /www/server/panel/vhost/nginx/your-site.conf
```

**步骤4：修复配置**
```bash
# 编辑配置
nano /www/server/panel/vhost/nginx/your-site.conf

# 删除或注释掉全局静态资源规则
# location ~* \.(js|css|...)$ { ... }

# 测试配置
nginx -t

# 重载nginx
nginx -s reload
```

### 经验教训总结

| 问题 | 原因 | 解决方案 | 预防措施 |
|------|------|---------|---------|
| 子项目空白页 | 全局静态资源规则拦截 | 删除全局规则 | 不添加全局正则location |
| JS/CSS返回404 | location优先级问题 | 使用^~提高优先级 | 理解nginx匹配顺序 |
| 部分文件404 | alias路径配置错误 | 检查alias末尾斜杠 | 统一使用末尾斜杠 |

### 标准Nginx配置模板

```nginx
# HTTP重定向到HTTPS
server {
    listen 80;
    server_name notee.vip www.notee.vip;
    return 301 https://notee.vip$request_uri;
}

# HTTPS服务器
server {
    listen 443 ssl http2;
    server_name notee.vip www.notee.vip;
    
    root /www/wwwroot/notee;
    index index.html;
    
    # SSL证书
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # SSL优化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # 安全头部
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # 主页
    location = / {
        try_files /index.html =404;
    }
    
    # 子项目（使用^~确保优先匹配）
    location ^~ /01-news-calendar/ {
        alias /www/wwwroot/notee/01-news-calendar/dist/;
        try_files $uri $uri/ /01-news-calendar/index.html;
    }
    
    location ^~ /02-tale-historical/ {
        alias /www/wwwroot/notee/02-tale-historical/dist/;
        try_files $uri $uri/ /02-tale-historical/index.html;
    }
    
    location ^~ /05-san-storm/ {
        alias /www/wwwroot/notee/05-san-storm/dist/;
        try_files $uri $uri/ /05-san-storm/index.html;
    }
    
    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # ⚠️ 不要添加全局静态资源规则！
    # ❌ location ~* \.(js|css|...)$ { ... }
}
```

### 关键要点

1. ✅ **不要添加全局静态资源正则规则**
2. ✅ **使用^~前缀提高子项目location优先级**
3. ✅ **location和alias路径末尾统一加斜杠**
4. ✅ **每次修改后测试：nginx -t && nginx -s reload**
5. ✅ **遇到空白页先检查JS/CSS是否404**

---

## ⚠️ 密码管理规范（重要！必读！）

### 🚨 关键教训：密码字段的保存和加载问题

#### 问题案例（2026-02-26 - 租赁追踪系统）

**症状**：
- 退出管理员后，有密码的项目直接显示完整信息，没有显示锁定状态（🔒）
- 编辑项目时，密码输入框显示为空
- 用户以为密码没有保存，实际上是前端逻辑问题

**根本原因**：
1. **后端安全措施**：API返回项目列表时，为了安全会移除 `password` 字段，只返回 `hasPassword` 布尔值
2. **前端编辑逻辑错误**：编辑项目时直接使用 `project.password`，但这个字段已经被后端移除了
3. **保存逻辑错误**：保存时如果密码字段为空，会把现有密码清空

#### ❌ 错误的实现方式

```javascript
// ❌ 错误1：编辑时直接使用 project.password（已被后端移除）
const handleEditProject = (project) => {
  setEditingProject({
    ...project,
    password: project.password || '',  // ❌ project.password 是 undefined
  })
}

// ❌ 错误2：保存时总是更新密码字段（即使为空）
const handleSaveProject = async () => {
  await updateProjectInfo(projectId, {
    name: editingProject.name,
    password: editingProject.password,  // ❌ 空字符串会清空现有密码
  })
}

// ❌ 错误3：后端无条件更新密码
router.put('/projects/:id', async (req, res) => {
  const { password } = req.body;
  project.password = password;  // ❌ 空字符串会清空现有密码
})
```

#### ✅ 正确的实现方式

**前端：编辑项目时**
```javascript
// ✅ 正确：不显示现有密码，提供清晰的提示
const handleEditProject = (project) => {
  setEditingProject({
    ...project,
    password: '',  // 留空，不显示现有密码
    passwordPlaceholder: project.hasPassword 
      ? '留空表示不修改密码'  // 有密码的项目
      : '留空表示无需密码',   // 无密码的项目
  })
}
```

**前端：保存项目时**
```javascript
// ✅ 正确：只有当密码输入框有内容时才更新密码
const handleSaveProject = async () => {
  const updateData = {
    name: editingProject.name,
    description: editingProject.description,
  }
  
  // 只有当密码输入框有内容时才更新密码
  if (editingProject.password) {
    updateData.password = editingProject.password
  }
  
  await updateProjectInfo(projectId, updateData)
}
```

**前端：密码输入框UI**
```jsx
{/* ✅ 正确：使用动态提示文本 */}
<input
  type="password"
  value={project.password || ''}
  onChange={(e) => onChange({ ...project, password: e.target.value })}
  placeholder={project.passwordPlaceholder || '留空表示无需密码'}
/>
<p className="text-xs text-gray-500 mt-1">
  {project.passwordPlaceholder || '设置后，访问此项目需要输入密码'}
</p>
```

**后端：更新项目时**
```javascript
// ✅ 正确：只有当 password 字段存在时才更新
router.put('/projects/:id', async (req, res) => {
  const { password } = req.body;
  
  // 只有当 password 字段存在时才更新密码
  // undefined = 不更新，空字符串 = 清除密码
  if (password !== undefined) {
    project.password = password;
  }
})
```

**后端：返回项目列表时**
```javascript
// ✅ 正确：移除密码字段，返回 hasPassword 布尔值
router.get('/projects', async (req, res) => {
  const projects = data.projects.map(project => {
    const { password, ...projectData } = project;
    return {
      ...projectData,
      hasPassword: !!password  // 转换为布尔值
    };
  });
  
  res.json({ success: true, projects });
})
```

### 密码管理的核心原则

#### 1. 前后端分离原则

| 层级 | 职责 | 不应该做 |
|------|------|---------|
| 后端 | 存储和验证密码 | ❌ 返回明文密码 |
| 前端 | 显示密码状态（有/无） | ❌ 存储明文密码 |
| API | 传输 hasPassword 布尔值 | ❌ 传输密码明文 |

#### 2. 编辑密码的UX原则

```
新建项目：
- 密码输入框：空
- 提示文本："留空表示无需密码"
- 保存逻辑：保存输入的密码（可以为空）

编辑项目（有密码）：
- 密码输入框：空（不显示现有密码）
- 提示文本："留空表示不修改密码"
- 保存逻辑：只有输入新密码时才更新

编辑项目（无密码）：
- 密码输入框：空
- 提示文本："留空表示无需密码"
- 保存逻辑：只有输入密码时才设置
```

#### 3. 密码验证的状态管理

```javascript
// ✅ 正确：不保存解锁状态，每次都重新验证
const handleSelectProject = async (project) => {
  // 管理员直接访问
  if (isAdmin) {
    onProjectSelect(project)
    return
  }
  
  // 没有密码的项目直接访问
  if (!project.hasPassword) {
    onProjectSelect(project)
    return
  }
  
  // 有密码的项目，每次都需要输入密码
  await handleUnlockProject(project)
}

// ❌ 错误：保存解锁状态（会导致退出管理员后仍然显示为解锁）
const [unlockedProjects, setUnlockedProjects] = useState(new Set())
```

### 常见错误和解决方案

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| 编辑项目时密码框为空 | 后端不返回密码字段 | ✅ 正常现象，添加提示文本 |
| 保存后密码被清空 | 前端总是发送空密码 | ✅ 只有输入新密码时才发送 |
| 退出管理员后仍显示解锁 | 保存了解锁状态 | ✅ 不保存状态，每次验证 |
| 无法设置密码 | 后端忽略空字符串 | ✅ 区分 undefined 和空字符串 |

### 调试密码问题的步骤

**步骤1：检查后端返回的数据**
```javascript
// 在浏览器控制台查看
console.log('Project data:', project);
console.log('hasPassword:', project.hasPassword);
console.log('password field:', project.password);  // 应该是 undefined
```

**步骤2：检查前端状态**
```javascript
// 在编辑对话框打开时查看
console.log('Editing project:', editingProject);
console.log('Password value:', editingProject.password);
console.log('Placeholder:', editingProject.passwordPlaceholder);
```

**步骤3：检查保存请求**
```javascript
// 在保存时查看发送的数据
console.log('Update data:', updateData);
// 应该只在有新密码时包含 password 字段
```

**步骤4：检查后端日志**
```javascript
// 在后端路由中添加日志
console.log('Received update:', req.body);
console.log('Password field:', req.body.password);
console.log('Password is undefined:', req.body.password === undefined);
```

### 安全最佳实践

#### 1. 密码传输
```javascript
// ✅ 正确：使用HTTPS传输
// ✅ 正确：密码字段使用 type="password"
// ✅ 正确：不在URL中传递密码
// ✅ 正确：使用POST/PUT请求体传递密码

// ❌ 错误：在URL中传递密码
fetch(`/api/projects?password=${password}`)  // ❌ 不安全

// ✅ 正确：在请求体中传递密码
fetch('/api/projects', {
  method: 'POST',
  body: JSON.stringify({ password })
})
```

#### 2. 密码存储
```javascript
// ✅ 推荐：使用bcrypt等加密算法（生产环境）
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(password, 10);

// ⚠️ 可接受：明文存储（仅用于简单项目）
// 注意：不要在生产环境使用明文密码
```

#### 3. 密码验证
```javascript
// ✅ 正确：每次访问都验证密码
// ✅ 正确：管理员可以绕过密码验证
// ✅ 正确：验证失败返回明确的错误信息

// ❌ 错误：保存解锁状态在localStorage
// ❌ 错误：使用前端验证代替后端验证
```

### 参考实现

可以参考以下项目的密码管理实现：
- `02-tale-historical`：分类密码保护，使用 `unlockedCategories` 状态
- `06-rental-tracking`：项目密码保护，每次访问都验证

### 经验教训总结

1. **不要假设后端返回密码字段**
   - 后端为了安全会移除密码字段
   - 使用 `hasPassword` 布尔值判断是否有密码

2. **编辑时不显示现有密码**
   - 提供清晰的提示文本
   - 只有输入新密码时才更新

3. **不要保存解锁状态**
   - 每次访问都重新验证密码
   - 退出管理员时自动上锁

4. **区分 undefined 和空字符串**
   - `undefined`：不更新密码
   - 空字符串：清除密码
   - 非空字符串：设置新密码

5. **提供良好的用户体验**
   - 清晰的提示文本
   - 合理的默认行为
   - 明确的错误信息

---

---

## ⚠️ 文件编码规范（重要！必读！）

### 强制要求

**所有文本文件必须使用UTF-8编码（无BOM）**

#### 为什么重要？
- ❌ 错误的编码会导致中文乱码
- ❌ 乱码文件无法正常编辑和查看
- ❌ 会影响git提交和团队协作
- ❌ 修复乱码非常耗时且容易出错

#### 适用文件类型
以下文件类型必须严格遵守UTF-8编码：
- ✅ Markdown文档（.md）
- ✅ JavaScript/JSX文件（.js, .jsx）
- ✅ JSON数据文件（.json）
- ✅ CSV数据文件（.csv）
- ✅ 配置文件（.config.js, .json）

### 创建新文件的正确方式

#### 方法1：使用Kiro AI的fsWrite工具（推荐）
```javascript
// fsWrite会自动使用UTF-8编码
fsWrite({
  path: "05-san-storm/docs/new-file.md",
  text: "# 标题\n\n内容..."
});
```

#### 方法2：使用VS Code
- 右下角选择"UTF-8"
- 确保没有BOM（Byte Order Mark）
- 保存文件

#### 方法3：使用PowerShell（Windows）
```powershell
# 正确方式：使用.NET方法（无BOM）
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)

# 或者明确指定UTF8
$content | Set-Content -Path "file.md" -Encoding UTF8
```

### 修改现有文件的正确方式

#### ❌ 错误方式（会导致乱码）
```powershell
# 不要这样做！
Set-Content -Path "file.md" -Value $content  # 默认编码可能不是UTF-8
Get-Content "file.md" | Set-Content "file.md"  # 可能改变编码
```

#### ✅ 正确方式
```powershell
# 方式1：明确指定UTF-8
$content = Get-Content "file.md" -Raw -Encoding UTF8
$content = $content -replace 'old', 'new'
Set-Content -Path "file.md" -Value $content -Encoding UTF8

# 方式2：使用.NET方法（推荐，无BOM）
$content = Get-Content "file.md" -Raw -Encoding UTF8
$content = $content -replace 'old', 'new'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path "file.md"), $content, $utf8NoBom)
```

### 检测和修复乱码文件

#### 如何识别乱码
```bash
# 正常文本
玩家系统文档

# 乱码文本（如果看到这样的字符，说明文件已乱码）
鐜╁绯荤粺鏂囨。
```

#### 修复步骤

**步骤1：从git恢复（最佳方案）**
```bash
git checkout HEAD -- path/to/file.md
```

**步骤2：如果git中也是乱码，删除并重新创建**
```bash
# 1. 删除乱码文件
rm path/to/file.md

# 2. 使用Kiro AI的fsWrite重新创建
# 3. 确保内容正确且使用UTF-8编码
```

**步骤3：使用Python转换编码（备用方案）**
```python
# 尝试多种编码读取
encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030']
for enc in encodings:
    try:
        with open(file, 'r', encoding=enc) as f:
            content = f.read()
        # 检查是否包含中文
        if '系统' in content or '文档' in content:
            # 写回UTF-8
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ 成功用 {enc} 读取并转换为UTF-8")
            break
    except:
        continue
```

### Git提交前检查清单

#### 必须检查
- [ ] 文件在编辑器中显示正常（无乱码）
- [ ] 中文字符显示正确
- [ ] `git diff`显示正常
- [ ] 文件大小合理（乱码文件通常会变大）

#### Git配置（确保使用UTF-8）
```bash
git config --global core.quotepath false
git config --global gui.encoding utf-8
git config --global i18n.commit.encoding utf-8
git config --global i18n.logoutputencoding utf-8
```

### 常见错误和解决方案

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| 中文显示为乱码 | 编码不是UTF-8 | 从git恢复或重新创建 |
| PowerShell显示乱码 | 终端编码问题 | 使用`chcp 65001`切换到UTF-8 |
| git diff显示乱码 | git配置问题 | 配置git使用UTF-8 |
| 文件无法读取 | 编码混乱 | 删除并重新创建 |
| 保存后变乱码 | 编辑器编码设置错误 | 检查编辑器设置 |

### VS Code配置（推荐）

```json
// settings.json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "files.eol": "\n"
}
```

### 预防措施

1. **始终使用UTF-8**
   - 创建文件时明确指定UTF-8
   - 修改文件时保持UTF-8编码
   - 不要使用记事本等简单编辑器

2. **定期检查**
   - 每次提交前检查文件编码
   - 发现乱码立即修复
   - 不要提交乱码文件

3. **团队协作**
   - 统一使用支持UTF-8的编辑器
   - 配置编辑器默认使用UTF-8
   - 发现问题及时通知团队

---

## 配置规范

### 1. Vite配置标准

**文件**: `vite.config.js`

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // ✅ 必须：子路径部署的base配置
  base: '/05-san-storm/',
  
  // ✅ 推荐：路径别名配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  
  // ✅ 必须：构建配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',  // 统一资源目录名称
    sourcemap: false,     // 生产环境禁用sourcemap
  },
});
```

**关键规则**：
- ✅ `base` 必须以 `/` 开头和结尾
- ✅ `assetsDir` 统一使用 `assets`
- ✅ `outDir` 统一使用 `dist`

### 2. React Router配置

**文件**: `src/App.jsx`

```javascript
import { BrowserRouter as Router } from 'react-router-dom';

function App() {
  return (
    // ✅ 必须：basename与vite.config.js的base保持一致
    <Router basename="/05-san-storm">
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </Router>
  );
}
```

### 3. 数据路径配置

**文件**: `src/utils/constants.js`

```javascript
// ✅ 必须：使用BASE_URL动态构建路径
const BASE_PATH = import.meta.env.BASE_URL || '/';

export const DATA_PATHS = {
  TROOPS: `${BASE_PATH}data/shared/troops.json`,
  CHARACTERS: `${BASE_PATH}data/shared/characters.json`,
};
```

---

## 编码规范

### 1. 数据加载规范

#### ✅ 正确方式：使用统一的dataLoader

```javascript
import { loadSharedData } from '@/utils/dataLoader';

// 正确
useEffect(() => {
  loadSharedData('troops')
    .then(data => setTroops(data.troops || []))
    .catch(err => setError(err.message));
}, []);
```

#### ❌ 错误方式：直接使用fetch

```javascript
// 错误：硬编码路径
useEffect(() => {
  fetch('/data/shared/troops.json')
    .then(res => res.json())
    .then(data => setTroops(data.troops));
}, []);
```

### 2. 组件规范

```javascript
/**
 * 组件名称
 * @param {Object} props - 组件属性
 */
export function ComponentName({ name }) {
  return <div>{name}</div>;
}

// ✅ 必须：PropTypes验证
ComponentName.propTypes = {
  name: PropTypes.string.isRequired,
};
```

---

## 数据加载规范

### 统一的数据加载流程

```
用户请求 → Hook → dataLoader → constants.DATA_PATHS → fetch → 返回数据
```

### 关键规则

1. ✅ 所有数据加载必须使用 `dataLoader`
2. ✅ 统一错误处理
3. ✅ 统一路径管理
4. ❌ 不要直接使用 `fetch`
5. ❌ 不要硬编码数据路径

---

## 部署检查清单

### 本地检查
- [ ] vite.config.js配置了base路径
- [ ] Router配置了basename
- [ ] 所有数据加载使用dataLoader
- [ ] 所有文件使用UTF-8编码（⚠️ 重要）
- [ ] 本地构建成功：`npm run build`

### 服务器检查
- [ ] 代码已同步：`git pull`
- [ ] 构建成功：`npm run build`
- [ ] dist目录完整
- [ ] nginx配置正确（⚠️ 检查是否有全局静态资源规则）
- [ ] 所有文件编码正确（无乱码）

### Nginx配置检查（⚠️ 重要）
- [ ] 没有全局静态资源正则规则（`location ~* \.(js|css|...)`）
- [ ] 子项目location使用^~前缀
- [ ] location和alias路径末尾有斜杠
- [ ] try_files的fallback路径正确
- [ ] nginx -t 测试通过
- [ ] nginx -s reload 重载成功

### 功能测试
- [ ] 主页能访问
- [ ] 导航链接正常
- [ ] 子项目页面不是空白（⚠️ 重要）
- [ ] 浏览器Network标签无404错误（⚠️ 重要）
- [ ] JS/CSS文件正常加载
- [ ] 数据加载正常
- [ ] 浏览器控制台无错误
- [ ] 中文显示正常（无乱码）

---

## 总结

### 核心原则

1. **Git同步**：每次修改后立即同步，不要积累多个修改⚠️
2. **Nginx配置**：不要添加全局静态资源正则规则⚠️
3. **文件编码**：始终使用UTF-8（无BOM）⚠️
4. **密码管理**：不显示现有密码，只在输入新密码时更新⚠️
5. **配置一致性**：vite base、Router basename、数据路径保持一致
6. **统一工具**：使用 dataLoader 统一处理数据加载
7. **避免硬编码**：使用 BASE_URL 动态构建路径

### 最佳实践

1. ✅ 使用^~前缀提高location优先级
2. ✅ 使用路径别名（`@/`）
3. ✅ 统一数据加载方法
4. ✅ 添加完整的类型检查
5. ✅ 编写清晰的注释
6. ✅ 遵循组件规范
7. ✅ 确保文件编码正确

### 避免的错误

1. ❌ 不完整的Git同步（导致代码丢失）⚠️
2. ❌ 添加全局静态资源正则规则（导致空白页）⚠️
3. ❌ 使用错误的文件编码（导致乱码）⚠️
4. ❌ 编辑时总是更新密码字段（导致密码被清空）⚠️
5. ❌ 硬编码绝对路径
6. ❌ 直接使用 fetch
7. ❌ 混用不同的数据加载方法
8. ❌ 忽略 PropTypes 验证
9. ❌ 缺少错误处理

---

**文档版本**: v1.4  
**创建日期**: 2026-02-10  
**最后更新**: 2026-02-26  
**维护者**: Kiro AI Assistant  
**适用项目**: 真三风云 (05-san-storm)、租赁追踪 (06-rental-tracking)

**重要更新**：
- v1.4 (2026-02-26): 添加密码管理规范，记录密码保存和加载的常见问题
- v1.3 (2026-02-11): 添加Git同步规范，强调完整同步的重要性
- v1.2 (2026-02-11): 添加Nginx配置规范，记录全局静态资源规则导致空白页的问题
