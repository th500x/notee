# 势力模板字段更新说明

**更新日期**: 2026-02-09  
**更新内容**: 统一CSV模板字段命名规范

---

## 📋 字段名称变更

为了与其他CSV模板保持一致，对faction-template.csv的字段名进行了以下调整：

| 旧字段名 | 新字段名 | 说明 |
|---------|---------|------|
| `id` | `faction_id` | 势力ID |
| `name` | `faction_name` | 势力名称 |
| `leader` | `faction_leader` | 势力君主（角色ID） |
| `style` | `styleType` | 风格类型 |
| `styleText` | `styleTypeText` | 风格类型文本 |

**其他字段保持不变**：
- `icon` - 势力图标
- `color` - 势力颜色
- `season` - 赛季
- `playerType` - 玩家类型
- `playerTypeText` - 玩家类型文本
- `maxPlayers` - 最大玩家数
- `bonus1-4` - 势力加成
- `description` - 描述
- `recommended` - 是否推荐
- `difficulty` - 难度

---

## 🔧 脚本更新

### 更新的文件

1. **faction-csv-to-json.cjs**
   - 更新字段映射：`row.faction_id` 替代 `row.id`
   - 更新字段映射：`row.faction_name` 替代 `row.name`
   - 更新字段映射：`row.faction_leader` 替代 `row.leader`
   - 更新字段映射：`row.styleType` 替代 `row.style`
   - 更新字段映射：`row.styleTypeText` 替代 `row.styleText`
   - 添加空行过滤：过滤掉`faction_id`为空的行
   - 修复布尔值判断：支持`TRUE`和`true`

### 生成的JSON格式

```json
{
  "season": "S1",
  "seasonName": "黄巾之乱",
  "factions": [
    {
      "id": "faction_s1_caocao",
      "name": "曹操",
      "leader": "char_san_1201",
      "icon": "⚔️",
      "color": "#4ECDC4",
      "season": "S1",
      "style": "balanced",
      "styleText": "霸业",
      "playerType": "solid",
      "playerTypeText": "扎实",
      "maxPlayers": 60,
      "bonuses": [
        "势力内政值+10%",
        "势力魅力值+5%",
        "部队卡攻击+20",
        "随机日常任务数+2"
      ],
      "description": "扎实玩家的选择，霸业风格",
      "recommended": true,
      "difficulty": "简单"
    }
  ],
  "metadata": {
    "totalFactions": 7,
    "totalMaxPlayers": 500,
    "generatedAt": "2026-02-09T13:52:05.174Z"
  }
}
```

---

## 🎨 前端更新

### 更新的组件

1. **FactionCard.jsx**
   - 添加`characters`属性支持
   - 使用`useMemo`查找君主角色名称
   - 将`faction.leader`（角色ID）转换为角色名称显示

```jsx
// 查找君主角色名称
const leaderName = React.useMemo(() => {
  if (!characters || characters.length === 0) {
    return faction.leader; // 如果没有角色数据，显示ID
  }
  const leader = characters.find(char => char.id === faction.leader);
  return leader ? leader.name : faction.leader;
}, [faction.leader, characters]);
```

2. **App.jsx - FactionsPage**
   - 添加`useCharacters`钩子
   - 将`characters`数据传递给`FactionCard`组件

```jsx
function FactionsPage() {
  const { factions, loading, error } = useFactions();
  const { characters, loading: charactersLoading } = useCharacters();
  
  // ...
  
  <FactionCard 
    key={faction.id} 
    faction={faction}
    characters={characters}
    onSelect={(faction) => alert(`选择了势力: ${faction.name}`)}
  />
}
```

---

## ✅ 验证结果

### CSV数据验证

运行转换脚本后的输出：

```
📖 读取CSV文件: D:\temp-reorganize\notee\05-san-storm\tools\faction-template.csv
✅ 成功读取 15 个势力

🔄 转换为JSON格式...

📊 势力统计:
  - 曹操 (char_san_1201): 60人, 简单
  - 汉室 (char_san_1601): 120人, 简单
  - 刘备 (char_san_1101): 40人, 中等
  - 董卓 (char_san_1501): 80人, 困难
  - 黄巾 (char_san_1701): 120人, 中等
  - 孙坚 (char_san_1301): 40人, 困难
  - 袁绍 (char_san_1401): 40人, 困难
  总计: 7个势力, 500个玩家位

💾 保存JSON文件: D:\temp-reorganize\notee\05-san-storm\public\data\seasons\s1\factions.json

✨ 转换完成！
```

### 前端显示验证

- ✅ 势力卡片正确显示君主名称（如"曹操"而不是"char_san_1201"）
- ✅ 所有势力数据正确加载
- ✅ 势力加成、难度、人数上限等信息正确显示

---

## 📝 使用说明

### 更新CSV数据

1. 编辑`tools/faction-template.csv`
2. 使用新的字段名：`faction_id`, `faction_name`, `faction_leader`, `styleType`, `styleTypeText`
3. `faction_leader`字段填写角色ID（如`char_san_1201`）

### 生成JSON

```bash
cd 05-san-storm
node tools/faction-csv-to-json.cjs
```

### 前端自动更新

前端会自动：
1. 加载`factions.json`数据
2. 加载`characters.json`数据
3. 将角色ID转换为角色名称显示

---

## 🎯 设计优势

1. **字段命名统一** - 与其他CSV模板（hero, troop, skill等）保持一致
2. **数据关联清晰** - `faction_leader`存储角色ID，前端自动查找角色名称
3. **易于维护** - CSV中只需填写角色ID，不需要手动同步名称
4. **灵活性高** - 如果角色名称变更，只需更新角色数据，势力数据无需改动

---

## 🔄 迁移指南

如果你有旧的CSV数据，需要进行以下更新：

1. 将`id`列重命名为`faction_id`
2. 将`name`列重命名为`faction_name`
3. 将`leader`列重命名为`faction_leader`
4. 将`leader`列的内容从角色名称改为角色ID
5. 将`style`列重命名为`styleType`
6. 将`styleText`列重命名为`styleTypeText`

**示例**：

旧格式：
```csv
id,name,leader,style,styleText
faction_s1_caocao,曹操,曹操,balanced,霸业
```

新格式：
```csv
faction_id,faction_name,faction_leader,styleType,styleTypeText
faction_s1_caocao,曹操,char_san_1201,balanced,霸业
```

---

**文档作者**: Kiro AI  
**创建日期**: 2026-02-09  
**状态**: 更新完成
