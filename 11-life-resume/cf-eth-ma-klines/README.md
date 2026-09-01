# ETH 均线投递 · Cloudflare Worker

国内机访问不了交易所。本目录是一台挂在 Cloudflare 上的小闹钟：每分钟先拉 Gate ETHUSDT 永续 15 分钟 K 线，失败再试 Bybit / 币安，然后 POST 到 `https://notee.vip/api/life-resume/eth-ma-cross/ingest`。

算均线、发手机通知仍在国内 11，这里只负责「跑腿」。

## 你需要准备

1. 免费 [Cloudflare](https://dash.cloudflare.com/sign-up) 账号（不必把 notee.vip 迁过去）。
2. 本机已安装 Node（能跑 `npx`）。
3. 与生产 `11-life-resume/backend/.env` 里 **同一串** `ETH_MA_INGEST_SECRET`（至少 16 位）。

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
2. **Logs** 里应大约每分钟有一行；看到 `ingest klines source=gate` 和 `200` 即投递成功。
3. 国内：`pm2 logs life-resume-backend` 搜 `[eth-ma-cross]`，新柱会有 `closed ... cross=`。

## 手工补跑一次

把下面的 `密钥` 换成同一串，`WORKER地址` 换成 deploy 打印的 URL：

```bash
curl -X POST "https://WORKER地址/" -H "X-Eth-Ma-Ingest-Secret: 密钥"
```

## 改代码后

仍在本目录执行 `npx wrangler deploy`。GitHub 定时已停用，**不要**再打开 `eth-ma-klines` 那个 Actions 工作流。
