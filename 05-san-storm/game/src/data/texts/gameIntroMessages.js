/**
 * 步骤1.5：游戏特色介绍对话框文案
 * 触发时机：角色创建完成后，进入游戏大地图时自动显示
 *
 * `gameIntroContentParagraphClass` 由 `ParchmentMessageCard` 与更新公告全屏层复用，改样式时请同步两处视觉。
 */

/** 介绍正文在卡片内的 Tailwind 类（由 GameIntroOverlay 引用，与文案同目录便于一起调） */
export const gameIntroContentParagraphClass =
  'text-gray-800 text-base leading-relaxed sm:text-lg';

export const gameIntroMessages = [
  {
    id: 1,
    position: 'top-left',
    icon: '⚔️',
    title: '《真三风云》',
    content: '本游戏设计理念：好玩，好玩，还是要好玩！公平，公平，还是他娘的公平！',
  },
  {
    id: 2,
    position: 'top-right',
    icon: '📈',
    title: '《机制介绍》',
    content: '进入游戏后请点击右上角的个人中心，可以查看游戏机制的详细介绍',
  },
  {
    id: 3,
    position: 'bottom-right',
    icon: '🎲',
    title: '《氪金之路》',
    content: '通过激活码开通的赛季战令是唯一氪金点（并可通过拉新免费获取），主要目的提高游戏性，平衡体验影响承诺不会超过5%',
  },
  {
    id: 4,
    position: 'bottom-left',
    icon: '💗',
    title: '《其他点滴》',
    content: '真三不比拼氪金/数值/狗运，爱玩爱肝即可名留一时，统领四方，驰骋疆场，机缘天注定，人定必胜天！',
  },
];
