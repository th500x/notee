import { daysInMonth, getBirthYearOptions } from '@shared/utils/lifeResumeBirthday.js';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * 年 / 月 / 日三个下拉；日随年、月变化。值为字符串（空=未选）。
 */
export default function BirthDateSelects({
  year,
  month,
  day,
  onChange,
  disabled = false,
  idPrefix = 'birth',
}) {
  const years = getBirthYearOptions();
  const y = year === '' || year == null ? null : Number(year);
  const m = month === '' || month == null ? null : Number(month);
  const maxDay = y && m ? daysInMonth(y, m) : 31;
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const emit = (nextYear, nextMonth, nextDay) => {
    let clampedDay = nextDay;
    const yi = nextYear === '' || nextYear == null ? null : Number(nextYear);
    const mi = nextMonth === '' || nextMonth == null ? null : Number(nextMonth);
    if (yi && mi && clampedDay !== '' && clampedDay != null) {
      const max = daysInMonth(yi, mi);
      if (Number(clampedDay) > max) clampedDay = '';
    }
    onChange({ year: nextYear, month: nextMonth, day: clampedDay });
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`${idPrefix}-year`}>
          年
        </label>
        <select
          id={`${idPrefix}-year`}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50"
          value={year}
          disabled={disabled}
          onChange={(e) => emit(e.target.value, month, day)}
        >
          <option value="">年</option>
          {years.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`${idPrefix}-month`}>
          月
        </label>
        <select
          id={`${idPrefix}-month`}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50"
          value={month}
          disabled={disabled}
          onChange={(e) => emit(year, e.target.value, day)}
        >
          <option value="">月</option>
          {MONTHS.map((opt) => (
            <option key={opt} value={opt}>
              {opt} 月
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor={`${idPrefix}-day`}>
          日
        </label>
        <select
          id={`${idPrefix}-day`}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-50"
          value={day}
          disabled={disabled}
          onChange={(e) => emit(year, month, e.target.value)}
        >
          <option value="">日</option>
          {days.map((opt) => (
            <option key={opt} value={opt}>
              {opt} 日
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
