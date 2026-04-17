/**
 * 主城 Tab（存卡城市）— UI 壳：竖屏三子 Tab + 横屏四象限
 * 业务数据与 API 后续接入（见 32-1 §1.3.1、32-2 §2.2.1）
 */

import { useMemo, useState } from 'react';
import { TabPageCloseButton, useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';
import TabSubNav from '@/components/game/TabSubNav';
import QuadrantGrid from '@/components/game/QuadrantGrid';

const SUB_TABS = [
  { id: 'overview', label: '概览' },
  { id: 'warehouse', label: '仓库' },
  { id: 'transfer', label: '调动' },
];

const QUADRANT_TASKS_ID = 'tasksNotices';

function shellBlock(body) {
  return (
    <div className="rounded-lg border border-amber-900/30 bg-stone-900/50 p-3 text-stone-400">
      {body}
    </div>
  );
}

export default function MainCityTab({ onClose }) {
  const isLandscape = useGameTabLandscape();
  const close = typeof onClose === 'function' ? onClose : () => {};
  const [activeSubTabId, setActiveSubTabId] = useState('overview');

  const portraitCopy = useMemo(
    () => ({
      overview: '主城城况、存卡城市摘要等（占位）。',
      warehouse: '备用部队卡仓库栅格（占位）；不复用编组军营整表组件。',
      transfer: '与上阵/仓库间调动入口（占位）；规则见 13-2。',
    }),
    [],
  );

  const quadrantCells = useMemo(
    () => [
      {
        id: 'overview',
        title: '概览',
        content: shellBlock(<p className="text-xs leading-relaxed">{portraitCopy.overview}</p>),
      },
      {
        id: 'warehouse',
        title: '仓库',
        content: shellBlock(<p className="text-xs leading-relaxed">{portraitCopy.warehouse}</p>),
      },
      {
        id: 'transfer',
        title: '调动',
        content: shellBlock(<p className="text-xs leading-relaxed">{portraitCopy.transfer}</p>),
      },
      {
        id: QUADRANT_TASKS_ID,
        title: '任务 / 提示',
        content: shellBlock(
          <p className="text-xs leading-relaxed">教程红点、冷却摘要等（占位）。</p>,
        ),
      },
    ],
    [portraitCopy],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900">
      {!isLandscape && (
        <TabSubNav
          tabs={SUB_TABS}
          activeTabId={activeSubTabId}
          onTabChange={setActiveSubTabId}
          onClose={close}
        />
      )}

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {isLandscape ? (
          <div className="flex h-full min-h-0 flex-col">
            <TabPageCloseButton onClose={close} variant="corner" />
            <div className="min-h-0 flex-1 overflow-hidden">
              <QuadrantGrid cells={quadrantCells} />
            </div>
          </div>
        ) : (
          <div className="min-h-0 p-3">
            {shellBlock(
              <p className="text-xs leading-relaxed text-stone-300">
                {portraitCopy[activeSubTabId] ?? portraitCopy.overview}
              </p>,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
