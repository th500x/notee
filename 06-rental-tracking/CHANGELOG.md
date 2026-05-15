# 06-rental-tracking 变更记录（入库副本）

完整综合说明仍以本地 **`docs/README.md`** 为准（该目录默认不入 Git）。本节与 `docs/README.md` 中「最近更新」保持同步摘要，便于在 GitHub 上查阅。

## 2026-05-15

- **照片单张上限**：2MB → 5MB（`src/config/index.js`、`backend/routes/upload.js`、`backend/middleware/validation.js`）。
- **账目单租金表（手机）**：`AccountingRentTab.jsx` — ROOM 列 `position: sticky`，横滑时房号列固定在左侧。
- **房源状态跨月**：`propertyStatus.js` — `getPropertyStatus` 在无当月状态时继承上一有记录月份的状态；`PropertyDetail.jsx` — 添加/编辑收支记录时默认状态与保存后的 `property.status` 与之一致。
