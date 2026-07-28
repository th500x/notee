/**
 * 章节关卡节点图：方格从左到右 + 箭头（支线可抬到上行）
 * 风格对齐策划红框示意；暂无美术贴图。
 * 可视列数：竖屏约 3、横屏约 5；超出横向滚动。
 */
import { useEffect, useMemo, useState } from 'react';
import {
  chapterNodeShortLabel,
  layoutChapterNodeGraph,
} from '@/utils/chapterNodeGraphLayout';
import './ChapterNodeGraph.css';

export const CHAPTER_NODE_CELL_W = 96;
export const CHAPTER_NODE_CELL_H = 52;
export const CHAPTER_NODE_GAP_X = 48;
export const CHAPTER_NODE_GAP_Y = 36;
export const CHAPTER_NODE_PAD = 20;

/** 竖屏（窄屏）一屏约展示列数 */
export const CHAPTER_NODE_VISIBLE_COLS_PORTRAIT = 3;
/** 横屏（宽屏）一屏约展示列数 */
export const CHAPTER_NODE_VISIBLE_COLS_LANDSCAPE = 5;

/**
 * @param {number} visibleCols
 * @returns {number} 视口像素宽（含内边距）
 */
export function chapterNodeGraphViewportWidth(visibleCols) {
  const n = Math.max(1, Math.floor(Number(visibleCols) || 1));
  return (
    CHAPTER_NODE_PAD * 2 +
    n * CHAPTER_NODE_CELL_W +
    Math.max(0, n - 1) * CHAPTER_NODE_GAP_X
  );
}

function useChapterNodeVisibleCols() {
  const [cols, setCols] = useState(CHAPTER_NODE_VISIBLE_COLS_LANDSCAPE);

  useEffect(() => {
    const mqPortrait = window.matchMedia('(orientation: portrait)');
    const mqNarrow = window.matchMedia('(max-width: 720px)');
    const sync = () => {
      const portraitLike = mqPortrait.matches || mqNarrow.matches;
      setCols(
        portraitLike
          ? CHAPTER_NODE_VISIBLE_COLS_PORTRAIT
          : CHAPTER_NODE_VISIBLE_COLS_LANDSCAPE,
      );
    };
    sync();
    mqPortrait.addEventListener('change', sync);
    mqNarrow.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mqPortrait.removeEventListener('change', sync);
      mqNarrow.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return cols;
}

/**
 * @param {{
 *   nodes: Array<object>,
 *   loading?: boolean,
 *   onSelectNode?: (node: object) => void,
 * }} props
 */
export default function ChapterNodeGraph({ nodes, loading = false, onSelectNode }) {
  const list = Array.isArray(nodes) ? nodes : [];
  const layout = useMemo(() => layoutChapterNodeGraph(list), [list]);
  const visibleCols = useChapterNodeVisibleCols();

  const boardWidth =
    CHAPTER_NODE_PAD * 2 +
    layout.cols * CHAPTER_NODE_CELL_W +
    Math.max(0, layout.cols - 1) * CHAPTER_NODE_GAP_X;
  const height =
    CHAPTER_NODE_PAD * 2 +
    (layout.rows === 1
      ? CHAPTER_NODE_CELL_H
      : CHAPTER_NODE_CELL_H * 2 + CHAPTER_NODE_GAP_Y);

  const viewportCap = chapterNodeGraphViewportWidth(visibleCols);
  const needsScroll = layout.cols > visibleCols;
  const viewportWidth = needsScroll ? viewportCap : Math.min(boardWidth, viewportCap);

  const centerOf = (nodeId) => {
    const p = layout.positions.get(nodeId);
    if (!p) return { x: 0, y: 0 };
    const rowIndex = layout.rows === 1 ? 0 : p.row;
    return {
      x:
        CHAPTER_NODE_PAD +
        p.col * (CHAPTER_NODE_CELL_W + CHAPTER_NODE_GAP_X) +
        CHAPTER_NODE_CELL_W / 2,
      y:
        CHAPTER_NODE_PAD +
        rowIndex * (CHAPTER_NODE_CELL_H + CHAPTER_NODE_GAP_Y) +
        CHAPTER_NODE_CELL_H / 2,
    };
  };

  return (
    <div
      className={`chapter-node-graph-scroll${needsScroll ? ' is-scrollable' : ''}`}
      style={{ width: viewportWidth, maxWidth: '100%' }}
    >
      <div className="chapter-node-graph-board" style={{ width: boardWidth, minHeight: height }}>
        <svg
          className="chapter-node-graph-edges"
          width={boardWidth}
          height={height}
          aria-hidden
        >
          <defs>
            <marker
              id="chapter-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" className="chapter-node-graph-arrowhead" />
            </marker>
          </defs>
          {layout.edges.map((e) => {
            const a = centerOf(e.from);
            const b = centerOf(e.to);
            const x1 = a.x + CHAPTER_NODE_CELL_W / 2 - 4;
            const y1 = a.y;
            const x2 = b.x - CHAPTER_NODE_CELL_W / 2 + 4;
            const y2 = b.y;
            const midX = (x1 + x2) / 2;
            const d =
              Math.abs(y2 - y1) < 2
                ? `M ${x1} ${y1} L ${x2} ${y2}`
                : `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
            return (
              <path
                key={`${e.from}->${e.to}`}
                d={d}
                className={
                  e.branch
                    ? 'chapter-node-graph-edge chapter-node-graph-edge--branch'
                    : 'chapter-node-graph-edge'
                }
                markerEnd="url(#chapter-arrow)"
              />
            );
          })}
        </svg>

        {list.map((node) => {
          const p = layout.positions.get(node.nodeId) || { col: 0, row: 1 };
          const rowIndex = layout.rows === 1 ? 0 : p.row;
          const left = CHAPTER_NODE_PAD + p.col * (CHAPTER_NODE_CELL_W + CHAPTER_NODE_GAP_X);
          const top = CHAPTER_NODE_PAD + rowIndex * (CHAPTER_NODE_CELL_H + CHAPTER_NODE_GAP_Y);
          const locked = node.status === 'locked';
          const statusClass =
            node.status === 'cleared'
              ? 'is-cleared'
              : node.status === 'playable'
                ? 'is-playable'
                : 'is-locked';
          const label = chapterNodeShortLabel(node);
          const typeTag = node.nodeType === 'battle' ? '战' : '剧';

          return (
            <button
              key={node.nodeId}
              type="button"
              disabled={locked || loading}
              title={`${label} · ${node.status}`}
              className={`chapter-node-box ${statusClass}`}
              style={{
                left,
                top,
                width: CHAPTER_NODE_CELL_W,
                height: CHAPTER_NODE_CELL_H,
              }}
              onClick={() => onSelectNode?.(node)}
            >
              <span className="chapter-node-box__type">{typeTag}</span>
              <span className="chapter-node-box__name">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
