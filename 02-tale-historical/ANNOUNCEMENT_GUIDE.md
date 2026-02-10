# 公告和分类配置指南

## 如何自定义公告内容

公告内容存储在 `src/config/announcement.js` 文件中，你可以随时修改。

### 配置文件位置
```
02-tale-historical/src/config/announcement.js
```

### 配置项说明

#### 1. 公告配置

```javascript
export const announcement = {
  // 公告日期 - 显示在公告栏左侧
  date: '2026/02/04',
  
  // 公告内容 - 主要文本内容
  // 支持较长文本，超出部分会自动截断显示省略号
  content: '欢迎来到佚事雜錄！这里记录着游戏世界的点点滴滴...',
  
  // 是否显示公告栏
  // true: 显示公告栏
  // false: 隐藏公告栏
  enabled: true
}
```

#### 2. 分类配置（预留功能）

```javascript
export const categories = [
  {
    id: 'all',
    name: '全部',
    icon: '📚'
  },
  {
    id: 'game-history',
    name: '游戏史记',
    icon: '🎮'
  },
  // ... 更多分类
]
```

## 修改示例

### 示例1: 更新公告内容

```javascript
export const announcement = {
  date: '2026/02/10',
  content: '新增《三国志14》游戏史记，记录威力加强版的精彩瞬间！',
  enabled: true
}
```

### 示例2: 临时隐藏公告

```javascript
export const announcement = {
  date: '2026/02/04',
  content: '欢迎来到佚事雜錄...',
  enabled: false  // 设置为false即可隐藏
}
```

### 示例3: 长公告内容

```javascript
export const announcement = {
  date: '2026/02/15',
  content: '春节特别活动：分享你的游戏故事，赢取精美周边！活动时间：2月15日-2月28日，详情请关注公众号...',
  enabled: true
}
```

## 公告栏样式说明

### 视觉设计
- **背景色**: 淡黄色渐变（#fff9e6 → #fef3c7）
- **边框**: 金色边框（#fbbf24）
- **文字颜色**: 深棕色（#78350f）
- **图标**: 📢 喇叭图标

### 布局结构
```
[📢] [公告] [2026/02/04] [公告内容文本...]
 图标  标签    日期         内容
```

### 响应式设计
- 桌面端: 完整显示所有元素
- 移动端: 内容文本会自动截断，显示省略号

## 分类标签说明

### 当前分类
1. **全部** (📚) - 显示所有书籍
2. **游戏史记** (🎮) - 游戏相关的历史记录
3. **游戏文本** (📖) - 游戏剧情、对话等文本内容
4. **个人私密** (🔒) - 个人私密内容

### 分类功能
- 点击分类标签可以筛选对应类别的书籍
- 选中的分类会高亮显示（深棕色背景）
- 未选中的分类为白色背景，悬停时变为淡黄色

### 如何给书籍分配分类

在 `src/contexts/BookContext.jsx` 中，给每本书添加 `category` 字段：

```javascript
{
  id: '02-01-san-nanyang',
  title: '三棋南阳史记',
  description: '记录三国题材游戏的点点滴滴',
  theme: 'red',
  category: '游戏史记',  // 指定分类
  chapters: [...]
}
```

## 常见问题

### Q1: 如何修改公告内容？
**A**: 编辑 `src/config/announcement.js` 文件，修改 `content` 字段即可。保存后页面会自动热更新。

### Q2: 公告内容太长怎么办？
**A**: 公告栏会自动截断过长的内容，显示省略号。建议控制在100字以内以获得最佳显示效果。

### Q3: 如何临时关闭公告？
**A**: 将 `enabled` 设置为 `false` 即可隐藏公告栏。

### Q4: 如何添加新的分类？
**A**: 
1. 在 `Bookshelf.jsx` 的 `categories` 数组中添加新分类名称
2. 在 `categoryIcons` 对象中添加对应的图标
3. 给书籍添加对应的 `category` 字段

### Q5: 分类标签的顺序可以调整吗？
**A**: 可以。在 `Bookshelf.jsx` 中调整 `categories` 数组的顺序即可。

## 样式自定义

如果你想自定义公告栏或分类标签的样式，可以修改 `src/App.css` 中的相关样式：

### 公告栏样式
```css
.announcement-bar {
  /* 修改背景色 */
  background: linear-gradient(135deg, #fff9e6 0%, #fef3c7 100%);
  
  /* 修改边框颜色 */
  border: 1px solid #fbbf24;
  
  /* 修改文字颜色 */
  color: #78350f;
}
```

### 分类标签样式
```css
.category-tab {
  /* 修改默认背景 */
  background: white;
  
  /* 修改边框 */
  border: 1.5px solid #e5e7eb;
}

.category-tab.active {
  /* 修改选中状态背景 */
  background: #78350f;
  
  /* 修改选中状态文字颜色 */
  color: white;
}
```

## 更新日志

### 2026-02-04
- ✅ 添加公告栏功能
- ✅ 添加分类标签功能
- ✅ 支持分类筛选
- ✅ 创建配置文件系统
- ✅ 添加空状态提示
