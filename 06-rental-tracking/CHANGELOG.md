# 06-rental-tracking 变更记录（入库副本）

完整综合说明仍以本地 **`docs/README.md`** 为准（该目录默认不入 Git）。本节与 `docs/README.md` 中「最近更新」保持同步摘要，便于在 GitHub 上查阅。

## 2026-05-15

- **照片单张上限**：2MB → 5MB（`src/config/index.js`、`backend/routes/upload.js`、`backend/middleware/validation.js`）。
- **账目单租金表（手机）**：已取消左侧 ROOM 列 `position:sticky` 与内层 `overflow-x-auto` 触控包装，表格随页面横纵滑动与系统缩放（避免触控与 sticky 反复打架）。**右侧镜像 ROOM**：在右月「交租」列与「删」列之间增加只读列，内容与左侧房号同步展示；`useSortable` 仍在 `<tr>` 上仅在非恒等 `transform` 时写 `transform`；表 `border-separate border-spacing-0`；行拖拽为 `PointerSensor`（手柄 `touch-none`）。
- **房源状态跨月**：`propertyStatus.js` — `getPropertyStatus` 在无当月状态时继承上一有记录月份的状态；`PropertyDetail.jsx` — 添加/编辑收支记录时默认状态与保存后的 `property.status` 与之一致。
