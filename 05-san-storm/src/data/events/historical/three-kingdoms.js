/**
 * 三国历史事件
 * 
 * 基于真实三国历史的事件集合
 */

export const threeKingdomsEvents = [
  {
    id: 'event_tk_0001',
    type: 'historical',
    category: 'three_kingdoms',
    title: '桃园结义',
    
    // 触发条件
    trigger: {
      locations: ['涿郡', '桃园'],
      minLevel: 1,
      requiredFactors: {
        charisma: 60,
      },
      probability: 0.15,
      context: ['move', 'idle'],
    },
    
    // 事件描述
    description: '你在桃园遇到了两位豪杰，他们正在畅谈天下大势。刘备邀请你共饮一杯，是否愿意结交？',
    
    // 选项配置
    options: [
      {
        id: 'option_a',
        text: '欣然接受，共饮此杯',
        outcomes: [
          {
            condition: {
              type: 'factor_check',
              factors: {
                charisma: { min: 70, weight: 0.6 },
                intelligence: { min: 60, weight: 0.4 },
              },
            },
            onSuccess: {
              type: 'text_reward',
              text: '刘备对你赞赏有加，关羽和张飞也对你刮目相看。你们结为异姓兄弟！',
              rewards: {
                relationship: { '刘备': 30, '关羽': 20, '张飞': 20 },
                items: ['桃园令牌'],
                attributes: { charisma: 5 },
              },
            },
            onFailure: {
              type: 'text',
              text: '你言语不当，刘备等人对你颇有微词，匆匆告辞离去。',
              rewards: {
                relationship: { '刘备': -10 },
              },
            },
          },
        ],
      },
      {
        id: 'option_b',
        text: '婉言谢绝，继续赶路',
        outcomes: [
          {
            condition: { type: 'always' },
            onSuccess: {
              type: 'text',
              text: '你礼貌地谢绝了邀请，继续自己的旅程。',
              rewards: {},
            },
          },
        ],
      },
    ],
    
    // 元数据
    metadata: {
      author: '策划组',
      version: '1.0',
      tags: ['结义', '刘备', '关羽', '张飞'],
      difficulty: 'easy',
      rarity: 'rare',
    },
  },

  // 示例事件2 - 可以继续添加更多事件
  {
    id: 'event_tk_0002',
    type: 'historical',
    category: 'three_kingdoms',
    title: '虎牢关之战',
    
    trigger: {
      locations: ['虎牢关'],
      minLevel: 10,
      requiredFactors: {
        combat: 70,
      },
      probability: 0.25,
      context: ['move'],
    },
    
    description: '虎牢关前，吕布独战群雄。你是否愿意上前挑战？',
    
    options: [
      {
        id: 'option_a',
        text: '挺身而出，挑战吕布',
        outcomes: [
          {
            condition: {
              type: 'factor_check',
              factors: {
                combat: { min: 85, weight: 0.7 },
                courage: { min: 80, weight: 0.3 },
              },
            },
            onSuccess: {
              type: 'battle',
              battleConfig: {
                enemy: 'lvbu_boss',
                difficulty: 'hard',
                rewards: {
                  exp: 5000,
                  items: ['方天画戟碎片'],
                  title: '虎牢勇士',
                },
              },
              afterBattleText: {
                victory: '你与吕布大战三百回合，虽未能击败他，但也赢得了他的尊重！',
                defeat: '吕布武艺高强，你不敌败退。但这次经历让你对武道有了更深的理解。',
              },
            },
            onFailure: {
              type: 'text',
              text: '你刚上前，就被吕布的气势所慑，不敢出战。',
              rewards: {
                attributes: { courage: -5 },
              },
            },
          },
        ],
      },
      {
        id: 'option_b',
        text: '观战学习，不参与战斗',
        outcomes: [
          {
            condition: { type: 'always' },
            onSuccess: {
              type: 'text',
              text: '你仔细观察吕布的武艺，从中学到了不少。',
              rewards: {
                exp: 500,
                attributes: { combat: 2 },
              },
            },
          },
        ],
      },
    ],
    
    metadata: {
      author: '策划组',
      version: '1.0',
      tags: ['吕布', '虎牢关', '战斗'],
      difficulty: 'hard',
      rarity: 'epic',
    },
  },
];

// 导出事件数量统计
export const threeKingdomsEventCount = threeKingdomsEvents.length;
