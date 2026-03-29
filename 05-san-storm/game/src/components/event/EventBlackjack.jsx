/**
 * EventBlackjack - 事件系统内嵌二十一点组件
 * 
 * @description 当事件选项为 minigame 类型且 game=blackjack 时渲染
 *              3局制，按胜局数判定胜负
 *              结束后回调 onGameEnd('victory'/'defeat')
 */

import { useState, useRef, useCallback } from 'react';
import { BlackjackGame, DIFFICULTY_CONFIG, SUIT_COLORS, PHASE } from '@/systems/blackjackGame';
import AncientModal from '@/components/common/AncientModal';

const BET_AMOUNT = 5; // 统一每局5两

// ========== 扑克牌（角标用绝对定位，避免 flex+rotate 在部分 WebView 上错位叠字） ==========
const Card = ({ card, index = 0 }) => {
  const isFaceDown = card.rank === '?';
  const isRed = !isFaceDown && SUIT_COLORS[card.suit] === 'red';
  const cornerCls = `leading-none select-none pointer-events-none ${isRed ? 'text-red-600' : 'text-gray-900'}`;
  return (
    <div className="w-14 h-20 rounded-lg shadow-lg flex-shrink-0 relative overflow-hidden"
      style={{ marginLeft: index > 0 ? -20 : 0, zIndex: index }}>
      {isFaceDown ? (
        <div className="w-14 h-20 rounded-lg border-2 border-amber-700/60 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #8B0000 0%, #B22222 30%, #8B0000 60%, #B22222 100%)' }}>
          <span className="text-amber-400/60 text-xs font-bold">?</span>
        </div>
      ) : (
        <div className="w-14 h-20 rounded-lg border border-gray-300 relative"
          style={{ background: 'linear-gradient(180deg, #FFFFF0 0%, #F5F5DC 100%)' }}>
          <div className={`absolute top-1 left-1 ${cornerCls}`}>
            <div className="text-sm font-bold">{card.rank}</div>
            <div className="text-[10px]">{card.suit}</div>
          </div>
          <div className={`absolute inset-0 flex items-center justify-center text-xl opacity-25 ${isRed ? 'text-red-600' : 'text-gray-900'} pointer-events-none`}>
            {card.suit}
          </div>
        </div>
      )}
    </div>
  );
};

// ========== 手牌区 ==========
const Hand = ({ cards, total, label, showTotal }) => (
  <div className="text-center">
    <div className="flex items-center justify-center gap-2 mb-1">
      <span className="text-amber-300/70 text-xs">{label}</span>
      {showTotal && (
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
          total > 21 ? 'bg-red-900/50 text-red-300' :
          total === 21 ? 'bg-yellow-700/50 text-yellow-300' :
          'bg-amber-900/40 text-amber-200'
        }`}>{total}点</span>
      )}
    </div>
    <div className="flex justify-center items-center min-h-[5.5rem]">
      {cards.length > 0
        ? cards.map((c, i) => <Card key={i} card={c} index={i} />)
        : <div className="w-14 h-20 rounded-lg border-2 border-dashed border-amber-800/30 flex items-center justify-center text-amber-600/30 text-[10px]">等待</div>
      }
    </div>
  </div>
);

// ========== 主组件 ==========
export default function EventBlackjack({ difficulty = 'medium', onGameEnd, playerName = '主公', playerSilver = 100 }) {
  const gameRef = useRef(null);
  if (!gameRef.current) {
    gameRef.current = new BlackjackGame(difficulty, {
      totalRounds: 3,
      betAmount: BET_AMOUNT,
      silver: playerSilver,
      playerName,
    });
  }

  const [state, setState] = useState(() => gameRef.current.getState());
  const [showRoundResult, setShowRoundResult] = useState(false);
  const [started, setStarted] = useState(false);
  const [dealerRevealing, setDealerRevealing] = useState(false);
  const endedRef = useRef(false);

  const refresh = useCallback(() => setState(gameRef.current.getState()), []);

  // 检查是否整场结束，回调事件系统
  const checkMatchEnd = useCallback(() => {
    if (gameRef.current.matchOver && !endedRef.current) {
      endedRef.current = true;
      const result = gameRef.current.matchResult;
      const silverDelta = gameRef.current.silverDelta;
      // 胜利=victory，失败或平局=defeat，附带筹码盈亏
      setTimeout(() => {
        onGameEnd(result === 'win' ? 'victory' : 'defeat', { silverDelta });
      }, 300);
    }
  }, [onGameEnd]);

  const handleStartRound = useCallback(() => {
    setShowRoundResult(false);
    gameRef.current.startRound();
    setStarted(true);
    refresh();
    if (gameRef.current.phase === PHASE.RESULT) {
      setTimeout(() => {
        refresh();
        setTimeout(() => {
          if (gameRef.current.matchOver) {
            checkMatchEnd();
          } else {
            setShowRoundResult(true);
          }
        }, 500);
      }, 800);
    }
  }, [refresh, checkMatchEnd]);

  const handleHit = useCallback(() => {
    gameRef.current.hit();
    refresh();
    if (gameRef.current.phase === PHASE.RESULT) {
      setTimeout(() => {
        if (gameRef.current.matchOver) {
          checkMatchEnd();
        } else {
          setShowRoundResult(true);
        }
      }, 600);
    }
  }, [refresh, checkMatchEnd]);

  const handleStand = useCallback(() => {
    gameRef.current.stand();
    setDealerRevealing(true);
    setTimeout(() => {
      setDealerRevealing(false);
      refresh();
      setTimeout(() => {
        if (gameRef.current.matchOver) {
          checkMatchEnd();
        } else {
          setShowRoundResult(true);
        }
      }, 400);
    }, 800);
  }, [refresh, checkMatchEnd]);

  const isPlayerTurn = state.phase === PHASE.PLAYER_TURN;
  const isResult = state.phase === PHASE.RESULT;

  let roundTitle = '';
  let roundType = 'info';
  if (isResult) {
    if (state.result === 'blackjack') { roundType = 'reward'; roundTitle = '🎉 天牌！'; }
    else if (state.result === 'win') { roundType = 'reward'; roundTitle = '🏆 胜！'; }
    else if (state.result === 'lose') { roundType = 'warning'; roundTitle = '💸 负'; }
    else { roundType = 'info'; roundTitle = '🤝 平局'; }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >

      <div className="w-full max-w-sm px-3 pointer-events-auto">
        {/* 信息栏 */}
        <div className="flex items-center justify-between text-xs mb-2 px-1">
          <span className="text-amber-300/70">💰 银两: <span className="text-amber-200 font-bold">{state.silver}</span></span>
          <span className="text-amber-300/70">每局: <span className="text-yellow-300 font-bold">{BET_AMOUNT}两</span></span>
          <span className="text-amber-300/70">第 {Math.min(state.roundsPlayed + 1, state.totalRounds)}/{state.totalRounds} 局</span>
        </div>

        {/* 战绩 */}
        {started && (
          <div className="text-center text-xs text-amber-400/60 mb-2">
            {state.roundsWon}胜 {state.roundsLost}负 {state.roundsPushed}平
          </div>
        )}

        {/* 牌桌 */}
        <div className="rounded-xl border-2 border-amber-800/30 p-3 space-y-3"
          style={{
            background: 'radial-gradient(ellipse at center, #3d2b1f 0%, #2a1d14 70%, #1a120c 100%)',
            boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.3)',
          }}>
          <Hand
            key={`dealer-${state.roundsPlayed}`}
            cards={state.dealerHand}
            total={isResult ? state.dealerTotal : state.dealerVisibleTotal}
            label={`🏮 ${state.config.label}`}
            showTotal={state.dealerHand.length > 0}
          />
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />
            <span className="text-amber-600/40 text-[10px]">VS</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />
          </div>
          <Hand
            key={`player-${state.roundsPlayed}`}
            cards={state.playerHand}
            total={state.playerTotal}
            label={`🎴 ${state.playerName}`}
            showTotal={state.playerHand.length > 0}
          />
        </div>

        {/* 操作 */}
        <div className="mt-3 text-center">
          {!started && (
            <button onClick={handleStartRound}
              className="px-8 py-2.5 rounded-xl text-sm font-bold bg-amber-700 text-amber-100 shadow-lg hover:bg-amber-600 active:scale-95 transition-all border-2 border-amber-600/50">
              🎲 开始赌局
            </button>
          )}
          {started && isPlayerTurn && (
            <div className="flex justify-center gap-3">
              <button onClick={handleHit}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-stone-700 text-amber-100 shadow-lg hover:bg-stone-600 active:scale-95 transition-all border-2 border-stone-500/50">
                🃏 要牌
              </button>
              <button onClick={handleStand}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-700 text-amber-100 shadow-lg hover:bg-amber-600 active:scale-95 transition-all border-2 border-amber-600/50">
                ✋ 停牌
              </button>
            </div>
          )}
          {dealerRevealing && (
            <span className="text-amber-300/70 text-sm animate-pulse">庄家翻牌中...</span>
          )}
        </div>
      </div>

      {/* 单局结果弹窗 */}
      <AncientModal
        isOpen={showRoundResult && !state.matchOver}
        onClose={() => setShowRoundResult(false)}
        preventClose
        type={roundType} title={roundTitle}
        confirmText="下一局" onConfirm={handleStartRound} showCancel={false}>
        <div className="text-center space-y-2">
          <p>{state.resultText}</p>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <div className="text-xs text-gray-500">{state.playerName}</div>
              <div className={`text-xl font-bold ${state.playerTotal > 21 ? 'text-red-600' : 'text-amber-700'}`}>{state.playerTotal}点</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">{state.config.label}</div>
              <div className={`text-xl font-bold ${state.dealerTotal > 21 ? 'text-red-600' : 'text-red-700'}`}>{state.dealerTotal}点</div>
            </div>
          </div>
          <div className="text-amber-600 text-xs mt-1">
            {state.roundsWon}胜 {state.roundsLost}负 {state.roundsPushed}平（{state.roundsPlayed}/{state.totalRounds}局）
          </div>
        </div>
      </AncientModal>
    </div>
  );
}
