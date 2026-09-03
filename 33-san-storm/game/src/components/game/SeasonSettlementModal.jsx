/**
 * 赛季结算选择向导（Phase 2 · 见 19-3 §9.2）
 *
 * 三页：① 自动结算清单（只读）② 装备套装多选（≤ maxEquipmentSets）③ 橙部队多选（≤ 10）。
 * 确认后调用 confirm 封档；成功或命中「已封档」均回调 onConfirmed（由上层转入封档态）。
 *
 * 仅展示与选择，规则上限以后端 preview 返回为准（后端 confirm 会再次权威校验）。
 */
import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { seasonSettlementAPI } from '@/services/seasonSettlementApi';
import { loadSharedData } from '@/services/dataService';

const PANEL = 'rounded-xl border border-amber-700/50 bg-black/90 text-amber-100 shadow-2xl';
const STEP_TITLES = ['自动结算', '选择装备套装', '选择橙色部队'];

function TileButton({ selected, disabled, onClick, title, subtitle }) {
  return (
    <button
      type="button"
      disabled={disabled && !selected}
      onClick={onClick}
      className={[
        'flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors',
        selected
          ? 'border-amber-400 bg-amber-700/40 text-amber-50'
          : 'border-amber-800/50 bg-black/60 text-amber-200 hover:bg-amber-900/30',
        disabled && !selected ? 'cursor-not-allowed opacity-40' : '',
      ].join(' ')}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="shrink-0 text-xs">{selected ? '✅' : '＋'}</span>
      </span>
      {subtitle ? <span className="text-[11px] text-amber-300/80">{subtitle}</span> : null}
    </button>
  );
}

TileButton.propTypes = {
  selected: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  title: PropTypes.string,
  subtitle: PropTypes.string,
};

export default function SeasonSettlementModal({ playerId, onClose, onConfirmed }) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [selectedSets, setSelectedSets] = useState(() => new Set());
  const [selectedTroops, setSelectedTroops] = useState(() => new Set());
  const [troopNameMap, setTroopNameMap] = useState({});
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const res = await seasonSettlementAPI.getPreview(playerId);
      if (!alive) return;
      if (res?.success && res.data) {
        setPreview(res.data);
        setLoadError('');
      } else {
        setLoadError(res?.error || '加载结算预览失败');
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [playerId]);

  useEffect(() => {
    loadSharedData('troops')
      .then((data) => {
        const list = Array.isArray(data?.troops) ? data.troops : [];
        const map = {};
        list.forEach((t) => {
          if (t?.id) map[t.id] = t.name || t.id;
        });
        setTroopNameMap(map);
      })
      .catch(() => {});
  }, []);

  const limits = preview?.limits || { maxEquipmentSets: 0, maxLegendaryTroops: 10 };
  const auto = preview?.autoInherited || {};
  const sets = preview?.selectableEquipmentSets || [];
  const troops = preview?.selectableLegendaryTroops || [];

  const autoSummary = useMemo(() => {
    const badge = auto.seasonBadgeItems || {};
    const badgeEntries = Object.entries(badge);
    return {
      achievements: (auto.achievementInstanceIds || []).length,
      titles: (auto.titleInstanceIds || []).length,
      treasures: (auto.treasureInstanceIds || []).length,
      coreTroops: (auto.coreTroopInstanceIds || []).length,
      badgeEntries,
    };
  }, [auto]);

  function toggleSet(id) {
    setSelectedSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < limits.maxEquipmentSets) next.add(id);
      return next;
    });
  }

  function toggleTroop(id) {
    setSelectedTroops((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < limits.maxLegendaryTroops) next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError('');
    const res = await seasonSettlementAPI.confirm(playerId, {
      equipmentSetInstanceIds: [...selectedSets],
      legendaryTroopInstanceIds: [...selectedTroops],
    });
    setSubmitting(false);
    if (res?.success) {
      onConfirmed?.();
      return;
    }
    // 已封档（幂等/冲突）也视为封档态
    if (res?.code === 'ALREADY_CONFIRMED') {
      onConfirmed?.();
      return;
    }
    setSubmitError(res?.error || '封档失败，请稍后重试');
  }

  const isLast = step === 2;
  const canConfirm = isLast && acknowledged && !submitting;

  return (
    <div className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/70 p-4">
      <div className={`${PANEL} flex max-h-[88vh] w-full max-w-2xl flex-col`}>
        <div className="flex items-center justify-between border-b border-amber-800/50 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-amber-200">赛季结算</h2>
            <p className="text-[11px] text-amber-400/70">
              {preview ? `${preview.fromSeason} → ${preview.toSeason}` : '加载中…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-amber-800/50 px-2 py-1 text-xs text-amber-300 hover:bg-amber-900/30"
          >
            关闭
          </button>
        </div>

        {/* 步骤指示 */}
        <div className="flex gap-2 px-5 pt-3">
          {STEP_TITLES.map((t, i) => (
            <div
              key={t}
              className={`flex-1 rounded-md px-2 py-1 text-center text-[11px] ${
                i === step ? 'bg-amber-700/50 text-amber-50' : 'bg-black/50 text-amber-400/60'
              }`}
            >
              {i + 1}. {t}
            </div>
          ))}
        </div>

        <div className="min-h-[280px] flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-amber-300/70">加载结算内容…</p>
          ) : loadError ? (
            <p className="py-10 text-center text-sm text-red-300">{loadError}</p>
          ) : step === 0 ? (
            <div className="space-y-3 text-sm">
              <p className="text-amber-300/80">
                以下内容将<strong className="text-amber-100">自动继承</strong>到下个赛季，无需选择：
              </p>
              <ul className="grid grid-cols-2 gap-2">
                <li className="rounded-md bg-black/50 px-3 py-2">成就 ×{autoSummary.achievements}</li>
                <li className="rounded-md bg-black/50 px-3 py-2">称号 ×{autoSummary.titles}</li>
                <li className="rounded-md bg-black/50 px-3 py-2">宝物 ×{autoSummary.treasures}</li>
                <li className="rounded-md bg-black/50 px-3 py-2">核心部队 ×{autoSummary.coreTroops}</li>
              </ul>
              <div className="rounded-md bg-black/50 px-3 py-2">
                <p className="mb-1 text-amber-300/80">徽章类道具（占位道具）：</p>
                {autoSummary.badgeEntries.length === 0 ? (
                  <p className="text-amber-400/60">（无）</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {autoSummary.badgeEntries.map(([id, cnt]) => (
                      <li key={id} className="rounded bg-amber-900/40 px-2 py-0.5 text-xs">
                        {id} ×{cnt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="pt-1 text-amber-300/80">
                接下来请选择要保留的<strong className="text-amber-100"> 装备套装（≤ {limits.maxEquipmentSets} 套）</strong>
                与<strong className="text-amber-100"> 橙色部队（≤ {limits.maxLegendaryTroops} 张）</strong>。
              </p>
            </div>
          ) : step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-300/80">
                已选 {selectedSets.size} / {limits.maxEquipmentSets} 套
              </p>
              {sets.length === 0 ? (
                <p className="py-6 text-center text-sm text-amber-400/60">没有可保留的成型装备套装。</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {sets.map((s) => (
                    <TileButton
                      key={s.instanceId}
                      selected={selectedSets.has(s.instanceId)}
                      disabled={selectedSets.size >= limits.maxEquipmentSets}
                      onClick={() => toggleSet(s.instanceId)}
                      title={s.displayName || '未命名套装'}
                      subtitle={`${(s.equipmentInstanceIds || []).length} 件装备`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-300/80">
                已选 {selectedTroops.size} / {limits.maxLegendaryTroops} 张
              </p>
              {troops.length === 0 ? (
                <p className="py-6 text-center text-sm text-amber-400/60">没有可保留的橙色部队。</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {troops.map((t) => (
                    <TileButton
                      key={t.instanceId}
                      selected={selectedTroops.has(t.instanceId)}
                      disabled={selectedTroops.size >= limits.maxLegendaryTroops}
                      onClick={() => toggleTroop(t.instanceId)}
                      title={troopNameMap[t.cardId] || t.cardId}
                      subtitle={t.cardId}
                    />
                  ))}
                </div>
              )}
              <label className="mt-3 flex items-start gap-2 rounded-md border border-red-700/40 bg-red-900/20 px-3 py-2 text-xs text-amber-100">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  我已确认上述选择。<strong className="text-red-300">封档后本赛季将无法继续游戏</strong>，
                  且选择不可更改，直至新赛季开启并领取结算物品。
                </span>
              </label>
              {submitError ? <p className="text-xs text-red-300">{submitError}</p> : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-amber-800/50 px-5 py-3">
          <button
            type="button"
            disabled={step === 0 || submitting}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-md border border-amber-800/50 px-3 py-1.5 text-sm text-amber-300 disabled:opacity-40"
          >
            上一步
          </button>
          {isLast ? (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="rounded-md border border-amber-400 bg-amber-700/70 px-4 py-1.5 text-sm font-medium text-amber-50 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? '封档中…' : '确认封档'}
            </button>
          ) : (
            <button
              type="button"
              disabled={loading || !!loadError}
              onClick={() => setStep((s) => Math.min(2, s + 1))}
              className="rounded-md border border-amber-400 bg-amber-700/70 px-4 py-1.5 text-sm font-medium text-amber-50 hover:bg-amber-600 disabled:opacity-40"
            >
              下一步
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

SeasonSettlementModal.propTypes = {
  playerId: PropTypes.string.isRequired,
  onClose: PropTypes.func,
  onConfirmed: PropTypes.func,
};
