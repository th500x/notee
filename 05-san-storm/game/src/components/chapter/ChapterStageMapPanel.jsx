/**
 * 章节节点图壳：锁/可打/已通关 · 兵符 · 开剧情/开战 · 章末领奖
 */
import { useCallback, useEffect, useState } from 'react';
import { chapterAPI } from '@/services/chapterApi';
import { usePlayerContext } from '@/contexts/PlayerContext';
import { validateMainLineupBattleGate } from '@/utils/mainLineupTroops';
import ChapterStoryPlayer from '@/components/chapter/ChapterStoryPlayer';
import ChapterBattle from '@/components/chapter/ChapterBattle';
import ChapterNodeGraph from '@/components/chapter/ChapterNodeGraph';

const STATUS_HINT = {
  locked: '灰色=未解锁',
  playable: '红框高亮=可挑战',
  cleared: '绿框=已通关可重玩',
};

/**
 * @param {{
 *   open: boolean,
 *   playerId: string,
 *   onClose: () => void,
 *   onChanged?: () => void|Promise<void>,
 * }} props
 */
export default function ChapterStageMapPanel({ open, playerId, onClose, onChanged }) {
  const { cards, player, refresh: refreshPlayer } = usePlayerContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [center, setCenter] = useState(null);
  const [storySession, setStorySession] = useState(null);
  const [battleSession, setBattleSession] = useState(null);
  const [storyBusy, setStoryBusy] = useState(false);
  const [actionNote, setActionNote] = useState('');

  const reload = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    setError('');
    try {
      const data = await chapterAPI.getCenter(playerId);
      if (!data?.success) {
        setError(data?.error || '加载章节失败');
        setCenter(null);
        return;
      }
      setCenter(data);
    } catch (e) {
      setError(e?.message || '加载章节失败');
      setCenter(null);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  const chapter = center?.chapters?.[0] || null;

  const startNode = useCallback(
    async (node) => {
      if (!playerId || !chapter || !node) return;
      setActionNote('');
      if (node.status === 'locked') {
        setActionNote('前序节点未通关');
        return;
      }
      if (node.nodeType === 'battle') {
        const gate = validateMainLineupBattleGate({
          cards,
          playerUnits: null,
          playerFood: player?.food ?? 0,
        });
        if (!gate.ok) {
          setActionNote(gate.message || '无法开战');
          return;
        }
      }
      try {
        const res = await chapterAPI.startNode(playerId, chapter.chapterId, node.nodeId);
        if (!res?.success) {
          setActionNote(res?.error || '开启失败');
          await refreshPlayer?.({ silent: true });
          await reload();
          return;
        }
        await refreshPlayer?.({ silent: true });
        if (res.nodeType === 'story' && res.story) {
          setStorySession({
            chapterId: chapter.chapterId,
            nodeId: node.nodeId,
            story: res.story,
          });
          return;
        }
        if (res.nodeType === 'battle' && res.stage) {
          setBattleSession({
            chapterId: chapter.chapterId,
            nodeId: node.nodeId,
            stage: res.stage,
          });
          return;
        }
        setActionNote('节点数据异常');
      } catch (e) {
        setActionNote(e?.message || '开启失败');
      }
    },
    [playerId, chapter, cards, player?.food, refreshPlayer, reload],
  );

  const finishStory = useCallback(async () => {
    if (!storySession || !playerId) return;
    setStoryBusy(true);
    try {
      const res = await chapterAPI.completeNode(
        playerId,
        storySession.chapterId,
        storySession.nodeId,
      );
      if (!res?.success) {
        setActionNote(res?.error || '完成剧情失败');
      }
      setStorySession(null);
      await reload();
      await onChanged?.();
    } finally {
      setStoryBusy(false);
    }
  }, [storySession, playerId, reload, onChanged]);

  const claimReward = useCallback(async () => {
    if (!playerId || !chapter?.canClaimReward) return;
    setActionNote('');
    const res = await chapterAPI.claimReward(playerId, chapter.chapterId);
    if (!res?.success) {
      setActionNote(res?.error || '领奖失败');
      return;
    }
    const g = res.granted || {};
    setActionNote(`已领取：银两 ${g.silver || 0} · 粮草 ${g.food || 0}`);
    await refreshPlayer?.({ silent: true });
    await reload();
    await onChanged?.();
  }, [playerId, chapter, refreshPlayer, reload, onChanged]);

  const inStory = !!storySession;
  const inBattle = !!battleSession;
  /** 开战/播剧情后仍挂载本组件（会话态），但节点弹窗须收起 */
  const showNodeShell = open && !inStory && !inBattle;

  if (!open && !inStory && !inBattle) return null;

  return (
    <>
      {showNodeShell ? (
      <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/70 px-3">
        <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-xl border border-amber-800/40 bg-[#16121c] text-stone-100 shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-amber-900/40 bg-[#1c1724]/95 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-amber-200">
                {chapter?.chapterName || '章节战棋'}
              </h2>
              <p className="text-[11px] text-stone-400 mt-0.5">
                兵符 {center?.tacticTokens ?? '—'}
                {chapter?.era ? ` · ${chapter.era}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="rounded border border-stone-600 px-2.5 py-1 text-xs text-stone-300 hover:bg-stone-800"
              onClick={onClose}
            >
              关闭
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            {loading ? <p className="text-sm text-stone-400">加载中…</p> : null}
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {chapter?.description ? (
              <p className="text-xs text-stone-400 leading-relaxed">{chapter.description}</p>
            ) : null}

            <p className="text-[10px] text-stone-500">
              {STATUS_HINT.playable} · {STATUS_HINT.cleared} · {STATUS_HINT.locked}
            </p>

            <ChapterNodeGraph
              nodes={chapter?.nodes || []}
              loading={loading}
              onSelectNode={(node) => void startNode(node)}
            />

            {chapter?.canClaimReward ? (
              <button
                type="button"
                className="w-full rounded-lg bg-emerald-800 hover:bg-emerald-700 px-3 py-2 text-sm text-emerald-50"
                onClick={() => void claimReward()}
              >
                领取章末奖励
              </button>
            ) : null}
            {chapter?.chapterRewardClaimed ? (
              <p className="text-center text-[11px] text-emerald-400/80">章末奖励已领取</p>
            ) : null}

            {actionNote ? (
              <p className="text-center text-[11px] text-amber-200/90 whitespace-pre-wrap">{actionNote}</p>
            ) : null}
          </div>
        </div>
      </div>
      ) : null}

      {storySession ? (
        <ChapterStoryPlayer
          title={storySession.story.title}
          lines={storySession.story.lines}
          busy={storyBusy}
          onDone={finishStory}
        />
      ) : null}

      {battleSession ? (
        <ChapterBattle
          playerId={playerId}
          chapterId={battleSession.chapterId}
          nodeId={battleSession.nodeId}
          stage={battleSession.stage}
          onClose={() => {
            setBattleSession(null);
            void reload();
            void onChanged?.();
          }}
        />
      ) : null}
    </>
  );
}
