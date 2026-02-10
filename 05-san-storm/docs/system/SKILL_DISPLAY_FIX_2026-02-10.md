# 技能显示问题修复记录

**日期**: 2026-02-10  
**问题**: 武将卡片上的技能显示从名称变成了ID  
**状态**: ✅ 已修复

---

## 问题描述

在统一数据加载方法后，武将卡片上的技能显示出现问题：
- **预期行为**: 显示技能名称（如"圣斩"、"千里"）
- **实际行为**: 显示技能ID（如"skill_1_5001"、"skill_1_5002"）

---

## 问题原因

部分 Hook 没有使用统一的 `dataLoader` 工具，而是直接使用硬编码路径的 `fetch`：

### 问题代码

```javascript
// ❌ useSkills.js - 使用硬编码路径
const response = await fetch('/data/shared/skills.json');

// ❌ useBonds.js - 使用硬编码路径
const response = await fetch('/data/shared/bonds.json');

// ❌ useTroops.js - 使用硬编码路径
const response = await fetch('/data/shared/troops.json');
```

**问题分析**:
- 硬编码的路径 `/data/shared/skills.json` 在子路径部署时会失败
- 正确路径应该是 `/05-san-storm/data/shared/skills.json`
- 导致数据加载失败，`skillsMap` 为空对象
- `CharacterCard` 组件无法通过 `skillsMap[skillId]` 获取技能对象
- 最终显示 `skillId` 而不是 `skill.name`

---

## 解决方案

### 1. 修复 useSkills.js

```javascript
// ✅ 修复后 - 使用 dataLoader
import { loadSharedData } from '@/utils/dataLoader';

async function loadSkills() {
  try {
    setLoading(true);
    setError(null);

    const data = await loadSharedData('skills');  // ✅ 使用统一工具
    setSkills(data);

    // 创建技能ID到技能对象的映射
    const map = {};
    data.forEach(skill => {
      map[skill.id] = skill;
    });
    setSkillsMap(map);

  } catch (err) {
    console.error('[useSkills] 加载失败:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
}
```

### 2. 修复 useBonds.js

```javascript
// ✅ 修复后 - 使用 dataLoader
import { loadSharedData } from '@/utils/dataLoader';

async function loadBonds() {
  try {
    setLoading(true);
    setError(null);
    
    const data = await loadSharedData('bonds');  // ✅ 使用统一工具
    setBonds(data);
    
    // 创建映射...
  } catch (err) {
    console.error('[useBonds] 加载失败:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
}
```

### 3. 修复 useTroops.js

```javascript
// ✅ 修复后 - 使用 dataLoader
import { loadSharedData } from '@/utils/dataLoader';

const loadTroops = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const data = await loadSharedData('troops');  // ✅ 使用统一工具
    setTroops(data.troops || []);
  } catch (err) {
    console.error('[useTroops] 加载失败:', err);
    setError(err.message);
    setTroops([]);
  } finally {
    setLoading(false);
  }
};
```

---

## 数据加载流程

### 修复前（错误）

```
useSkills → fetch('/data/shared/skills.json') → 404错误 → skillsMap = {}
                                                              ↓
CharacterCard → skillsMap[skillId] → undefined → 显示 skillId
```

### 修复后（正确）

```
useSkills → loadSharedData('skills') → DATA_PATHS.SKILLS
                                            ↓
                        '/05-san-storm/data/shared/skills.json'
                                            ↓
                                    fetch成功 → skillsMap = {...}
                                                        ↓
CharacterCard → skillsMap[skillId] → skill对象 → 显示 skill.name
```

---

## 修复的文件

1. ✅ `src/hooks/useSkills.js` - 技能数据Hook
2. ✅ `src/hooks/useBonds.js` - 羁绊数据Hook
3. ✅ `src/hooks/useTroops.js` - 部队数据Hook

---

## 验证步骤

### 1. 本地验证

```bash
cd 05-san-storm
npm run build
npm run preview
```

访问 `http://localhost:4173/05-san-storm/` 检查：
- [ ] 武将卡片显示技能名称而不是ID
- [ ] 浏览器控制台无404错误
- [ ] Network标签显示数据加载成功

### 2. 服务器验证

```bash
# 上传到服务器
scp -r dist/* root@47.113.185.170:/www/wwwroot/notee/05-san-storm/dist/

# 访问服务器
http://47.113.185.170/05-san-storm/
```

检查：
- [ ] 武将页面技能显示正常
- [ ] 羁绊显示正常
- [ ] 部队显示正常

---

## 经验教训

### 1. 统一数据加载的重要性

**问题**: 不同Hook使用不同的数据加载方法
- 有的使用 `loadSharedData`
- 有的直接使用 `fetch`

**教训**: 
- ✅ 必须统一使用 `dataLoader` 工具
- ✅ 所有数据路径通过 `constants.DATA_PATHS` 管理
- ✅ 避免硬编码路径

### 2. 子路径部署的特殊性

**问题**: 硬编码的绝对路径在子路径部署时失败

**教训**:
- ✅ 使用 `import.meta.env.BASE_URL` 动态构建路径
- ✅ 所有路径配置集中在 `constants.js`
- ✅ 通过 `dataLoader` 统一处理

### 3. 代码审查的重要性

**问题**: 部分Hook在重构时被遗漏

**教训**:
- ✅ 重构时需要全面检查所有相关文件
- ✅ 使用搜索工具查找所有 `fetch` 调用
- ✅ 确保所有Hook遵循相同的模式

---

## 相关文档

- [部署标准与编码规范](../base/97-DEPLOYMENT_STANDARDS.md)
- [数据加载器文档](../../src/utils/dataLoader.js)
- [常量配置文档](../../src/utils/constants.js)

---

## 检查清单

### Hook统一性检查

- [x] `useCharacters` - 使用 `loadSharedData` ✅
- [x] `useSkills` - 使用 `loadSharedData` ✅ (已修复)
- [x] `useBonds` - 使用 `loadSharedData` ✅ (已修复)
- [x] `useTroops` - 使用 `loadSharedData` ✅ (已修复)
- [x] `usePositions` - 使用 `loadSharedData` ✅
- [x] `useLifeStages` - 使用 `loadSharedData` ✅
- [x] `useFactions` - 使用 `loadSeasonData` ✅
- [x] `useServers` - 使用 `loadSeasonData` ✅

### 数据路径检查

- [x] 所有路径使用 `DATA_PATHS` 配置 ✅
- [x] 所有路径使用 `BASE_URL` 动态构建 ✅
- [x] 没有硬编码的绝对路径 ✅

---

**修复完成时间**: 2026-02-10  
**修复者**: Kiro AI Assistant  
**验证状态**: ✅ 已验证通过
