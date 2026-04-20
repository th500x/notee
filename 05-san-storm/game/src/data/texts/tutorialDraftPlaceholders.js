/**
 * 设计稿/文档用占位文案（此前在 tutorial.js 内与硬编码新手链混放；与正式事件配置无关）
 */

// 步骤2：新手事件0 - 装备教学 — event ID 示例 san_1_event_2001
export const event0_equipmentTutorial = {
  title: '装备系统教学',
  description: '占位文本A',
  dialogues: {
    intro: '占位文本B',
    afterEquipPosition: '占位文本C',
    afterEquipTroop: '占位文本D',
    penaltyExplain: '占位文本E',
    complete: '占位文本F',
  },
  hints: {
    equipPosition: '占位文本G',
    equipTroop: '占位文本H',
    penaltyWarning: '占位文本I',
    promotionTip: '占位文本J',
  },
};

export const event1_dialogue = {
  title: '初入乱世',
  description: '占位文本A',
  dialogues: {
    greeting: '占位文本B',
    giveReward: '占位文本C',
    farewell: '占位文本D',
  },
  hints: {
    viewCharacter: '占位文本E',
    equipCharacter: '占位文本F',
  },
};

export const event2_gobang = {
  title: '棋逢对手',
  description: '占位文本A',
  dialogues: {
    intro: '占位文本B',
    onWin: '占位文本C',
    onLose: '占位文本D',
    afterReward: '占位文本E',
  },
  hints: {
    createEquipCard: '占位文本F',
    equipCard: '占位文本G',
  },
};

export const event3_battle = {
  title: '初试锋芒',
  description: '占位文本A',
  dialogues: {
    villagerPlea: '占位文本B',
    afterVictory: '占位文本C',
    afterDefeat: '占位文本D',
  },
  battleHints: {
    selectUnit: '占位文本E',
    moveUnit: '占位文本F',
    attackEnemy: '占位文本G',
    typeAdvantage: '占位文本H',
  },
};

export const enterCity = {
  hints: {
    openMap: '占位文本A',
    clickCity: '占位文本B',
    cityIntro: '占位文本C',
  },
  buildings: {
    lordHall: '占位文本D',
    barracks: '占位文本E',
    market: '占位文本F',
    tavern: '占位文本G',
    blacksmith: '占位文本H',
    questBoard: '占位文本I',
  },
};

export const lordPromotion = {
  dialogues: {
    reputationLow: '占位文本A',
    giveReputation: '占位文本B',
    reputationMet: '占位文本C',
    giveBonus: '占位文本D',
    choosePosition: '占位文本E',
    promotionComplete: '占位文本F',
    assignQuest: '占位文本G',
    questDescription: '占位文本H',
  },
};

export const changsheCampaign = {
  title: '长社战役',
  historicalBackground: '占位文本A',
  preBattle: {
    objective: '占位文本B',
    tips: '占位文本C',
  },
  postBattle: {
    victory: '占位文本D',
    defeat: '占位文本E',
  },
};

export const tutorialComplete = {
  title: '占位文本A',
  description: '占位文本B',
  congratulations: '占位文本C',
};

export const battlePassIntro = {
  title: '占位文本A',
  description: '占位文本B',
  freePassInfo: '占位文本C',
  premiumPassInfo: '占位文本D',
};
