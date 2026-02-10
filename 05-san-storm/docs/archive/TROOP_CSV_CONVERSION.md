# 部队CSV转JSON说明

**创建日期**: 2026-02-08  
**工具版本**: v1.0.0

---

## 📋 工具说明

### 工具文件
- `tools/troop-csv-to-json.cjs` - 部队CSV转JSON转换工具

### 数据文件
- **输入**: `tools/troop-template.csv` - 部队数据源（CSV格式）
- **输出**: `public/data/shared/troops.json` - 部队数据（JSON格式）

---

## 🚀 使用方法

### 1. 编辑CSV数据
编辑 `tools/troop-template.csv`，填写部队数据。

### 2. 运行转换工具
```bash
node tools/troop-csv-to-json.cjs
```

### 3. 查看输出
工具会：
- ✅ 读取CSV文件
- ✅ 转换为JSON格式
- ✅ 自动转换字段命名（snake_case → camelCase）
- ✅ 生成 `public/data/shared/troops.json`
- ✅ 显示统计信息

---

## 📊 字段映射

### CSV → JSON 字段转换

| CSV字段（snake_case） | JSON字段（camelCase） | 类型 | 说明 |
|---------------------|---------------------|------|------|
| `troop_id` | `id` | string | 部队ID |
| `troop_name` | `name` | string | 部队名称 |
| `rarity` | `rarity` | string | 稀有度 |
| `troop_type` | `troopType` | string | 兵种类型 |
| `range` | `range` | number | 射程 |
| `attack` | `attack` | number | 攻击 |
| `defense` | `defense` | number | 防御 |
| `speed` | `speed` | number | 速度 |
| `movement` | `movement` | number | 移速 |
| `max_troops` | `maxTroops` | number | 最大兵力 |
| `plain_adapt` | `plainAdapt` | number | 平原适应 |
| `hill_adapt` | `hillAdapt` | number | 丘陵适应 |
| `forest_adapt` | `forestAdapt` | number | 森林适应 |
| `siege_adapt` | `siegeAdapt` | number | 攻城适应 |
| `counter_type` | `counterType` | string | 克制兵种 |
| `countered_by` | `counteredBy` | string | 被克兵种 |
| `counter_multiplier` | `counterMultiplier` | number | 克制倍率 |
| `skill_3` | `skill_3` | string | 技能3 |
| `skill_4` | `skill_4` | string | 技能4 |
| - | `skills` | array | 技能数组（自动生成） |
| `description` | `description` | string | 说明 |

---

## 🎯 字段说明

### 基础信息
- **troop_id**: 部队唯一标识，格式：`troop_{系列}_{赛季}{势力}{编号}`
  - 系列代码：`san` = 三国系列
  - 第1位数字：赛季（1=S1, 2=S2...）
  - 第2位数字：势力（0=通用, 1=刘备, 2=孙坚, 3=曹操...）
  - 第3-4位数字：部队卡编号（01-99）
  - 示例：`troop_san_1001`（S1赛季，通用部队，第1个）、`troop_san_1101`（S1赛季，刘备势力，第1个）
- **troop_name**: 部队名称（中文）
- **rarity**: 稀有度（common/rare/epic/legendary/core）
- **troop_type**: 兵种类型（infantry/cavalry/archer）

### 战斗属性
- **range**: 攻击距离（格数），范围1-4
- **attack**: 攻击力，范围60-120
- **defense**: 防御力，范围50-120
- **speed**: 行动速度，范围1-10（决定行动顺序）
- **movement**: 移动距离（格数），范围2-4
- **max_troops**: 最大兵力
  - common: 200
  - rare: 400
  - epic: 600
  - legendary: 800
  - core: 999

### 地形适应
- **plain_adapt**: 平原地形修正，范围0.8-1.2
- **hill_adapt**: 丘陵地形修正，范围0.7-1.2
- **forest_adapt**: 森林地形修正，范围0.6-1.1
- **siege_adapt**: 攻城地形修正，范围0.5-1.5
  - 表示在城市、据点、关卡等防御工事中的战斗力

### 克制关系
- **counter_type**: 克制哪个兵种（infantry/cavalry/archer）
- **countered_by**: 被哪个兵种克制（infantry/cavalry/archer）
- **counter_multiplier**: 克制倍率，范围1.0-1.5
  - 当克制敌人时：伤害 × counter_multiplier
  - 当被克制时：伤害 / counter_multiplier

**克制关系**：
```
步兵 → 克制骑兵 → 克制弓兵 → 克制步兵（循环）
```

### 技能
- **skill_3**: 技能3（对应角色的skill_1，主动技能）
- **skill_4**: 技能4（对应角色的skill_2，被动技能）
- **skills**: 技能数组（自动生成，包含skill_3和skill_4）

**说明**：
- 技能ID在技能表格中统一管理
- 与角色系统保持一致的命名规则
- 技能可以为空

### 其他
- **description**: 备注说明

---

## 📝 CSV模板示例

```csv
troop_id,troop_name,rarity,troop_type,range,attack,defense,speed,movement,max_troops,plain_adapt,hill_adapt,forest_adapt,siege_adapt,counter_type,countered_by,counter_multiplier,skill_3,skill_4,description
troop_san_1001,民兵,common,infantry,1,60,80,4,2,200,1.0,1.0,1.0,1.1,cavalry,archer,1.2,,,白色步兵
troop_san_1003,重装步兵,epic,infantry,1,80,100,5,2,600,1.0,1.0,1.0,1.3,cavalry,archer,1.3,skill_shield_wall,skill_defense_boost,紫色步兵
troop_san_1006,轻骑兵,common,cavalry,1,80,60,7,3,200,1.0,0.8,0.7,0.6,archer,infantry,1.2,,,白色骑兵
troop_san_1011,弓箭手,common,archer,3,70,50,5,2,200,1.0,1.1,0.9,1.0,infantry,cavalry,1.2,,,白色弓兵
```

---

## 🎮 生成的JSON格式

```json
{
  "troops": [
    {
      "id": "troop_san_1001",
      "name": "民兵",
      "rarity": "common",
      "troopType": "infantry",
      "range": 1,
      "attack": 60,
      "defense": 80,
      "speed": 4,
      "movement": 2,
      "maxTroops": 200,
      "plainAdapt": 1.0,
      "hillAdapt": 1.0,
      "forestAdapt": 1.0,
      "siegeAdapt": 1.1,
      "counterType": "cavalry",
      "counteredBy": "archer",
      "counterMultiplier": 1.2,
      "skill_3": "",
      "skill_4": "",
      "skills": [],
      "description": "白色步兵"
    }
  ]
}
```

---

## ⚠️ 注意事项

### 1. 数据源
- CSV是主数据源，所有修改都在CSV中进行
- JSON是生成文件，不要手动编辑

### 2. 字段命名
- CSV使用下划线命名（snake_case）
- JSON使用驼峰命名（camelCase）
- 工具自动转换

### 3. 数据类型
- 数值字段会自动转换为number类型
- 空字段会转换为空字符串或默认值

### 4. 技能数组
- `skills` 数组自动从 `skill_3` 和 `skill_4` 生成
- 空技能会被过滤掉

### 5. 克制倍率
- 由你手动设定每个部队卡的倍率
- 建议范围：1.0-1.5
- 可以根据平衡性需求精确调整

---

## 📚 相关文档

- `TROOP_SYSTEM.md` - 部队系统完整文档
- `TROOP_TEMPLATE_GUIDE.md` - 部队模板使用指南
- `ID_NAMING_CONVENTION.md` - ID命名规范
- `CHARACTER_SYSTEM.md` - 角色系统文档（技能系统）

---

**工具作者**: Kiro AI  
**最后更新**: 2026-02-08  
**工具版本**: v1.0.0
