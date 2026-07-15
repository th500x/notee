/**
 * 主城「驻军所」双 Tab 壳：驻地编组 | 军营与仓库（两子页各自逻辑不合并）。
 */

import { useState } from 'react';
import TabSubNav from '@/components/game/TabSubNav';
import GarrisonLineup from '@/components/garrison/GarrisonLineup';
import MainCityBarracksPostPanel from '@/components/garrison/MainCityBarracksPostPanel';

const HUB_TABS = [
  { id: 'garrison', label: '🏰 驻地编组' },
  { id: 'barracks', label: '🏛️ 军营与仓库' },
];

export default function MainCityBarracksHub({
  cityId,
  cityName = '主城',
  onClose,
  onAfterMutation,
}) {
  const [tab, setTab] = useState('garrison');

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900">
      <TabSubNav
        tabs={HUB_TABS}
        activeTabId={tab}
        onTabChange={setTab}
        onClose={onClose}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {tab === 'garrison' ? (
          <GarrisonLineup
            embedded
            cityId={cityId}
            cityName={cityName}
            onClose={onClose}
            onAfterMutation={onAfterMutation}
          />
        ) : (
          <MainCityBarracksPostPanel
            embedded
            cityId={cityId}
            cityName={cityName}
            onClose={onClose}
            onAfterSave={onAfterMutation}
          />
        )}
      </div>
    </div>
  );
}
