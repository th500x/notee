/**
 * EventGobang - 事件系统内嵌五子棋组件
 * 
 * @description 当事件选项为 minigame 类型时，在大世界地图上内嵌五子棋
 *              棋局结束后回调 onGameEnd('victory'/'defeat')
 *              UI精简：只有棋盘 + 底部状态文字
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { GobangGame, BOARD_SIZE, EMPTY, BLACK, WHITE } from '@/systems/gobangGame';

const DIFF_LABEL = { easy: '简单', medium: '中等', hard: '困难' };
const STAR_POINTS = [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];

export default function EventGobang({ difficulty = 'medium', onGameEnd }) {
  const [game] = useState(() => new GobangGame(difficulty));
  const [board, setBoard] = useState(game.board);
  const [lastMove, setLastMove] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [thinking, setThinking] = useState(false);
  const baseUrl = import.meta.env.BASE_URL;
  const endedRef = useRef(false);

  // 预加载棋子图片
  useEffect(() => {
    new Image().src = `${baseUrl}assets/san_1_map/tile_3_mini/gobang/black_01.png`;
    new Image().src = `${baseUrl}assets/san_1_map/tile_3_mini/gobang/white_01.png`;
  }, [baseUrl]);

  // 同步状态
  const syncState = useCallback((g) => {
    setBoard(g.board.map(row => [...row]));
    setLastMove(g.lastMove);
    setGameOver(g.gameOver);
    setWinner(g.winner);
    if (g.gameOver && !endedRef.current) {
      endedRef.current = true;
      if (g.winner === 0) {
        // 平局 → 重开
        setTimeout(() => {
          endedRef.current = false;
          g.reset();
          setBoard(g.board.map(row => [...row]));
          setLastMove(null);
          setGameOver(false);
          setWinner(null);
        }, 800);
      } else {
        // 延迟回调，让玩家看到最后一手
        setTimeout(() => {
          onGameEnd(g.winner === BLACK ? 'victory' : 'defeat');
        }, 1200);
      }
    }
  }, [onGameEnd]);

  // 玩家落子
  const handleCellClick = useCallback((x, y) => {
    if (gameOver || thinking || game.currentPlayer !== BLACK) return;
    if (!game.playerMove(x, y)) return;
    syncState(game);
    if (game.gameOver) return;
    setThinking(true);
    setTimeout(() => {
      game.aiMove();
      syncState(game);
      setThinking(false);
    }, 300 + Math.random() * 400);
  }, [game, gameOver, thinking, syncState]);

  const cellSize = 'min(calc((100vw - 48px) / 13), 44px)';

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'transparent', pointerEvents: 'none' }}>
      {/* 棋盘 */}
      <div
        className="relative rounded-lg shadow-xl overflow-hidden border-4 border-amber-900/60"
        style={{ background: '#D2A85C', pointerEvents: 'auto' }}
      >
        {/* 网格线 */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: `calc(${cellSize} * 13)`, height: `calc(${cellSize} * 13)` }}
          viewBox={`0 0 ${BOARD_SIZE * 40} ${BOARD_SIZE * 40}`}
        >
          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <line key={`h${i}`}
              x1={20} y1={20 + i * 40} x2={20 + 12 * 40} y2={20 + i * 40}
              stroke="#5C3A1E" strokeWidth="1" />
          ))}
          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <line key={`v${i}`}
              x1={20 + i * 40} y1={20} x2={20 + i * 40} y2={20 + 12 * 40}
              stroke="#5C3A1E" strokeWidth="1" />
          ))}
          {STAR_POINTS.map(([sx, sy]) => (
            <circle key={`s${sx}_${sy}`}
              cx={20 + sx * 40} cy={20 + sy * 40} r="3.5" fill="#5C3A1E" />
          ))}
        </svg>

        {/* 交互层 */}
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize})`,
            gridTemplateRows: `repeat(${BOARD_SIZE}, ${cellSize})`,
          }}
        >
          {board.map((row, y) =>
            row.map((cell, x) => (
              <div
                key={`${x}_${y}`}
                className={`relative flex items-center justify-center cursor-pointer
                  ${cell === EMPTY && !gameOver && !thinking ? 'hover:bg-amber-600/20' : ''}
                  ${lastMove && lastMove.x === x && lastMove.y === y ? 'ring-2 ring-red-500 ring-inset rounded-sm' : ''}`}
                onClick={() => handleCellClick(x, y)}
              >
                {cell === BLACK && (
                  <img src={`${baseUrl}assets/san_1_map/tile_3_mini/gobang/black_01.png`}
                    alt="黑" className="w-[85%] h-[85%] object-contain drop-shadow-md pointer-events-none" />
                )}
                {cell === WHITE && (
                  <img src={`${baseUrl}assets/san_1_map/tile_3_mini/gobang/white_01.png`}
                    alt="白" className="w-[85%] h-[85%] object-contain drop-shadow-md pointer-events-none" />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 底部状态文字 */}
      <div className="mt-3 px-4 py-2 rounded-lg bg-black/70 backdrop-blur-sm"
        style={{ pointerEvents: 'auto' }}>
        <span className="text-white/90 text-sm">
          第 {game.moveCount} 手 · 难度：{DIFF_LABEL[difficulty] || difficulty}
        </span>
      </div>
    </div>
  );
}
