# ETH 均线投递 · Cloudflare Worker

国内机访问不了交易所，也发不出 Google 的手机通知。本目录是一台挂在 Cloudflare 上的小闹钟：每分钟先拉 Gate ETHUSDT 永续 **1 小时** K 线，失败再试 Bybit / 币安，POST 到国内 11 算均线；若出现金叉/死叉，**由本 Worker 在海外把通知发给手机**。

## 你需要准备

1. 免费 [Cloudflare](https://dash.cloudflare.com/sign-up) 账号（不必把 notee.vip 迁过去）。
2. 本机已安装 Node（能跑 `npx`）。
3. 与生产 `11-life-resume/backend/.env` 里 **同一串** `ETH_MA_INGEST_SECRET`（至少 16 位）。

发通知用的 VAPID 仍只存在国内 11；交叉时随加密通道交给 Worker，**不要**再往 Wrangler 里贴 VAPID。

## 部署（本机做一次即可）

在仓库里打开终端，进入本目录后依次执行：

```bash
cd 11-life-resume/cf-eth-ma-klines
npx wrangler login
```

浏览器会打开 Cloudflare，点允许。然后写入两个密钥（粘贴时不会显示在屏幕上）：

```bash
npx wrangler secret put ETH_MA_INGEST_URL
```

提示时输入：

`https://notee.vip/api/life-resume/eth-ma-cross/ingest`

```bash
npx wrangler secret put ETH_MA_INGEST_SECRET
```

提示时粘贴与国内 `.env` **完全相同**的那串。

发布：

```bash
npx wrangler deploy
```

成功后控制台会给出 Worker 地址。之后每分钟自动跑，不必再开着电脑。

## 怎么确认在跑

1. 打开 [Cloudflare 控制台](https://dash.cloudflare.com/) → **Workers & Pages** → **eth-ma-klines**。
2. **Logs** 里应大约每分钟有一行；看到 `ingest klines source=gate` 和 `{"ok":true,"reason":"NO_CROSS"` 一类摘要即投递成功。
3. 出现交叉时应有 `web-push relay sent=`，且 **不要**再出现整段 JSON（里面会有密钥）。
4. 国内：`pm2 logs life-resume-backend` 搜 `[eth-ma-cross]`。交叉时先有 `relay push`，海外发成功后再有 `push-ack marked=true`。

## 手工补跑一次

把下面的 `密钥` 换成同一串，`WORKER地址` 换成 deploy 打印的 URL：

```bash
curl -X POST "https://WORKER地址/" -H "X-Eth-Ma-Ingest-Secret: 密钥"
```

## 改代码后

仍在本目录执行 `npx wrangler deploy`。GitHub 定时已停用，**不要**再打开 `eth-ma-klines` 那个 Actions 工作流。

上线顺序：**先发布本 Worker，再更新国内 11**。若先更新 11、Worker 仍是旧版，旧日志会把推送密钥打到 Cloudflare。

---

## 换电脑必读 · 2026-09-01 全链路审查摘要

详细表在本地（**不进 GitHub**）：`07-coin-index/docs/ETH-MA-CROSS-PUSH.md` §15.7。换电脑请把 `07-coin-index/docs` 整夹拷走。

**产品**：ETHUSDT 永续 **1h**，SMA7/SMA25，只认已收盘，贴线不算交叉；金叉看多、死叉看空。不看 MA99。订阅按浏览器/设备，不是账号全局。主题 `eth_ma_1h`（旧 `eth_ma_15m` 已迁走）。

**生产路径**：Cloudflare Worker 每分钟拉 Gate（失败再 Bybit/币安）→ POST 国内 11 算线 → 交叉则 Worker 海外发 Web Push → `push-ack`。国内 **不要**跑 `eth-ma-cross-worker`，**不要**对 11 的 ecosystem 整份 `pm2 start`。

**已证实**：K 线进库、金叉死叉判定、国内直连 Google 推送会失败（0996 `sent=0/1 failed=1`）。  
**未证实**：改代发之后，下一次交叉时手机通知栏是否响起。下午那次死叉不会补推。页面上「最近信号」只是读库，不是系统推送。

**审查结论**：没有必须立刻再改一版才能跑的代码漏洞。仍要盯：

- 07 静态页要单独 rebuild 才会更新文案/`sw.js`
- `sw.js` 不能被 Nginx 回成网页
- 换手机/换浏览器必须再点一次订阅
- Worker 停约 50 分钟会漏一根交叉（50 分钟窗口不是回放上一根）
- 价格跟币安图可能差几美金（现在用 Gate）

交叉时应看到：Cloudflare `PUSH_RELAY` + `web-push relay sent=1`；国内 `relay push` + `push-ack marked=true`。不应再出现国内 `[web-push] send failed`。

编码须为 **aes128gcm**（与国内 `web-push` 默认一致）。旧 Worker 用过 `aesgcm`，现代 Chrome/FCM 会 403，手机收不到。2026-09-01 已改。

可选：`ETH_MA_INGEST_KLINE_SOURCE` 可用 wrangler `[vars]` 覆盖默认 `gate,bybit,binance`。

