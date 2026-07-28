/**
 * CommPanel · 战报 Tab（原 CommPanel.jsx）
 */
import { useState, useMemo, lazy, Suspense } from 'react';
import { API_CONFIG } from '@/constants';
import { fetchWithTimeout } from '@/services/httpClient';
import AncientModal from '@/components/common/AncientModal';
import PvpAutoDuelReplay from '@/pvp/auto-duel/PvpAutoDuelReplay';
// 战术对决全屏回放壳（重，含 BattleMap/动画）：懒加载，仅点开「战术对决 · 回放」时拉取
const PvpTacticalBattleShell = lazy(() => import('@/pvp/tactical/PvpTacticalBattleShell'));
import { buildBattleScoreFormulaLines, resolveKillLossTroopCounts } from '@/systems/battleScoreSystem';
import { memorialRecordBattleId, resolveMemorialFileUrl } from '@/utils/battleMemorialRender';
import {
  BATTLE_FILTERS,
  COMM_TAB_BODY_CLASS,
  COMM_TAB_SCROLL_CLASS,
  COMM_TAB_TOP_SLOT_CLASS,
  formatRelativeTime,
} from '@/components/comm/commPanelLayout';

/** 战报Tab */
function BattleTab({
  battles,
  filter,
  onFilterChange,
  loading,
  expandedBattle,
  battleDetail,
  onExpand,
  onToggleFavorite,
  memorialQuota,
  creatingMemorialBattleId,
  onCreateMemorial,
  playerId,
}) {
  return (
    <div className={COMM_TAB_BODY_CLASS}>
      <div className={COMM_TAB_TOP_SLOT_CLASS}>
        <div className="flex px-0 py-0 gap-0.5">
          {BATTLE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`flex-1 py-1 text-[10px] rounded transition-colors
                ${filter === f.id
                  ? 'bg-amber-700/40 text-amber-200'
                  : 'text-amber-200/50 hover:text-amber-200/70'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-amber-200/45 px-0.5">
          战斗纪念图：今日 {memorialQuota?.usedToday ?? 0}/{memorialQuota?.dailyLimit ?? 1}
        </div>
      </div>

      <div className={`${COMM_TAB_SCROLL_CLASS} p-1.5 space-y-1`}>
        {loading && <div className="text-center text-amber-200/40 text-xs py-2">加载中...</div>}
        {!loading && battles.length === 0 && (
          <div className="text-center text-amber-200/40 text-xs py-2">暂无战报</div>
        )}
        {battles.map(b => (
          <BattleCard
            key={b.battleId}
            battle={b}
            isExpanded={expandedBattle === b.battleId}
            detail={expandedBattle === b.battleId ? battleDetail : null}
            onExpand={() => onExpand(b.battleId)}
            onToggleFavorite={() => onToggleFavorite(b)}
            memorialQuota={memorialQuota}
            creatingMemorial={creatingMemorialBattleId === b.battleId}
            onCreateMemorial={() => onCreateMemorial(b, expandedBattle === b.battleId ? battleDetail : null)}
            playerId={playerId}
          />
        ))}
      </div>
    </div>
  );
}

/** 单条战报卡片 */
function BattleCard({
  battle,
  isExpanded,
  detail,
  onExpand,
  onToggleFavorite,
  memorialQuota,
  creatingMemorial,
  onCreateMemorial,
  playerId,
}) {
  const isWin = battle.result === 'win';
  const timeStr = formatRelativeTime(battle.battleAt);
  const todayMemorialBattleId = memorialRecordBattleId(memorialQuota?.todayRecord);
  const battleIdStr = battle.battleId != null ? String(battle.battleId).trim() : '';
  const isTodayMemorialBattle =
    Boolean(battleIdStr) && Boolean(todayMemorialBattleId) && todayMemorialBattleId === battleIdStr;
  const todayMemorialUrl = resolveMemorialFileUrl(memorialQuota?.todayRecord?.imageUrl || '');

  const handleDownloadTodayMemorial = async (e) => {
    e.stopPropagation();
    if (!todayMemorialUrl) return;
    const memorialRowId = memorialQuota?.todayRecord?.id;
    try {
      let response;
      if (playerId && memorialRowId) {
        const apiBase = String(API_CONFIG.BASE_URL || '').replace(/\/$/, '');
        const proxyUrl = `${apiBase}/memorial/battle/download?playerId=${encodeURIComponent(playerId)}&id=${encodeURIComponent(String(memorialRowId))}`;
        response = await fetchWithTimeout(proxyUrl, { cache: 'no-store' });
      } else {
        const bustUrl = `${todayMemorialUrl}${todayMemorialUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;
        response = await fetch(bustUrl, { cache: 'no-store' });
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const pathOnly = todayMemorialUrl.split('?')[0];
      const seg = pathOnly.split('/').pop() || '';
      const filename = decodeURIComponent(seg) || `memorial_${battle.battleId || Date.now()}.png`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[BattleCard] 下载纪念图失败:', err);
      try {
        window.open(todayMemorialUrl, '_blank', 'noopener,noreferrer');
      } catch {
        /* ignore */
      }
    }
  };

  // 从 rewards JSON 中提取评分信息
  const rewards = battle.rewards || {};
  const score = rewards.battleScore || 0;
  const grade = rewards.battleGrade || '-';

  const gradeColor = grade === 'S' ? 'text-yellow-400' :
    grade === 'A' ? 'text-green-400' :
    grade === 'B' ? 'text-blue-400' :
    grade === 'C' ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="bg-black/30 rounded border border-amber-700/20 overflow-hidden">
      {/* 摘要行 */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-amber-700/10 transition-colors"
        onClick={onExpand}
      >
        <span className="text-sm">{isWin ? '✅' : '❌'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-amber-100 truncate">
            {battle.opponentName ||
              (battle.battleType === 'pve_campaign'
                ? '战役'
                : battle.battleType === 'pve_bandit'
                  ? '匪寨'
                  : '事件战斗')}
          </div>
          <div className="text-[10px] text-amber-200/50">
            评分：<span className={gradeColor}>{grade}</span> · {score}分
          </div>
          {isTodayMemorialBattle && (
            <div className="text-[10px] text-emerald-300/90 mt-0.5">
              🖼️ 今日已生成纪念图
              {todayMemorialUrl && (
                <button
                  type="button"
                  onClick={handleDownloadTodayMemorial}
                  className="ml-2 underline text-emerald-200 hover:text-emerald-100"
                >
                  点击下载
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-amber-200/40">{timeStr}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className={`text-sm ${battle.isFavorited ? 'text-yellow-400' : 'text-amber-200/30 hover:text-yellow-400/60'}`}
          >
            {battle.isFavorited ? '⭐' : '☆'}
          </button>
        </div>
      </div>

      {/* 展开详情 */}
      {isExpanded && detail && (
        <BattleDetail detail={detail} />
      )}
      {isExpanded && !detail && (
        <div className="px-2 py-2 text-center text-amber-200/40 text-[10px]">加载中...</div>
      )}
      {isExpanded && isTodayMemorialBattle && todayMemorialUrl && (
        <div className="px-2 pb-2">
          <button
            type="button"
            onClick={handleDownloadTodayMemorial}
            className="w-full py-1.5 rounded text-[10px] border border-emerald-600/45 bg-emerald-800/35 text-emerald-100 hover:bg-emerald-700/40 transition-colors"
          >
            🖼️ 下载今日纪念图
          </button>
        </div>
      )}
      {isExpanded && !isTodayMemorialBattle && (
        <div className="px-2 pb-2">
          <button
            type="button"
            disabled={(memorialQuota?.remaining ?? 0) <= 0 || creatingMemorial}
            title={(memorialQuota?.remaining ?? 0) <= 0 ? '今日生成次数1/1，请明日再来' : '将本场战报转为纪念图'}
            onClick={onCreateMemorial}
            className={`w-full py-1.5 rounded text-[10px] border transition-colors ${
              (memorialQuota?.remaining ?? 0) <= 0
                ? 'bg-gray-700/40 border-gray-500/30 text-gray-300/60 cursor-not-allowed'
                : 'bg-emerald-800/35 border-emerald-600/45 text-emerald-100 hover:bg-emerald-700/40'
            }`}
          >
            {creatingMemorial ? '纪念图生成中…' : '🖼️ 转为纪念图'}
          </button>
          {(memorialQuota?.remaining ?? 0) <= 0 && !isTodayMemorialBattle && (
            <div className="text-[10px] text-amber-200/35 mt-1 text-center">今日生成次数1/1，请明日再来</div>
          )}
        </div>
      )}
    </div>
  );
}

/** 战报详情展开区 */
function BattleDetail({ detail }) {
  const [replayOpen, setReplayOpen] = useState(false);
  const [tacticalReplayOpen, setTacticalReplayOpen] = useState(false);
  const rewards = detail.rewards || {};
  // 事件流回放（17-5 §12.6 + 17-5-3 阶段 5）：泛化——凡 rewards.eventReplay.roomId 存在即挂壳
  // （切磋 pvp_tactical_duel + 真实链条 pvp_siege/pvp_defense/pvp_field 同一入口）。
  const tacticalReplayRoomId = rewards.eventReplay?.roomId || null;
  const tacticalReplayTitle =
    detail.battleType === 'pvp_siege' || detail.battleType === 'pvp_defense'
      ? '城防对决'
      : detail.battleType === 'pvp_field' || rewards.roadEncounterId
        ? '道路遭遇'
        : '阵前切磋';
  const logRaw = detail.battleLog;
  const logStr = typeof logRaw === 'string' ? logRaw : Array.isArray(logRaw) ? logRaw.map((l) => (typeof l === 'object' && l?.text ? l.text : String(l))).join('\n') : '';
  /** 简化回放：左=攻方、右=守军（与棋盘「我方格」无关，只看战略攻守身份） */
  const isDefenseReport = detail.battleType === 'pvp_defense';
  const siegeLeftLabel = isDefenseReport
    ? `攻方${detail.opponentName ? ` · ${detail.opponentName}` : ''}`
    : '攻方';
  const siegeRightLabel = isDefenseReport
    ? '守军'
    : `守军${detail.opponentName ? ` · ${detail.opponentName}` : ''}`;
  /** 简化回放须解析「次攻击」协议文；新战报 battle_log 为回合摘要，优先 rewards.autoDuelBattleLog */
  const replayLogStr =
    typeof rewards.autoDuelBattleLog === 'string' && rewards.autoDuelBattleLog.length > 12
      ? rewards.autoDuelBattleLog
      : isDefenseReport
        ? ''
        : logStr;
  const canSiegeReplay =
    replayLogStr.length > 12 &&
    /═══\s*第\s*\d+\s*回合\s*═══/.test(replayLogStr) &&
    /次攻击/.test(replayLogStr) &&
    /\[攻方\]/.test(replayLogStr);

  const usePvpFieldScoreMultiplierLabel =
    detail.battleType === 'pvp_field' || !!rewards.roadEncounterId;
  const scoreMultLineLabel = usePvpFieldScoreMultiplierLabel ? 'PVP积分倍率' : '攻城积分倍率';
  const formulaLines = useMemo(
    () =>
      buildBattleScoreFormulaLines(rewards.scoreDetails, rewards.battleScore, {
        finalMultiplierLabel: scoreMultLineLabel,
      }).lines,
    [rewards.scoreDetails, rewards.battleScore, scoreMultLineLabel],
  );
  const troopCounts = useMemo(
    () => resolveKillLossTroopCounts(rewards.scoreDetails),
    [rewards.scoreDetails],
  );

  return (
    <div className="px-2 py-1.5 border-t border-amber-700/20 space-y-1.5">
      {tacticalReplayRoomId && (
        <>
          <button
            type="button"
            onClick={() => setTacticalReplayOpen(true)}
            className="w-full py-1.5 rounded bg-amber-800/40 border border-amber-600/40 text-amber-100 text-[10px] hover:bg-amber-700/40"
          >
            战术对决 · 回放
          </button>
          {tacticalReplayOpen && (
            <Suspense fallback={null}>
              <PvpTacticalBattleShell
                roomId={tacticalReplayRoomId}
                title={tacticalReplayTitle}
                onClose={() => setTacticalReplayOpen(false)}
              />
            </Suspense>
          )}
        </>
      )}
      {canSiegeReplay && (
        <>
          <button
            type="button"
            onClick={() => setReplayOpen(true)}
            className="w-full py-1.5 rounded bg-amber-800/40 border border-amber-600/40 text-amber-100 text-[10px] hover:bg-amber-700/40"
          >
            攻城战报 · 简化回放
          </button>
          {replayOpen && (
            <AncientModal
              isOpen
              onClose={() => setReplayOpen(false)}
              type="confirm"
              title="攻城战报 · 简化回放"
              hideButtons
              width="max-w-md"
            >
              <div className="-mx-2 -my-2 bg-[#1a1a2e] rounded p-2 text-left">
                <PvpAutoDuelReplay
                  open
                  onClose={() => setReplayOpen(false)}
                  battleLog={replayLogStr}
                  leftLabel={siegeLeftLabel}
                  rightLabel={siegeRightLabel}
                  initialAttackerTroops={rewards.initialAttackerTroops}
                  initialDefenderTroops={rewards.initialDefenderTroops}
                />
              </div>
            </AncientModal>
          )}
        </>
      )}
      {/* 评分明细 */}
      {rewards.battleScore != null && (
        <div className="bg-black/20 rounded p-1.5">
          <div className="text-[10px] text-amber-200/60 mb-0.5">战斗评分</div>
          <div className="text-xs text-amber-100">
            {rewards.battleGrade} · {rewards.battleScore}分
          </div>
          {rewards.scoreDetails && (
            <div className="text-[10px] text-amber-200/40 mt-0.5 space-y-0.5">
              <div>
                歼敌 {troopCounts.killTroops != null ? troopCounts.killTroops : '—'} / 战损{' '}
                {troopCounts.lossTroops != null ? troopCounts.lossTroops : '—'}
                <span className="text-amber-200/30">（兵力）</span>
              </div>
              <div>
                +{rewards.scoreDetails.killScore} / {rewards.scoreDetails.lossScore}
                <span className="text-amber-200/30">（评分）</span>
              </div>
              {(rewards.scoreDetails.baseScore != null ||
                (rewards.scoreDetails.killScore != null && rewards.scoreDetails.lossScore != null)) && (
                <div>
                  基础分{' '}
                  {rewards.scoreDetails.baseScore ??
                    rewards.scoreDetails.killScore + rewards.scoreDetails.lossScore}
                  （上两项代数和）
                </div>
              )}
              {rewards.scoreDetails.turnMultiplier != null && rewards.scoreDetails.roundNum != null && (
                <div>
                  回合倍率 ×{rewards.scoreDetails.turnMultiplier}（第{rewards.scoreDetails.roundNum}回合）
                </div>
              )}
              {rewards.scoreDetails.siegeScoreMultiplier != null &&
                Number(rewards.scoreDetails.siegeScoreMultiplier) !== 1 && (
                <div>
                  {scoreMultLineLabel} ×{rewards.scoreDetails.siegeScoreMultiplier}
                </div>
              )}
              {formulaLines.length > 0 && (
                <div className="mt-1 pt-1 border-t border-amber-700/15 space-y-0.5 text-[9px] text-amber-200/35 leading-snug">
                  <div className="text-amber-200/45">完整计分步骤</div>
                  {formulaLines.map((row, i) => (
                    <div key={i}>{row.text}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 双方阵容 */}
      {detail.playerTeam && (
        <div className="bg-black/20 rounded p-1.5">
          <div className="text-[10px] text-amber-200/60 mb-0.5">我方阵容</div>
          <div className="text-[10px] text-amber-100/80">
            {[...new Set(detail.playerTeam.map(t => t.name || t.displayName))].join('、')}
          </div>
        </div>
      )}
      {detail.opponentTeam && (
        <div className="bg-black/20 rounded p-1.5">
          <div className="text-[10px] text-amber-200/60 mb-0.5">敌方阵容</div>
          <div className="text-[10px] text-amber-100/80">
            {[...new Set(detail.opponentTeam.map(t => t.name || t.displayName))].join('、')}
          </div>
        </div>
      )}

      {/* 战斗统计 */}
      <div className="flex gap-2 text-[10px] text-amber-200/50">
        {detail.totalKills != null && <span>击杀：{detail.totalKills}</span>}
        {detail.totalDamageDealt != null && <span>输出：{detail.totalDamageDealt}</span>}
        {detail.totalDamageTaken != null && <span>承受：{detail.totalDamageTaken}</span>}
        {detail.duration != null && <span>回合：{detail.duration}</span>}
      </div>

      {/* 战斗日志 */}
      {detail.battleLog && (
        <BattleLogSection log={detail.battleLog} />
      )}
      {!detail.battleLog && detail.hasLog === false && (
        <div className="text-[10px] text-amber-200/30 text-center">日志已过期</div>
      )}
    </div>
  );
}

/** 战斗日志折叠区 */
function BattleLogSection({ log }) {
  const [showLog, setShowLog] = useState(false);
  const lines = typeof log === 'string' ? log.split('\n') : (Array.isArray(log) ? log : []);

  return (
    <div>
      <button
        onClick={() => setShowLog(!showLog)}
        className="text-[10px] text-amber-400/60 hover:text-amber-400/80"
      >
        {showLog ? '▲ 收起日志' : '▼ 查看战斗日志'}
      </button>
      {showLog && (
        <div className="mt-1 max-h-32 overflow-y-auto bg-black/30 rounded p-1.5 space-y-0.5">
          {lines.map((line, i) => (
            <div key={i} className="text-[10px] text-amber-100/60 leading-tight">
              {typeof line === 'object' ? line.text : line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BattleTab;
