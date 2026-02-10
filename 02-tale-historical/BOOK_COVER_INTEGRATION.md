# 书籍封面集成方案

## 当前书籍列表

根据 `BookContext.jsx`，我们有以下书籍需要封面：

1. **三国志·真三风云**
   - 类别: 游戏史记
   - 描述: 记录三国题材游戏的点点滴滴
   - 建议风格: 古典三国风格，红金配色

2. **游戏文本集**（示例）
   - 类别: 游戏文本
   - 建议风格: 现代简约

3. **私密日记**（示例）
   - 类别: 个人私密
   - 建议风格: 优雅低调

---

## 封面图片规格

基于当前CSS样式分析：

```css
/* 书籍卡片尺寸 */
width: 280px
height: 400px

/* 封面区域 */
aspect-ratio: 2/3
建议分辨率: 560x840 或 768x1152
```

---

## Stable Diffusion 生成提示词

### 1. 南阳三棋史记

**正面提示词：**
```
book cover design, ancient china three kingdoms period,
strategy game world map view, strategic map, isometric perspective,
multiple cities connected by roads, mountains and rivers landscape,
traditional chinese ink painting style, watercolor aesthetic,
birds eye view, game map illustration,
cities with ancient architecture, pathways between settlements,
natural scenery decoration, misty mountains, flowing rivers,
elegant composition, historical map design,
masterpiece, best quality, 8k, highly detailed
```

**负面提示词：**
```
modern, contemporary, western style, realistic photo,
characters, people, warriors, soldiers, portraits,
anime, manga, cartoon, 3d render,
low quality, blurry, ugly, distorted,
watermark, signature, text, logo
```

**参数建议：**
- 尺寸: 768x1152
- 采样步数: 30-40
- CFG Scale: 7-9
- 采样器: DPM++ 2M Karras

---

## 集成步骤

### 第一步：生成封面图片

1. 使用 Stable Diffusion WebUI 生成封面
2. 保存到项目目录: `02-tale-historical/public/covers/`
3. 命名格式: `book-{id}.jpg` 或 `book-{id}.png`

### 第二步：修改代码支持自定义封面

需要修改的文件：
- `src/contexts/BookContext.jsx` - 添加 cover 字段
- `src/components/Bookshelf.jsx` - 显示封面图片
- `src/App.css` - 调整封面样式

### 第三步：测试效果

确保封面：
- 正确显示在书架上
- 保持3D效果和阴影
- 响应式适配移动端

---

## 代码修改预览

### BookContext.jsx
```javascript
const books = [
  {
    id: 1,
    title: "三国志·真三风云",
    description: "记录三国题材游戏的点点滴滴",
    category: "游戏史记",
    cover: "/covers/book-1.jpg", // 新增
    chapters: [...]
  }
]
```

### Bookshelf.jsx
```javascript
<div className="book-cover">
  {book.cover ? (
    <img 
      src={book.cover} 
      alt={book.title}
      className="w-full h-full object-cover"
    />
  ) : (
    // 原有的渐变背景作为后备
    <div className="book-cover-gradient">...</div>
  )}
</div>
```

---

## 批量生成方案（未来）

如果需要生成大量封面，可以：

1. 使用 SD WebUI 的 API
2. 编写自动化脚本
3. 批量生成并命名

示例脚本结构：
```javascript
// generate-covers.js
const books = [...] // 书籍列表
for (const book of books) {
  const prompt = generatePrompt(book)
  const image = await callSDAPI(prompt)
  await saveImage(image, `book-${book.id}.jpg`)
}
```

---

## 下一步

1. 先手动生成1-2个封面测试效果
2. 确认满意后，我帮你修改代码集成
3. 如果需要，再开发批量生成工具
