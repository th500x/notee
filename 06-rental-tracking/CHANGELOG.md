# 06-rental-tracking 变更记录（入库副本）

完整综合说明仍以本地 **`docs/README.md`** 为准（该目录默认不入 Git）。本节与 `docs/README.md` 中「最近更新」保持同步摘要，便于在 GitHub 上查阅。

## 2026-05-15

- **照片单张上限**：2MB → 5MB（`src/config/index.js`、`backend/routes/upload.js`、`backend/middleware/validation.js`）。
- **账目单租金表（手机）**：`AccountingRentTab.jsx` — ROOM 列 `position: sticky`；`useSortable` 在 `<tr>` 上仅在非恒等 `transform` 时写 `transform`（恒等会破坏 sticky）；表 `border-separate border-spacing-0`。**第四次（Chrome Android 横滑/缩放）**：去掉 `max-lg` 内层 `overflow-x-auto`（改由页面视口横向滚动，减轻与 Dnd 的冲突）；去掉表级 `touch-pan-y`（该写法会禁用双指 `pinch-zoom`）；恢复 `MouseSensor` + `TouchSensor`（`delay: 300`）替代 `PointerSensor`，降低多指缩放被拦截的概率；拖动手柄仍 `data-rent-drag-handle` + `touch-none`。**第五次**：ROOM 外多为公式/日期「展示态 `<button>`」；Chrome Android 上双指缩放易从按钮起手势失效，于 `AccountingFormulaCell`、`AccountingDateIsoCell` 及租金表 `inputCls` 上显式 `[touch-action:pan-x_pan-y_pinch-zoom]`（拖动手柄仍 `touch-none`）；表头「筛选」与行末「删」钮同加。**第六次**：视口横滑虽利于手势，但 `sticky` 依赖「本组件内」的 `overflow-x` 滚动条；恢复内层 `overflow-x-auto` + `w-max` 内容宽，并在该滚动容器上写 `[touch-action:pan-x_pan-y_pinch-zoom]`（不用整表 `touch-pan-y`），与第五次的单元格声明叠加，兼顾 ROOM 吸顶、横滑与双指缩放。**第七次**：横滑再次失效时，滚动容器改为仅 `[touch-action:pan-x_pinch-zoom]`（不写 `pan-y`，减少与内层 `overflow-x` 横滑命中冲突）；`TouchSensor`+`MouseSensor` 改回仅 `PointerSensor`（`distance: 8`），因排序监听器只在拖动手柄上，避免 TouchSensor 与滚动条抢 `touchmove`。**第八次**：第七次在滚动容器上省略 `pan-y` 导致在表区域无法纵向滑页、横滑亦异常；滚动条容器去掉一切 `touch-action`，改由浏览器默认；公式/日期格与 `inputCls`、筛选/删钮的 `pan-*` 改为 `touch-manipulation`，减少对祖先 `overflow-x` 与页面纵滑的干扰。**第九次**：第八次子元素大量 `touch-manipulation` 时 Chrome 常不把横滑交给带 `overflow-x-auto` 的祖先；去掉子控件上的 `touch-manipulation`，仅在横向滚动容器上恢复 `[touch-action:pan-x_pan-y_pinch-zoom]`。
- **房源状态跨月**：`propertyStatus.js` — `getPropertyStatus` 在无当月状态时继承上一有记录月份的状态；`PropertyDetail.jsx` — 添加/编辑收支记录时默认状态与保存后的 `property.status` 与之一致。
