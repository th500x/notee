/**
 * 属性随机抽屉
 * 
 * @description 全屏抽屉，复用角色创建的属性方案展示（CharacterCard）
 *              底部固定：重新随机按钮 + 确认按钮 + 批次导航
 */

import { useState, useEffect, useCallback } from 'react';
import CharacterCard from '@shared/components/card/CharacterCard';
import { playerAPI } from '@/services/playerApi';

const RARITY_LABEL = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传奇', core: '核心' };
const RARITY_COLOR = { common: '#d1d5db', rare: '#3b82f6', epic: '#8b5cf6', legendary: '#f97316', core: '#eab308' };

export default function AttrRerollDrawer({ playerId, playerName, skillsMap, onClose, onConfirm }) {
  const baseUrl = import.meta.env.BASE_URL;
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentBatch, setCurrentBatch] = useState(0);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await playerAPI.getRerollStatus(playerId);
      if (res.success) setStatus(res.data);
    } catch (e) { console.error(e); }
  }, [playerId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // 初始化 currentBatch 到最新批次
  useEffect(() => {
    if (status?.batches?.length) {
      setCurrentBatch(status.batches.length);
      if (status.selectedBatch != null) {
        setSelectedBatch(status.selectedBatch);
        setSelectedIndex(status.selectedIndex);
      }
    }
  }, [status]);

  const handleReroll = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await playerAPI.rerollAttributes(playerId);
      if (res.success) {
        setStatus(prev => ({
          ...prev,
          batches: res.data.batches,
          remaining: res.data.remaining,
          silver: res.data.remainingSilver,
        }));
        setCurrentBatch(res.data.batch);
        setSelectedBatch(null);
        setSelectedIndex(null);
      } else {
        setError(res.error || '随机失败');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (batchNum, idx) => {
    setSelectedBatch(batchNum);
    setSelectedIndex(idx);
  };

  const handleConfirm = async () => {
    if (selectedBatch == null || selectedIndex == null) return;
    setConfirming(true);
    try {
      const res = await playerAPI.rerollConfirm(playerId, selectedBatch, selectedIndex);
      if (res.success) {
        onConfirm?.(res.data);
        onClose();
      } else {
        setError(res.error || '确认失败');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setConfirming(false);
    }
  };

  const batches = status?.batches || [];
  const currentOptions = batches[currentBatch - 1]?.options || [];
  const rarity = status?.rarity || 'common';
  const cost = status?.cost || 0;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/95 border-b border-amber-500/30">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎲</span>
          <span className="text-amber-200 font-bold">属性随机</span>
          <span className="text-xs px-2 py-0.5 rounded"
            style={{ background: RARITY_COLOR[rarity] + '33', color: RARITY_COLOR[rarity], border: `1px solid ${RARITY_COLOR[rarity]}55` }}>
            {RARITY_LABEL[rarity]}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl px-2">✕</button>
      </div>

      {/* 信息栏 */}
      <div className="flex items-center justify-center gap-6 py-2 bg-gray-900/80 text-xs text-gray-300 border-b border-gray-700/50">
        <span>💰 银两: <b className="text-amber-400">{status?.silver ?? '?'}</b></span>
        <span>每次: <b className="text-amber-400">{cost}</b></span>
        <span>今日: <b className="text-amber-400">{status?.remaining ?? '?'}/{status?.dailyLimit ?? 2}</b></span>
      </div>

      {/* 批次导航 */}
      {batches.length > 1 && (
        <div className="flex items-center justify-center gap-4 py-2 bg-gray-900/60">
          <button onClick={() => setCurrentBatch(b => Math.max(1, b - 1))} disabled={currentBatch <= 1}
            className="px-3 py-1 text-xs text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/10 disabled:opacity-30 disabled:cursor-not-allowed">
            ← 上一批
          </button>
          <span className="text-gray-400 text-xs">第 {currentBatch} 批 / 共 {batches.length} 批</span>
          <button onClick={() => setCurrentBatch(b => Math.min(batches.length, b + 1))} disabled={currentBatch >= batches.length}
            className="px-3 py-1 text-xs text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/10 disabled:opacity-30 disabled:cursor-not-allowed">
            下一批 →
          </button>
        </div>
      )}

      {/* 方案展示区 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {currentOptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-4xl mb-4">🎲</span>
            <p className="mb-2">点击下方按钮开始属性随机</p>
            <p className="text-xs text-gray-500">每次生成3个方案（武官/文官/文武各1个）</p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4">
            {currentOptions.map((option, idx) => {
              const isSelected = selectedBatch === currentBatch && selectedIndex === idx;
              const charData = {
                id: `reroll_${currentBatch}_${idx}`,
                name: playerName || '玩家',
                rarity,
                luck: parseFloat(option.attributes?.luck || 0),
                courage: parseFloat(option.attributes?.courage || 0),
                combat: parseFloat(option.attributes?.combat || 0),
                command: parseFloat(option.attributes?.command || 0),
                intelligence: parseFloat(option.attributes?.intelligence || 0),
                politics: parseFloat(option.attributes?.politics || 0),
                charm: parseFloat(option.attributes?.charm || 0),
                skills: [option.skills?.skill_1?.id, option.skills?.skill_2?.id].filter(Boolean),
              };
              return (
                <CharacterCard
                  key={`${currentBatch}_${idx}`}
                  character={charData}
                  skillsMap={skillsMap}
                  showDetails={true}
                  baseUrl={baseUrl}
                  onSelect={() => handleSelect(currentBatch, idx)}
                  isSelected={isSelected}
                  characterType={option.type}
                  totalPoints={option.totalPoints}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-900/50 border border-red-500/30 rounded text-red-300 text-xs text-center">
          {error}
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="px-4 py-3 bg-gray-900/95 border-t border-amber-500/30 flex items-center justify-between gap-3">
        <button onClick={handleReroll}
          disabled={loading || (status?.remaining ?? 0) <= 0 || (status?.silver ?? 0) < cost}
          className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-all
            bg-gradient-to-r from-amber-700 to-yellow-700 text-amber-100
            hover:from-amber-600 hover:to-yellow-600
            disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
          {loading ? '随机中...'
            : (status?.remaining ?? 0) <= 0 ? '今日次数已用完'
            : (status?.silver ?? 0) < cost ? '💰 银两不足'
            : `🎲 随机（${cost}银两）`}
        </button>
        <button onClick={handleConfirm}
          disabled={selectedBatch == null || confirming}
          className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-all
            bg-gradient-to-r from-green-700 to-emerald-700 text-green-100
            hover:from-green-600 hover:to-emerald-600
            disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
          {confirming ? '确认中...' : selectedBatch != null ? '✅ 确认选择' : '请先选择方案'}
        </button>
      </div>
    </div>
  );
}
