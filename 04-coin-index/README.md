# 区块指标 - 区块链市场指标分析系统

> **专业的区块链市场指标分析工具**  
> 通过12个核心指标的综合分析，为投资者提供量化的市场评级和投资建议

---

## 🚀 快速开始

### 安装依赖
```bash
cd 04-coin-index
npm install
```

### 开发模式
```bash
npm run dev
# 访问: http://localhost:5173
```

### 构建生产版本
```bash
npm run build
```

---

## 📚 完整文档

**请查看 [COMPLETE_GUIDE.md](./COMPLETE_GUIDE.md) 获取完整的操作指南**

该文档包含：
- ✅ 12个核心指标详细说明
- ✅ 评分系统完整规则
- ✅ 数据收集流程
- ✅ 脚本使用指南
- ✅ 前端架构说明
- ✅ 每周数据更新流程
- ✅ 故障排查方案

---

## 🎯 核心功能

### 📊 12个核心指标
1. BTC周涨跌幅
2. BTC距ATH回撤
3. BTC周均价
4. ETH周均价
5. ETH/BTC市值比
6. 恐惧&贪婪指数
7. 梅耶倍数
8. Ahr999指标
9. BTC四年指数
10. 美联储利率
11. 日央行利率
12. 个人评级（综合评分）

### 🎨 智能评分系统
- 8个指标独立评分（-2到+2分）
- 个人评级总分（-16到+16分）
- 颜色编码和状态文字
- 实时投资建议

### 📈 数据可视化
- 周历导航（2025-2026年）
- 红绿点涨跌指示器
- 模拟演练（ETH交易模拟）
- 年终总结（统计分析）

---

## 📅 每周数据更新（快速参考）

### 步骤1: 收集API数据
```bash
node scripts/collectWeeklyDataV2.js
```

### 步骤2: 编辑手动数据
编辑 `data-import.csv` 文件，添加新周数据

### 步骤3: 导入手动数据
```bash
node scripts/importManualData.js
```

### 步骤4: 验证
```bash
npm run dev
# 检查新周数据是否正确显示
```

**⚠️ 重要原则**:
- 只更新没有数据的周
- 永远不修改已有数据（除非人类明确要求）
- 默认使用CoinGecko API
- 1年以前的数据使用Yahoo API

---

## 🛠️ 技术栈

- **前端**: React + Vite + Tailwind CSS
- **数据源**: CoinGecko API + Yahoo Finance API + CSV导入
- **脚本**: Node.js
- **数据格式**: JSON

---

## 📁 项目结构

```
04-coin-index/
├── src/                    # 源代码
│   ├── components/         # React组件
│   ├── utils/             # 工具函数
│   └── data/              # 开发环境数据
├── public/                # 静态资源
│   └── weeklyData.json    # 生产环境数据
├── scripts/               # 数据处理脚本
│   ├── collectWeeklyDataV2.js      # 当前周数据收集
│   ├── collect2025AllWeeks.js      # 历史数据收集
│   └── importManualData.js         # 手动数据导入
├── data-import.csv        # 手动数据模板
├── COMPLETE_GUIDE.md      # 完整操作指南 ⭐
└── README.md              # 本文件
```

---

## 📖 文档索引

- **[COMPLETE_GUIDE.md](./COMPLETE_GUIDE.md)** - 完整操作指南（必读）
- **data-import.csv** - 手动数据导入模板

---

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

---

## 📄 许可证

MIT License

---

## 🍺 致谢

感谢所有为区块链数据分析做出贡献的开发者和研究者！

---

**免责声明**: 本工具仅供参考，不构成投资建议。投资有风险，决策需谨慎。

**维护**: 请遵循 [COMPLETE_GUIDE.md](./COMPLETE_GUIDE.md) 进行数据更新和维护

🍺 LOVE & PEACE!
