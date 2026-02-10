# 代码规范

**版本**: v1.0  
**更新时间**: 2026-02-07

---

## 📋 核心原则

### 1. 变量命名规范

**✅ 正确**：使用英文命名变量、函数、属性
```javascript
// 好的例子
const stage = 'early';
const characterType = 'military';
const faction = 'liubei';

// 数据结构
{
  stage: 'early',      // 英文
  rarity: 'legendary', // 英文
  characterType: 'military' // 英文
}
```

**❌ 错误**：使用中文命名变量、函数、属性
```javascript
// 不好的例子
const 阶段 = '茅庐';
const 角色类型 = '武官';

// 数据结构
{
  stage: '茅庐',      // 中文 - 错误！
  rarity: '传奇',     // 中文 - 错误！
  characterType: '武官' // 中文 - 错误！
}
```

### 2. 注释规范

**✅ 正确**：注释可以使用中文
```javascript
/**
 * 获取生涯文本
 * @param {string} stage - 生涯（英文：early/peak/late）
 * @returns {string} 阶段中文显示
 */
function getStageText(stage) {
  // 将英文 stage 转换为中文显示
  const texts = {
    'early': '茅庐',
    'peak': '巅峰',
    'late': '不惑',
  };
  return texts[stage] || stage;
}
```

### 3. 显示文本规范

**✅ 正确**：UI 显示使用中文
```javascript
// 数据存储使用英文
const character = {
  stage: 'early',
  rarity: 'legendary',
};

// UI 显示转换为中文
function render() {
  return (
    <div>
      <p>阶段：{getStageText(character.stage)}</p>
      <p>稀有度：{getRarityText(character.rarity)}</p>
    </div>
  );
}
```

---

## 🎯 数据字段规范

### Stage（生涯）

**数据存储**（英文）：
- `early` - 茅庐期
- `peak` - 巅峰期
- `late` - 不惑期

**UI 显示**（中文）：
- 茅庐
- 巅峰
- 不惑

**示例**：
```javascript
// JSON 数据
{
  "name": "刘备",
  "stage": "early"  // ✅ 英文
}

// UI 显示
function CharacterCard({ character }) {
  return <div>{getStageText(character.stage)}</div>; // 显示：茅庐
}
```

### Rarity（稀有度）

**数据存储**（英文）：
- `common` - 普通
- `rare` - 稀有
- `epic` - 史诗
- `legendary` - 传奇
- `core` - 核心

**UI 显示**（中文）：
- 普通
- 稀有
- 史诗
- 传奇
- 核心

### Character Type（角色类型）

**数据存储**（英文）：
- `military` - 武官型
- `strategist` - 军师型
- `balanced` - 文武双全

**UI 显示**（中文）：
- 武官型
- 军师型
- 文武双全

---

## 🔄 数据转换流程

### CSV → JSON 转换

CSV 文件可以使用中文（方便人类编辑），但转换为 JSON 时必须转换为英文：

```javascript
// hero-csv-to-json.cjs
function csvRowToCharacter(row) {
  // CSV 中可能是中文
  const stageMap = {
    '茅庐': 'early',
    '巅峰': 'peak',
    '不惑': 'late',
    'early': 'early',  // 兼容已经是英文的情况
    'peak': 'peak',
    'late': 'late',
  };
  
  return {
    stage: stageMap[row.stage] || row.stage, // ✅ 转换为英文
  };
}
```

### JSON → UI 显示

JSON 数据是英文，UI 显示时转换为中文：

```javascript
// CharacterCard.jsx
function getStageText(stage) {
  const texts = {
    'early': '茅庐',
    'peak': '巅峰',
    'late': '不惑',
  };
  return texts[stage] || stage;
}
```

---

## 📁 文件命名规范

### ✅ 正确

- `hero-csv-to-json.cjs` - 使用英文和连字符
- `CharacterCard.jsx` - 使用 PascalCase
- `useCharacters.js` - 使用 camelCase
- `dataLoader.js` - 使用 camelCase

### ❌ 错误

- `武将转换.cjs` - 不要使用中文
- `character_card.jsx` - 不要使用下划线（除非是常量）
- `UseCharacters.js` - Hook 文件应该用 camelCase

---

## 🎨 组件规范

### 组件命名

```javascript
// ✅ 正确：使用 PascalCase
export function CharacterCard({ character }) {
  // ...
}

// ❌ 错误：使用中文
export function 角色卡片({ character }) {
  // ...
}
```

### Props 命名

```javascript
// ✅ 正确：使用英文
function CharacterCard({ character, onSelect, showDetails }) {
  // ...
}

// ❌ 错误：使用中文
function CharacterCard({ 角色, 选择回调, 显示详情 }) {
  // ...
}
```

---

## 🔧 工具函数规范

### 函数命名

```javascript
// ✅ 正确：使用英文动词开头
function getStageText(stage) { }
function calculateTotal(character) { }
function filterCharacters(filters) { }

// ❌ 错误：使用中文
function 获取阶段文本(stage) { }
function 计算总和(character) { }
```

### 参数命名

```javascript
// ✅ 正确：使用英文
function validateCharacter(character, rules, options) {
  // ...
}

// ❌ 错误：使用中文
function validateCharacter(角色, 规则, 选项) {
  // ...
}
```

---

## 📊 常量规范

### 常量命名

```javascript
// ✅ 正确：使用 UPPER_SNAKE_CASE
const MAX_CHARACTERS = 100;
const DEFAULT_STAGE = 'peak';
const RARITY_COLORS = {
  common: '#gray',
  rare: '#blue',
};

// ❌ 错误：使用中文
const 最大角色数 = 100;
const 默认阶段 = 'peak';
```

---

## 🗂️ 数据结构规范

### JSON 数据结构

```json
{
  "characters": [
    {
      "id": "char_san_1100",
      "name": "刘备",
      "stage": "early",
      "rarity": "core",
      "characterType": "balanced",
      "faction": "刘备",
      "skills": ["仁德", "激励"],
      "description": "汉室宗亲"
    }
  ]
}
```

**规则**：
- ✅ 字段名使用英文（`stage`, `rarity`, `characterType`）
- ✅ 字段值使用英文（`early`, `core`, `balanced`）
- ✅ 显示文本可以使用中文（`name`, `description`, `skills`）

---

## 🔍 验证规范

### 数据验证

```javascript
// ✅ 正确：验证英文值
function validateStage(stage) {
  const validStages = ['early', 'peak', 'late'];
  return validStages.includes(stage);
}

// ❌ 错误：验证中文值
function validateStage(stage) {
  const validStages = ['茅庐', '巅峰', '不惑'];
  return validStages.includes(stage);
}
```

---

## 📝 总结

### 核心规则

1. **代码中的所有标识符（变量、函数、属性）必须使用英文**
2. **注释可以使用中文，帮助理解**
3. **UI 显示文本使用中文，提供良好的用户体验**
4. **数据存储使用英文，保证代码的国际化和可维护性**

### 数据流

```
CSV（可以中文）→ 转换工具（转为英文）→ JSON（英文）→ UI（显示中文）
```

### 检查清单

- [ ] 所有变量名是英文
- [ ] 所有函数名是英文
- [ ] 所有 JSON 字段名是英文
- [ ] 所有 JSON 字段值（非显示文本）是英文
- [ ] UI 显示正确转换为中文
- [ ] 注释清晰，帮助理解

---

**维护者**: Kiro AI  
**最后更新**: 2026-02-07
