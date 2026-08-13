# 22-one-line — One Line / 今日一句 API

Notee Go「今日一句」后端。产品设计见 sibling `KIRO/notee-go` → `docs/02-One-Line.md`。

- **库表规则：** [`docs/SCHEMA.md`](./docs/SCHEMA.md)  
- **站长改库：** [`docs/MODERATION.md`](./docs/MODERATION.md)  
- **生产部署：** [`docs/DEPLOY.md`](./docs/DEPLOY.md)

| 项 | 值 |
|----|-----|
| 端口 | **3022** |
| 对外 | `https://notee.vip/api/oneline/*` |
| 库名 | `22_one_line` |
| PM2 | `one-line-backend` |
| 阶段 | **P5** — + TTL + 月榜 |

## 常用命令（与 05 同形式）

在仓库根目录 `notee/` 下：

```bash
# 安装后端依赖
cd 22-one-line/backend && npm install

# 首次启动 PM2（仅一次；在 22-one-line 目录）
cd /www/wwwroot/notee/22-one-line
pm2 start ecosystem.config.cjs

# 重启 PM2 进程（日常发版）
pm2 restart one-line-backend
```

发版常见组合：

```bash
cd 22-one-line/backend && npm install
pm2 restart one-line-backend
```

建表 / 迁移（配好 `backend/.env` 后）：

```bash
cd 22-one-line/backend && npm run db:migrate
```

## 本地启动

```bash
cd 22-one-line/backend
cp .env.example .env   # 必填 JWT_SECRET（>=16）
npm install
npm run db:migrate
npm run dev
# 手动跑每日任务：
npm run jobs:daily
```

`DISABLE_CRON=1` 可关闭进程内定时任务（便于测试）。

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| … | auth / me / posts / feed / resonance / report / blocks | P1–P4 |
| GET | `/api/oneline/posts/mine` | 作者现存帖（未软删、未过期）；`created_at DESC` |
| GET | `/api/oneline/board?month=YYYY-MM` | 默认**当月** live Top 30；往月读快照（缺则固化） |

正文：统一预算 100（汉字占 2，其余占 1）。客户端 + 服务端双拦。

日界 / 月界：**UTC+7**。每日 **00:15 Asia/Bangkok**：软删过期帖 + 固化上月榜。  
月榜为快照（`monthly_board`），帖过期后榜仍在。

## 生产

完整步骤（DB / JWT / Nginx / PM2 / 冒烟 / App）：见 **[`docs/DEPLOY.md`](./docs/DEPLOY.md)**。

简版：建库 → `backend/.env`（独立 `JWT_SECRET`、`MIGRATION_ASSUME_DB_EXISTS=1`）→ `npm run db:migrate` → Nginx `/api/oneline` → `3022` → 上方 PM2 命令。

若以前用旧 `ecosystem`（cwd 在项目根）起过进程，改布局后请：

```bash
pm2 delete one-line-backend
cd /www/wwwroot/notee/22-one-line
pm2 start ecosystem.config.cjs
pm2 save
```
