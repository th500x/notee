# 周数据存储目录

这个目录用于存储通过API收集的真实周数据。

## 文件说明

- `weeklyData.json` - 通过CoinGecko API收集的真实价格数据
- `cache/` - API响应缓存目录
- `backup/` - 数据备份目录

## T0「必」

`t0Must` 由 `src/utils/t0Must.js` 计算，经 `npm run recalc-ratings` 写入：`buy` / `sell` / `null`。不计入 `personalRating`。完整规则见 `docs/README.md` §2.3.1。

ETH 15m 均线金叉/死叉 Web Push 不在本 JSON 内，见 `docs/ETH-MA-CROSS-PUSH.md`。

## 数据更新

使用以下命令更新数据：

```bash
# 收集指定周的数据
node scripts/collectWeeklyData.js

# 更新所有数据
npm run update-data
```

## 数据格式

```json
{
  "2026-W01": {
    "weekId": "2026-W01",
    "year": 2026,
    "weekNumber": 1,
    "weekStart": "2026-01-05",
    "weekEnd": "2026-01-11",
    "btcWeeklyAvgPrice": 95420.50,
    "ethWeeklyAvgPrice": 3280.75,
    "t0Must": null,
    "rawData": {
      "btc": {
        "average": 95420.50,
        "prices": [...],
        "dates": [...],
        "dataPoints": 7
      }
    }
  }
}
```