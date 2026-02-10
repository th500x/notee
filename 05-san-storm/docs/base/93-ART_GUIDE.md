# 美术设计指南

**文档版本**: v1.0.0  
**最后更新**: 2026-02-09

---

## 📋 文档概述

本文档涵盖游戏美术设计的两个核心方面：
1. **美术风格** - 整体视觉风格和设计原则
2. **资源规范** - 具体的尺寸、格式、命名规范

---

## 一、美术风格

### 1.1 核心美术方向

**采用方案：半写实卡通风 + 水墨元素**

结合现代卡通风格的易用性与中国传统水墨的文化底蕴，打造独特的三国游戏视觉体验。

### 1.2 设计原则

#### 角色设计 - 半写实卡通风格

**风格定位**：
- 介于纯卡通和写实之间
- 保留人物特征的真实感
- 简化细节，突出个性
- 色彩鲜明，易于识别

**参考游戏**：
- 《三国志·战略版》
- 《率土之滨》
- 《鸿图之下》
- 《火焰纹章：风花雪月》

**技术实现**：
- 使用AI生成（Stable Diffusion）
- 推荐模型：
  - `CounterfeitV3.0`（半写实动漫）
  - `RealisticVision`（写实向）
  - `Anything V5`（动漫向）

#### UI设计 - 水墨元素点缀

**应用场景**：
- ✅ 界面边框和装饰
- ✅ 背景纹理
- ✅ 过场动画
- ✅ 技能释放特效（可选）
- ✅ 加载界面

**水墨元素使用原则**：
- **适度使用**：不喧宾夺主
- **点缀为主**：增加文化氛围
- **可选实现**：根据开发进度灵活调整

**具体应用**：

**优先级 P0（必须实现）**：
- 卡牌边框：水墨笔触边框
- 按钮装饰：水墨纹理背景
- 分隔线：水墨笔画效果

**优先级 P1（中期实现）**：
- 背景图：水墨山水远景
- 过场动画：水墨晕染效果
- 加载界面：水墨画卷展开

**优先级 P2（长期优化）**：
- 技能特效：水墨笔触轨迹
- 战斗场景：水墨风格地图
- 动态效果：墨迹扩散动画

### 1.3 色彩方案

#### 主色调
- **主色**：深蓝色 `#1e3a8a`（代表智慧、策略）
- **辅色**：金黄色 `#f59e0b`（代表权力、荣耀）
- **强调色**：朱红色 `#dc2626`（代表战斗、激情）

#### 稀有度配色
- **Core（核心）**：金黄色 `#fbbf24` + 光效
- **Legendary（传奇）**：橙红色 `#f97316` + 光效
- **Epic（史诗）**：紫色 `#a855f7` + 光效
- **Rare（稀有）**：蓝色 `#3b82f6`
- **Common（普通）**：灰色 `#6b7280`

#### 势力配色
- **刘备**：绿色 `#10b981`（仁德）
- **曹操**：蓝色 `#3b82f6`（智谋）
- **孙坚**：红色 `#ef4444`（勇武）
- **袁绍**：紫色 `#8b5cf6`（权贵）
- **董卓**：暗红 `#991b1b`（暴虐）
- **汉室**：金黄 `#f59e0b`（正统）
- **黄巾**：黄色 `#eab308`（起义）

### 1.4 分阶段实施

#### 阶段1：里程碑1-2（当前）
**目标**：快速验证玩法

**美术内容**：
- ✅ 半写实卡通风格武将立绘（140个）
- ✅ 简洁现代UI设计
- ✅ 基础卡牌框架
- ⚠️ 水墨元素：仅边框装饰（最小化）

**工作量**：2-4周

**技术方案**：
- AI批量生成武将立绘
- 使用现成UI框架（Tailwind CSS）
- 简单的水墨纹理素材（网上下载）

#### 阶段2：里程碑3-4（中期）
**目标**：提升视觉品质

**美术内容**：
- ✅ 优化武将立绘（表情、姿态变化）
- ✅ 精美UI设计（水墨元素增强）
- ✅ 技能特效（粒子系统）
- ✅ 战斗场景（2D战棋地图）

**工作量**：2-3个月

#### 阶段3：里程碑5+（长期）
**目标**：打造独特视觉风格

**美术内容**：
- ✅ Live2D动画（武将眨眼、呼吸）
- ✅ 水墨风格战斗场景
- ✅ 动态水墨特效
- ✅ 过场动画（水墨画卷）

**工作量**：6-12个月

---

## 二、资源规范

### 2.1 卡牌尺寸规范

**所有卡牌类型统一使用**：

| 项目 | 尺寸 | 比例 | 说明 |
|------|------|------|------|
| 完整卡牌 | 512 × 768 px | 2:3 | 包含边框、标题、图标、属性等完整UI |
| 显示尺寸 | 256 × 384 px | 2:3 | 前端显示时缩小50% |

**适用范围**：
- 武将卡牌
- 部队卡牌
- 道具卡牌
- 装备卡牌

### 2.2 图标尺寸规范

#### 部队图标

| 项目 | 尺寸 | 格式 | 说明 |
|------|------|------|------|
| **推荐尺寸** | **400 × 400 px** | PNG | 方形，支持透明背景，适配2x-3x屏幕 |
| 理想尺寸 | 512 × 512 px | PNG | 标准图标尺寸，AI生成默认输出 |
| 最小尺寸 | 200 × 200 px | PNG | 低于此尺寸会模糊 |
| 显示尺寸 | 100 × 100 px | - | 前端实际显示大小 |

**为什么推荐400×400px？**
- ✅ 是显示尺寸的4倍，适合高分辨率屏幕
- ✅ 文件大小适中（PNG约50-200KB）
- ✅ 足够清晰，缩放不失真
- ✅ 未来放大显示也够用

#### 武将头像

| 项目 | 尺寸 | 格式 | 说明 |
|------|------|------|------|
| 推荐尺寸 | 400 × 400 px | PNG | 方形或圆形，支持透明背景 |
| 最小尺寸 | 256 × 256 px | PNG | 低于此尺寸会模糊 |

#### 武将立绘

| 项目 | 尺寸 | 格式 | 说明 |
|------|------|------|------|
| 推荐尺寸 | 1024 × 1536 px | PNG | 2:3比例，透明背景 |
| 文件大小 | < 500KB | - | 优化后 |

#### 道具图标

| 项目 | 尺寸 | 格式 | 说明 |
|------|------|------|------|
| 推荐尺寸 | 256 × 256 px | PNG | 方形，支持透明背景 |
| 最小尺寸 | 128 × 128 px | PNG | 低于此尺寸会模糊 |

### 2.3 文件命名规范

#### 部队图标

**命名格式**：`{troop_id}.png`

**示例**：
```
troop_san_1001.png  // S1赛季，通用部队，第1个（民兵）
troop_san_1002.png  // S1赛季，通用部队，第2个（刀盾兵）
troop_san_1101.png  // S1赛季，刘备势力，第1个（白马义从）
```

**存放路径**：`public/assets/troops/`

#### 武将头像

**命名格式**：`{character_id}.png`

**示例**：
```
char_san_1101.png  // 刘备
char_san_1102.png  // 关羽
char_san_1103.png  // 张飞
```

**存放路径**：`public/assets/characters/`

#### 武将立绘

**命名格式**：`{character_id}_portrait.png`

**示例**：
```
char_san_1101_portrait.png  // 刘备立绘
```

#### 技能图标

**命名格式**：`{skill_id}_icon.png`

**示例**：
```
skill_1_5001_icon.png
```

#### 道具图标

**命名格式**：`{item_id}.png`

**示例**：
```
item_weapon_001.png  // 青龙偃月刀
item_armor_001.png   // 白银铠甲
```

**存放路径**：
```
public/assets/items/
├── weapons/
├── armors/
└── accessories/
```

### 2.4 文件大小规范

| 资源类型 | 尺寸 | 目标大小 | 最大大小 |
|---------|------|---------|---------|
| 部队图标 | 400×400 | 50-150KB | 200KB |
| 武将头像 | 400×400 | 50-150KB | 200KB |
| 武将立绘 | 1024×1536 | 200-500KB | 800KB |
| 道具图标 | 256×256 | 30-80KB | 100KB |

**优化建议**：
- 使用8位色深（256色）而非24位
- 启用PNG压缩
- 移除元数据
- 可选WebP格式（减少30-50%）

---

## 三、部队卡牌布局

### 3.1 布局结构

```
┌─────────────────┐
│   部队名称区域   │ ← 顶部 (40px)
│   [兵种] 名称    │   稀有度标识
├─────────────────┤
│ [图标]  兵力     │
│ 100×100 射程     │ ← 图标+信息区 (120px)
│                 │   左图标，右信息
├─────────────────┤
│ 攻击 | 防御      │ ← 属性区 (80px)
│ 速度 | 移速      │   2×2网格
├─────────────────┤
│ ✨ 技能         │ ← 技能区 (80px)
│ [技能1]         │   最多显示2个
│ [技能2]         │
├─────────────────┤
│ ✓克制 ✗被克     │ ← 克制/地形 (64px)
│ 地形适应         │
└─────────────────┘
```

### 3.2 图标展示区域

**图标容器**：
- 显示尺寸：100 × 100 px
- 推荐图标：400 × 400 px（4倍图）
- 边框：2px，颜色根据稀有度变化
- 背景：半透明黑色 + 模糊效果
- 位置：左对齐

**图标加载逻辑**：
```javascript
// 1. 优先使用自定义路径
if (troop.iconPath) {
  return troop.iconPath;
}

// 2. 使用默认路径
return `/assets/troops/${troop.id}.png`;

// 3. 加载失败显示占位符
// 显示兵种emoji + "待添加图标"文字
```

---

## 四、部队图标设计指南

### 4.1 步兵图标设计

**设计要点**：
- 展示持盾士兵正面站立
- 强调防御姿态
- 装备：盾牌、长矛/刀剑
- 构图：正面或微侧面

**示例描述**：
```
民兵：简单布衣，木盾，短矛
刀盾兵：皮甲，铁盾，环首刀
重装步兵：重甲，大盾，长矛
陷阵营：精良铠甲，精制盾牌，戟
白毦兵：白色战袍，精美铠甲，长戟
```

### 4.2 骑兵图标设计

**设计要点**：
- 展示骑兵冲锋姿态
- 强调速度和冲击力
- 装备：战马、长矛/刀剑
- 构图：斜向冲锋

**示例描述**：
```
轻骑兵：轻甲，快马，长矛
突骑兵：中甲，战马，骑枪
虎豹骑：重甲，骏马，长矛
白马义从：白马，精甲，长枪
飞熊军：黑甲，战马，长戟
```

### 4.3 弓兵图标设计

**设计要点**：
- 展示弓箭手拉弓姿态
- 强调射程和精准
- 装备：弓/弩、箭袋
- 构图：侧面拉弓或正面持弩

**示例描述**：
```
弓箭手：布衣，木弓，箭袋
强弩兵：皮甲，强弩，箭匣
神臂弩：中甲，神臂弩，特制弩箭
虎贲弩：重甲，重型弩，大型箭匣
先登死士：精甲，连弩，多箭匣
```

---

## 五、AI绘图工作流程

### 5.1 Stable Diffusion参数

**基础参数**：
```
尺寸: 512 × 512 (生成方形图标)
采样器: DPM++ 2M Karras
步数: 20-30
CFG Scale: 7-9
模型: 推荐使用写实风格或中国风模型
```

### 5.2 提示词模板

**武将立绘**：
```
Positive:
masterpiece, best quality, ultra detailed,
semi-realistic style, anime style,
Three Kingdoms warrior, [character name],
[age: young/middle-aged/old], [gender: male/female],
[armor type: heavy armor/light armor/robe],
[weapon: sword/spear/bow/fan],
heroic pose, confident expression,
detailed face, detailed eyes,
clean background, white background,
full body portrait / upper body portrait,
professional lighting, soft shadows

Negative:
lowres, bad anatomy, bad hands, text, error,
missing fingers, extra digit, fewer digits,
cropped, worst quality, low quality,
normal quality, jpeg artifacts, signature,
watermark, username, blurry,
multiple views, reference sheet
```

**步兵图标**：
```
[部队名称] infantry soldier, three kingdoms era, 
standing pose with shield and spear, 
detailed armor, chinese military uniform,
front view, white background, 
game icon art, high quality, 4k
```

**骑兵图标**：
```
[部队名称] cavalry soldier, three kingdoms era,
riding horse, charging pose with lance,
detailed armor, chinese military uniform,
dynamic angle, white background,
game icon art, high quality, 4k
```

**弓兵图标**：
```
[部队名称] archer soldier, three kingdoms era,
drawing bow pose, detailed armor,
chinese military uniform, side view,
white background, game icon art, high quality, 4k
```

### 5.3 后期处理

**必要步骤**：
1. **去除背景** - 使用Photoshop或在线工具去除背景
2. **调整尺寸** - 缩放到目标尺寸
3. **优化文件** - 压缩PNG文件大小
4. **命名保存** - 按照命名规范保存

**推荐工具**：
- **去背景**: remove.bg, Photoshop
- **调整尺寸**: Photoshop, GIMP
- **压缩**: TinyPNG, ImageOptim

---

## 六、质量标准

### 6.1 武将立绘
- ✅ 人物特征清晰可辨
- ✅ 服装符合历史背景
- ✅ 姿态自然，不僵硬
- ✅ 色彩和谐，不刺眼
- ✅ 背景干净，无杂物
- ✅ 分辨率足够，不模糊

### 6.2 UI设计
- ✅ 信息层级清晰
- ✅ 按钮易于点击（移动端）
- ✅ 色彩对比度足够（可读性）
- ✅ 响应式设计（适配不同屏幕）
- ✅ 加载速度快（< 3秒）

### 6.3 水墨元素
- ✅ 不影响信息传达
- ✅ 不降低可读性
- ✅ 与整体风格协调
- ✅ 可以关闭（可选）

---

## 七、参考资源

### AI模型下载
- [Civitai](https://civitai.com/) - 最大的SD模型社区
- [HuggingFace](https://huggingface.co/) - 官方模型库

### 水墨素材
- [Freepik](https://www.freepik.com/) - 搜索 "chinese ink"
- [Pixabay](https://pixabay.com/) - 免费素材
- [Unsplash](https://unsplash.com/) - 高质量图片

### UI设计参考
- [Dribbble](https://dribbble.com/) - 搜索 "game UI"
- [Behance](https://www.behance.net/) - 游戏UI设计
- [Pinterest](https://pinterest.com/) - 三国游戏UI

### 字体推荐
- **标题**：思源黑体 Bold / 站酷高端黑
- **正文**：思源黑体 Regular / 苹方
- **装饰**：汉仪尚巍手书 / 庞门正道标题体

---

## 八、注意事项

### 8.1 版权问题
- ✅ AI生成的图片可商用（确认模型许可）
- ✅ 自己绘制的原创内容
- ✅ 购买的商用素材
- ❌ 不要直接使用其他游戏的美术资源
- ❌ 不要使用未授权的历史画作

### 8.2 性能优化
- 所有图片必须压缩优化
- 使用WebP格式（比PNG小30-50%）
- 实现懒加载（按需加载）
- 使用雪碧图（Sprite Sheet）合并小图标

### 8.3 风格一致性
- 建立角色设计规范文档
- 使用相同的AI模型和参数
- 定期审查，确保风格统一
- 建立素材库，复用通用元素

---

## 九、灵活调整原则

### 水墨元素的实施灵活性

**核心原则**：
> 水墨元素是**加分项**，不是**必需项**。如果实现困难或影响开发进度，可以灵活精简或延后。

**精简策略**：

#### 最小化方案（P0）
- 仅保留：卡牌边框的水墨纹理
- 实现方式：使用现成的水墨PNG素材作为边框
- 工作量：1-2天

#### 简化方案（P1）
- 保留：边框 + 背景纹理
- 实现方式：使用CSS滤镜模拟水墨效果
- 工作量：3-5天

#### 完整方案（P2）
- 保留：所有水墨元素
- 实现方式：自定义水墨特效系统
- 工作量：2-4周

**决策依据**：
- 如果开发进度紧张 → 采用最小化方案
- 如果有额外时间 → 逐步升级到简化/完整方案
- 如果玩家反馈需要 → 后期迭代添加

---

## 十、总结

**核心美术风格**：半写实卡通风 + 水墨元素点缀

**优势**：
- ✅ 快速实现（AI生成）
- ✅ 风格统一（易于批量）
- ✅ 文化特色（水墨元素）
- ✅ 灵活可调（水墨可精简）
- ✅ 现代审美（年轻玩家接受）

**实施路径**：
1. 先做半写实卡通风格武将（核心）
2. 添加最小化水墨元素（边框）
3. 根据进度和反馈逐步增强

**最终目标**：
打造一款既有现代感又有文化底蕴的三国策略游戏！

---

## 十一、免费资源推荐

### 11.1 核心理念

**快速验证优先**：
- 🎯 先用免费资源验证游戏性
- 💰 零成本启动项目
- 🎨 保持风格统一
- 🔄 后期可替换为定制资源

### 11.2 Emoji图标方案（推荐）⭐⭐⭐⭐⭐

**优势**：
- ✅ 完全免费，无版权问题
- ✅ 跨平台兼容
- ✅ 风格统一
- ✅ 开发速度快

**适用场景**：
- 里程碑1-2（核心原型）
- 快速验证游戏性
- 展示原型

**Emoji资源库**：

```javascript
// 势力图标
const FACTION_ICONS = {
  刘备: '🐉',  // 龙（汉室宗亲）
  曹操: '⚔️',  // 剑（军事强权）
  孙坚: '🐯',  // 虎（江东猛虎）
  汉室: '👑',  // 皇冠（正统）
  董卓: '🔥',  // 火（暴君）
  袁绍: '🏛️',  // 宫殿（名门）
  黄巾: '⚡',  // 闪电（起义）
};

// 稀有度图标
const RARITY_ICONS = {
  legendary: '⭐⭐⭐⭐⭐',
  epic: '⭐⭐⭐⭐',
  rare: '⭐⭐⭐',
  common: '⭐⭐',
};

// 属性图标
const ATTRIBUTE_ICONS = {
  luck: '🎲',
  courage: '💪',
  command: '⚔️',
  combat: '🗡️',
  intelligence: '📚',
  politics: '🏛️',
  charisma: '✨',
  morale: '🔥',
};

// 羁绊图标
const BOND_ICONS = {
  桃园: '🌸',
  五虎: '🐯',
  魏武: '⚔️',
  虎卫: '🛡️',
  夏侯: '🏇',
  江东: '🌊',
  袁氏: '🏛️',
  无双: '⚡',
  谋士: '📚',
  卧龙凤雏: '🐉🐦',
};

// 兵种图标
const TROOP_ICONS = {
  步兵: '🚶',
  弓兵: '🏹',
  骑兵: '🏇',
  枪兵: '🔱',
};

// 物品图标
const ITEM_ICONS = {
  武器: '⚔️',
  防具: '🛡️',
  饰品: '💍',
  消耗品: '🧪',
  材料: '📦',
};

// 状态图标
const STATUS_ICONS = {
  吉兆: '✨',
  天灾: '☠️',
  buff: '⬆️',
  debuff: '⬇️',
  胜利: '🏆',
  失败: '💀',
  金币: '💰',
  宝石: '💎',
  经验: '📈',
};
```

**Emoji + 渐变色块方案**：

```css
/* 武将卡片渐变背景 */
.character-card-legendary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.character-card-epic {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.character-card-rare {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.character-card-common {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

/* 势力主题色 */
.faction-liubei {
  background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
}

.faction-caocao {
  background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
}

.faction-sunjian {
  background: linear-gradient(135deg, #F7971E 0%, #FFD200 100%);
}
```

### 11.3 免费图标库

#### Game-icons.net（强烈推荐）⭐⭐⭐⭐⭐

- **网址**：https://game-icons.net/
- **数量**：4000+ 游戏图标
- **授权**：CC BY 3.0（免费商用，需署名）
- **格式**：SVG（可自定义颜色）
- **风格**：统一的线条风格

**适合的图标**：
```
武器类：sword-brandish、spear-hook、bow-arrow、axe-swing
防具类：shield、armor-vest、helmet
人物类：crowned-skull、general、warrior、wizard-staff
势力类：dragon-head、tiger-head、crowned-heart、fire-symbol
属性类：muscle-up、brain、heart-beats、two-coins
```

**使用方法**：
```javascript
// 下载SVG图标，放入 public/icons/ 目录
<img src="/icons/sword-brandish.svg" alt="武力" />

// 或使用React组件
import { ReactComponent as SwordIcon } from './icons/sword-brandish.svg';
<SwordIcon className="w-6 h-6 text-red-500" />
```

#### Heroicons（简约风格）

- **网址**：https://heroicons.com/
- **授权**：MIT（完全免费）
- **格式**：SVG
- **风格**：现代简约

**适合的图标**：user-group、shield-check、fire、star、chart-bar

#### Lucide Icons（现代风格）

- **网址**：https://lucide.dev/
- **授权**：ISC（完全免费）
- **格式**：SVG
- **风格**：清晰简洁

### 11.4 武将头像方案

#### 方案1：纯色圆形头像 + 文字（最简单）

```javascript
// 根据武将名字生成颜色
function getAvatarColor(name) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// 显示武将名字首字
<div className="avatar" style={{ backgroundColor: getAvatarColor('刘备') }}>
  刘
</div>
```

#### 方案2：Dicebear Avatars（自动生成）

- **网址**：https://www.dicebear.com/
- **授权**：免费
- **特点**：根据名字自动生成头像

```javascript
// 直接使用URL
const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent('刘备')}`;
<img src={avatarUrl} alt="刘备" />
```

**风格选择**：avataaars（卡通）、bottts（机器人）、identicon（几何）、initials（首字母）

### 11.5 UI组件库

#### TailwindCSS + Headless UI（推荐）⭐⭐⭐⭐⭐
- **授权**：MIT（完全免费）
- **特点**：完全可定制
- **组件**：模态框、下拉菜单、标签页等

#### DaisyUI（快速开发）⭐⭐⭐⭐
- **授权**：MIT
- **特点**：基于TailwindCSS的组件库
- **组件**：卡片、按钮、徽章等

#### Shadcn/ui（现代风格）⭐⭐⭐⭐⭐
- **授权**：MIT
- **特点**：复制粘贴组件，完全可定制
- **组件**：对话框、表格、表单等

### 11.6 游戏素材包

#### Kenney Game Assets（强烈推荐）⭐⭐⭐⭐⭐

- **网址**：https://kenney.nl/
- **授权**：CC0（完全免费，无需署名）
- **内容**：UI包、角色包、地图包、音效包

**适合的资源包**：
- `UI Pack` - 各种UI元素
- `Game Icons` - 游戏图标
- `Boardgame Pack` - 棋盘游戏素材

### 11.7 配色方案

```javascript
// 势力主题色
const FACTION_COLORS = {
  刘备: {
    primary: '#FF6B6B',
    secondary: '#FF8E53',
    gradient: 'from-red-500 to-orange-500',
  },
  曹操: {
    primary: '#4ECDC4',
    secondary: '#44A08D',
    gradient: 'from-teal-500 to-green-600',
  },
  孙坚: {
    primary: '#F7971E',
    secondary: '#FFD200',
    gradient: 'from-orange-500 to-yellow-400',
  },
  汉室: {
    primary: '#FFD700',
    secondary: '#FFA500',
    gradient: 'from-yellow-500 to-orange-500',
  },
  董卓: {
    primary: '#DC143C',
    secondary: '#8B0000',
    gradient: 'from-red-600 to-red-900',
  },
  袁绍: {
    primary: '#9370DB',
    secondary: '#8A2BE2',
    gradient: 'from-purple-500 to-purple-700',
  },
  黄巾: {
    primary: '#FFD700',
    secondary: '#DAA520',
    gradient: 'from-yellow-500 to-yellow-600',
  },
};

// 稀有度颜色
const RARITY_COLORS = {
  legendary: {
    color: '#FFD700',
    gradient: 'from-yellow-400 to-yellow-600',
    glow: 'shadow-yellow-500/50',
  },
  epic: {
    color: '#9C27B0',
    gradient: 'from-purple-500 to-purple-700',
    glow: 'shadow-purple-500/50',
  },
  rare: {
    color: '#2196F3',
    gradient: 'from-blue-500 to-blue-700',
    glow: 'shadow-blue-500/50',
  },
  common: {
    color: '#4CAF50',
    gradient: 'from-green-500 to-green-700',
    glow: 'shadow-green-500/50',
  },
};
```

### 11.8 里程碑资源规划

#### 里程碑1-2（当前）
**必须有**：
- ✅ Emoji图标（免费）
- ✅ TailwindCSS（免费）
- ✅ 渐变色背景（CSS）
- ✅ 纯色圆形头像（CSS）

**暂时不需要**：
- ❌ 武将插画
- ❌ 地图素材
- ❌ 音效
- ❌ 动画

#### 里程碑3-4（中期）
**可以添加**：
- ✅ Game-icons.net图标（免费）
- ✅ Dicebear头像（免费）
- ✅ 简单的战斗动画（CSS）

#### 里程碑5+（长期）
**可以考虑**：
- ✅ AI生成武将头像
- ✅ 定制UI图标
- ✅ 地图素材
- ✅ 音效

**可能需要成本**：
- 💰 委托画师绘制
- 💰 购买素材包
- 💰 AI生成（需要订阅）

### 11.9 资源替换策略

**渐进式替换**：

```
阶段1（里程碑1-2）：
- 使用Emoji + 纯色
- 验证游戏性

阶段2（里程碑3-4）：
- 添加免费图标库
- 优化UI效果

阶段3（里程碑5+）：
- 考虑AI生成
- 定制化资源

阶段4（正式版）：
- 委托画师
- 完整美术资源
```

### 11.10 实用建议

**开发原则**：
- ✅ 先验证游戏性，功能比美术重要
- ✅ 保持风格统一（全部用Emoji或全部用图标库）
- ✅ 利用CSS创造视觉效果（渐变色、阴影、动画、滤镜）
- ❌ 不要在美术上花太多时间
- ❌ 不要混搭多种风格

**参考案例**：
- 《Wordle》- 纯色块
- 《2048》- 简单数字
- 《Vampire Survivors》- 像素风格

### 11.11 资源链接汇总

**图标资源**：
- Game-icons.net: https://game-icons.net/
- Heroicons: https://heroicons.com/
- Lucide: https://lucide.dev/

**UI组件**：
- TailwindCSS: https://tailwindcss.com/
- DaisyUI: https://daisyui.com/
- Shadcn/ui: https://ui.shadcn.com/

**头像生成**：
- Dicebear: https://www.dicebear.com/

**游戏素材**：
- Kenney: https://kenney.nl/
- OpenGameArt: https://opengameart.org/

**音效**（可选）：
- Freesound: https://freesound.org/
- Zapsplat: https://www.zapsplat.com/

**配色工具**：
- Coolors: https://coolors.co/
- Color Hunt: https://colorhunt.co/

---

## 十二、响应式设计

### 12.1 设计理念

**移动优先 (Mobile First)** - 先设计手机版，再适配PC端

**为什么移动优先？**
- ✅ 大部分玩家会用手机玩
- ✅ 手机屏幕限制更多，设计更简洁
- ✅ 从小屏适配到大屏比反过来容易
- ✅ 触摸操作是基础，鼠标操作是增强

### 12.2 屏幕尺寸断点

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

**设备检测**：
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

### 12.3 布局设计

#### 手机端（竖屏）- 主要设计

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

#### 手机端（横屏）- 次要支持

```
┌──────────────────────────────────────┐
│ 状态 │    游戏主区域    │   操作   │
│ 栏   │   (地图/战斗)    │   栏     │
│ 60px │                  │   80px   │
└──────────────────────────────────────┘

尺寸: 667x375 (iPhone SE横屏)
```

#### PC端（横屏）- 增强体验

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

### 12.4 UI组件设计

#### 按钮尺寸

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

#### 文字大小

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

#### 间距

```css
/* 手机端 - 紧凑 */
.container { padding: 16px; }
.gap { gap: 12px; }

/* PC端 - 宽松 */
.container { padding: 24px; }
.gap { gap: 20px; }
```

### 12.5 事件对话框设计

#### 手机端

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

#### PC端增强

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

### 12.6 战斗界面设计

#### 手机端（竖屏）

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

#### PC端（横屏）

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

### 12.7 地图界面设计

#### 手机端

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

#### 触摸手势

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

### 12.8 输入适配

#### 触摸 vs 鼠标

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

### 12.9 安全区域适配

#### iPhone刘海屏适配

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

### 12.10 测试清单

#### 手机端测试
- [ ] iPhone SE (375x667) - 小屏手机
- [ ] iPhone 12 (390x844) - 标准手机
- [ ] iPhone 12 Pro Max (428x926) - 大屏手机
- [ ] Android (360x640) - 安卓小屏
- [ ] Android (412x915) - 安卓标准

#### 平板测试
- [ ] iPad (768x1024) - 竖屏
- [ ] iPad (1024x768) - 横屏
- [ ] iPad Pro (1024x1366) - 大平板

#### PC测试
- [ ] 1366x768 - 小笔记本
- [ ] 1920x1080 - 标准显示器
- [ ] 2560x1440 - 2K显示器

#### 功能测试
- [ ] 触摸操作流畅
- [ ] 鼠标操作正常
- [ ] 横竖屏切换正常
- [ ] 文字清晰可读
- [ ] 按钮大小合适
- [ ] 动画流畅（60fps）
- [ ] 加载速度快（<3秒）

### 12.11 响应式调试工具

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

### 12.12 响应式设计原则

**核心原则**：
1. **移动优先** - 先设计手机版
2. **触摸友好** - 按钮够大，间距合理
3. **性能优先** - 优化加载和渲染
4. **渐进增强** - PC端提供更多功能

**推荐工具**：
- **设计**: Figma（响应式设计）
- **开发**: Tailwind CSS（快速响应式）
- **测试**: Chrome DevTools（设备模拟）
- **调试**: React DevTools（组件检查）

---

**文档创建者**: Kiro AI  
**创建日期**: 2026-02-09  
**最后更新**: 2026-02-09  
**文档版本**: v1.2.0
