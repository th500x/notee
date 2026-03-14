# 真三风云 - 共享组件库

## 📦 简介

这是《真三风云》项目的共享组件库，用于在多个子项目（wiki、game等）之间共享可复用的UI组件、工具函数和常量定义。

## 🎯 设计目标

- ✅ 统一管理可复用组件，避免代码重复
- ✅ 修改一次，所有项目生效
- ✅ 保持组件的独立性和通用性
- ✅ 提供清晰的文档和使用示例

## 📁 目录结构

```
shared/
├── components/          # 共享UI组件
│   ├── card/           # 卡牌组件
│   │   ├── TroopCard.jsx         # 部队卡牌
│   │   ├── CharacterCard.jsx     # 将领卡牌
│   │   └── index.js              # 统一导出
│   │
│   ├── common/         # 通用组件（未来）
│   ├── layout/         # 布局组件（未来）
│   └── index.js        # 总导出
│
├── utils/              # 共享工具函数（未来）
├── constants/          # 共享常量（未来）
├── hooks/              # 共享Hooks（未来）
├── services/           # 共享服务（未来）
├── package.json        # 包配置
└── README.md           # 本文档
```

## 🚀 使用方法

### 方式1：路径别名（推荐）

#### 1. 配置Vite别名

在项目的 `vite.config.js` 中添加别名：

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
});
```

#### 2. 使用共享组件

```javascript
// 导入卡牌组件
import { TroopCard, CharacterCard } from '@shared/components/card';

// 或者单独导入
import TroopCard from '@shared/components/card/TroopCard';
import { CharacterCard } from '@shared/components/card/CharacterCard';

function MyPage() {
  return (
    <div>
      <TroopCard 
        troop={troopData}
        baseUrl="/05-san-storm/"
      />
      <CharacterCard 
        character={characterData}
        baseUrl="/05-san-storm/"
      />
    </div>
  );
}
```

### 方式2：npm包（未来扩展）

```bash
# 在项目中安装
npm install ../shared

# 使用
import { TroopCard, CharacterCard } from '@san-storm/shared';
```

## 📚 组件文档

### TroopCard（部队卡牌）

显示部队的详细信息，包括属性、技能、相性、地形适应等。

**Props**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| troop | Object | ✅ | - | 部队数据对象 |
| skillsMap | Object | ❌ | {} | 技能映射对象 |
| showDetails | Boolean | ❌ | true | 是否显示详细信息 |
| baseUrl | String | ❌ | '' | 资源基础路径 |
| onSelect | Function | ❌ | - | 选择回调函数 |

**示例**：

```javascript
<TroopCard 
  troop={{
    id: 'san_1_troop_1001',
    name: '青州兵',
    rarity: 'rare',
    troopType: 'infantry',
    faction: '刘备',
    attack: 155,
    defense: 145,
    speed: 120,
    movement: 3,
    maxTroops: 1000,
    currentTroops: 850,
    skills: ['skill_1_001', 'skill_1_002'],
    // ... 更多属性
  }}
  skillsMap={skillsMap}
  showDetails={true}
  baseUrl="/05-san-storm/"
  onSelect={(troop) => console.log('选中部队:', troop)}
/>
```

### CharacterCard（将领卡牌）

显示将领的详细信息，支持翻牌查看生涯。

**Props**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| character | Object | ✅ | - | 将领数据对象 |
| skillsMap | Object | ❌ | {} | 技能映射对象 |
| bondsMap | Object | ❌ | {} | 羁绊映射对象 |
| showDetails | Boolean | ❌ | true | 是否显示详细信息 |
| baseUrl | String | ❌ | '' | 资源基础路径 |
| lifeStageData | Object | ❌ | null | 生涯数据（用于翻牌） |
| onSelect | Function | ❌ | - | 选择回调函数 |

**示例**：

```javascript
<CharacterCard 
  character={{
    id: 'san_1_char_1001',
    name: '刘备',
    rarity: 'legendary',
    stage: 'peak',
    luck: 85,
    courage: 80,
    command: 90,
    combat: 75,
    intelligence: 85,
    politics: 88,
    charisma: 95,
    skills: ['san_1_skill_1_001'],
    biography: '《先主传》',
    // ... 更多属性
  }}
  skillsMap={skillsMap}
  bondsMap={bondsMap}
  showDetails={true}
  baseUrl="/05-san-storm/"
  lifeStageData={lifeStageData}
  onSelect={(char) => console.log('选中将领:', char)}
/>
```

## 🎨 设计规范

### 1. 组件独立性

共享组件必须完全独立，不依赖特定项目的代码：

```javascript
// ✅ 正确：通过props接收数据
function TroopCard({ troop, skillsMap }) {
  return <div>{troop.name}</div>;
}

// ❌ 错误：依赖项目特定的context
function TroopCard({ troopId }) {
  const troop = useGameStore(state => state.troops[troopId]);
  return <div>{troop.name}</div>;
}
```

### 2. 样式管理

使用Tailwind CSS，确保样式一致性：

```javascript
// ✅ 正确：使用Tailwind类名
<div className="w-64 h-96 rounded-lg shadow-lg">

// ❌ 错误：使用内联样式
<div style={{ width: '256px', height: '384px' }}>
```

### 3. Props设计

Props应该清晰、完整、可选：

```javascript
ComponentName.propTypes = {
  data: PropTypes.object.isRequired,  // 必填
  options: PropTypes.object,          // 可选
  onSelect: PropTypes.func,           // 可选
};

ComponentName.defaultProps = {
  options: {},
  onSelect: null,
};
```

### 4. 文档注释

每个组件必须有清晰的JSDoc注释：

```javascript
/**
 * 组件名称
 * 
 * @description 组件描述
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.data - 数据对象
 * @param {Function} [props.onSelect] - 选择回调（可选）
 * 
 * @example
 * <ComponentName data={data} onSelect={handleSelect} />
 */
```

## 🚨 注意事项

1. **不要在共享组件中使用项目特定的代码**
   - ❌ 不要使用项目特定的context
   - ❌ 不要使用项目特定的store
   - ❌ 不要使用项目特定的hooks
   - ✅ 通过props传递所有需要的数据

2. **保持组件的通用性**
   - ✅ 组件应该适用于所有项目
   - ✅ 通过props控制不同的显示方式
   - ✅ 提供合理的默认值

3. **统一样式系统**
   - ✅ 使用Tailwind CSS
   - ✅ 保持样式一致性
   - ❌ 不要使用内联样式

4. **完善的文档**
   - ✅ 每个组件必须有文档注释
   - ✅ 提供使用示例
   - ✅ 说明所有props的含义

## 📝 开发指南

### 添加新组件

1. 在相应目录下创建组件文件
2. 编写组件代码和PropTypes
3. 添加JSDoc文档注释
4. 在index.js中导出
5. 更新README文档

### 测试组件

在wiki或game项目中测试新组件：

```bash
# 1. 确保已配置路径别名
# 2. 导入并使用组件
# 3. 检查功能和样式
# 4. 确认在不同项目中都能正常工作
```

## 🔗 相关文档

- [架构设计文档](../docs/00-base/02-ARCHITECTURE_DESIGN.md)
- [开发规范](../docs/DEVELOPMENT_RULES.md)
- [ID命名规范](../docs/00-base/03-ID_NAMING_GUIDE.md)

## 📅 更新日志

- v1.0.0 (2026-03-12): 初始版本，创建共享组件库结构，添加TroopCard和CharacterCard组件

---

**维护者**: Kiro AI  
**创建日期**: 2026-03-12  
**版本**: v1.0.0
