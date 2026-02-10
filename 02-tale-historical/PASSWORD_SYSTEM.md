# 密码保护系统说明

## 功能概述

为了保护隐私内容，「游戏文本」和「个人私密」两个分类需要输入每日密码才能访问。

## 密码生成规则

密码每天自动变化，格式为：**当前日期 + 英文星期缩写（前两个字母）**

### 格式说明
```
YYYYMMDD + 星期缩写
```

### 星期缩写对照表
- 星期日: `su` (Sunday)
- 星期一: `mo` (Monday)
- 星期二: `tu` (Tuesday)
- 星期三: `we` (Wednesday)
- 星期四: `th` (Thursday)
- 星期五: `fr` (Friday)
- 星期六: `sa` (Saturday)

### 密码示例

| 日期 | 星期 | 密码 |
|------|------|------|
| 2026/02/04 | 星期三 | `20260204we` |
| 2026/02/05 | 星期四 | `20260205th` |
| 2026/02/06 | 星期五 | `20260206fr` |
| 2026/02/07 | 星期六 | `20260207sa` |
| 2026/02/08 | 星期日 | `20260208su` |

## 使用流程

### 1. 点击受保护的分类
当你点击「游戏文本」或「个人私密」分类时，会弹出密码验证窗口。

### 2. 输入密码
- 输入框会自动获得焦点
- 支持按回车键提交
- 密码以等宽字体显示，便于输入

### 3. 验证结果
- **密码正确**: 自动解锁该分类，显示书籍列表
- **密码错误**: 显示错误提示，可以重新输入

### 4. 解锁状态
- 解锁后的分类会在当前会话中保持解锁状态
- 刷新页面后需要重新输入密码
- 锁定图标会从分类标签上消失

## 界面说明

### 分类标签状态

**未解锁状态**
```
🔒 游戏文本 🔒
```
- 显示锁定图标
- 点击后弹出密码验证窗口

**已解锁状态**
```
📖 游戏文本
```
- 不显示锁定图标
- 可以直接切换查看

### 密码验证窗口

```
┌─────────────────────────────┐
│ 🔒 需要验证              × │
├─────────────────────────────┤
│ 请输入今日密码以访问        │
│ 「游戏文本」分类            │
│                             │
│ [密码输入框]                │
│                             │
│ 💡 提示：密码格式为当日     │
│    日期+星期缩写            │
│    （如：20260204we）       │
├─────────────────────────────┤
│     [取消]      [确认]      │
└─────────────────────────────┘
```

## 技术实现

### 密码生成函数

```javascript
const generateTodayPassword = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const weekDays = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa']
  const weekDay = weekDays[today.getDay()]
  
  return `${year}${month}${day}${weekDay}`
}
```

### 状态管理

- `unlockedCategories`: Set类型，存储已解锁的分类
- `showPasswordModal`: 控制密码弹窗显示
- `passwordInput`: 用户输入的密码
- `passwordError`: 密码错误提示
- `pendingCategory`: 待解锁的分类名称

### 验证逻辑

```javascript
const handlePasswordSubmit = () => {
  const correctPassword = generateTodayPassword()
  
  if (passwordInput === correctPassword) {
    // 密码正确，解锁分类
    setUnlockedCategories(prev => new Set([...prev, pendingCategory]))
    setSelectedCategory(pendingCategory)
    setShowPasswordModal(false)
  } else {
    // 密码错误
    setPasswordError('密码错误，请重试')
  }
}
```

## 安全性说明

### 当前实现
- 密码验证在前端进行
- 解锁状态仅在当前会话有效
- 刷新页面后需要重新验证

### 安全级别
- **低级别保护**: 适合个人使用，防止他人随意浏览
- **不适合**: 存储高度敏感信息

### 提升安全性建议
如果需要更高的安全性，可以考虑：
1. 添加后端验证
2. 使用更复杂的密码规则
3. 添加访问日志
4. 实现密码错误次数限制
5. 使用加密存储

## 自定义配置

### 修改受保护的分类

在 `Bookshelf.jsx` 中修改：

```javascript
// 需要密码验证的分类
const protectedCategories = ['游戏文本', '个人私密']
```

### 修改密码规则

如果想使用不同的密码规则，修改 `generateTodayPassword` 函数：

```javascript
// 示例：只使用日期，不包含星期
const generateTodayPassword = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  
  return `${year}${month}${day}`
}
```

### 修改弹窗样式

在 `App.css` 中修改相关样式：

```css
.password-modal {
  /* 修改弹窗背景色 */
  background: white;
  
  /* 修改圆角 */
  border-radius: 16px;
}

.password-btn-submit {
  /* 修改确认按钮颜色 */
  background: #78350f;
}
```

## 常见问题

### Q1: 忘记今天的密码怎么办？
**A**: 密码格式是固定的：`YYYYMMDD + 星期缩写`。例如今天是2026年2月4日星期三，密码就是 `20260204we`。

### Q2: 密码区分大小写吗？
**A**: 是的，密码区分大小写。星期缩写必须是小写字母。

### Q3: 解锁后刷新页面还需要重新输入吗？
**A**: 是的，解锁状态只在当前会话有效，刷新页面后需要重新验证。

### Q4: 可以永久解锁某个分类吗？
**A**: 当前版本不支持。如果需要这个功能，可以使用 localStorage 存储解锁状态。

### Q5: 如何临时关闭密码保护？
**A**: 在 `Bookshelf.jsx` 中将对应分类从 `protectedCategories` 数组中移除即可。

## 更新日志

### 2026-02-04
- ✅ 实现密码保护功能
- ✅ 添加密码验证弹窗
- ✅ 实现每日密码自动生成
- ✅ 添加解锁状态管理
- ✅ 优化用户体验（回车提交、自动聚焦等）
