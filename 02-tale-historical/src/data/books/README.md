# 书籍数据（自动上架）

本目录由 **12-tale-studio** 的发布脚本写入，02 项目通过 `src/data/loadBooks.js` 自动扫描，**不必**再改 `BookContext`。

## 目录约定

```
books/
  <id>/                 # 与 book.meta.json 的 id 一致，如 02-12-thailand-notes
    meta.json
    chapters/
      01.md
      02.md
      ...
```

## 如何更新内容

在 `12-tale-studio` 定稿后：

1. 编辑 `books/<书名>/book.meta.json`，设 `"publish": true`
2. 运行 `node scripts/publish_to_02.mjs` 或带书名参数
3. 刷新 02 开发服；部署前将本目录新增/变更随 02 提交

请勿手改本目录作为长期录入源；创作以 studio 为准。
