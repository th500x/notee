/**
 * 三公府 · 朝政 · 势力政策（11-3 §7）
 *
 * 全屏底抽屉壳与 `SanGongFuFactionWarDrawer` 同源（遮罩 z-[135] / 抽屉 z-[136] / 顶栏资源条 + ✕）。
 * 内容为四类长效政策卡片（粮饷加成 / 城战奖赏 / 招贤纳士 / 内政目标）：
 *   - 当前生效配置（来源「已批准」 / 「默认」）
 *   - 类目 CD 倒计时
 *   - 谏言按钮（限大司马 / 大司空；其它官职置灰）
 *
 * 临时政策（前军/后军/御驾，仅 PVP）属实装段3，在 PVP 宣战 / 战事谏言流程内嵌，不在本抽屉。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { factionPolicyAPI } from '@/services/factionPolicyApi';
import PlayerTopResourceBadges from '@/components/game/PlayerTopResourceBadges';
import FactionPolicyRemonstranceModal from '@/components/game/FactionPolicyRemonstranceModal';
import {
  POLICY_CATEGORY,
  POLICY_CATEGORY_META,
  POLICY_CATEGORY_ORDER,
  POLICY_OUTCOME_LABEL,
} from '@/constants/factionPolicyLabels';

const POLLED_INTERVAL_MS = 1000;

function formatRemainingMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function PolicyCard({
  category,
  policy,
  canPropose,
  proposerNeedLabel,
  onOpenRemonstrance,
  nowTick,
}) {
  const meta = POLICY_CATEGORY_META[category];
  if (!meta || !policy) return null;
  const valueLabel = meta.valueLabel(policy.config?.[meta.valueKey]);
  const isDefault = policy.source !== 'row';
  const eligibleAt = policy.nextEligibleAt
    ? new Date(policy.nextEligibleAt).getTime()
    : null;
  const cooldownMs =
    Number.isFinite(eligibleAt) && eligibleAt > nowTick ? eligibleAt - nowTick : 0;
  const cdText = formatRemainingMs(cooldownMs);
  const cdActive = cooldownMs > 0;

  const buttonDisabled = !canPropose || cdActive;
  let buttonHint = '';
  if (!canPropose) buttonHint = `谏言权限：${proposerNeedLabel}`;
  else if (cdActive) buttonHint = `冷却中（${cdText}）`;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-stone-700/60 bg-stone-800/50 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">{meta.icon}</span>
            <span className="text-[12px] font-semibold text-amber-200/95">{meta.label}</span>
            <span
              className={`shrink-0 rounded border px-1.5 py-[1px] text-[9px] font-medium ${
                isDefault
                  ? 'border-stone-600/70 bg-stone-900/60 text-stone-400'
                  : 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300/95'
              }`}
            >
              {isDefault ? '默认' : '已批准'}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-snug text-stone-500">{meta.summary}</p>
          <p className="mt-1.5 text-[11px] text-stone-300">
            当前：<span className="font-semibold text-amber-100/95">{valueLabel}</span>
          </p>
          {category === POLICY_CATEGORY.SIEGE_REWARD && isDefault ? (
            <p className="mt-0.5 text-[10px] leading-snug text-emerald-400/90">
              战斗结算：按上方默认比例拆分净银两/净粮草（实装后默认生效，无需批准）
            </p>
          ) : null}
          {category === POLICY_CATEGORY.SIEGE_REWARD && !isDefault ? (
            <p className="mt-0.5 text-[10px] leading-snug text-emerald-400/90">
              战斗结算：攻城 / 打大本营等净收益按上方比例拆分（声望、贡献、装备仍 100% 个人）
            </p>
          ) : null}
          {policy.lastOutcome ? (
            <p className="mt-0.5 text-[10px] text-stone-500">
              最近一次：
              <span
                className={
                  policy.lastOutcome === 'approved'
                    ? 'text-emerald-400/90'
                    : 'text-amber-400/90'
                }
              >
                {POLICY_OUTCOME_LABEL[policy.lastOutcome] || policy.lastOutcome}
              </span>
              {policy.lastOutcomeAt ? (
                <span className="ml-1 text-stone-600">
                  · {new Date(policy.lastOutcomeAt).toLocaleString('zh-CN', { hour12: false })}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
          <button
            type="button"
            disabled={buttonDisabled}
            onClick={() => onOpenRemonstrance(category)}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold ${
              buttonDisabled
                ? 'cursor-not-allowed border-stone-600 bg-stone-800/50 text-stone-500'
                : 'border-amber-700/60 bg-amber-950/35 text-amber-100 hover:bg-amber-900/40'
            }`}
          >
            谏言
          </button>
          {buttonHint ? (
            <span className="text-center text-[10px] text-amber-500/90 sm:text-right">{buttonHint}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * @param {{
 *   factionId: string|null,
 *   open: boolean,
 *   onClose: () => void,
 * }} props
 *
 * 提议者 playerId 由后端从 `req.player.sub` 取，前端不再上报；本组件不需要 `playerId` 参数。
 */
export default function SanGongFuFactionPolicyDrawer({ factionId, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null);
  const [openModalCategory, setOpenModalCategory] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!open || !factionId) {
      setPanel(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await factionPolicyAPI.getPanel(factionId);
      if (res && res.success && res.data) {
        setPanel(res.data);
      } else {
        setPanel(null);
        setError((res && res.error) || '政策面板加载失败');
      }
    } catch (e) {
      setPanel(null);
      setError(e?.message || '政策面板加载失败');
    } finally {
      setLoading(false);
    }
  }, [open, factionId]);

  useEffect(() => {
    if (open) load();
    else {
      setPanel(null);
      setError(null);
      setOpenModalCategory(null);
    }
  }, [open, load]);

  // CD 倒计时只在抽屉打开 + 任一类目处于 cooldownActive 时滴答
  const anyCooldown = useMemo(() => {
    if (!panel?.policies) return false;
    return Object.values(panel.policies).some((p) => p && p.cooldownActive);
  }, [panel?.policies]);
  useEffect(() => {
    if (!open || !anyCooldown) return undefined;
    setNowTick(Date.now());
    const iv = setInterval(() => setNowTick(Date.now()), POLLED_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [open, anyCooldown]);

  const canProposeLongTerm = !!panel?.proposer?.canProposeLongTerm;
  const proposerNeedLabel = '大司马 / 大司空';

  const onOpenRemonstrance = useCallback((category) => {
    setOpenModalCategory(category);
  }, []);

  const onPolicySubmitted = useCallback(() => {
    // 提交完成后刷新 panel（取最新 last_outcome / next_eligible_at）
    load();
  }, [load]);

  if (!open) return null;

  const currentCategoryPolicy = openModalCategory
    ? panel?.policies?.[openModalCategory] || null
    : null;

  return (
    <>
      <div
        className="fixed inset-0 z-[135] bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
        aria-hidden
      />

      <div
        className="fixed left-0 right-0 bottom-0 z-[136] flex min-h-0 flex-col overflow-hidden rounded-t-2xl border-t-2 border-amber-700/50 bg-stone-900 isolate top-[4.5rem] sm:top-14"
      >
        <div className="flex min-w-0 flex-shrink-0 items-center justify-between gap-2 border-b border-stone-700 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-bold text-amber-400">📜 势力政策（长效）</span>
            <span className="shrink-0 text-xs text-stone-500">四类常驻政策</span>
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <PlayerTopResourceBadges variant="panel" />
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 px-2 py-1 text-xl text-stone-400 hover:text-white"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-stone-900 p-3">
          <div className="mb-3 rounded-lg border border-amber-900/25 bg-stone-900/40 px-2 py-2">
            <div className="text-xs font-semibold text-amber-500/95">说明</div>
            <p className="mt-1 break-words text-[10px] leading-snug text-stone-400">
              长效政策由 <span className="text-amber-200/90">大司马</span> 或{' '}
              <span className="text-amber-200/90">大司空</span>{' '}
              谏言；AI 君主审批通过后生效，未通过仅记录冷却。临时政策（前军 / 后军 / 御驾）在「势力战事」发起 PVP 宣战时勾选，不在本抽屉。
            </p>
            {panel?.proposer?.currentPositionName ? (
              <p className="mt-1 break-words text-[10px] leading-snug text-stone-500">
                当前角色官职：{panel.proposer.currentPositionName}
                {canProposeLongTerm ? (
                  <span className="ml-1 text-emerald-400/90">· 可谏言</span>
                ) : (
                  <span className="ml-1 text-stone-500">· 无长效政策谏言权</span>
                )}
              </p>
            ) : null}
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-stone-500">加载中…</p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-red-400/90">{error}</p>
          ) : !panel ? (
            <p className="py-6 text-center text-sm text-stone-500">暂无政策数据。</p>
          ) : (
            <ul className="space-y-2">
              {POLICY_CATEGORY_ORDER.map((cat) => (
                <PolicyCard
                  key={cat}
                  category={cat}
                  policy={panel.policies?.[cat] || null}
                  canPropose={canProposeLongTerm}
                  proposerNeedLabel={proposerNeedLabel}
                  onOpenRemonstrance={onOpenRemonstrance}
                  nowTick={nowTick}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {openModalCategory && currentCategoryPolicy && panel ? (
        <FactionPolicyRemonstranceModal
          open={!!openModalCategory}
          onClose={() => setOpenModalCategory(null)}
          factionId={factionId}
          category={openModalCategory}
          currentConfig={currentCategoryPolicy.config}
          lastOutcome={currentCategoryPolicy.lastOutcome}
          cooldownActive={!!currentCategoryPolicy.cooldownActive}
          nextEligibleAt={currentCategoryPolicy.nextEligibleAt}
          approvalPreview={panel.approvalPreview || null}
          recruitMapping={panel.recruitMapping || null}
          factionReserves={panel.factionReserves || null}
          currentApproved={
            openModalCategory === POLICY_CATEGORY.RECRUIT
              ? currentCategoryPolicy.source === 'row' &&
                !!currentCategoryPolicy.config?.enabled
              : currentCategoryPolicy.lastOutcome === 'approved'
          }
          onSubmitted={onPolicySubmitted}
        />
      ) : null}
    </>
  );
}
