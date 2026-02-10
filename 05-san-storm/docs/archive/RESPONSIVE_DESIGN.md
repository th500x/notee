# 响应式设计指南

## 设计理念

**移动优先 (Mobile First)** - 先设计手机版，再适配PC端

### 为什么移动优先？
1. ✅ 大部分玩家会用手机玩
2. ✅ 手机屏幕限制更多，设计更简洁
3. ✅ 从小屏适配到大屏比反过来容易
4. ✅ 触摸操作是基础，鼠标操作是增强

---

## 屏幕尺寸断点

```css
/* Tailwind CSS 断点 */
/* 手机 */
sm: 640px   /* 小手机横屏 */

/* 平板 */
md: 768px   /* 平板竖屏 */
lg: 1024px  /* 平板横屏 */

/* PC */
xl: 1280px  /* 小笔记本 */
2xl: 1536px /* 大显示器 */
```

### 游戏适配策略

```javascript
// 检测设备类型
const deviceType = {
  mobile: window.innerWidth < 768,
  tablet: window.innerWidth >= 768 && window.innerWidth < 1024,
  desktop: window.innerWidth >= 1024
};

// 检测方向
const orientation = {
  portrait: window.innerHeight > window.innerWidth,  // 竖屏
  landscape: window.innerWidth > window.innerHeight  // 横屏
};
```

---

## 布局设计

### 1. 手机端（竖屏）- 主要设计

```
┌─────────────────────┐
│   顶部状态栏         │  ← 固定高度 60px
│   等级 金币 经验     │
├─────────────────────┤
│                     │
│                     │
│    游戏主区域        │  ← 弹性高度
│   (地图/战斗/事件)   │
│                     │
│                     │
├─────────────────────┤
│   底部操作栏         │  ← 固定高度 80px
│  [地图][背包][设置]  │
└─────────────────────┘

尺寸: 375x667 (iPhone SE)
     414x896 (iPhone 11)
```

### 2. 手机端（横屏）- 次要支持

```
┌──────────────────────────────────────┐
│ 状态 │    游戏主区域    │   操作   │
│ 栏   │   (地图/战斗)    │   栏     │
│ 60px │                  │   80px   │
└──────────────────────────────────────┘

尺寸: 667x375 (iPhone SE横屏)
```

### 3. PC端（横屏）- 增强体验

```
┌────────────────────────────────────────────┐
│         顶部导航栏 (固定)                   │
├──────┬──────────────────────────┬──────────┤
│      │                          │          │
│ 左侧 │    游戏主区域             │   右侧   │
│ 面板 │   (地图/战斗/事件)        │   面板   │
│      │                          │          │
│ 250px│                          │   250px  │
│      │                          │          │
├──────┴──────────────────────────┴──────────┤
│         底部信息栏 (可选)                   │
└────────────────────────────────────────────┘

尺寸: 1920x1080 (常见PC分辨率)
```

---

## UI组件设计

### 1. 按钮尺寸

```jsx
// 手机端 - 大按钮（方便触摸）
<button className="
  w-full h-14           /* 宽度100%, 高度56px */
  text-lg font-bold     /* 大字体 */
  rounded-lg            /* 圆角 */
  active:scale-95       /* 点击反馈 */
  transition-transform  /* 动画 */
">
  确认
</button>

// PC端 - 中等按钮
<button className="
  w-auto px-8 h-12      /* 自适应宽度, 高度48px */
  text-base             /* 正常字体 */
  hover:bg-blue-600     /* 鼠标悬停效果 */
  cursor-pointer        /* 鼠标指针 */
">
  确认
</button>
```

### 2. 文字大小

```css
/* 手机端 */
.title { font-size: 24px; }      /* 标题 */
.content { font-size: 16px; }    /* 正文 */
.small { font-size: 14px; }      /* 小字 */

/* PC端 */
.title { font-size: 32px; }      /* 标题 */
.content { font-size: 18px; }    /* 正文 */
.small { font-size: 14px; }      /* 小字 */
```

### 3. 间距

```css
/* 手机端 - 紧凑 */
.container { padding: 16px; }
.gap { gap: 12px; }

/* PC端 - 宽松 */
.container { padding: 24px; }
.gap { gap: 20px; }
```

---

## 事件对话框设计

### 手机端

```jsx
// 全屏对话框（手机）
<div className="
  fixed inset-0           /* 全屏覆盖 */
  bg-black/80             /* 半透明背景 */
  flex items-end          /* 底部对齐 */
  md:items-center         /* PC端居中 */
  z-50                    /* 最高层级 */
">
  <div className="
    w-full                /* 手机全宽 */
    md:w-[600px]          /* PC端固定宽度 */
    bg-white              /* 白色背景 */
    rounded-t-3xl         /* 顶部圆角 */
    md:rounded-2xl        /* PC端全圆角 */
    p-6                   /* 内边距 */
    max-h-[80vh]          /* 最大高度80% */
    overflow-y-auto       /* 滚动 */
  ">
    {/* 事件标题 */}
    <h2 className="text-2xl font-bold mb-4">
      桃园结义
    </h2>
    
    {/* 事件描述 */}
    <p className="text-base leading-relaxed mb-6">
      你在桃园遇到了两位豪杰...
    </p>
    
    {/* 选项按钮 */}
    <div className="space-y-3">
      <button className="w-full h-14 bg-blue-500 text-white rounded-lg">
        欣然接受，共饮此杯
      </button>
      <button className="w-full h-14 bg-gray-200 text-gray-700 rounded-lg">
        婉言谢绝，继续赶路
      </button>
    </div>
  </div>
</div>
```

### PC端增强

```jsx
// PC端可以显示更多信息
<div className="hidden md:block absolute top-4 right-4">
  {/* 事件元数据 */}
  <div className="text-sm text-gray-500">
    <div>难度: 简单</div>
    <div>稀有度: 稀有</div>
  </div>
</div>

// PC端可以显示角色立绘
<div className="hidden lg:block w-48 h-64">
  <img src="/characters/liubei.png" alt="刘备" />
</div>
```

---

## 战斗界面设计

### 手机端（竖屏）

```
┌─────────────────────┐
│   敌方信息           │  ← 60px
│   HP: ████░░ 80%    │
├─────────────────────┤
│                     │
│   战斗棋盘区域       │  ← 弹性高度
│   7x7 或 10x10      │     (正方形)
│                     │
├─────────────────────┤
│   我方信息           │  ← 60px
│   HP: ██████ 100%   │
├─────────────────────┤
│   操作按钮           │  ← 100px
│ [移动][攻击][技能]   │
└─────────────────────┘
```

### PC端（横屏）

```
┌────────────────────────────────────────┐
│         回合信息 / 操作提示             │
├──────┬──────────────────────┬──────────┤
│      │                      │          │
│ 敌方 │   战斗棋盘区域        │   我方   │
│ 信息 │   7x7 或 10x10       │   信息   │
│      │                      │          │
│ 200px│                      │   200px  │
│      │                      │          │
├──────┴──────────────────────┴──────────┤
│   操作按钮 [移动][攻击][技能][结束回合] │
└────────────────────────────────────────┘
```

---

## 地图界面设计

### 手机端

```jsx
// 全屏地图
<div className="relative w-full h-full">
  {/* 地图画布 */}
  <canvas 
    ref={mapCanvas}
    className="w-full h-full"
    style={{ touchAction: 'none' }}  // 禁用默认触摸行为
  />
  
  {/* 小地图（右上角）*/}
  <div className="absolute top-4 right-4 w-24 h-24 bg-black/50 rounded-lg">
    <canvas ref={miniMapCanvas} className="w-full h-full" />
  </div>
  
  {/* 操作按钮（右下角）*/}
  <div className="absolute bottom-4 right-4 flex flex-col gap-2">
    <button className="w-12 h-12 bg-white/90 rounded-full shadow-lg">
      +
    </button>
    <button className="w-12 h-12 bg-white/90 rounded-full shadow-lg">
      -
    </button>
  </div>
</div>
```

### 触摸手势

```javascript
// 地图操作手势
const mapGestures = {
  // 单指拖动 - 移动地图
  onPan: (e) => {
    map.move(e.deltaX, e.deltaY);
  },
  
  // 双指缩放 - 缩放地图
  onPinch: (e) => {
    map.zoom(e.scale);
  },
  
  // 单击 - 选择单位
  onTap: (e) => {
    const unit = map.getUnitAt(e.x, e.y);
    if (unit) selectUnit(unit);
  },
  
  // 长按 - 显示详情
  onLongPress: (e) => {
    const tile = map.getTileAt(e.x, e.y);
    showTileInfo(tile);
  }
};
```

---

## 输入适配

### 触摸 vs 鼠标

```javascript
// 统一的输入处理
class InputHandler {
  constructor() {
    this.isTouchDevice = 'ontouchstart' in window;
  }
  
  // 统一的点击事件
  onClick(element, callback) {
    if (this.isTouchDevice) {
      element.addEventListener('touchend', (e) => {
        e.preventDefault();
        callback(e.changedTouches[0]);
      });
    } else {
      element.addEventListener('click', callback);
    }
  }
  
  // 统一的拖动事件
  onDrag(element, callbacks) {
    if (this.isTouchDevice) {
      element.addEventListener('touchstart', callbacks.start);
      element.addEventListener('touchmove', callbacks.move);
      element.addEventListener('touchend', callbacks.end);
    } else {
      element.addEventListener('mousedown', callbacks.start);
      element.addEventListener('mousemove', callbacks.move);
      element.addEventListener('mouseup', callbacks.end);
    }
  }
}
```

---

## 性能优化

### 1. 图片资源

```javascript
// 根据设备加载不同分辨率的图片
const imageQuality = {
  mobile: {
    character: '512x512',
    background: '1024x768',
    icon: '64x64'
  },
  desktop: {
    character: '1024x1024',
    background: '1920x1080',
    icon: '128x128'
  }
};

// 懒加载
<img 
  src={placeholder} 
  data-src={actualImage}
  loading="lazy"
  className="w-full h-auto"
/>
```

### 2. 动画性能

```css
/* 使用 transform 而不是 position */
/* ❌ 性能差 */
.move {
  left: 100px;
  top: 100px;
}

/* ✅ 性能好 */
.move {
  transform: translate(100px, 100px);
  will-change: transform;  /* 提示浏览器优化 */
}
```

### 3. 渲染优化

```javascript
// 只渲染可见区域
class Viewport {
  constructor(canvas) {
    this.canvas = canvas;
    this.visibleArea = this.calculateVisibleArea();
  }
  
  render(entities) {
    // 只渲染在视口内的实体
    const visibleEntities = entities.filter(entity => 
      this.isInViewport(entity)
    );
    
    visibleEntities.forEach(entity => {
      entity.render(this.canvas);
    });
  }
}
```

---

## 测试清单

### 手机端测试

- [ ] iPhone SE (375x667) - 小屏手机
- [ ] iPhone 12 (390x844) - 标准手机
- [ ] iPhone 12 Pro Max (428x926) - 大屏手机
- [ ] Android (360x640) - 安卓小屏
- [ ] Android (412x915) - 安卓标准

### 平板测试

- [ ] iPad (768x1024) - 竖屏
- [ ] iPad (1024x768) - 横屏
- [ ] iPad Pro (1024x1366) - 大平板

### PC测试

- [ ] 1366x768 - 小笔记本
- [ ] 1920x1080 - 标准显示器
- [ ] 2560x1440 - 2K显示器

### 功能测试

- [ ] 触摸操作流畅
- [ ] 鼠标操作正常
- [ ] 横竖屏切换正常
- [ ] 文字清晰可读
- [ ] 按钮大小合适
- [ ] 动画流畅（60fps）
- [ ] 加载速度快（<3秒）

---

## 实用工具

### 1. 响应式调试

```javascript
// 显示当前屏幕信息（开发时使用）
function showDebugInfo() {
  const info = document.createElement('div');
  info.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 10px;
    font-size: 12px;
    z-index: 9999;
  `;
  
  function update() {
    info.innerHTML = `
      屏幕: ${window.innerWidth}x${window.innerHeight}<br>
      设备: ${deviceType.mobile ? '手机' : deviceType.tablet ? '平板' : 'PC'}<br>
      方向: ${orientation.portrait ? '竖屏' : '横屏'}<br>
      DPR: ${window.devicePixelRatio}
    `;
  }
  
  update();
  window.addEventListener('resize', update);
  document.body.appendChild(info);
}
```

### 2. 安全区域适配（iPhone刘海屏）

```css
/* 适配iPhone刘海屏 */
.safe-area-top {
  padding-top: env(safe-area-inset-top);
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

/* 示例 */
.game-header {
  height: 60px;
  padding-top: env(safe-area-inset-top);
}
```

---

## 总结

### 核心原则

1. **移动优先** - 先设计手机版
2. **触摸友好** - 按钮够大，间距合理
3. **性能优先** - 优化加载和渲染
4. **渐进增强** - PC端提供更多功能

### 推荐工具

- **设计**: Figma（响应式设计）
- **开发**: Tailwind CSS（快速响应式）
- **测试**: Chrome DevTools（设备模拟）
- **调试**: React DevTools（组件检查）

### 下一步

1. 创建基础UI组件库
2. 实现响应式布局
3. 测试各种设备
4. 优化性能

祝开发顺利！📱💻
