/**
 * 势力 Tab — 竖屏四子 Tab + 横屏四象限（同一套分区，仅布局不同）
 * 「势力信息」「军团」→ GET /api/players/:id/faction/overview（军团只读展示，编制在三公府）
 * 「公告」→ GET …/san-gong-fu/bulletin（谕旨/文书/战事）+ 外交占位
 */
import { useMemo, useState, useEffect, useCallback } from 'react';
import { TabPageCloseButton, useGameTabLandscape } from '@/components/game/TabPageCloseAffordance';
import TabSubNav from '@/components/game/TabSubNav';
import QuadrantGrid from '@/components/game/QuadrantGrid';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { playerAPI } from '@/services/playerApi';
import FactionInfoPanel from '@/components/game/faction/FactionInfoPanel';
import FactionBulletinSection from '@/components/game/faction/FactionBulletinSection';
import FactionLegionSection from '@/components/game/faction/FactionLegionSection';

const SUB_TABS = [
  { id: 'factionInfo', label: '势力信息' },
  { id: 'cityOfficials', label: '城市长官' },
  { id: 'legion', label: '军团' },
  { id: 'bulletin', label: '公告' },
];

const QUADRANT_BULLETIN_ID = 'bulletin';



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



  /** 进入本 Tab、横屏、或切至「势力信息 / 军团」时拉取 overview */
  useEffect(() => {
    if (!playerId) return;
    if (isLandscape || activeSubTabId === 'factionInfo' || activeSubTabId === 'legion') {
      loadOverview();
    }
  }, [playerId, isLandscape, activeSubTabId, loadOverview]);

  const portraitCopy = useMemo(
    () => ({
      cityOfficials:
        '本势力各城长官任命与任免入口（占位，规则待实装）。',
    }),
    [],
  );

  const cityOfficialsBody = (
    <p className="text-xs leading-relaxed text-stone-300">{portraitCopy.cityOfficials}</p>
  );

  const legionBody = (
    <FactionLegionSection
      overview={overview}
      loading={overviewLoading}
      error={overviewError}
    />
  );

  const quadrantCells = useMemo(
    () => [
      {
        id: 'factionInfo',
        title: '势力信息',
        content: shellBlock(
          <FactionInfoPanel overview={overview} loading={overviewLoading} error={overviewError} />,
        ),
      },
      {
        id: 'cityOfficials',
        title: '城市长官',
        content: shellBlock(cityOfficialsBody),
      },
      {
        id: 'legion',
        title: '军团',
        content: shellBlock(legionBody),
      },
      {
        id: QUADRANT_BULLETIN_ID,
        title: '公告',
        content: shellBlock(<FactionBulletinSection playerId={playerId} />),
      },
    ],
    [
      cityOfficialsBody,
      legionBody,
      playerId,
      overview,
      overviewLoading,
      overviewError,
    ],
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

              shellBlock(

                <FactionInfoPanel overview={overview} loading={overviewLoading} error={overviewError} />,

              )

            ) : activeSubTabId === 'cityOfficials' ? (
              shellBlock(cityOfficialsBody)
            ) : activeSubTabId === 'legion' ? (
              shellBlock(legionBody)
            ) : activeSubTabId === 'bulletin' ? (
              shellBlock(<FactionBulletinSection playerId={playerId} />)
            ) : null}

          </div>

        )}

      </div>

    </div>

  );

}


