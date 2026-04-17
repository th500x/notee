/**

 * 势力 Tab — 竖屏三子 Tab + 横屏四象限

 * 「势力信息」象限已接 GET /api/players/:id/faction/overview

 */



import { useMemo, useState, useEffect, useCallback } from 'react';

import { TabPageCloseButton, useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';

import TabSubNav from '@/components/game/TabSubNav';

import QuadrantGrid from '@/components/game/QuadrantGrid';

import { usePlayerContext } from '@/contexts/PlayerContext';

import { playerAPI } from '@/services/playerApi';

import FactionInfoPanel from '@/components/game/faction/FactionInfoPanel';



const SUB_TABS = [

  { id: 'factionInfo', label: '势力信息' },

  { id: 'dynamics', label: '势力动态' },

  { id: 'cities', label: '城市与长官' },

];



const QUADRANT_BULLETIN_ID = 'bulletinSupply';



function shellBlock(body) {

  return (

    <div className="rounded-lg border border-amber-900/30 bg-stone-900/50 p-3 text-stone-400">

      {body}

    </div>

  );

}



export default function FactionTab({ onClose }) {

  const isLandscape = useGameTabLandscape();

  const close = typeof onClose === 'function' ? onClose : () => {};

  const { player } = usePlayerContext();

  const playerId = player?.player_id;

  const [activeSubTabId, setActiveSubTabId] = useState('factionInfo');

  const [overview, setOverview] = useState(null);

  const [overviewLoading, setOverviewLoading] = useState(true);

  const [overviewError, setOverviewError] = useState(null);



  const loadOverview = useCallback(async () => {

    if (!playerId) {

      setOverview(null);

      setOverviewLoading(false);

      return;

    }

    setOverviewLoading(true);

    setOverviewError(null);

    try {

      const res = await playerAPI.getFactionOverview(playerId);

      if (res.success && res.data) {

        setOverview(res.data);

      } else {

        setOverviewError(res.error || '加载失败');

        setOverview(null);

      }

    } catch (e) {

      setOverviewError(e?.message || '加载失败');

      setOverview(null);

    } finally {

      setOverviewLoading(false);

    }

  }, [playerId]);



  /** 进入本 Tab 或切回「势力信息」时拉取，避免后端已更新但页面仍用旧 state */
  useEffect(() => {
    if (!playerId) return;
    if (isLandscape || activeSubTabId === 'factionInfo') {
      loadOverview();
    }
  }, [playerId, isLandscape, activeSubTabId, loadOverview]);



  const portraitCopy = useMemo(

    () => ({

      factionInfo: null,

      dynamics: '战事/建造/公告等动态列表（占位）。',

      cities: '势力城市列表与长官入口（占位）；军团可放二级。',

    }),

    [],

  );



  const factionInfoBody = (

    <FactionInfoPanel overview={overview} loading={overviewLoading} error={overviewError} />

  );



  const quadrantCells = useMemo(

    () => [

      {

        id: 'factionInfo',

        title: '势力信息',

        content: shellBlock(factionInfoBody),

      },

      {

        id: 'dynamics',

        title: '势力动态与外交',

        content: shellBlock(<p className="text-xs leading-relaxed">{portraitCopy.dynamics}</p>),

      },

      {

        id: 'cities',

        title: '城市与长官',

        content: shellBlock(<p className="text-xs leading-relaxed">{portraitCopy.cities}</p>),

      },

      {

        id: QUADRANT_BULLETIN_ID,

        title: '公告 / 军需',

        content: shellBlock(

          <p className="text-xs leading-relaxed">

            势力公告摘要、贡献军需入口等（占位）；与 `factions` / 12-2 对齐后接 API。

          </p>,

        ),

      },

    ],

    [portraitCopy.dynamics, portraitCopy.cities, overview, overviewLoading, overviewError],

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

            {activeSubTabId === 'factionInfo' ? (

              shellBlock(factionInfoBody)

            ) : (

              shellBlock(

                <p className="text-xs leading-relaxed text-stone-300">

                  {portraitCopy[activeSubTabId] ?? portraitCopy.dynamics}

                </p>,

              )

            )}

          </div>

        )}

      </div>

    </div>

  );

}


