# 部署标准与编码规范

**版本**: v1.0  
**更新时间**: 2026-02-10  
**适用范围**: 真三风云项目及所有子路径部署的React项目

---

## 📋 目录

1. [配置规范](#配置规范)
2. [编码规范](#编码规范)
3. [数据加载规范](#数据加载规范)
4. [路由配置规范](#路由配置规范)
5. [部署检查清单](#部署检查清单)

---

## 配置规范

### 1. Vite配置标准

**文件**: `vite.config.js`

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // ✅ 必须：子路径部署的base配置
  base: '/05-san-storm/',
  
  // ✅ 推荐：路径别名配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  
  // ✅ 必须：构建配置
  build: {
    outDir: 'dist',
    assetsDir: 'assets',  // 统一资源目录名称
    sourcemap: false,     // 生产环境禁用sourcemap
  },
  
  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
  },
});
```

**关键规则**：
- ✅ `base` 必须以 `/` 开头和结尾
- ✅ `assetsDir` 统一使用 `assets`
- ✅ `outDir` 统一使用 `dist`
- ❌ 不要使用相对路径作为base（如 `./`）

---

### 2. 路由配置标准

**文件**: `src/App.jsx`

```javascript
import { BrowserRouter as Router } from 'react-router-dom';

function App() {
  return (
    // ✅ 必须：basename与vite.config.js的base保持一致
    <Router basename="/05-san-storm">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/servers" element={<ServersPage />} />
      </Routes>
    </Router>
  );
}
```

**关键规则**：
- ✅ `basename` 必须与 `vite.config.js` 的 `base` 一致
- ✅ 路由路径使用相对路径（如 `/servers`）
- ❌ 不要在路由路径中包含basename（如 `/05-san-storm/servers`）

---

### 3. 数据路径配置标准

**文件**: `src/utils/constants.js`

```javascript
// ✅ 必须：使用BASE_URL动态构建路径
const BASE_PATH = import.meta.env.BASE_URL || '/';

export const DATA_PATHS = {
  // 共享数据
  CHARACTERS: `${BASE_PATH}data/shared/characters.json`,
  POSITIONS: `${BASE_PATH}data/shared/positions.json`,
  TROOPS: `${BASE_PATH}data/shared/troops.json`,
  SKILLS: `${BASE_PATH}data/shared/skills.json`,
  'LIFE-STAGES': `${BASE_PATH}data/shared/life-stages.json`,
  BONDS: `${BASE_PATH}data/shared/bonds.json`,
  
  // 赛季数据（函数形式）
  FACTIONS: (season) => `${BASE_PATH}data/seasons/${season}/factions.json`,
  SERVERS: (season) => `${BASE_PATH}data/seasons/${season}/servers.json`,
  EVENTS: (season) => `${BASE_PATH}data/seasons/${season}/events.json`,
};
```

**关键规则**：
- ✅ 使用 `import.meta.env.BASE_URL` 获取base路径
- ✅ 所有数据路径都通过 `DATA_PATHS` 统一管理
- ❌ 不要使用硬编码的绝对路径（如 `/data/...`）

---

## 编码规范

### 1. 数据加载规范

#### ✅ 正确方式：使用统一的dataLoader

```javascript
// src/utils/dataLoader.js
import { DATA_PATHS } from './constants.js';

/**
 * 加载共享数据
 * @param {string} resource - 资源名称
 * @returns {Promise<Object>}
 */
export async function loadSharedData(resource) {
  const path = DATA_PATHS[resource.toUpperCase()];
  const response = await fetch(path);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

/**
 * 加载赛季数据
 * @param {string} season - 赛季标识
 * @param {string} resource - 资源名称
 * @returns {Promise<Object>}
 */
export async function loadSeasonData(season, resource) {
  const path = DATA_PATHS[resource.toUpperCase()](season);
  const response = await fetch(path);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}
```

#### 在组件中使用

```javascript
import { loadSharedData } from '@/utils/dataLoader';

// ✅ 正确方式
useEffect(() => {
  loadSharedData('troops')
    .then(data => setTroops(data.troops || []))
    .catch(err => setError(err.message));
}, []);

// ❌ 错误方式：直接使用fetch
useEffect(() => {
  fetch('/data/shared/troops.json')  // ❌ 硬编码路径
    .then(res => res.json())
    .then(data => setTroops(data.troops));
}, []);
```

**关键规则**：
- ✅ 所有数据加载必须使用 `dataLoader`
- ✅ 统一错误处理
- ✅ 统一路径管理
- ❌ 不要直接使用 `fetch`
- ❌ 不要硬编码数据路径

---

### 2. 自定义Hook规范

#### 标准Hook模板

```javascript
/**
 * 数据Hook模板
 * @param {string} param - 参数说明
 * @returns {Object} { data, loading, error, refetch }
 */
export function useDataHook(param = 'default') {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // ✅ 使用dataLoader
      const result = await loadSharedData('resource');
      setData(result.data || []);
    } catch (err) {
      console.error('[useDataHook] 加载失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [param]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
```

**关键规则**：
- ✅ 返回 `{ data, loading, error, refetch }` 标准结构
- ✅ 使用 `dataLoader` 加载数据
- ✅ 统一错误处理
- ✅ 提供 `refetch` 方法
- ✅ 添加JSDoc注释

---

### 3. 组件规范

#### 组件文件结构

```javascript
/**
 * 组件名称
 * 
 * @description 组件功能描述
 * @module components/category/ComponentName
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * 组件主函数
 * @param {Object} props - 组件属性
 * @param {string} props.name - 属性说明
 */
export function ComponentName({ name }) {
  return (
    <div>
      {/* 组件内容 */}
    </div>
  );
}

// ✅ 必须：PropTypes验证
ComponentName.propTypes = {
  name: PropTypes.string.isRequired,
};

// ✅ 可选：默认属性
ComponentName.defaultProps = {
  name: 'Default',
};
```

**关键规则**：
- ✅ 添加JSDoc注释
- ✅ 使用PropTypes验证
- ✅ 导出命名函数（不使用default export）
- ✅ 组件名使用PascalCase

---

### 4. 路径引用规范

#### 使用路径别名

```javascript
// ✅ 正确：使用别名
import { loadSharedData } from '@/utils/dataLoader';
import { CharacterCard } from '@/components/character/CharacterCard';
import { useCharacters } from '@/hooks/useCharacters';

// ❌ 错误：使用相对路径
import { loadSharedData } from '../../utils/dataLoader';
import { CharacterCard } from '../character/CharacterCard';
```

**关键规则**：
- ✅ 使用 `@/` 别名引用src目录
- ✅ 使用 `@components/` 引用组件
- ✅ 使用 `@hooks/` 引用hooks
- ✅ 使用 `@utils/` 引用工具
- ❌ 避免使用 `../../` 相对路径

---

### 5. 资源引用规范

#### 图片资源

```javascript
// ✅ 正确：使用import导入
import logoImage from '@/assets/logo.png';

function Component() {
  return <img src={logoImage} alt="Logo" />;
}

// ❌ 错误：硬编码路径
function Component() {
  return <img src="/assets/logo.png" alt="Logo" />;
}
```

#### public目录资源

```javascript
// ✅ 正确：使用BASE_URL
const BASE_PATH = import.meta.env.BASE_URL;

function Component() {
  return <img src={`${BASE_PATH}data/image.png`} alt="Image" />;
}

// ❌ 错误：硬编码路径
function Component() {
  return <img src="/data/image.png" alt="Image" />;
}
```

**关键规则**：
- ✅ src/assets 中的资源使用 `import` 导入
- ✅ public 中的资源使用 `BASE_URL` 拼接
- ❌ 不要使用硬编码的绝对路径

---

## 数据加载规范

### 1. 统一的数据加载流程

```
用户请求 → Hook → dataLoader → constants.DATA_PATHS → fetch → 返回数据
```

### 2. 数据加载层次

```
┌─────────────────────────────────────┐
│         组件层 (Component)           │
│  - 使用Hook获取数据                  │
│  - 处理UI渲染                        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Hook层 (useXxx)              │
│  - 管理状态 (data, loading, error)   │
│  - 调用dataLoader                    │
│  - 提供refetch方法                   │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      数据加载层 (dataLoader)         │
│  - 统一的fetch封装                   │
│  - 错误处理                          │
│  - 缓存管理（可选）                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      配置层 (constants)              │
│  - DATA_PATHS路径配置                │
│  - 使用BASE_URL动态构建              │
└─────────────────────────────────────┘
```

### 3. 数据加载示例

#### 完整示例：加载部队数据

```javascript
// 1. constants.js - 配置层
const BASE_PATH = import.meta.env.BASE_URL || '/';
export const DATA_PATHS = {
  TROOPS: `${BASE_PATH}data/shared/troops.json`,
};

// 2. dataLoader.js - 数据加载层
export async function loadSharedData(resource) {
  const path = DATA_PATHS[resource.toUpperCase()];
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// 3. useTroops.js - Hook层
export function useTroops() {
  const [troops, setTroops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTroops = async () => {
    try {
      setLoading(true);
      const data = await loadSharedData('troops');
      setTroops(data.troops || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTroops();
  }, []);

  return { troops, loading, error, refetch: fetchTroops };
}

// 4. TroopList.jsx - 组件层
export function TroopList() {
  const { troops, loading, error } = useTroops();

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;

  return (
    <div>
      {troops.map(troop => (
        <TroopCard key={troop.id} troop={troop} />
      ))}
    </div>
  );
}
```

---

## 路由配置规范

### 1. 路由结构

```javascript
<Router basename="/05-san-storm">
  <Routes>
    {/* 一级路由 */}
    <Route path="/" element={<HomePage />} />
    <Route path="/servers" element={<ServersPage />} />
    
    {/* 二级路由 */}
    <Route path="/characters" element={<CharactersLayout />}>
      <Route index element={<CharacterList />} />
      <Route path=":id" element={<CharacterDetail />} />
    </Route>
  </Routes>
</Router>
```

### 2. 导航链接

```javascript
import { Link } from 'react-router-dom';

// ✅ 正确：使用相对路径
<Link to="/">首页</Link>
<Link to="/servers">服务器</Link>
<Link to="/characters/char_san_1101">刘备</Link>

// ❌ 错误：包含basename
<Link to="/05-san-storm/">首页</Link>
<Link to="/05-san-storm/servers">服务器</Link>
```

### 3. 编程式导航

```javascript
import { useNavigate } from 'react-router-dom';

function Component() {
  const navigate = useNavigate();

  const handleClick = () => {
    // ✅ 正确：使用相对路径
    navigate('/servers');
    
    // ❌ 错误：包含basename
    navigate('/05-san-storm/servers');
  };
}
```

---

## 部署检查清单

### 本地开发检查

- [ ] `vite.config.js` 配置了正确的 `base` 路径
- [ ] `vite.config.js` 配置了 `build.assetsDir: 'assets'`
- [ ] `Router` 配置了正确的 `basename`
- [ ] 所有数据加载使用 `dataLoader`
- [ ] 没有硬编码的绝对路径
- [ ] 使用路径别名（`@/`）而不是相对路径
- [ ] 所有组件有 `PropTypes` 验证
- [ ] 所有函数有 JSDoc 注释
- [ ] `public` 目录在 git 版本控制中

### 构建前检查

- [ ] 运行 `npm run build` 成功
- [ ] 检查 `dist/` 目录结构完整
- [ ] 检查 `dist/assets/` 目录存在
- [ ] 检查 `dist/data/` 目录存在（如果需要）
- [ ] 检查 `dist/index.html` 中的资源路径正确

### 部署后检查

- [ ] 主页能正常访问
- [ ] 所有导航链接正常工作
- [ ] 数据加载正常，无404错误
- [ ] 图片资源加载正常
- [ ] 浏览器控制台无错误
- [ ] Network 标签无404错误

---

## 常见错误与解决方案

### 错误1: 数据加载404

**症状**: 
```
Failed to load resource: the server responded with a status of 404
```

**原因**: 使用了硬编码的绝对路径

**解决方案**:
```javascript
// ❌ 错误
fetch('/data/shared/troops.json')

// ✅ 正确
import { loadSharedData } from '@/utils/dataLoader';
loadSharedData('troops');
```

---

### 错误2: 路由跳转到根路径

**症状**: 点击导航链接跳转到网站根路径

**原因**: Router 没有配置 basename

**解决方案**:
```javascript
// ❌ 错误
<Router>

// ✅ 正确
<Router basename="/05-san-storm">
```

---

### 错误3: 静态资源404

**症状**: JS/CSS文件返回404

**原因**: Nginx 全局正则规则覆盖

**解决方案**: 删除 nginx 配置中的全局静态资源规则

---

### 错误4: public目录未部署

**症状**: 构建后 dist 目录缺少 data 文件夹

**原因**: `.gitignore` 忽略了 public 目录

**解决方案**:
```gitignore
# .gitignore
public
!05-san-storm/public
```

---

## 代码审查检查点

### 配置文件审查

- [ ] `vite.config.js` 的 `base` 配置正确
- [ ] `Router` 的 `basename` 与 `base` 一致
- [ ] `constants.js` 使用 `BASE_URL` 构建路径

### 代码质量审查

- [ ] 所有数据加载使用 `dataLoader`
- [ ] 没有硬编码的路径
- [ ] 使用路径别名
- [ ] 组件有 `PropTypes`
- [ ] 函数有 JSDoc 注释

### 性能审查

- [ ] 使用 `useMemo` 优化计算
- [ ] 使用 `useCallback` 优化回调
- [ ] 避免不必要的重渲染
- [ ] 图片使用适当的格式和大小

---

## 总结

### 核心原则

1. **配置一致性**: vite base、Router basename、数据路径保持一致
2. **统一工具**: 使用 dataLoader 统一处理数据加载
3. **避免硬编码**: 使用 BASE_URL 动态构建路径
4. **代码规范**: 遵循命名规范、添加注释、使用 PropTypes

### 最佳实践

1. ✅ 使用路径别名（`@/`）
2. ✅ 统一数据加载方法
3. ✅ 添加完整的类型检查
4. ✅ 编写清晰的注释
5. ✅ 遵循组件规范

### 避免的错误

1. ❌ 硬编码绝对路径
2. ❌ 直接使用 fetch
3. ❌ 混用不同的数据加载方法
4. ❌ 忽略 PropTypes 验证
5. ❌ 缺少错误处理

---

**文档版本**: v1.0  
**创建时间**: 2026-02-10  
**维护者**: Kiro AI Assistant  
**适用项目**: 真三风云 (05-san-storm)

