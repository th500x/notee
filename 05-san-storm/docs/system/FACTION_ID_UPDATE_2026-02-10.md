# 势力ID命名规则更新

**更新时间**: 2026-02-10  
**更新内容**: 统一势力ID命名规则，与角色/部队ID保持一致

---

## 更新原因

之前的势力ID使用 `faction_s1_0001` 格式，与角色ID（`char_san_1101`）和部队ID（`troop_san_1101`）的命名规则不一致。

为了保持整个系统ID命名的一致性，将势力ID改为与角色/部队ID相同的编号规则。

---

## 新旧格式对比

### 旧格式
```
faction_s1_0001  // 刘备
faction_s1_0002  // 孙坚
faction_s1_0003  // 曹操
faction_s1_0004  // 汉室
faction_s1_0005  // 董卓
faction_s1_0006  // 袁绍
faction_s1_0007  // 黄巾
```

### 新格式
```
faction_1101  // S1赛季，刘备势力
faction_1201  // S1赛季，曹操势力
faction_1301  // S1赛季，孙坚势力
faction_1401  // S1赛季，袁绍势力
faction_1501  // S1赛季，董卓势力
faction_1601  // S1赛季，汉室势力
faction_1701  // S1赛季，黄巾势力
```

---

## 新格式说明

### 格式规则
```
faction_{赛季势力编号}
```

- 第1位数字：赛季（1=S1, 2=S2, 3=S3...）
- 第2位数字：势力（1=刘备, 2=曹操, 3=孙坚...）
- 第3-4位数字：固定为01（预留扩展）

### 势力编号（0-7）

| 编号 | 势力名称 | 说明 |
|------|---------|------|
| 0 | 通用 | 用于角色/部队，势力本身不使用 |
| 1 | 刘备 | 蜀汉阵营 |
| 2 | 曹操 | 曹魏阵营 |
| 3 | 孙坚 | 东吴阵营 |
| 4 | 袁绍 | 河北军阀 |
| 5 | 董卓 | 西凉军阀 |
| 6 | 汉室 | 汉室朝廷 |
| 7 | 黄巾 | 黄巾军 |

---

## 与其他ID的一致性

### 角色ID
```javascript
char_san_1201  // S1赛季，曹操势力，第1个角色（曹操本人）
```

### 部队ID
```javascript
troop_san_1201  // S1赛季，曹操势力，第1个部队卡（虎豹骑）
```

### 势力ID
```javascript
faction_1201  // S1赛季，曹操势力
```

**一致性优势**：
- 通过ID即可知道赛季和势力
- 编号规则统一，易于理解和记忆
- 便于按赛季和势力排序和查询

---

## 更新的文件列表

### 数据文件
- ✅ `tools/faction-template.csv` - 势力模板CSV
- ✅ `public/data/seasons/s1/factions.json` - 势力数据JSON

### 前端代码
- ✅ `src/seasons/s1/config.js` - S1赛季配置
- ✅ `src/seasons/s1/factions.js` - S1势力定义

### 文档文件
- ✅ `docs/base/92-ID_NAMING_GUIDE.md` - ID命名规范
- ✅ `docs/system/10-core-system/11-FACTION_SYSTEM.md` - 势力系统文档
- ✅ `docs/system/10-core-system/12-AI_FACTION_SYSTEM.md` - AI势力系统
- ✅ `docs/system/10-core-system/14-PLAYER_SYSTEM.md` - 玩家系统
- ✅ `docs/system/30-frontend/31-CHAT_SYSTEM.md` - 聊天系统
- ✅ `docs/base/02-MILESTONES_S1.md` - S1里程碑
- ✅ `src/seasons/s1/README.md` - S1赛季说明
- ✅ `README.md` - 项目主文档

### 归档文档（未更新）
- `docs/archive/` 目录下的文档保持原样，作为历史记录

---

## S1赛季完整势力ID列表

| 势力ID | 势力名称 | 首领ID | 首领名称 | 难度 |
|--------|---------|--------|---------|------|
| `faction_1101` | 刘备 | `char_san_1101` | 刘备 | 中等 |
| `faction_1201` | 曹操 | `char_san_1201` | 曹操 | 简单 |
| `faction_1301` | 孙坚 | `char_san_1301` | 孙坚 | 困难 |
| `faction_1401` | 袁绍 | `char_san_1401` | 袁绍 | 困难 |
| `faction_1501` | 董卓 | `char_san_1501` | 董卓 | 困难 |
| `faction_1601` | 汉室 | `char_san_1601` | 何进 | 简单 |
| `faction_1701` | 黄巾 | `char_san_1701` | 张角 | 中等 |

---

## 未来赛季示例

### S2赛季（未来）
```javascript
faction_2101  // S2赛季，刘备势力
faction_2201  // S2赛季，曹操势力
faction_2301  // S2赛季，孙坚势力
// ...
```

### S3赛季（未来）
```javascript
faction_3101  // S3赛季，刘备势力
faction_3201  // S3赛季，曹操势力
faction_3301  // S3赛季，孙坚势力
// ...
```

---

## 注意事项

1. **势力编号顺序已调整**：
   - 之前：1=刘备, 2=孙坚, 3=曹操
   - 现在：1=刘备, 2=曹操, 3=孙坚
   - 原因：与角色/部队ID保持一致

2. **势力ID没有"通用"（0）**：
   - 角色/部队有通用编号（0），表示可被任何势力使用
   - 势力本身不需要"通用"概念

3. **第3-4位固定为01**：
   - 预留扩展空间
   - 未来可能支持势力分支（如刘备01、刘备02）

---

## 更新完成

所有相关文件已更新完毕，新的势力ID命名规则已生效。

**最后更新**: 2026-02-10
