/**
 * 章节战斗：start-node 已扣兵符后，生图 → LargeMapBattle（pve_chapter）
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayerContext } from '@/contexts/PlayerContext';
import LargeMapBattle from '@/components/campaign/LargeMapBattle';
import { buildPlayerUnitsFromContext } from '@/utils/battlePlayerBuilder';
import { useSkillsMap } from '@/hooks/useSkillsMap';
import { generateChapterStageMap } from '@shared/utils/chapterStageMapGenerator.js';
import { getMainLineupBattleFoodDeployCost } from '@/utils/mainLineupTroops';
import { resolveKillLossTroopCounts } from '@/systems/battleScoreSystem';

/**
 * @param {{
 *   playerId: string,
 *   chapterId: string,
 *   nodeId: string,
 *   stage: object,
 *   onClose: () => void,
 * }} props
 */
export default function ChapterBattle({ playerId, chapterId, nodeId, stage, onClose }) {
  const { player, cards, attributeBonusBySlot } = usePlayerContext();
  const skillsMap = useSkillsMap();
  const [sim, setSim] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [battleEndOverlay, setBattleEndOverlay] = useState(null);

  useEffect(() => {
    if (!stage) {
      setErrorMessage('缺少关卡数据');
      return;
    }
    try {
      const seedRaw = stage.mapSeed;
      const seed =
        seedRaw != null && String(seedRaw).trim() !== '' && Number.isFinite(Number(seedRaw))
          ? Number(seedRaw)
          : undefined;
      const result = generateChapterStageMap(
        {
          stage_id: stage.stageId,
          stage_name: stage.stageName,
          map_w: stage.mapW,
          map_h: stage.mapH,
          deploy_pattern: stage.deployPattern,
          terrain_brief: stage.terrainBrief,
          terrain_ratios: stage.terrainRatios,
          enemy_roster: stage.enemyRoster,
          ally_roster: stage.allyRoster,
          map_seed: stage.mapSeed,
        },
        { seed },
      );
      setSim(result);
      setErrorMessage('');
    } catch (e) {
      setSim(null);
      setErrorMessage(e?.message || '生图失败');
    }
  }, [stage]);

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
    return (
      <div className="fixed inset-0 z-[240] flex flex-col items-center justify-center gap-4 bg-[#1a1a2e] px-6 text-center">
        <p className="text-red-300 text-sm">编组为空，无法开战</p>
        <button type="button" className="rounded-lg bg-stone-700 px-4 py-2 text-stone-100 text-sm" onClick={onClose}>
          返回
        </button>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="fixed inset-0 z-[240] flex flex-col items-center justify-center gap-4 bg-[#1a1a2e] px-6 text-center">
        <p className="text-red-300 text-sm max-w-md whitespace-pre-wrap">{errorMessage}</p>
        <button type="button" className="rounded-lg bg-stone-700 px-4 py-2 text-stone-100 text-sm" onClick={onClose}>
          返回
        </button>
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="fixed inset-0 z-[240] flex flex-col items-center justify-center gap-2 bg-[#1a1a2e] px-6 text-stone-300">
        <p className="text-sm">生成章节地图…</p>
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
        minRounds={stage.minRounds}
        maxRounds={stage.maxRounds || 30}
        campaignId={null}
        chapterId={chapterId}
        nodeId={nodeId}
        battleType="pve_chapter"
        opponentName={stage.stageName || '章节敌军'}
        campaignMapSim={sim}
        playerDeployRect={sim.deployRects?.player || null}
        campaignPreset={{ campaign_id: stage.stageId }}
        campaignBattleTitle={stage.stageName || '章节战'}
        skillsMap={skillsMap}
        onBattleEnd={handleEnd}
      />
      {battleEndOverlay && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="bg-gray-900/95 rounded-xl p-6 border border-amber-500/30 max-w-sm w-full text-center space-y-3">
            <div className="text-3xl">{battleEndOverlay.victory ? '⚔️' : '💀'}</div>
            <div className="text-xl font-bold text-amber-400">章节结算</div>
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
                {troopCounts.killTroops != null ? (
                  <div className="flex justify-between">
                    <span>击破兵力</span>
                    <span>{troopCounts.killTroops}</span>
                  </div>
                ) : null}
              </div>
            )}
            <button
              type="button"
              className="w-full rounded-lg bg-amber-700 hover:bg-amber-600 px-4 py-2 text-sm text-amber-50"
              onClick={dismissEndOverlay}
            >
              返回节点图
            </button>
          </div>
        </div>
      )}
    </>
  );
}
