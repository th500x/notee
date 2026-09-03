/**
 * 五子棋游戏逻辑
 * 
 * 15×15 标准棋盘，黑子先手
 * 三种 AI 难度：
 *   easy   - 基础评分 + 30%随机犯错（人类胜率 ~80-90%）
 *   medium - 高级评分 + 威胁组合检测（人类胜率 ~60%）
 *   hard   - minimax + alpha-beta 剪枝，深度4（人类胜率 ~30%）
 */

const BOARD_SIZE = 13;
const EMPTY = 0;
const BLACK = 1; // 玩家
const WHITE = 2; // AI

const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];

// ========== 评分常量 ==========
const SCORE = {
  FIVE:        1000000,  // 连五（必胜）
  LIVE_FOUR:    100000,  // 活四（必胜）
  RUSH_FOUR:     10000,  // 冲四（单头四）
  LIVE_THREE:    10000,  // 活三（一步变活四）
  SLEEP_THREE:    1000,  // 眠三（一步变冲四）
  LIVE_TWO:       500,   // 活二
  SLEEP_TWO:       50,   // 眠二
  LIVE_ONE:        10,   // 活一
  CENTER:           5,   // 中心位置加分
};

export class GobangGame {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
    this.currentPlayer = BLACK;
    this.gameOver = false;
    this.winner = null;   // null | BLACK | WHITE | 0(平局)
    this.lastMove = null;
    this.moveCount = 0;
  }

  /** 玩家落子 */
  playerMove(x, y) {
    if (this.gameOver || this.currentPlayer !== BLACK) return false;
    if (!this._isValid(x, y)) return false;

    this.board[y][x] = BLACK;
    this.lastMove = { x, y, player: BLACK };
    this.moveCount++;

    if (this._checkWin(x, y, BLACK)) {
      this.gameOver = true;
      this.winner = BLACK;
      return true;
    }
    if (this._isFull()) {
      this.gameOver = true;
      this.winner = 0;
      return true;
    }

    this.currentPlayer = WHITE;
    return true;
  }

  /** AI 落子，返回 {x, y} 或 null */
  aiMove() {
    if (this.gameOver || this.currentPlayer !== WHITE) return null;

    let move;
    if (this.difficulty === 'easy') move = this._aiEasy();
    else if (this.difficulty === 'hard') move = this._aiHard();
    else move = this._aiMedium();

    if (!move) return null;

    this.board[move.y][move.x] = WHITE;
    this.lastMove = { x: move.x, y: move.y, player: WHITE };
    this.moveCount++;

    if (this._checkWin(move.x, move.y, WHITE)) {
      this.gameOver = true;
      this.winner = WHITE;
      return move;
    }
    if (this._isFull()) {
      this.gameOver = true;
      this.winner = 0;
      return move;
    }

    this.currentPlayer = BLACK;
    return move;
  }

  /** 重置 */
  reset() {
    this.board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
    this.currentPlayer = BLACK;
    this.gameOver = false;
    this.winner = null;
    this.lastMove = null;
    this.moveCount = 0;
  }

  // ========== 基础工具 ==========

  _isValid(x, y) {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && this.board[y][x] === EMPTY;
  }

  _isFull() {
    for (let y = 0; y < BOARD_SIZE; y++)
      for (let x = 0; x < BOARD_SIZE; x++)
        if (this.board[y][x] === EMPTY) return false;
    return true;
  }

  _checkWin(x, y, player) {
    for (const [dx, dy] of DIRECTIONS) {
      let count = 1;
      for (let i = 1; i < 5; i++) {
        const nx = x + dx * i, ny = y + dy * i;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
        if (this.board[ny][nx] !== player) break;
        count++;
      }
      for (let i = 1; i < 5; i++) {
        const nx = x - dx * i, ny = y - dy * i;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
        if (this.board[ny][nx] !== player) break;
        count++;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  // ========== 改进的评分系统 ==========

  /**
   * 分析某方向上的棋型（精确模式识别）
   * 返回 { count, openEnds } 
   *   count: 连续同色棋子数
   *   openEnds: 两端开放数（0=死棋, 1=眠, 2=活）
   */
  _analyzeLine(x, y, dx, dy, player) {
    let count = 1;
    let openEnds = 0;

    // 正方向扫描
    let blocked = false;
    for (let i = 1; i <= 4; i++) {
      const nx = x + dx * i, ny = y + dy * i;
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) { blocked = true; break; }
      if (this.board[ny][nx] === player) count++;
      else { if (this.board[ny][nx] === EMPTY) openEnds++; blocked = true; break; }
    }
    if (!blocked) openEnds++; // 到达边界前全是同色

    // 反方向扫描
    blocked = false;
    for (let i = 1; i <= 4; i++) {
      const nx = x - dx * i, ny = y - dy * i;
      if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) { blocked = true; break; }
      if (this.board[ny][nx] === player) count++;
      else { if (this.board[ny][nx] === EMPTY) openEnds++; blocked = true; break; }
    }
    if (!blocked) openEnds++;

    return { count, openEnds };
  }

  /**
   * 评估某位置对某玩家的得分（改进版）
   * 基于精确棋型识别
   */
  _evaluatePosition(x, y, player) {
    let score = 0;
    let liveFours = 0, rushFours = 0, liveThrees = 0;

    this.board[y][x] = player;

    for (const [dx, dy] of DIRECTIONS) {
      const { count, openEnds } = this._analyzeLine(x, y, dx, dy, player);

      if (count >= 5) {
        score += SCORE.FIVE;
      } else if (count === 4) {
        if (openEnds === 2) { score += SCORE.LIVE_FOUR; liveFours++; }
        else if (openEnds === 1) { score += SCORE.RUSH_FOUR; rushFours++; }
        // openEnds === 0: 死四，无分
      } else if (count === 3) {
        if (openEnds === 2) { score += SCORE.LIVE_THREE; liveThrees++; }
        else if (openEnds === 1) { score += SCORE.SLEEP_THREE; }
      } else if (count === 2) {
        if (openEnds === 2) score += SCORE.LIVE_TWO;
        else if (openEnds === 1) score += SCORE.SLEEP_TWO;
      } else if (count === 1) {
        if (openEnds === 2) score += SCORE.LIVE_ONE;
      }
    }

    // 组合威胁加分（双三、冲四+活三等）
    if (rushFours >= 2) score += SCORE.LIVE_FOUR; // 双冲四 = 必胜
    if (rushFours >= 1 && liveThrees >= 1) score += SCORE.LIVE_FOUR; // 冲四+活三 = 必胜
    if (liveThrees >= 2) score += SCORE.RUSH_FOUR * 2; // 双活三 = 极强威胁

    // 中心位置微调
    const cx = Math.abs(x - 6), cy = Math.abs(y - 6);
    score += (12 - cx - cy) * SCORE.CENTER;

    this.board[y][x] = EMPTY;
    return score;
  }

  /** 获取有邻居的空位（搜索范围控制） */
  _getCandidates(range = 2) {
    const set = new Set();
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (this.board[y][x] !== EMPTY) {
          for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && this.board[ny][nx] === EMPTY) {
                set.add(ny * BOARD_SIZE + nx);
              }
            }
          }
        }
      }
    }
    if (set.size === 0) return [{ x: 6, y: 6 }];
    return [...set].map(v => ({ x: v % BOARD_SIZE, y: Math.floor(v / BOARD_SIZE) }));
  }

  /**
   * 对候选点按启发式评分排序（用于alpha-beta剪枝优化）
   */
  _sortCandidates(candidates, player) {
    const opponent = player === WHITE ? BLACK : WHITE;
    const scored = candidates.map(p => {
      const attack = this._evaluatePosition(p.x, p.y, player);
      const defend = this._evaluatePosition(p.x, p.y, opponent);
      return { ...p, score: attack + defend * 0.9 };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  // ========== AI 实现 ==========

  /** 简单 AI：随机落子 */
  _aiEasy() {
    const candidates = this._getCandidates(2);
    if (candidates.length === 0) return null;

    // 1. 必胜：自己能连五 → 一定要下
    for (const p of candidates) {
      this.board[p.y][p.x] = WHITE;
      if (this._checkWin(p.x, p.y, WHITE)) { this.board[p.y][p.x] = EMPTY; return p; }
      this.board[p.y][p.x] = EMPTY;
    }

    // 2. 必防：对手能连五 → 一定要堵
    for (const p of candidates) {
      this.board[p.y][p.x] = BLACK;
      if (this._checkWin(p.x, p.y, BLACK)) { this.board[p.y][p.x] = EMPTY; return p; }
      this.board[p.y][p.x] = EMPTY;
    }

    // 3. 30%概率犯错：从候选中随机选一个（不是全棋盘随机）
    if (Math.random() < 0.30) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // 4. 简化评分：只看进攻，不做组合威胁检测
    let best = null, bestScore = -1;
    for (const p of candidates) {
      const attack = this._evaluatePosition(p.x, p.y, WHITE);
      const defend = this._evaluatePosition(p.x, p.y, BLACK) * 0.8;
      const score = attack + defend;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best || candidates[0];
  }

  /**
   * 中等 AI：高级评分 + 威胁组合检测
   * 
   * 能识别：活四、冲四、活三、双三、冲四+活三
   * 不能看到：需要2步以上才能形成的组合
   * 目标人类胜率：~60%
   */
  _aiMedium() {
    const candidates = this._getCandidates(2);

    // 1. 必胜检查：自己能连五
    for (const p of candidates) {
      this.board[p.y][p.x] = WHITE;
      if (this._checkWin(p.x, p.y, WHITE)) { this.board[p.y][p.x] = EMPTY; return p; }
      this.board[p.y][p.x] = EMPTY;
    }

    // 2. 必防检查：对手能连五
    for (const p of candidates) {
      this.board[p.y][p.x] = BLACK;
      if (this._checkWin(p.x, p.y, BLACK)) { this.board[p.y][p.x] = EMPTY; return p; }
      this.board[p.y][p.x] = EMPTY;
    }

    // 3. 检查自己能否形成活四或双冲四（必胜局面）
    for (const p of candidates) {
      const atkScore = this._evaluatePosition(p.x, p.y, WHITE);
      if (atkScore >= SCORE.LIVE_FOUR) return p;
    }

    // 4. 检查对手能否形成活四或双冲四（必须防守）
    for (const p of candidates) {
      const defScore = this._evaluatePosition(p.x, p.y, BLACK);
      if (defScore >= SCORE.LIVE_FOUR) return p;
    }

    // 5. 综合评分选最优
    let best = null, bestScore = -1;
    for (const p of candidates) {
      const attack = this._evaluatePosition(p.x, p.y, WHITE);
      const defend = this._evaluatePosition(p.x, p.y, BLACK) * 1.1; // 略偏防守
      const score = attack + defend;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best || this._aiEasy();
  }

  /**
   * 困难 AI：minimax + alpha-beta 剪枝
   * 
   * 搜索深度4层，能看到2步后的局面
   * 能识别：所有组合威胁 + 多步杀棋
   * 目标人类胜率：~30%
   */
  _aiHard() {
    const candidates = this._getCandidates(2);

    // 快速必胜/必防
    for (const p of candidates) {
      this.board[p.y][p.x] = WHITE;
      if (this._checkWin(p.x, p.y, WHITE)) { this.board[p.y][p.x] = EMPTY; return p; }
      this.board[p.y][p.x] = EMPTY;
    }
    for (const p of candidates) {
      this.board[p.y][p.x] = BLACK;
      if (this._checkWin(p.x, p.y, BLACK)) { this.board[p.y][p.x] = EMPTY; return p; }
      this.board[p.y][p.x] = EMPTY;
    }

    // minimax搜索
    const depth = 4;
    const sorted = this._sortCandidates(candidates, WHITE);
    // 只搜索前15个最有希望的候选点（性能优化）
    const topCandidates = sorted.slice(0, 15);

    let bestMove = topCandidates[0];
    let bestVal = -Infinity;

    for (const p of topCandidates) {
      this.board[p.y][p.x] = WHITE;
      const val = this._minimax(depth - 1, -Infinity, Infinity, false);
      this.board[p.y][p.x] = EMPTY;

      if (val > bestVal) {
        bestVal = val;
        bestMove = p;
      }
    }

    return bestMove || this._aiEasy();
  }

  /**
   * Minimax + Alpha-Beta 剪枝
   * @param {number} depth - 剩余搜索深度
   * @param {number} alpha - alpha值
   * @param {number} beta  - beta值
   * @param {boolean} isMaximizing - 是否为AI（最大化）回合
   */
  _minimax(depth, alpha, beta, isMaximizing) {
    // 终止条件
    if (depth === 0) return this._evaluateBoard();

    const candidates = this._getCandidates(1);
    if (candidates.length === 0) return 0;

    // 排序候选点，取前10个（深层搜索缩小范围）
    const player = isMaximizing ? WHITE : BLACK;
    const sorted = this._sortCandidates(candidates, player);
    const topN = sorted.slice(0, 10);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const p of topN) {
        this.board[p.y][p.x] = WHITE;

        // 检查是否胜利（提前终止）
        if (this._checkWin(p.x, p.y, WHITE)) {
          this.board[p.y][p.x] = EMPTY;
          return SCORE.FIVE * (depth + 1); // 越早赢分越高
        }

        const val = this._minimax(depth - 1, alpha, beta, false);
        this.board[p.y][p.x] = EMPTY;

        maxEval = Math.max(maxEval, val);
        alpha = Math.max(alpha, val);
        if (beta <= alpha) break; // 剪枝
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const p of topN) {
        this.board[p.y][p.x] = BLACK;

        // 检查是否胜利（提前终止）
        if (this._checkWin(p.x, p.y, BLACK)) {
          this.board[p.y][p.x] = EMPTY;
          return -SCORE.FIVE * (depth + 1);
        }

        const val = this._minimax(depth - 1, alpha, beta, true);
        this.board[p.y][p.x] = EMPTY;

        minEval = Math.min(minEval, val);
        beta = Math.min(beta, val);
        if (beta <= alpha) break; // 剪枝
      }
      return minEval;
    }
  }

  /**
   * 全局棋盘评估（用于minimax叶节点）
   * AI(WHITE)得分为正，玩家(BLACK)得分为负
   */
  _evaluateBoard() {
    let score = 0;
    // 扫描所有已落子位置的贡献
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (this.board[y][x] === WHITE) {
          score += this._evaluateStoneThreat(x, y, WHITE);
        } else if (this.board[y][x] === BLACK) {
          score -= this._evaluateStoneThreat(x, y, BLACK);
        }
      }
    }
    return score;
  }

  /**
   * 评估已落子位置在各方向上的威胁值
   */
  _evaluateStoneThreat(x, y, player) {
    let threat = 0;
    for (const [dx, dy] of DIRECTIONS) {
      const { count, openEnds } = this._analyzeLine(x, y, dx, dy, player);
      if (count >= 5) threat += SCORE.FIVE;
      else if (count === 4 && openEnds === 2) threat += SCORE.LIVE_FOUR;
      else if (count === 4 && openEnds === 1) threat += SCORE.RUSH_FOUR;
      else if (count === 3 && openEnds === 2) threat += SCORE.LIVE_THREE;
      else if (count === 3 && openEnds === 1) threat += SCORE.SLEEP_THREE;
      else if (count === 2 && openEnds === 2) threat += SCORE.LIVE_TWO;
      else if (count === 2 && openEnds === 1) threat += SCORE.SLEEP_TWO;
    }
    return threat;
  }
}

export { BOARD_SIZE, EMPTY, BLACK, WHITE };
