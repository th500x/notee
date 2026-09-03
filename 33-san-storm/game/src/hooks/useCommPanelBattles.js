/**
 * CommPanel · 战报列表 / 详情 / 纪念图（原 CommPanel.jsx 业务块）。
 */
import { useState, useEffect, useCallback } from 'react';
import { battleAPI } from '@/services/battleApi';
import {
  blobToDataUrl,
  renderBattleMemorialBlob,
} from '@/utils/battleMemorialRender';

export function useCommPanelBattles({
  playerId,
  playerName,
  open,
  activeTab,
  onShowModal,
}) {
  const [battles, setBattles] = useState([]);
  const [battleFilter, setBattleFilter] = useState('all');
  const [battleLoading, setBattleLoading] = useState(false);
  const [expandedBattle, setExpandedBattle] = useState(null);
  const [battleDetail, setBattleDetail] = useState(null);
  const [battleMemorialQuota, setBattleMemorialQuota] = useState({
    dailyLimit: 1,
    usedToday: 0,
    remaining: 1,
  });
  const [creatingMemorialBattleId, setCreatingMemorialBattleId] = useState(null);

  const loadBattles = useCallback(async () => {
    if (!playerId) return;
    setBattleLoading(true);
    try {
      const apiFilter = battleFilter === 'favorited' ? 'favorited' : 'all';
      const res = await battleAPI.getBattles(playerId, apiFilter);
      if (res.success) {
        let list = res.battles || [];
        if (battleFilter === 'win') list = list.filter((b) => b.result === 'win');
        if (battleFilter === 'lose') list = list.filter((b) => b.result === 'lose');
        setBattles(list);
      }
    } catch (err) {
      console.error('[CommPanel] 加载战报失败:', err);
    } finally {
      setBattleLoading(false);
    }
  }, [playerId, battleFilter]);

  const loadBattleMemorialQuota = useCallback(async () => {
    if (!playerId) return;
    const res = await battleAPI.getBattleMemorialQuota(playerId);
    if (res.success) setBattleMemorialQuota(res.data);
  }, [playerId]);

  useEffect(() => {
    if (open && activeTab === 'battle') {
      loadBattles();
      loadBattleMemorialQuota();
    }
  }, [open, activeTab, loadBattles, loadBattleMemorialQuota]);

  const handleExpandBattle = useCallback(
    async (battleId) => {
      if (expandedBattle === battleId) {
        setExpandedBattle(null);
        setBattleDetail(null);
        return;
      }
      setExpandedBattle(battleId);
      const res = await battleAPI.getBattleDetail(battleId);
      if (res.success) setBattleDetail(res.battle);
    },
    [expandedBattle],
  );

  const handleToggleFavorite = useCallback(
    async (battle) => {
      if (!playerId) return;
      if (battle.isFavorited) {
        await battleAPI.unfavoriteBattle(playerId, battle.battleId);
      } else {
        await battleAPI.favoriteBattle(playerId, battle.battleId);
      }
      loadBattles();
    },
    [playerId, loadBattles],
  );

  const handleCreateBattleMemorial = useCallback(
    async (battle, detail) => {
      if (!playerId || !battle?.battleId) return;
      if ((battleMemorialQuota?.remaining ?? 0) <= 0) {
        onShowModal?.({
          open: true,
          title: '提示',
          modalType: 'warning',
          lines: ['今日生成次数1/1，请明日再来'],
        });
        return;
      }
      try {
        setCreatingMemorialBattleId(battle.battleId);
        let finalDetail = detail;
        if (!finalDetail) {
          const r = await battleAPI.getBattleDetail(battle.battleId);
          if (r.success) finalDetail = r.battle;
        }
        const blob = await renderBattleMemorialBlob({
          playerName: playerName || playerId,
          playerId,
          battle,
          detail: finalDetail,
        });
        if (!blob) throw new Error('图片生成失败');
        const imageBase64 = await blobToDataUrl(blob);
        const res = await battleAPI.createBattleMemorial({
          playerId,
          battleId: battle.battleId,
          imageBase64,
        });
        if (!res.success) {
          onShowModal?.({
            open: true,
            title: '生成失败',
            modalType: 'warning',
            lines: [res.error || '生成失败'],
          });
          await loadBattleMemorialQuota();
          return;
        }
        onShowModal?.({
          open: true,
          title: '生成成功',
          modalType: 'reward',
          lines: ['战斗纪念图已生成（今日次数 1/1）'],
        });
        await loadBattleMemorialQuota();
      } catch (error) {
        console.error('[CommPanel] 生成战斗纪念图失败:', error);
        onShowModal?.({
          open: true,
          title: '生成失败',
          modalType: 'warning',
          lines: ['战斗纪念图生成失败，请稍后重试'],
        });
      } finally {
        setCreatingMemorialBattleId(null);
      }
    },
    [playerId, playerName, battleMemorialQuota?.remaining, loadBattleMemorialQuota, onShowModal],
  );

  return {
    battles,
    battleFilter,
    setBattleFilter,
    battleLoading,
    expandedBattle,
    battleDetail,
    battleMemorialQuota,
    creatingMemorialBattleId,
    handleExpandBattle,
    handleToggleFavorite,
    handleCreateBattleMemorial,
  };
}

export default useCommPanelBattles;
