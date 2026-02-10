# 书籍数据文件说明

## 文件命名规则

每本书籍的数据文件按照以下规则命名：
- 格式：`book-{书籍ID}.jsx`
- 示例：`book-02-01-san-nanyang.jsx`（对应书籍ID: 02-01-san-nanyang）
- 注意：文件必须使用 `.jsx` 扩展名，因为章节内容使用了模板字符串（JSX语法）

## 文件结构

每个书籍文件应导出一个书籍对象，包含以下字段：

```javascript
export const book_{书籍ID} = {
  id: '书籍ID',
  title: '书名',
  description: '简介',
  cover: 封面图片导入,
  theme: '主题颜色',
  category: '分类',
  requirePassword: false, // 是否需要密码保护
  password: null, // 密码（如果需要）
  chapters: [
    {
      id: '章节ID',
      title: '章节标题',
      content: `章节内容（Markdown格式）`
    }
  ]
}
```

## 密码保护

如果书籍需要密码保护：
1. 设置 `requirePassword: true`
2. 设置 `password: '你的密码'`
3. 用户需要输入正确密码才能查看内容

## 导入方式

在 `BookContext.jsx` 中导入书籍数据（不需要写 `.jsx` 扩展名）：

```javascript
import { book_02_01_san_nanyang } from '../data/books/book-02-01-san-nanyang'

// 在 useEffect 中使用
const initialBooks = [
  book_02_01_san_nanyang,
  // 其他书籍...
]
```
