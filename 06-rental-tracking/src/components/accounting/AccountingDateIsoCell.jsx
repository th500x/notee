import { useState, useEffect } from 'react';
import {
  formatYmdSlash,
  formatMdSlash,
  sanitizeIsoDateField,
  parseMdTextToIso,
  isIsoInCurrentCalendarMonth,
  isIsoDateString
} from '../../utils/accountingDates';

const baseCls =
  'min-h-[2.25rem] w-full min-w-[4rem] border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100';

/**
 * ISO 日期格：
 * - `ymd`：申报/实际，展示 YYYY/M/D；编辑用原生 date。
 * - `md`：交租，展示 M/D；编辑仅「月/日」文本，年份取自列锚 `anchorMonthKey`（`YYYY-MM`）。
 * - `mdEmptyAsRed`：仅 `md`（交租）时，由父级在「实际」有日期且交租仍为空时传 true，空值「—」用红色。
 */
export function AccountingDateIsoCell({
  valueIso,
  onCommit,
  variant = 'ymd',
  anchorMonthKey,
  emphasizeIfCurrentMonth = false,
  mdEmptyAsRed = false,
  rentNavSlot,
  onGridArrowKeyDown
}) {
  const [editing, setEditing] = useState(false);
  const [draftYmd, setDraftYmd] = useState('');
  const [draftMd, setDraftMd] = useState('');

  const iso = sanitizeIsoDateField(valueIso);
  const isoForMonthAccent =
    editing && variant === 'ymd' ? sanitizeIsoDateField(draftYmd) : iso;
  const monthAccentRed =
    variant === 'ymd' &&
    emphasizeIfCurrentMonth &&
    isIsoInCurrentCalendarMonth(isoForMonthAccent);
  const monthAccentCls = monthAccentRed ? ' text-red-600 font-semibold' : ' text-gray-900';

  const mdEmptyHighlight =
    variant === 'md' && mdEmptyAsRed && !isIsoDateString(iso);
  const mdCls = mdEmptyHighlight ? ' text-red-600 font-bold' : ' text-gray-900';

  useEffect(() => {
    if (!editing) {
      const next = sanitizeIsoDateField(valueIso);
      setDraftYmd(next);
      const md = formatMdSlash(next);
      setDraftMd(md === '—' ? '' : md);
    }
  }, [valueIso, editing]);

  const display = variant === 'ymd' ? formatYmdSlash(iso) : formatMdSlash(iso);

  if (editing && variant === 'ymd') {
    return (
      <input
        type="date"
        className={`${baseCls} bg-white${variant === 'ymd' ? monthAccentCls : mdCls}`}
        value={draftYmd}
        onChange={(e) => setDraftYmd(e.target.value)}
        onBlur={() => {
          onCommit(sanitizeIsoDateField(draftYmd));
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (
            onGridArrowKeyDown &&
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
          ) {
            onGridArrowKeyDown(e);
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          }
        }}
        data-rent-nav={rentNavSlot}
        autoFocus
        title="选择日期；留空可清除"
      />
    );
  }

  if (editing && variant === 'md') {
    return (
      <input
        type="text"
        inputMode="text"
        className={`${baseCls} bg-white text-left font-mono${mdCls}`}
        value={draftMd}
        placeholder="月/日"
        onChange={(e) => setDraftMd(e.target.value)}
        onBlur={() => {
          const parsed = parseMdTextToIso(anchorMonthKey, draftMd);
          if (parsed || !String(draftMd).trim()) {
            onCommit(parsed);
          } else {
            onCommit(iso);
          }
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (
            onGridArrowKeyDown &&
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
          ) {
            onGridArrowKeyDown(e);
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          }
        }}
        data-rent-nav={rentNavSlot}
        autoFocus
        title={`仅填月/日，年份取本列 ${anchorMonthKey || '?'}`}
      />
    );
  }

  return (
    <button
      type="button"
      title={
        variant === 'md'
          ? iso
            ? `ISO：${iso}（点按编辑月/日）`
            : `点按输入月/日（年份：${anchorMonthKey?.slice(0, 4) || '—'}）`
          : iso
            ? `ISO：${iso}`
            : '点击选择日期'
      }
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (
          onGridArrowKeyDown &&
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
        ) {
          onGridArrowKeyDown(e);
        }
      }}
      data-rent-nav={rentNavSlot}
      className={`${baseCls} text-left bg-white hover:bg-gray-50${
        variant === 'ymd' ? monthAccentCls : mdCls
      }`}
    >
      {display}
    </button>
  );
}
