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
| 阶段 | **P7** — + 短号注册 / 登录（`login_id` + 密码） |

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
| POST | `/api/oneline/posts/pour` | 酒局结构化卡；与写一句分计；每天最多 2 局；拒图片字段 |
| GET | `/api/oneline/posts/today/me` | `{ canPost, canPostLine, canPostPour, pourLimit, pourUsed, post, pourPost, pourPosts[] }`；旧 `canPost` = 写一句；`pourPost` 兼容第一条 |
| GET | `/api/oneline/auth/login-id/candidates` | `?count=9&exclude=AB12,CD34` → `{ loginIds[], partial, prefix }`；当前字母档内抽 9 个（3×3）；App 刷新一次并保留两批 |
| POST | `/api/oneline/auth/register` | `{ loginId, password }` + Bearer → 短号绑**当前**户；无 Bearer 401 |
| POST | `/api/oneline/auth/login` | `{ loginId, password, deviceKey? }` → `{ token, expiresAt, user }`；带 `deviceKey` 则本机改挂该户 |
| GET | `/api/oneline/gifts/inbox` | Bearer；当前户待领运营赠品（`stamp` / 日后 `pet`） |
| POST | `/api/oneline/gifts/:id/claim` | Bearer；先记领取再返回 payload；已领过仍 200（崩溃重放） |

账号规则正本：sibling `notee-go` → `docs/00-1-Account.md`。冒烟 `npm run smoke:login-id`。  
短号软删即回池（狮子号回活动池，不进自动出号）；`password_hash` 不出参。  
狮子号（`0000`…`9999` / `AAAA`…`ZZZZ`）不进候选；发放：`npm run grant:lion -- <userUuid> AAAA`（户须已有普通短号）。

运营赠品（无公开发放口，与狮子号同形）。参数中文说明见 sibling `notee-go` → `docs/00-2-Home-Top-Bar.md` §3.5。

```bash
# 单个短号 + 领取页标题（--title 显示在 App 领取行）
npm run gift:create -- --audience login_ids --ids AB12 --kind stamp --id th_lopburi --title "New Year Gift"

# 多个短号同样写法，逗号分隔
npm run gift:create -- --audience login_ids --ids AB12,CD34 --kind stamp --id th_lopburi --title "New Year Gift"

# 全员发章；--require-login = 必须已注册短号才能领（Limited 建议打开）
npm run gift:create -- --audience all --kind stamp --id th_lopburi --require-login --title "New Year Gift"

# 查某号待领（不领取）
npm run gift:inbox -- AB12

# 取消活动（已领的章不收回）
npm run gift:cancel -- <campaignId>

npm run test:gifts
```

Pass / 荣耀受众等 `users.pass_at` / `honor_at` 再开。客户端认 `kind=stamp`；PET 袋未开时 inbox 里的 `pet` 会被 App 滤掉。

酒局帖 `PATCH` → `POUR_NO_EDIT`。写一句每天 1；酒局每天最多 2。软删仍占该名额。

**QA 临时开关（测完必须 `false`，与 App 一起关）：**  
- `backend/services/postService.js` → `POUR_TEST_RESYNC_AFTER_DELETE`：删酒局帖释放当天名额。App 对应 `PourRules.TEST_RESYNC_AFTER_DELETE`。  
- `backend/lib/pourPayload.js` → `POUR_TEST_SHORT_PUBLISH_GAP`：可发布时长下限改为 **5 分钟**（正本 30 分钟，上限仍 6h）。App 对应 `PourRules.TEST_SHORT_PUBLISH_GAP`。  

测完这两处都改回 `false`，并同时把 App 那两个开关也改回 `false`。漏关任一端，线上会按测试规则走。清单见 sibling `notee-go` → `docs/04-Pour-Check.md`。

正文：统一预算 100（汉字占 2，其余占 1）。客户端 + 服务端双拦。

日界 / 月界：**UTC+7**。每日 **00:15 Asia/Bangkok**：软删过期帖 + 清 30 天无心跳的静默户 + 固化上月榜。  
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
