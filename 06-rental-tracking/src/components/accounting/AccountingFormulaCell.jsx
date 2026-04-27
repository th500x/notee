import { useState, useEffect } from 'react';
import { evaluateArithmeticExpression, formatAccountingNumber } from '../../utils/accountingExpression';

/**
 * 可编辑公式格：失焦显示数值；聚焦编辑原始表达式（可含前导 =）。
 */
export function AccountingFormulaCell({
  valueExpr,
  onCommit,
  className = '',
  disabled = false,
  align = 'right'
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(valueExpr ?? ''));

  useEffect(() => {
    if (!editing) {
      setDraft(String(valueExpr ?? ''));
    }
  }, [valueExpr, editing]);

  const displayEval = evaluateArithmeticExpression(valueExpr);
  const displayText = formatAccountingNumber(displayEval);

  const baseCls =
    'min-h-[2.25rem] w-full min-w-[4.5rem] border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100';

  if (editing) {
    return (
      <input
        type="text"
        className={`${baseCls} ${className} ${align === 'right' ? 'text-right font-mono' : 'text-left font-mono'}`}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onCommit(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          }
        }}
        autoFocus
        title="支持算术表达式，如 =6000-5000"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={String(valueExpr || '').trim() ? `公式/原值：${valueExpr}` : '点击输入'}
      onClick={() => !disabled && setEditing(true)}
      className={`${baseCls} ${className} ${align === 'right' ? 'text-right' : 'text-left'} bg-white hover:bg-gray-50 text-gray-900 disabled:opacity-50`}
    >
      {displayText}
    </button>
  );
}
