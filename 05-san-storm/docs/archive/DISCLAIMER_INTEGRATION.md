# 游戏申明集成说明

## 📋 概述

本文档说明如何在游戏中集成游戏申明、版权信息和S1赛季介绍。

---

## 📁 相关文件

### 数据源
- `tools/游戏申明.csv` - 原始申明文本

### 组件
- `src/components/common/GameDisclaimer.jsx` - 游戏申明组件
  - `GameDisclaimer` - 申明展示组件
  - `DisclaimerModal` - 注册确认弹窗

### 示例
- `src/components/auth/RegisterExample.jsx` - 注册流程示例

---

## 🎯 已完成的集成

### 1. 首页展示 ✅

**位置**：`src/App.jsx` - HomePage组件

**内容**：
- 游戏申明（4条）
- S1赛季介绍（10条特色）
- 版权申明

**效果**：
- 所有访问首页的用户都能看到
- 完整展示游戏规则和版权信息
- 美观的卡片式布局

### 2. 页脚版权信息 ✅

**位置**：`src/App.jsx` - Footer组件

**内容**：
- 游戏名称和版本
- 版权声明
- 简短的法律声明

**效果**：
- 每个页面底部都显示
- 持续提醒版权保护

---

## 🔄 待实现的集成

### 3. 注册流程弹窗 ⏳

**时机**：用户点击注册按钮后

**流程**：
```
1. 用户填写注册信息
2. 点击"注册"按钮
3. 弹出游戏申明弹窗
4. 用户阅读并勾选"同意"
5. 点击"同意并继续"
6. 执行注册逻辑
```

**实现示例**：
```jsx
import { DisclaimerModal } from '@/components/common/GameDisclaimer';

function RegisterPage() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleRegister = () => {
    // 验证表单...
    
    // 显示申明弹窗
    setShowDisclaimer(true);
  };

  const handleAcceptDisclaimer = () => {
    // 用户同意后执行注册
    setShowDisclaimer(false);
    // 调用注册API...
  };

  return (
    <>
      {/* 注册表单 */}
      <form onSubmit={handleRegister}>
        {/* ... */}
      </form>

      {/* 申明弹窗 */}
      <DisclaimerModal
        isOpen={showDisclaimer}
        onAccept={handleAcceptDisclaimer}
        onCancel={() => setShowDisclaimer(false)}
      />
    </>
  );
}
```

**参考**：`src/components/auth/RegisterExample.jsx`

---

## 📦 组件使用说明

### GameDisclaimer 组件

**用途**：展示游戏申明和版权信息

**Props**：
- `showFull` (boolean) - 是否显示完整内容（包括S1介绍和版权）
  - `false` - 只显示4条基础申明
  - `true` - 显示完整内容

**使用示例**：
```jsx
import { GameDisclaimer } from '@/components/common/GameDisclaimer';

// 只显示基础申明
<GameDisclaimer showFull={false} />

// 显示完整内容（首页使用）
<GameDisclaimer showFull={true} />
```

### DisclaimerModal 组件

**用途**：注册时的申明确认弹窗

**Props**：
- `isOpen` (boolean) - 是否显示弹窗
- `onAccept` (function) - 用户同意后的回调
- `onCancel` (function) - 用户取消的回调

**特性**：
- 必须勾选"同意"才能继续
- 显示完整的申明内容
- 模态窗口，背景遮罩
- 响应式设计，移动端友好

**使用示例**：
```jsx
import { DisclaimerModal } from '@/components/common/GameDisclaimer';

const [showModal, setShowModal] = useState(false);

<DisclaimerModal
  isOpen={showModal}
  onAccept={() => {
    console.log('用户同意');
    setShowModal(false);
    // 执行注册逻辑...
  }}
  onCancel={() => {
    console.log('用户取消');
    setShowModal(false);
  }}
/>
```

---

## 🎨 样式说明

### 颜色方案
- 主色：蓝色（#3b82f6）
- 成功色：绿色（#10b981）
- 文字：灰色系（#374151, #6b7280, #9ca3af）

### 布局
- 卡片式设计，圆角阴影
- 响应式网格布局
- 移动端友好

### 字体
- 标题：font-bold
- 正文：text-sm
- 代码：font-mono

---

## 📝 内容说明

### 游戏申明（4条）

1. **历史还原**：历史人物、地理仅作还原，非完全考据
2. **势力设定**：综合史实和约定俗成，请勿细究
3. **数据所有权**：玩家拥有数据，倒闭后生成赛博墓志铭
4. **管理权限**：管理员有权制裁违规玩家

### S1赛季介绍（10条）

1. 完全免费，真爱无私
2. 武将唯一，你即唯一
3. 赛季战令，氪金独苗
4. 七大势力，特色各异
5. 精彩日常，绝不长草（求不打脸）
6. 多线程动态调整势力强度
7. 上百位黄巾之乱真实武将
8. 上千条游戏随机组合事件
9. 每日生成漫画不虚度每一天
10. 赛季末进行豪华的终局评定

### 版权申明

```
真三风云 (San Storm)
版本：1.0.0
Copyright © 2026 Notee.vip
保留所有权利

本游戏为原创作品，受版权法保护。
游戏中的创意、机制、数据均为原创。
```

---

## 🔧 未来扩展

### 可能的改进

1. **多语言支持**
   - 添加英文版申明
   - 根据用户语言自动切换

2. **版本历史**
   - 记录用户同意的申明版本
   - 申明更新时提示用户重新确认

3. **详细条款**
   - 添加用户协议链接
   - 添加隐私政策链接
   - 添加服务条款链接

4. **法律合规**
   - 根据地区法律调整申明内容
   - 添加必要的法律声明

---

## ✅ 检查清单

### 里程碑1（当前）
- [x] 创建GameDisclaimer组件
- [x] 创建DisclaimerModal组件
- [x] 首页集成申明展示
- [x] 页脚添加版权信息
- [x] 创建注册示例组件
- [x] 编写集成文档

### 里程碑2+（未来）
- [ ] 实现完整注册流程
- [ ] 集成申明弹窗到注册
- [ ] 记录用户同意记录
- [ ] 添加用户协议页面
- [ ] 添加隐私政策页面

---

## 📚 相关文档

- `SECURITY_AND_IP_GUIDE.md` - 安全和知识产权保护指南
- `tools/游戏申明.csv` - 原始申明文本
- `src/components/auth/RegisterExample.jsx` - 注册流程示例

---

**最后更新**：2026-02-06
**状态**：首页集成完成，注册流程待实现
