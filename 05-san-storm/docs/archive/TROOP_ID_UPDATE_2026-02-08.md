# 部队ID格式更新记录

**更新日期**: 2026-02-08  
**更新原因**: 统一ID命名规范，与角色ID格式保持一致

---

## 📋 更新内容

### 旧格式（已废弃）

```
troop_{兵种代码}_{稀有度数字}{编号}
```

**示例**：
- `troop_i_1001` - 步兵，白色，第1个
- `troop_c_4001` - 骑兵，橙色，第1个
- `troop_a_5001` - 弓兵，金色，第1个

**问题**：
- ❌ 兵种信息在ID中（i/c/a），但兵种已有独立字段`troopType`
- ❌ 稀有度信息在ID中（1-5），但稀有度已有独立字段`rarity`
- ❌ 无法体现赛季和势力信息
- ❌ 与角色ID格式不一致

---

### 新格式（当前使用）

```
troop_{系列代码}_{赛季}{势力}{编号}
```

**格式说明**：
- 系列代码：`san` = 三国系列
- 第1位数字：赛季（1=S1, 2=S2, 3=S3...）
- 第2位数字：势力（0=通用, 1=刘备, 2=孙坚, 3=曹操...）
- 第3-4位数字：部队卡编号（01-99）

**示例**：
- `troop_san_1001` - S1赛季，通用部队，第1个（民兵）
- `troop_san_1006` - S1赛季，通用部队，第6个（轻骑兵）
- `troop_san_1011` - S1赛季，通用部队，第11个（弓箭手）
- `troop_san_1101` - S1赛季，刘备势力，第1个（白马义从）
- `troop_san_1301` - S1赛季，曹操势力，第1个（虎豹骑）

**优势**：
- ✅ 与角色ID格式完全一致
- ✅ 通过ID即可了解赛季和势力信息
- ✅ 兵种和稀有度使用独立字段，避免冗余
- ✅ 便于按赛季和势力管理部队卡
- ✅ 支持势力专属部队卡

---

## 🔄 ID映射对照表

### 通用部队（S1赛季）

| 旧ID | 新ID | 部队名称 | 兵种 | 稀有度 |
|------|------|---------|------|--------|
| `troop_i_1001` | `troop_san_1001` | 民兵 | 步兵 | 普通 |
| `troop_i_2001` | `troop_san_1002` | 刀盾兵 | 步兵 | 稀有 |
| `troop_i_3001` | `troop_san_1003` | 重装步兵 | 步兵 | 史诗 |
| `troop_i_4001` | `troop_san_1004` | 陷阵营 | 步兵 | 传奇 |
| `troop_i_5001` | `troop_san_1005` | 白毦兵 | 步兵 | 核心 |
| `troop_c_1001` | `troop_san_1006` | 轻骑兵 | 骑兵 | 普通 |
| `troop_c_2001` | `troop_san_1007` | 突骑兵 | 骑兵 | 稀有 |
| `troop_c_3001` | `troop_san_1008` | 虎豹骑 | 骑兵 | 史诗 |
| `troop_c_4001` | `troop_san_1009` | 白马义从 | 骑兵 | 传奇 |
| `troop_c_5001` | `troop_san_1010` | 飞熊军 | 骑兵 | 核心 |
| `troop_a_1001` | `troop_san_1011` | 弓箭手 | 弓兵 | 普通 |
| `troop_a_2001` | `troop_san_1012` | 强弩兵 | 弓兵 | 稀有 |
| `troop_a_3001` | `troop_san_1013` | 神臂弩 | 弓兵 | 史诗 |
| `troop_a_4001` | `troop_san_1014` | 虎贲弩 | 弓兵 | 传奇 |
| `troop_a_5001` | `troop_san_1015` | 先登死士 | 弓兵 | 核心 |

---

## 📁 已更新的文件

### 文档文件
- ✅ `ART_ASSETS_GUIDE.md` - 美术资源规范
- ✅ `TROOP_CARD_TEST_GUIDE.md` - 测试指南
- ✅ `TROOP_CARD_SUMMARY.md` - 完成总结
- ✅ `TROOP_CSV_CONVERSION.md` - CSV转换说明
- ✅ `public/assets/troops/README.md` - 图标清单

### 数据文件
- ⏳ `tools/troop-template.csv` - 待明天更新（完成部队数据后）
- ⏳ `public/data/shared/troops.json` - 待明天生成

### 代码文件
- ✅ `tools/troop-csv-to-json.cjs` - 转换工具（已支持新格式）
- ✅ `src/components/troop/TroopCard.jsx` - 卡牌组件（已支持新格式）
- ✅ `src/components/troop/TroopCardExample.jsx` - 示例页面（已支持新格式）

---

## 🎯 新格式的优势

### 1. 信息更丰富

**旧格式**：
```javascript
troop_i_1001
    ↓
troop = 部队卡
i = 步兵
1 = 白色
001 = 第1个
```

**新格式**：
```javascript
troop_san_1001
    ↓
troop = 部队卡
san = 三国系列
1 = S1赛季
0 = 通用部队（所有势力可用）
01 = 第1个
```

### 2. 支持势力专属

**通用部队**（所有势力可用）：
```javascript
troop_san_1001  // S1赛季，通用，第1个
troop_san_1002  // S1赛季，通用，第2个
```

**势力专属部队**：
```javascript
troop_san_1101  // S1赛季，刘备势力，第1个（白马义从）
troop_san_1201  // S1赛季，孙坚势力，第1个（先登死士）
troop_san_1301  // S1赛季，曹操势力，第1个（虎豹骑）
troop_san_1501  // S1赛季，董卓势力，第1个（飞熊军）
```

### 3. 便于查询和管理

```javascript
// 查询S1赛季所有部队卡
SELECT * FROM troops WHERE id LIKE 'troop_san_1%'

// 查询通用部队（所有势力可用）
SELECT * FROM troops WHERE id LIKE 'troop_san_%0%'

// 查询曹操势力所有部队卡
SELECT * FROM troops WHERE id LIKE 'troop_san_%3%'

// 查询S1赛季曹操势力所有部队卡
SELECT * FROM troops WHERE id LIKE 'troop_san_13%'
```

### 4. 与角色ID规则一致

**角色ID**：
```javascript
char_san_1301   // 曹操（S1赛季，曹操势力，第1个角色）
```

**部队ID**：
```javascript
troop_san_1301  // 虎豹骑（S1赛季，曹操势力，第1个部队卡）
```

---

## 📝 注意事项

### 1. 字段独立性

- ✅ **兵种类型**：使用 `troopType` 字段（infantry/cavalry/archer）
- ✅ **稀有度**：使用 `rarity` 字段（common/rare/epic/legendary/core）
- ✅ **ID不再包含兵种和稀有度信息**

### 2. 图标文件命名

**旧命名**：
```
troop_i_1001.png
troop_c_1001.png
troop_a_1001.png
```

**新命名**：
```
troop_san_1001.png
troop_san_1006.png
troop_san_1011.png
```

### 3. 数据迁移

**明天需要做的**：
1. 更新 `tools/troop-template.csv` 中的所有ID
2. 运行 `node tools/troop-csv-to-json.cjs` 生成新的JSON
3. 准备图标文件，使用新的命名格式

---

## 🚀 下一步计划

### 明天的工作

1. **更新CSV数据**
   - 将 `troop-template.csv` 中的所有ID更新为新格式
   - 确保所有字段正确填写

2. **生成JSON数据**
   - 运行转换工具生成 `troops.json`
   - 验证数据格式正确

3. **准备图标**
   - 使用新的命名格式：`troop_san_1001.png`
   - 最少准备3个演示图标
   - 放入 `public/assets/troops/` 目录

4. **测试验证**
   - 访问 `/troop-cards` 页面
   - 验证卡牌显示正确
   - 验证图标加载正常

---

## 📚 相关文档

- `ID_NAMING_CONVENTION.md` - ID命名规范（完整版）
- `ART_ASSETS_GUIDE.md` - 美术资源规范
- `TROOP_CARD_TEST_GUIDE.md` - 测试指南
- `TROOP_CSV_CONVERSION.md` - CSV转换说明

---

**更新人员**: Kiro AI  
**更新日期**: 2026-02-08  
**文档版本**: v1.0.0
