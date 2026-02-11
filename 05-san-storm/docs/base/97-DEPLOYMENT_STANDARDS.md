# 部署标准与编码规范

**版本**: v1.1  
**更新时间**: 2026-02-10  
**适用范围**: 真三风云项目及所有子路径部署的React项目

---

## 📋 目录

1. [文件编码规范](#文件编码规范)（⚠️ 重要！）
2. [配置规范](#配置规范)
3. [编码规范](#编码规范)
4. [数据加载规范](#数据加载规范)
5. [部署检查清单](#部署检查清单)

---

## ⚠️ 文件编码规范（重要！必读！）

### 强制要求

**所有文本文件必须使用UTF-8编码（无BOM）**

#### 为什么重要？
- ❌ 错误的编码会导致中文乱码
- ❌ 乱码文件无法正常编辑和查看
- ❌ 会影响git提交和团队协作
- ❌ 修复乱码非常耗时且容易出错

#### 适用文件类型
以下文件类型必须严格遵守UTF-8编码：
- ✅ Markdown文档（.md）
- ✅ JavaScript/JSX文件（.js, .jsx）
- ✅ JSON数据文件（.json）
- ✅ CSV数据文件（.csv）
- ✅ 配置文件（.config.js, .json）

### 创建新文件的正确方式

#### 方法1：使用Kiro AI的fsWrite工具（推荐）
```javascript
// fsWrite会自动使用UTF-8编码
fsWrite({
  path: "05-san-storm/docs/new-file.md",
  text: "# 标题\n\n内容..."
});
```

#### 方法2：使用VS Code
- 右下角选择"UTF-8"
- 确保没有BOM（Byte Order Mark）
- 保存文件

#### 方法3：使用PowerShell（Windows）
```powershell
# 正确方式：使用.NET方法（无BOM）
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)

# 或者明确指定UTF8
$content | Set-Content -Path "file.md" -Encoding UTF8
```

### 修改现有文件的正确方式

#### ❌ 错误方式（会导致乱码）
```powershell
# 不要这样做！
Set-Content -Path "file.md" -Value $content  # 默认编码可能不是UTF-8
Get-Content "file.md" | Set-Content "file.md"  # 可能改变编码
```

#### ✅ 正确方式
```powershell
# 方式1：明确指定UTF-8
$content = Get-Content "file.md" -Raw -Encoding UTF8
$content = $content -replace 'old', 'new'
Set-Content -Path "file.md" -Value $content -Encoding UTF8

# 方式2：使用.NET方法（推荐，无BOM）
$content = Get-Content "file.md" -Raw -Encoding UTF8
$content = $content -replace 'old', 'new'
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Resolve-Path "file.md"), $content, $utf8NoBom)
```

### 检测和修复乱码文件

#### 如何识别乱码
```bash
# 正常文本
玩家系统文档

# 乱码文本（如果看到这样的字符，说明文件已乱码）
鐜╁绯荤粺鏂囨。
```

#### 修复步骤

**步骤1：从git恢复（最佳方案）**
```bash
git checkout HEAD -- path/to/file.md
```

**步骤2：如果git中也是乱码，删除并重新创建**
```bash
# 1. 删除乱码文件
rm path/to/file.md

# 2. 使用Kiro AI的fsWrite重新创建
# 3. 确保内容正确且使用UTF-8编码
```

**步骤3：使用Python转换编码（备用方案）**
```python
# 尝试多种编码读取
encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030']
for enc in encodings:
    try:
        with open(file, 'r', encoding=enc) as f:
            content = f.read()
        # 检查是否包含中文
        if '系统' in content or '文档' in content:
            # 写回UTF-8
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ 成功用 {enc} 读取并转换为UTF-8")
            break
    except:
        continue
```

### Git提交前检查清单

#### 必须检查
- [ ] 文件在编辑器中显示正常（无乱码）
- [ ] 中文字符显示正确
- [ ] `git diff`显示正常
- [ ] 文件大小合理（乱码文件通常会变大）

#### Git配置（确保使用UTF-8）
```bash
git config --global core.quotepath false
git config --global gui.encoding utf-8
git config --global i18n.commit.encoding utf-8
git config --global i18n.logoutputencoding utf-8
```

### 常见错误和解决方案

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| 中文显示为乱码 | 编码不是UTF-8 | 从git恢复或重新创建 |
| PowerShell显示乱码 | 终端编码问题 | 使用`chcp 65001`切换到UTF-8 |
| git diff显示乱码 | git配置问题 | 配置git使用UTF-8 |
| 文件无法读取 | 编码混乱 | 删除并重新创建 |
| 保存后变乱码 | 编辑器编码设置错误 | 检查编辑器设置 |

### VS Code配置（推荐）

```json
// settings.json
{
  "files.encoding": "utf8",
  "files.autoGuessEncoding": false,
  "files.eol": "\n"
}
```

### 预防措施

1. **始终使用UTF-8**
   - 创建文件时明确指定UTF-8
   - 修改文件时保持UTF-8编码
   - 不要使用记事本等简单编辑器

2. **定期检查**
   - 每次提交前检查文件编码
   - 发现乱码立即修复
   - 不要提交乱码文件

3. **团队协作**
   - 统一使用支持UTF-8的编辑器
   - 配置编辑器默认使用UTF-8
   - 发现问题及时通知团队

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
});
```

**关键规则**：
- ✅ `base` 必须以 `/` 开头和结尾
- ✅ `assetsDir` 统一使用 `assets`
- ✅ `outDir` 统一使用 `dist`

### 2. React Router配置

**文件**: `src/App.jsx`

```javascript
import { BrowserRouter as Router } from 'react-router-dom';

function App() {
  return (
    // ✅ 必须：basename与vite.config.js的base保持一致
    <Router basename="/05-san-storm">
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </Router>
  );
}
```

### 3. 数据路径配置

**文件**: `src/utils/constants.js`

```javascript
// ✅ 必须：使用BASE_URL动态构建路径
const BASE_PATH = import.meta.env.BASE_URL || '/';

export const DATA_PATHS = {
  TROOPS: `${BASE_PATH}data/shared/troops.json`,
  CHARACTERS: `${BASE_PATH}data/shared/characters.json`,
};
```

---

## 编码规范

### 1. 数据加载规范

#### ✅ 正确方式：使用统一的dataLoader

```javascript
import { loadSharedData } from '@/utils/dataLoader';

// 正确
useEffect(() => {
  loadSharedData('troops')
    .then(data => setTroops(data.troops || []))
    .catch(err => setError(err.message));
}, []);
```

#### ❌ 错误方式：直接使用fetch

```javascript
// 错误：硬编码路径
useEffect(() => {
  fetch('/data/shared/troops.json')
    .then(res => res.json())
    .then(data => setTroops(data.troops));
}, []);
```

### 2. 组件规范

```javascript
/**
 * 组件名称
 * @param {Object} props - 组件属性
 */
export function ComponentName({ name }) {
  return <div>{name}</div>;
}

// ✅ 必须：PropTypes验证
ComponentName.propTypes = {
  name: PropTypes.string.isRequired,
};
```

---

## 数据加载规范

### 统一的数据加载流程

```
用户请求 → Hook → dataLoader → constants.DATA_PATHS → fetch → 返回数据
```

### 关键规则

1. ✅ 所有数据加载必须使用 `dataLoader`
2. ✅ 统一错误处理
3. ✅ 统一路径管理
4. ❌ 不要直接使用 `fetch`
5. ❌ 不要硬编码数据路径

---

## 部署检查清单

### 本地检查
- [ ] vite.config.js配置了base路径
- [ ] Router配置了basename
- [ ] 所有数据加载使用dataLoader
- [ ] 所有文件使用UTF-8编码（⚠️ 重要）
- [ ] 本地构建成功：`npm run build`

### 服务器检查
- [ ] 代码已同步：`git pull`
- [ ] 构建成功：`npm run build`
- [ ] dist目录完整
- [ ] nginx配置正确
- [ ] 所有文件编码正确（无乱码）

### 功能测试
- [ ] 主页能访问
- [ ] 导航链接正常
- [ ] 数据加载正常
- [ ] 浏览器控制台无错误
- [ ] 中文显示正常（无乱码）

---

## 总结

### 核心原则

1. **文件编码**：始终使用UTF-8（无BOM）⚠️
2. **配置一致性**：vite base、Router basename、数据路径保持一致
3. **统一工具**：使用 dataLoader 统一处理数据加载
4. **避免硬编码**：使用 BASE_URL 动态构建路径

### 最佳实践

1. ✅ 使用路径别名（`@/`）
2. ✅ 统一数据加载方法
3. ✅ 添加完整的类型检查
4. ✅ 编写清晰的注释
5. ✅ 遵循组件规范
6. ✅ 确保文件编码正确

### 避免的错误

1. ❌ 使用错误的文件编码（导致乱码）
2. ❌ 硬编码绝对路径
3. ❌ 直接使用 fetch
4. ❌ 混用不同的数据加载方法
5. ❌ 忽略 PropTypes 验证
6. ❌ 缺少错误处理

---

**文档版本**: v1.1  
**创建日期**: 2026-02-10  
**最后更新**: 2026-02-10  
**维护者**: Kiro AI Assistant  
**适用项目**: 真三风云 (05-san-storm)
