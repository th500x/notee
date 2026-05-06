/**
 * 战役 PVE：必须先成功加载服务端 preset，再进入 LargeMapBattle。
 * 战前部署在 16×20 象限丙（叙事稿 deploy:列x行 矩形）；开战后再由现有回合引擎演算。战报带 campaignId。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import LargeMapBattle from '@/components/campaign/LargeMapBattle';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';
import { useSkillsMap } from '@/hooks/useSkillsMap';
import { campaignAPI } from '@/services/campaignApi';
import { generateCampaignMapSimulated } from '@shared/utils/campaignMapGenerator';
import { getRarityHex, getRarityLabelCn } from '@/constants';
import { resolveKillLossTroopCounts } from '@/systems/battleScoreSystem';
import { getMainLineupBattleFoodDeployCost } from '@/utils/mainLineupTroops';
import { shortEquipmentDisplayName } from '@/utils/equipmentDisplayName';

export default function CampaignBattle({
  campaignId,
  campaignName = '战役',
  minRounds = null,
  maxRounds = 30,
  playerId,
  onClose,
}) {
  const { player, cards, attributeBonusBySlot } = usePlayerContext();
  const skillsMap = useSkillsMap();
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [campaignMapSim, setCampaignMapSim] = useState(null);
  /** 与叙事稿 §④ 一致，供象限丙 deploy:列x行 与大地图部署 */
  const [campaignPreset, setCampaignPreset] = useState(null);
  /** 与攻城/事件奖励页一致：汇总战术图宝箱（已随战报入库） */
  const [battleEndOverlay, setBattleEndOverlay] = useState(null);

  useEffect(() => {
    if (!campaignId) {
      setStatus('error');
      setErrorMessage('缺少战役 ID');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');
    (async () => {
      try {
        const res = await campaignAPI.getPreset(campaignId);
        if (cancelled) return;
        if (!res?.success || !res.preset) {
          setErrorMessage(res?.error || '无法加载战役预设地图（请确认后端已注册该 preset）');
          setStatus('error');
          return;
        }
        const sim = generateCampaignMapSimulated(res.preset, { seed: res.preset.seed });
        setCampaignMapSim(sim);
        setCampaignPreset(res.preset);
        setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(e?.message || '加载战役预设失败');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const playerUnits = useMemo(
    () => buildPlayerUnitsFromContext(player, cards, attributeBonusBySlot, skillsMap),
    [player, cards, attributeBonusBySlot, skillsMap],
  );

  const deploymentFoodCost = useMemo(
    () => getMainLineupBattleFoodDeployCost(cards, playerUnits),
    [cards, playerUnits],
  );

  const handleEnd = useCallback((result, _silverSpent, scoreResult, _killedIndices, meta) => {
    const chestRewards = Array.isArray(meta?.chestRewards) ? meta.chestRewards : [];
    setBattleEndOverlay({
      victory: result === 'victory',
      scoreResult: scoreResult || null,
      chestRewards,
    });
  }, []);

  const dismissEndOverlay = useCallback(() => {
    setBattleEndOverlay(null);
    onClose?.();
  }, [onClose]);

  if (playerUnits.length === 0) {
    onClose?.();
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[240] flex flex-col items-center justify-center gap-2 bg-[#1a1a2e] px-6 text-stone-300">
        <p className="text-sm">加载战役地图…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="fixed inset-0 z-[240] flex flex-col items-center justify-center gap-4 bg-[#1a1a2e] px-6 text-center">
        <p className="text-red-300 text-sm max-w-md">{errorMessage}</p>
        <button
          type="button"
          className="rounded-lg bg-stone-700 px-4 py-2 text-stone-100 text-sm"
          onClick={onClose}
        >
          返回
        </button>
      </div>
    );
  }

  const troopCounts = battleEndOverlay?.scoreResult
    ? resolveKillLossTroopCounts(battleEndOverlay.scoreResult.details)
    : { killTroops: null, lossTroops: null };

  return (
    <>
      <LargeMapBattle
        playerUnits={playerUnits}
        cards={cards}
        silverAmount={player?.silver ?? 0}
        playerFood={player?.food ?? 0}
        deploymentFoodCost={deploymentFoodCost}
        playerId={playerId}
        minRounds={minRounds}
        maxRounds={maxRounds}
        campaignId={campaignId}
        opponentName={campaignName}
        campaignMapSim={campaignMapSim}
        campaignPreset={campaignPreset}
        campaignBattleTitle={campaignName}
        skillsMap={skillsMap}
        onBattleEnd={handleEnd}
      />
      {battleEndOverlay && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-gray-900/95 rounded-xl p-6 border border-amber-500/30 max-w-sm w-full text-center space-y-3">
            <div className="text-3xl">{battleEndOverlay.victory ? '⚔️' : '💀'}</div>
            <div className="text-xl font-bold text-amber-400">战役结算</div>
            <div className={battleEndOverlay.victory ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
              {battleEndOverlay.victory ? '胜利' : '失败'}
            </div>
            {battleEndOverlay.scoreResult && (
              <div className="bg-gray-800/80 rounded-lg p-3 text-left text-xs text-stone-300 space-y-1">
                <div className="flex justify-between">
                  <span>评分</span>
                  <span className="font-bold text-amber-200">
                    {battleEndOverlay.scoreResult.grade} · {battleEndOverlay.scoreResult.score} 分
                  </span>
                </div>
                <div>
                  歼敌 {troopCounts.killTroops != null ? troopCounts.killTroops : '—'} / 战损{' '}
                  {troopCounts.lossTroops != null ? troopCounts.lossTroops : '—'}
                  <span className="text-stone-500">（兵力）</span>
                </div>
              </div>
            )}
            {battleEndOverlay.chestRewards.length > 0 && (
              <div className="text-left text-sm border-t border-amber-500/25 pt-2">
                <div className="text-[11px] text-stone-500 mb-1.5">📦 地图内宝箱</div>
                <div className="space-y-1">
                  {battleEndOverlay.chestRewards.map((r, i) => (
                    <div
                      key={`${r.equipmentId || 'chest'}-${i}`}
                      className="font-medium"
                      style={{ color: getRarityHex(r.rarity) }}
                    >
                      {shortEquipmentDisplayName(r.name)}（{getRarityLabelCn(r.rarity)}）
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={dismissEndOverlay}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-700 to-yellow-700 text-amber-100 font-bold text-sm"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </>
  );
}
