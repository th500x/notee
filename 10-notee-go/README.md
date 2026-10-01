# 10-notee-go — One Line / 今日一句 API

Notee Go「今日一句」后端。产品设计见 sibling `KIRO/notee-go` → `docs/02-One-Line.md`。

- **库表规则：** [`docs/SCHEMA.md`](./docs/SCHEMA.md)  
- **站长改库：** [`docs/MODERATION.md`](./docs/MODERATION.md)  
- **生产部署：** [`docs/DEPLOY.md`](./docs/DEPLOY.md)

| 项 | 值 |
|----|-----|
| 端口 | **3010** |
| 对外 | `https://notee.vip/api/notee-go/*` |
| 库名 | `10_notee_go` |
| PM2 | `10-notee-go-backend` |
| 阶段 | **P8** — + 新闻笔记 RSS 采集（24 小时清单 + 每区月榜 Top 10） |

## 扫码落地页 `/sp/`

`sp/index.html` 是系统相机扫 `https://notee.vip/sp/1#ABCD` 打开的静态页。nginx 直接出文件，**不走** 3010，也不用重启 PM2。

把 nginx 里 `/sp/` 的 `alias` 指到本目录（旧的 `22-notee-go-sp` 可以删）：

```nginx
location ^~ /sp/ {
    alias /www/wwwroot/notee/10-notee-go/sp/;
    try_files $uri $uri/ /sp/index.html;
}
```

`git pull` 之后刷新即生效。改过 nginx 才需要 `nginx -s reload`。

## 常用命令（与 05 同形式）

在仓库根目录 `notee/` 下：

```bash
# 安装后端依赖
cd 10-notee-go/backend && npm install

# 首次启动 PM2（仅一次；在 10-notee-go 目录）
cd /www/wwwroot/notee/10-notee-go
pm2 start ecosystem.config.cjs

# 重启 PM2 进程（日常发版）
pm2 restart 10-notee-go-backend
```

发版常见组合：

```bash
cd 10-notee-go/backend && npm install
pm2 restart 10-notee-go-backend
```

建表 / 迁移（配好 `backend/.env` 后）：

```bash
cd 10-notee-go/backend && npm run db:migrate
```

## 本地启动

```bash
cd 10-notee-go/backend
cp .env.example .env   # 必填 JWT_SECRET（>=16）
npm install
npm run db:migrate
npm run dev
# 手动跑每日任务：
npm run jobs:daily
# 手动采一次新闻（会真去请求 RSS，并冻结已结束月份）：
npm run jobs:news
```

`DISABLE_CRON=1` 可关闭进程内定时任务（便于测试）。

## API 摘要

| 方法 | 路径 | 说明 |
|------|------|------|
| … | auth / me / posts / feed / resonance / report / blocks | P1–P4 |
| GET | `/api/notee-go/posts/mine` | 作者现存帖（未软删、未过期）；`created_at DESC` |
| GET | `/api/notee-go/board?month=YYYY-MM` | 默认**当月** live Top 30；往月读快照（缺则固化） |
| POST | `/api/notee-go/posts/pour` | 酒局结构化卡；与写一句分计；每天最多 2 局；拒图片字段 |
| GET | `/api/notee-go/posts/today/me` | `{ canPost, canPostLine, canPostPour, pourLimit, pourUsed, post, pourPost, pourPosts[] }`；旧 `canPost` = 写一句；`pourPost` 兼容第一条 |
| GET | `/api/notee-go/auth/login-id/candidates` | `?count=9&exclude=AB12,CD34` → `{ loginIds[], partial, prefix }`；当前字母档内抽 9 个（3×3）；App 刷新一次并保留两批 |
| POST | `/api/notee-go/auth/register` | `{ loginId, password }` + Bearer → 短号绑**当前**户；无 Bearer 401 |
| POST | `/api/notee-go/auth/login` | `{ loginId, password, deviceKey? }` → `{ token, expiresAt, user }`；带 `deviceKey` 则本机改挂该户 |
| GET | `/api/notee-go/gifts/inbox` | Bearer；当前户待领运营赠品（`stamp` / `pet`） |
| POST | `/api/notee-go/gifts/:id/claim` | Bearer；先记领取再返回 payload；已领过仍 200（崩溃重放） |
| GET | `/api/notee-go/stamp/bag` | Bearer；当前户整袋（库存 + 签到窗 + 开户自选 flag）。无行则 `revision: 0` |
| PUT | `/api/notee-go/stamp/bag` | Bearer；`revision` 必须大于云端；否则 409 `STAMP_BAG_STALE` |
| GET | `/api/notee-go/pour/bag` | Bearer；开瓶账 + 最近 30 条无图历史。无行则 `revision: 0`。原片不上云 |
| PUT | `/api/notee-go/pour/bag` | Bearer；`revision` 必须大于云端；否则 409 `POUR_BAG_STALE`。拒图片字段；历史最多 30 条 |
| GET | `/api/notee-go/pet/bag` | Bearer；当前户宠物袋（个体 JSON + P-Points + 默认出战 + 首赠闩 + Tonight 日）。无行则 `revision: 0`。已领赠品 id 不在此袋 |
| PUT | `/api/notee-go/pet/bag` | Bearer；`revision` 必须大于云端；否则 409 `PET_BAG_STALE` |
| POST | `/api/notee-go/lyric/proposals` | Bearer；灵感库提议 `{ songs: [{ title, artist? }] }` 一次 1–5 首；写入 `lyric_proposals`；无公开 GET |
| GET | `/api/notee-go/news?region=bkk` | 新闻笔记最近 24 小时，新的在上，最多 8 条 `{ regionId, items: [{ title, publisher, url, publishedAt }] }`；无需登录 |
| GET | `/api/notee-go/news/board?region=bkk&month=YYYY-MM` | 默认**当月** live Top 10；冻结过的往月读 `news_monthly_board`；`source: live \| frozen`。GET 不写库 |

账号规则正本：sibling `notee-go` → `docs/00-1-Account.md`。冒烟 `npm run smoke:login-id`。  
短号软删即回池（狮子号回活动池，不进自动出号）；`password_hash` 不出参。  
狮子号（`0000`…`9999` / `AAAA`…`ZZZZ`）不进候选；发放：`npm run grant:lion -- <userUuid> AAAA`（户须已有普通短号）。

运营赠品（无公开发放口，与狮子号同形）。参数中文说明见 sibling `notee-go` → `docs/00-2-Home-Top-Bar.md` §3.5。

```bash
# 单个短号 + 领取页标题（--title 显示在 App 领取行）
npm run gift:create -- --audience login_ids --ids TTGO --kind stamp --id th_lopburi --title "New Year Gift"

# Region 泰国 12 城
npm run gift:create -- --audience login_ids --ids TTGO --kind stamp --series region --country th --title "Thailand Region"

# Limited 泰国（现 1 枚：th_lopburi）
npm run gift:create -- --audience login_ids --ids TTGO --kind stamp --series limited --country th --title "Lopburi Limited"

# 全员发章；--require-login = 必须已注册短号才能领（Limited 建议打开）
npm run gift:create -- --audience all --kind stamp --id th_lopburi --require-login --title "New Year Gift"

# 查某号待领（不领取）
npm run gift:inbox -- TTGO

# 取消活动（已领的章不收回）
npm run gift:cancel -- <campaignId>

npm run test:gifts
```

Pass / 荣耀受众等 `users.pass_at` / `honor_at` 再开。客户端认 `kind=stamp` 与屋系 `kind=pet`（`bar_*`）。

```bash
# 屋系一只（招财）
npm run gift:create -- --audience login_ids --ids TTGO --kind pet --id bar_fortune --title "Opening Fortune"
```

整袋上云（库存 + 签到窗 + 开户自选）：`GET/PUT /stamp/bag`，跟 JWT `sub` 走。短号登录拉的是这户的袋，不是本机空袋。库存 blob 收 `v1` / `v2` / `v3`（v3 末段为特化 stamp id）。规则正本：sibling `notee-go` → `docs/00-3-STAMP.md` §6.2。`npm run test:stamp-bag`。

酒局袋（开瓶账 + 最近 30 条结构化历史，**无原片**）：`GET/PUT /pour/bag`，同样跟 JWT `sub`。短号登录拉云袋；云端 `revision = 0` 则清空本机袋，不把上一身份推上去。JSON 体上限 256kb。规则正本：sibling `notee-go` → `docs/03-Pour-Check.md` §3.7。`npm run test:pour-bag`。

宠物袋（个体 JSON + **P-Points `pp`** + **默认出战 `fav`** + 首赠闩 + Tonight 日）：`GET/PUT /pet/bag`，同样跟 JWT `sub`。点数和默认出战写在 `bagBlob` 里，不另开列。PUT 的 `bagBlob` 可以是字符串或 JSON 对象；`fav` 指向袋里已没有的 uid 时不要 400。已领赠品 id **不在此袋**，仍挂在邮票文档的 `giftClaimedIds`。删号 / 闲置清扫会清行。成功路径不要逐请求打日志。规则正本：sibling `notee-go` → `docs/00-4-PET.md` §8.4 / §10.2。`npm run test:pet-bag`。

正方形裁切私有备份（与局卡同一刀，**不是**原片、**不上** Feed）：`PUT/GET/HEAD /pour/media/:sittingId/{start|end}`，JPEG ≤300kb，跟 JWT `sub`。袋里只记 `startCrop` / `endCrop`。删号、闲置清扫、袋 PUT 修剪 30 条都会删磁盘对象。目录 `POUR_MEDIA_DIR`（默认 `10-notee-go/data/pour-media`）。`npm run test:pour-media`。

酒局帖默认 `PATCH` → `POUR_NO_EDIT`。写一句每天 1；酒局每天最多 2。软删仍占该名额。结束同步的瓶数只计有消耗的瓶。

**QA 临时开关（测完必须 `false`，与 App 一起关）：**  
- `backend/services/postService.js` → `POUR_TEST_RESYNC_AFTER_DELETE`：删酒局帖释放当天名额。App 对应 `PourRules.TEST_RESYNC_AFTER_DELETE`。  
- `backend/lib/pourPayload.js` → `POUR_TEST_SHORT_PUBLISH_GAP`：可发布时长下限改为 **5 分钟**（正本 30 分钟，上限仍 6h）。App 对应 `PourRules.TEST_SHORT_PUBLISH_GAP`。  
- `backend/lib/pourPayload.js` → `POUR_TEST_EDIT_STATS`：允许酒局帖 `PATCH` 瓶数 / 消耗 ml、`stampId`、`place`（不限次数；聚餐帖只开放地点）。App 对应 `PourRules.TEST_EDIT_POUR_STATS`。  

测完这三处都改回 `false`，并同时把 App 对应开关也改回 `false`。漏关任一端，线上会按测试规则走。清单见 sibling `notee-go` → `docs/03-Pour-Check.md` §8.1。

正文：统一预算 100（汉字占 2，其余占 1）。客户端 + 服务端双拦。

日界 / 月界：**UTC+7**。每日 **00:15 Asia/Bangkok**：软删过期帖 + 物理删除 30 天无心跳且无短号的户（连同其帖、袋、月榜行；已软删且无短号的行一并删）+ 固化上月榜。已注册短号的户不删。  
月榜为快照（`monthly_board`）。短号户的帖过期后榜仍在。被清掉的临时户若上过榜，那一行跟着删。

新闻笔记：Asia/Bangkok 每个偶数点 **:05** 采一次 RSS（来源在 `lib/newsFeeds.js`），进程启动 5 秒后再补一次。每次采完顺手冻结已结束月份（`news_monthly_board`），所以 1 日 00:05 那次就把上月冻好。单条 feed 失败只打 warn，其余照采。`npm run test:news` 离线断言 RSS 解析与窗口规则。产品规则见 sibling `notee-go` → `docs/06-News-Calendar.md`。

## 生产

完整步骤（DB / JWT / Nginx / PM2 / 冒烟 / App）：见 **[`docs/DEPLOY.md`](./docs/DEPLOY.md)**。

简版：建库 → `backend/.env`（独立 `JWT_SECRET`、`MIGRATION_ASSUME_DB_EXISTS=1`）→ `npm run db:migrate` → Nginx `/api/notee-go` → `3010` → 上方 PM2 命令。

2026-09-29 目录由 `22-one-line` 改为 `10-notee-go`，PM2 进程由 `22-one-line-backend` 改为 `10-notee-go-backend`。库名是 `10_notee_go`。

```bash
pm2 delete 22-one-line-backend
mv /www/wwwroot/notee/22-one-line /www/wwwroot/notee/10-notee-go
cd /www/wwwroot/notee/10-notee-go
pm2 start ecosystem.config.cjs
pm2 save
```

nginx `/sp/` 的 `alias`、以及 `backend/.env` 里写成绝对路径的 `POUR_MEDIA_DIR`，若还指着旧目录，改到 `10-notee-go` 后执行 `nginx -s reload`。
