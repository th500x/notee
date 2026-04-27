# 06 租赁追踪（Rental Tracking）

本目录为 **notee** 仓库中的独立子项目：租赁台账、水电单、**账目单** 等；前后端分离，本地默认对接 **XAMPP 3.x / MariaDB**。

---

## 一、技术栈与端口

| 部分 | 技术 | 默认端口 / 路径 |
|------|------|------------------|
| 前端 | Vite + React | **http://localhost:5176**，`base` 为 **`/06-rental-tracking/`**（开发时浏览器地址通常为 `http://localhost:5176/06-rental-tracking/`） |
| 后端 | Express + MySQL2 | **http://localhost:3003**，API 前缀 **`/api/rental-tracking`** |
| 数据库 | MariaDB / MySQL | 库名默认 **`06_rental_tracking`**（见 `backend/.env`） |

根目录 `notee-monorepo-layout-and-backends` 约定：06 专属后端端口为 **3003**，勿与其它子项目混用。

---

## 二、首次本地环境

### 2.1 数据库

1. 启动 XAMPP 中的 **MySQL**。
2. 在 `backend/` 下复制 **`backend/.env.example`** 为 **`backend/.env`**，按本机填写 `DB_HOST`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`（默认库名 `06_rental_tracking`）。
3. 若库表尚未初始化，可按仓库内 `backend/database/schema.sql` 或既有流程建库建表（以你团队约定为准）。

### 2.2 迁移脚本（列变更）

在 **`06-rental-tracking/backend`** 目录执行：

| 脚本 | 作用 |
|------|------|
| `npm run migrate:utility` | 应用 `001-add-project-kind-utility-sheet.sql`（项目种类、水电单 JSON 等） |
| `npm run migrate:accounting` | 应用 `002-add-accounting-sheet.sql`，为 `projects` 表增加 **`accounting_sheet`**（JSON，仅 `project_kind = accounting` 使用） |

已存在同名列时会输出 **`SKIP: ... already exists.`**，可安全重复执行。

### 2.3 后端依赖与启动

```bash
cd backend
npm install
npm start
```

开发可选用 `npm run dev`（nodemon）。环境变量由 `server.js` 加载：**先** `backend/.env`，**再** `backend/.env.local`（后者覆盖前者）。

### 2.4 前端依赖与启动

在子项目根目录（本 `README.md` 所在目录）：

```bash
npm install
npm run dev
```

可选环境变量见下文；API 基址逻辑见 `src/config/index.js`（开发默认 `http://localhost:3003`，也可用 `VITE_API_URL` 覆盖）。

---

## 三、项目种类（`project_kind`）

| 值 | 说明 |
|----|------|
| `rental` | 默认租赁项目：房源、收租记录、开支等 |
| `utility` | 水电单项目：`utility_sheet` JSON，无房源级登录密码 |
| `accounting` | **账目单** 项目：`accounting_sheet` JSON，无房源级登录密码 |

未登录「全局管理员」时，公开列表接口只返回 **`rental`**；**`utility` / `accounting`** 仅在管理员视角下展示与创建（见第五节本地旁路）。

---

## 四、账目单功能说明（`accounting_sheet`）

账目单用于在**两个月**的时间窗口内记录租金相关格子、固定支出类目、以及由公式汇总得到的月度盈余（**收入口径 = 各房当月 IN − OUT 的自动 SETTLE 之和**）。

### 4.1 数据存哪里

- **MySQL**：表 **`projects`**，列 **`accounting_sheet`**（`JSON NULL`），仅当 **`project_kind = 'accounting'`** 时有业务意义。
- **API 响应 / 前端**：驼峰字段 **`accountingSheet`**（与后端 `mapProjectRow` 一致）。

### 4.2 JSON 结构（逻辑模型）

顶层字段：

| 字段 | 类型 | 含义 |
|------|------|------|
| `monthKeys` | `[string, string]` | 两个自然月，格式 **`YYYY-MM`**，约定为 **[上月, 本月]**（相对「今天」或切换窗口时的基准日） |
| `rentRows` | `array` | 租金表行，每行多个月份格子 |
| `expenseRows` | `array` | 固定支出类目行（每类两行月份格，仅 `out`） |
| `monthlySummary` | `object` | 按 `YYYY-MM` 存放 **`{ balance }`**，由前端根据租金与支出**重算**后写回（见 4.5） |

**租金行 `rentRows[]`**（每条）主要字段：

- `id`：行 id（服务端归一化时可为新行生成）
- `room`、`agency`、`remarks`：自由文本（列较窄时 UI 用 `title` 做悬停/长按提示全文）
- `declaration`、`actualRent`：存 **ISO `YYYY-MM-DD`**，界面展示为 **`YYYY/M/D`**（如 `2026/3/1`）；旧数据非 ISO 会在归一化时清空
- `price`、`deposit`：算术公式串（见 4.3）
- `months`：键为 `monthKeys` 中的月份，值为 **`{ in, out, settle, payRent }`**
  - `in` / `out`：算术公式串
  - **`settle`**：由 **`IN − OUT`** 自动计算（存库时由前后端 `normalize` 写入数值字符串，界面只读）
  - **`payRent`**：存 **ISO 日期**，展示为 **`M/D`**；编辑时只填**月/日**，**年份取该列 `monthKey` 的年份**（`parseMdTextToIso`），避免原生 date 控件的「年/月/日」整段输入。

**支出行 `expenseRows[]`**：

- 固定 **7 个类目**（与后端 `EXPENSE_CATEGORY_KEYS` 一致）：`FAMILY`、`TRAFFIC`、`SHOPPING`、`ENTERTM`、`EATING`、`HEALTH`、`DRINKING`
- 每行 `months[YYYY-MM].out` 为支出金额串（公式规则同下）

### 4.3 公式格（算术表达式）

- 单元格内容为**字符串**；可为 **`=1+2*3`** 形式（前导 `=` 会去掉再算）或纯 **`1+2*3`**。
- **仅允许**数字与 `+ - * / ( )` 及空格（白名单正则），**不支持**引用其它单元格、不支持字母函数。
- 实现见前端 `src/utils/accountingExpression.js`（`evaluateArithmeticExpression`）；非法或无法求值时展示为 **—**。

### 4.4 收入与「SETTLE」

- 每格 **SETTLE** = 该月该行的 **`evaluateArithmeticExpression(in) − evaluateArithmeticExpression(out)`**；非有限数按 **0** 参与（`computeSettleFromInOut`）。
- 月度汇总**收入侧**：对当月所有行上述 SETTLE **求和**（`sumSettleForMonth`）。
- **支出侧**：各支出类目当月 **`out`** 求和（`sumExpenseOutForMonth`）。
- **`monthlySummary[YYYY-MM]`**：可选字段 **`income`**、**`expense`**、**`balance`**。当前双月窗口在保存时由 `withComputedMonthlySummary` 根据租金/支出表写入三者；**其它月份**可由脚本 `import:history-monthly` 从 `history.md` 合并，仅用于「收支账目」展示，不改动租金/支出明细。

### 4.5 双月窗口与「切换当月」

- 界面以 **`monthKeys`** 两列为表头（展示上可格式化为类似 `2026/4/1`）。
- **切换当月 / 对齐自然月**：逻辑在 `src/utils/accountingSheetModel.js` 的 **`rolloverAccountingWindowFromToday`**：若旧窗口右月等于新窗口左月则**左移**复制一列数据；否则清空两月格子并套用新 `monthKeys`（避免跨月丢数据策略在产品层定义）。

### 4.6 前端页面结构

- 入口：从首页进入 **`projectKind === 'accounting'`** 的项目后打开 **`AccountingSheetPage`**（三 Tab：**租金 / 支出 / 汇总**）。
- 公式输入用 **`AccountingFormulaCell`**；申报/实际/交租用 **`AccountingDateIsoCell`**（`src/utils/accountingDates.js`）；保存调用 **`apiClient.updateAccountingSheet(projectId, sheet)`**。

### 4.7 后端 API 与校验

- **保存**：`PUT /api/rental-tracking/:id/accounting-sheet`  
  - 需通过 **`verifyToken`**（JWT）；请求体 **`{ accountingSheet }`**。  
  - 使用 **`accountingSheetUpdateSchema`**（Joi）校验；写入前 **`normalizeAccountingSheet`**（`backend/utils/accountingSheet.js`），与前端结构对齐。  
  - **`monthlySummary` 合并**：保存时会把请求体里的 `monthlySummary` **叠在库内已有之上**（同月键以请求为准），避免前端只带当前双月汇总时**整份覆盖**抹掉 `history.md` 脚本导入的历史月。  
  - 若项目 **`project_kind` 不是 `accounting`** 会拒绝更新。
- **创建账目项目**：走创建项目接口并指定 **`projectKind: 'accounting'`**（无租赁密码字段）；服务端写入默认 `accounting_sheet` JSON。
- **同步**：`backend/routes/sync.js` 已包含 **`accounting_sheet`** 的导入导出字段，避免备份恢复丢列。

### 4.8 与水电单（`utility`）的共性

- 二者在列表中均依赖**管理员身份**；详情与编辑入口与 `utility` 共用部分弹窗文案（`UtilityBillFormModal` 的 `variant`）。

---

## 五、认证与本地开发旁路（重要）

### 5.1 正常行为（生产或提交前应保持）

- **全局管理员**：通过主站颁发的 JWT，存于前端 `localStorage`（见 `tokenManager` / `useAdmin`），请求头带 **`Authorization: Bearer <token>`**。
- 无有效 JWT 时：**列表不展示** `utility` / `accounting`，**写操作**依赖 JWT 的路由会 **401**。

### 5.2 仅本地：临时旁路（便于不测主站登录）

复制示例文件并启用开关（**二者建议成对使用**）：

| 文件 | 变量 | 作用 |
|------|------|------|
| **`backend/.env.local`** | `RENTAL_TRACKING_DEV_SKIP_JWT=1` | `decodeTokenOptional` 将请求视为已认证；`verifyToken` 跳过校验；**列表等同管理员可见全部 `project_kind`**。控制台会打 `[Auth] RENTAL_TRACKING_DEV_SKIP_JWT=1` 警告。 |
| **子项目根目录 `.env.development.local`** | `VITE_RENTAL_TRACKING_DEV_SKIP_ADMIN=1` | 仅在 **Vite `DEV`** 下：`useAdmin` 直接 **`isLoggedIn === true`**，UI 上可点创建账目单等。 |

示例模板：

- `backend/.env.local.example`
- `.env.development.local.example`

### 5.3 推送 GitHub 前必做（安全）

1. **删除或注释**上述两个文件中的 **`RENTAL_TRACKING_DEV_SKIP_JWT`**、**`VITE_RENTAL_TRACKING_DEV_SKIP_ADMIN`**，或删除整个本地文件（若文件仅含旁路用途）。  
2. **不要**将真实的 **`backend/.env`**（含 `JWT_SECRET`、数据库密码、OSS 密钥）提交到仓库。  
3. 重新启动后端与前端，确认未带旁路时行为符合「仅 JWT 管理员可操作敏感能力」。

> **说明**：`.env.local`、`.env.development.local` 通常已在 `.gitignore` 中；若误提交含 `=1` 的旁路文件，等于把「免 JWT」开关泄露给克隆仓库的人，务必在 PR 前检查 `git status`。

---

## 六、其它命令与路径速查

| 路径 | 说明 |
|------|------|
| `backend/server.js` | 入口；端口 `PORT` 默认 3003 |
| `backend/rental-tracking-mysql.js` | 主业务路由（含 `accounting-sheet`） |
| `backend/middleware/auth.js` | JWT 与 `RENTAL_TRACKING_DEV_SKIP_JWT` |
| `backend/middleware/validation.js` | Joi schema，含 `accountingSheetUpdateSchema` |
| `backend/database/migrations/002-add-accounting-sheet.sql` | 账目单列 DDL |
| `src/hooks/useAdmin.js` | `VITE_RENTAL_TRACKING_DEV_SKIP_ADMIN` |
| `src/config/index.js` | `VITE_API_URL`、`VITE_UPLOAD_API_URL` 等 |

**危险操作**：`npm run db:reset-local`（在 `backend`）会按脚本重置本地数据，执行前请确认脚本说明与备份。

### 6.1 历史收支导入（`history.md` → `monthlySummary`）

- **文件位置（默认）**：子项目根目录 **`history.md`**（与 `backend/` 同级）。格式：**制表符**分隔；第一列日期 **`YYYY/M/D`**（如 `2024/4/1`）；第二列 **IN**（收入）；第三列 **OUT**（支出）；数字可含英文逗号千分位。
- **命令**（在 **`06-rental-tracking/backend`**）：

```bash
npm run import:history-monthly -- --project-id=<账目项目 id>
# 自定义路径:
node scripts/import-history-monthly-summary.js --project-id=<id> --file="D:/Google Docs/KIRO/notee/06-rental-tracking/history.md"
# 只看解析结果不写库:
node scripts/import-history-monthly-summary.js --project-id=<id> --dry-run
```

- **行为**：把每行合并进该项目的 **`accounting_sheet.monthlySummary`**（键为 **`YYYY-MM`**，写入 `income` / `expense` / `balance`），再经 **`normalizeAccountingSheet`** 写回 MySQL；**租金记录 / 支出记录 Tab 不变**，「收支账目」按时间列出所有月份，非当前双月窗口行带 **「历史」** 标记。
- **前端同步**：账目页打开时会 **`GET /api/rental-tracking/:id`** 拉最新 `accountingSheet`（避免仍停留在进入页面前列表里的旧快照）。脚本改库后**重新进入该项目**或刷新即可看到历史行；若本地未登录管理员导致 403，需先具备访问账目单的权限。

---

## 七、构建与预览

```bash
npm run build
npm run preview
```

生产部署时由站点 Nginx 等将 **`/api/rental-tracking`** 反代到本后端；前端 `PROD` 下 API `baseUrl` 可为空字符串以走同域代理（见 `src/config/index.js`）。

如有与主站联调、OSS、同步备份的更多约定，可在此 README 后续追加章节，保持**本文件为 06 子项目唯一说明文档**即可。
