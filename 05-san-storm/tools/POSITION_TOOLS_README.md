# 官职系统数据管理工具

## 📁 文件说明

### 1. position-template.csv
官职数据的CSV模板文件，用于编辑和维护官职数据。

**字段说明：**

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `id` | string | 官职唯一标识符 | `position_general` |
| `name` | string | 官职名称 | `大将军` |
| `level` | number | 官职等级（1-9） | `8` |
| `icon` | string | 官职图标 | `⭐⭐⭐` |
| `rank` | number | 排名顺序 | `1` |
| `requirement` | string | 晋升要求 | `势力排名第1` |
| `description` | string | 官职描述 | `势力最高军职，掌握战争大权` |
| `color` | string | 颜色代码（十六进制） | `#FFD700` |
| `resourceBonus` | number | 资源加成（小数） | `0.5` 表示 +50% |
| `prestigeBonus` | number | 声望加成（小数） | `0.5` 表示 +50% |
| `infantryBonus` | number | 步兵加成（小数） | `0.15` 表示 +15% |
| `cavalryBonus` | number | 骑兵加成（小数） | `0.15` 表示 +15% |
| `archerBonus` | number | 弓兵加成（小数） | `0.15` 表示 +15% |
| `permissions` | string | 特殊权限（用 \| 分隔） | `权限1\|权限2\|权限3` |

**注意事项：**
- 加成值为 0 时可以填 `0` 或留空
- 权限字段使用 `|` 符号分隔多个权限
- 如果权限为空，该字段留空即可
- 如果字段内容包含逗号，需要用双引号包裹

### 2. position-csv-to-json.cjs
CSV转JSON的转换工具。

**功能：**
- 读取 `position-template.csv`
- 验证数据格式
- 转换为JSON格式
- 输出到 `public/data/shared/positions.json`
- 显示统计信息

## 🚀 使用方法

### 步骤1：编辑CSV文件
使用Excel、Google Sheets或任何文本编辑器打开 `position-template.csv`，编辑官职数据。

**示例：**
```csv
id,name,level,icon,rank,requirement,description,color,resourceBonus,prestigeBonus,infantryBonus,cavalryBonus,archerBonus,permissions
position_general,大将军,8,⭐⭐⭐,1,势力排名第1,势力最高军职，掌握战争大权,#FFD700,0.5,0.5,0,0,0,"提出外交建议（每周1次）|管理联盟、战争相关权限|可发布战争类任务"
```

### 步骤2：运行转换工具
在项目根目录执行：

```bash
node tools/position-csv-to-json.cjs
```

### 步骤3：验证结果
转换成功后，检查 `public/data/shared/positions.json` 文件是否正确生成。

工具会显示：
- ✓ 读取的官职数量
- ✓ 转换成功的官职数量
- 📊 按等级统计的官职分布
- 💾 输出文件路径

## 📊 官职等级配色参考

| 等级 | 名称 | 颜色 | 说明 |
|------|------|------|------|
| 9 | AI专属 | 红色 `#ef4444` | 君主（AI专属） |
| 8 | 最高级 | 橙色 `#f97316` | 大将军/大司马 |
| 7 | 高级 | 黄色 `#eab308` | 骠骑/车骑将军 |
| 6 | 中高级 | 绿色 `#10b981` | 四安/四平/四镇/四征 |
| 5 | 中级 | 蓝色 `#3b82f6` | 各类将军 |
| 4 | 初级 | 紫色 `#8b5cf6` | 中郎将 |
| 3 | 基础 | 灰色 `#6b7280` | 校尉 |
| 2 | 基础 | 浅灰 `#9ca3af` | 都尉 |
| 1 | 基础 | 最浅灰 `#d1d5db` | 军候 |

## 🔍 数据验证

转换工具会自动进行以下验证：
- ✓ CSV文件格式正确性
- ✓ 必填字段完整性
- ✓ 数值类型正确性
- ✓ 等级范围（1-9）
- ✓ 加成值格式（小数）

## 💡 常见问题

### Q: 如何添加新官职？
A: 在CSV文件末尾添加新行，填写所有必填字段，然后运行转换工具。

### Q: 如何修改现有官职？
A: 直接在CSV文件中修改对应行的数据，然后运行转换工具。

### Q: 权限字段如何填写多个权限？
A: 使用 `|` 符号分隔，例如：`权限1|权限2|权限3`

### Q: 加成值如何填写？
A: 使用小数表示百分比，例如 `0.5` 表示 +50%，`0.15` 表示 +15%

### Q: 如果某个加成为0怎么办？
A: 可以填 `0` 或留空，转换工具会自动处理。

### Q: 为什么没有经验加成（expBonus）？
A: 官职系统不提供经验加成，只提供资源、声望和兵种加成。

## 📝 更新日志

### v1.0.0 (2026-02-09)
- ✨ 创建官职CSV模板
- ✨ 创建CSV转JSON转换工具
- ✨ 支持所有官职字段
- ✨ 支持权限列表解析
- ✨ 添加数据统计功能

## 🔗 相关文档

- [官职系统文档](../docs/system/20-data-layer/22-POSITION_SYSTEM.md)
- [官职卡牌组件](../src/components/position/PositionCard.jsx)
- [官职数据文件](../public/data/shared/positions.json)
