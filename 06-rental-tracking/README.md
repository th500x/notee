# 06-rental-tracking（租赁追踪）

管理员账目单、房源租赁、水电单（`utility`）等。完整设计、端口、数据库与水电/账目专章见本地 **`docs/README.md`**（`docs/` 目录常被仓库 `.gitignore` 排除；克隆后若存在该文件，请以其中说明为准）。

---

## 近期功能更新（2026-05-15）

以下内容与当日已合并代码一致（原 **`CHANGELOG.md`** 摘要已并入此处与本目录 **`docs/README.md`**「最近更新」）。

- **照片单张上限**：由 2MB 调整为 **5MB**。涉及 `src/config/index.js`；后端 `backend/routes/upload.js`、`backend/middleware/validation.js`。
- **账目单租金表（`AccountingRentTab.jsx`）**
  - **触控与滚动**：取消左侧 ROOM 的 **`position: sticky`** 与组件内 **`overflow-x-auto`**，表格随**页面**横向/纵向滑动及系统缩放，避免移动端吸顶与触控方案互相干扰。
  - **行排序**：`@dnd-kit/sortable` 仅在 **`transform` 非恒等**时写入 `<tr>`；表 **`border-separate border-spacing-0`**；**`PointerSensor`**（`distance: 8`），拖动手柄 **`touch-none`**。
  - **右侧只读「ROOM（镜像）」列**：位于右月「交租」与「删」之间，实时显示与左侧相同的房号，**不可编辑**；列宽与「申报 / 实际」一致（**`COMPACT_COL_TD`**）；左侧 ROOM 列宽仍为 **`ROOM_COL_TD`**。
  - **表头**：两行列名 **`text-center align-middle`**；「筛选」按钮在表头格内 **flex 居中**。
  - **列数**：表体与空状态、合计行共 **17** 列（含镜像列）。
- **房源状态跨月**：`src/utils/propertyStatus.js` 中 **`getPropertyStatus`** 在无当月带 `status` 的记录时，继承 **上一有记录月份** 的状态，再回退 `property.status`。`PropertyDetail.jsx`：添加/编辑收支时默认状态与保存后的 **`property.status`** 与之一致。

---

## 快速启动（摘录）

- 前端：`06-rental-tracking` 根目录 `npm install && npm run dev`（默认端口见 `docs/README.md` 或 `package.json`）。
- 后端：`06-rental-tracking/backend`，`npm install && npm start`（默认 **3003**）。
- 生产与 JWT、Nginx 反代等仍以 **`docs/README.md`** 专章为准。
