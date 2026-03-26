/**
 * 21点（Blackjack）游戏逻辑
 * 
 * 规则：
 * - 使用1副牌（52张），每局重新洗牌
 * - 玩家和庄家各发2张，庄家第二张暗牌
 * - A可算1或11，J/Q/K算10
 * - 玩家可选择"要牌"或"停牌"
 * - 超过21点爆牌，直接输
 * - 玩家停牌后庄家按规则补牌（<17必须要，>=17停）
 * - 点数大者赢，相同为平局
 * - 起手21点（A+10点牌）为Blackjack，1.5倍赔率
 * 
 * 三种难度：
 *   easy   - 庄家18点才停牌，玩家有利（胜率~55%）
 *   medium - 标准规则，庄家17点停牌（胜率~45%）
 *   hard   - 庄家偷看牌，16点以下有概率抽到好牌（胜率~35%）
 */

// ========== 花色与牌面 ==========
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// ========== 难度配置 ==========
const DIFFICULTY_CONFIG = {
  easy: {
    label: '赌坊小厮',
    dealerStandAt: 18,   // 庄家18点才停
    luckyDraw: false,
    description: '庄家比较保守，18点才停牌',
  },
  medium: {
    label: '赌坊掌柜',
    dealerStandAt: 17,   // 标准规则
    luckyDraw: false,
    description: '标准规则，庄家17点停牌',
  },
  hard: {
    label: '赌坊黑手',
    dealerStandAt: 17,
    luckyDraw: true,     // 庄家有"手气"加成
    description: '庄家手气极佳，小心应对',
  },
};

// ========== 创建一副牌 ==========
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

// ========== 洗牌（Fisher-Yates） ==========
function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ========== 计算手牌点数 ==========
function calculateHand(cards) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      total += 11;
      aces++;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank);
    }
  }

  // A从11降为1，直到不爆牌
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

// ========== 判断是否Blackjack（起手2张=21） ==========
function isBlackjack(cards) {
  return cards.length === 2 && calculateHand(cards) === 21;
}

// ========== 游戏阶段 ==========
const PHASE = {
  BETTING: 'betting',     // 下注阶段
  PLAYER_TURN: 'player',  // 玩家回合
  DEALER_TURN: 'dealer',  // 庄家回合
  RESULT: 'result',       // 结算
};

// ========== 主类 ==========
export class BlackjackGame {
  /**
   * @param {string} difficulty - easy | medium | hard
   * @param {object} options
   * @param {number} options.totalRounds - 总局数（默认3）
   * @param {number} options.betAmount - 每局下注银两（默认10）
   * @param {number} options.silver - 玩家当前银两（默认100，demo用）
   * @param {string} options.playerName - 玩家角色名（默认"主公"）
   */
  constructor(difficulty = 'medium', options = {}) {
    this.difficulty = difficulty;
    this.config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
    this.totalRounds = options.totalRounds || 3;
    this.betAmount = options.betAmount || 10;
    this.silver = options.silver ?? 100;
    this.playerName = options.playerName || '主公';
    this.roundsPlayed = 0;
    this.roundsWon = 0;
    this.roundsLost = 0;
    this.roundsPushed = 0;
    this.silverDelta = 0;   // 总银两变化
    this._initialSilver = this.silver; // 记录初始银两
    this.matchOver = false; // 3局全部结束
    this.matchResult = null; // 'win' | 'lose' | 'draw'
    this.resetRound();
  }

  /** 重置当局牌面（保留银两和战绩） */
  resetRound() {
    this.deck = shuffle(createDeck());
    this.playerHand = [];
    this.dealerHand = [];
    this.phase = PHASE.PLAYER_TURN; // 跳过下注，自动发牌
    this.result = null;
    this.resultText = '';
    this.bet = this.betAmount;
  }

  /** 开始新一局（自动下注+发牌） */
  startRound() {
    if (this.matchOver) return false;
    this.resetRound();

    // 扣除银两
    this.silver -= this.bet;

    // 发牌
    this.playerHand.push(this._draw());
    this.dealerHand.push(this._draw());
    this.playerHand.push(this._draw());
    this.dealerHand.push(this._draw());

    // 检查Blackjack
    const playerBJ = isBlackjack(this.playerHand);
    const dealerBJ = isBlackjack(this.dealerHand);

    if (playerBJ && dealerBJ) {
      this._settle('push', '双方皆为天牌，平局！');
      return true;
    }
    if (playerBJ) {
      this._settle('blackjack', '天牌二十一点！大获全胜！');
      return true;
    }
    if (dealerBJ) {
      this._settle('lose', '庄家天牌二十一点，庄家胜。');
      return true;
    }

    this.phase = PHASE.PLAYER_TURN;
    return true;
  }

  /** 玩家要牌 */
  hit() {
    if (this.phase !== PHASE.PLAYER_TURN) return false;

    this.playerHand.push(this._draw());
    const total = this.getPlayerTotal();

    if (total > 21) {
      this._settle('lose', `${total}点，爆牌了！庄家胜。`);
    } else if (total === 21) {
      // 自动停牌
      this.stand();
    }

    return true;
  }

  /** 玩家停牌 → 庄家回合 */
  stand() {
    if (this.phase !== PHASE.PLAYER_TURN) return false;
    this.phase = PHASE.DEALER_TURN;
    this._dealerPlay();
    return true;
  }

  /** 庄家按规则补牌 */
  _dealerPlay() {
    const standAt = this.config.dealerStandAt;

    while (calculateHand(this.dealerHand) < standAt) {
      // hard模式：庄家有概率抽到好牌
      if (this.config.luckyDraw && Math.random() < 0.3) {
        this._luckyDraw();
      } else {
        this.dealerHand.push(this._draw());
      }
    }

    const dealerTotal = this.getDealerTotal();
    const playerTotal = this.getPlayerTotal();

    if (dealerTotal > 21) {
      this._settle('win', `庄家${dealerTotal}点爆牌！主公胜！`);
    } else if (playerTotal > dealerTotal) {
      this._settle('win', `主公${playerTotal}点 胜 庄家${dealerTotal}点！`);
    } else if (playerTotal < dealerTotal) {
      this._settle('lose', `庄家${dealerTotal}点 胜 主公${playerTotal}点。`);
    } else {
      this._settle('push', `双方${playerTotal}点，平局！`);
    }
  }

  /** hard模式：庄家"手气好"，从牌堆中找一张不会爆的牌 */
  _luckyDraw() {
    const currentTotal = calculateHand(this.dealerHand);
    const need = 21 - currentTotal;

    // 找一张点数 <= need 的牌
    const idx = this.deck.findIndex(card => {
      const val = card.rank === 'A' ? 1 :
        ['J', 'Q', 'K'].includes(card.rank) ? 10 : parseInt(card.rank);
      return val <= need;
    });

    if (idx >= 0) {
      const card = this.deck.splice(idx, 1)[0];
      this.dealerHand.push(card);
    } else {
      // 找不到就正常抽
      this.dealerHand.push(this._draw());
    }
  }

  /** 结算 */
  _settle(result, text) {
    this.result = result;
    this.resultText = text;
    this.phase = PHASE.RESULT;
    this.roundsPlayed++;

    let roundDelta = 0;
    if (result === 'blackjack') {
      roundDelta = Math.floor(this.bet * 2.5); // 本金+1.5倍
      this.silver += roundDelta;
      this.roundsWon++;
    } else if (result === 'win') {
      roundDelta = this.bet * 2; // 本金+1倍
      this.silver += roundDelta;
      this.roundsWon++;
    } else if (result === 'push') {
      roundDelta = this.bet; // 退还本金
      this.silver += roundDelta;
      this.roundsPushed++;
    } else {
      // lose: 赌注已扣
      this.roundsLost++;
    }
    this.silverDelta = this.silver - (this._initialSilver ?? this.silver);

    // 检查3局是否结束
    if (this.roundsPlayed >= this.totalRounds) {
      this.matchOver = true;
      if (this.roundsWon > this.roundsLost) {
        this.matchResult = 'win';
      } else if (this.roundsWon < this.roundsLost) {
        this.matchResult = 'lose';
      } else {
        this.matchResult = 'draw';
      }
    }
  }

  /** 抽牌 */
  _draw() {
    if (this.deck.length === 0) {
      this.deck = shuffle(createDeck());
    }
    return this.deck.pop();
  }

  // ===== 查询方法 =====

  getPlayerTotal() { return calculateHand(this.playerHand); }
  getDealerTotal() { return calculateHand(this.dealerHand); }

  /** 庄家可见牌（游戏中只显示第一张） */
  getDealerVisibleCards() {
    if (this.phase === PHASE.RESULT || this.phase === PHASE.DEALER_TURN) {
      return this.dealerHand; // 全部可见
    }
    // 只显示第一张，第二张暗牌
    return this.dealerHand.map((card, i) =>
      i === 0 ? card : { suit: '?', rank: '?' }
    );
  }

  getState() {
    return {
      difficulty: this.difficulty,
      config: this.config,
      phase: this.phase,
      playerHand: [...this.playerHand],
      dealerHand: this.getDealerVisibleCards(),
      dealerFullHand: [...this.dealerHand],
      playerTotal: this.getPlayerTotal(),
      dealerTotal: this.getDealerTotal(),
      dealerVisibleTotal: this.phase === PHASE.RESULT || this.phase === PHASE.DEALER_TURN
        ? this.getDealerTotal()
        : this.dealerHand.length > 0
          ? calculateHand([this.dealerHand[0]])
          : 0,
      silver: this.silver,
      bet: this.bet,
      betAmount: this.betAmount,
      result: this.result,
      resultText: this.resultText,
      roundsPlayed: this.roundsPlayed,
      roundsWon: this.roundsWon,
      roundsLost: this.roundsLost,
      roundsPushed: this.roundsPushed,
      totalRounds: this.totalRounds,
      matchOver: this.matchOver,
      matchResult: this.matchResult,
      silverDelta: this.silverDelta,
      playerName: this.playerName,
    };
  }
}

export { DIFFICULTY_CONFIG, SUIT_COLORS, PHASE, calculateHand, isBlackjack };
export default BlackjackGame;
