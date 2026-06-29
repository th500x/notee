/** 正文编辑常用 emoji 快捷栏（黄脸 / 吃喝 / 植物） */

const EMOJI_GROUPS = [
  {
    label: '表情',
    emojis: ['😀', '😃', '😄', '😁', '😂', '🤣', '😊', '🙂', '😉', '🥰', '😍', '😘', '😎', '🤔', '😅', '😭', '🥳', '🙄', '😴', '🤗', '👍', '👎', '🙏', '❤️'],
  },
  {
    label: '吃喝',
    emojis: ['🍎', '🍊', '🍌', '🍇', '🍓', '🍑', '🍔', '🍟', '🍕', '🍜', '🍣', '🍱', '🍰', '🎂', '☕', '🍵', '🍹', '🍺', '🍻', '🥤', '🥗', '🍳'],
  },
  {
    label: '植物',
    emojis: ['🌸', '🌺', '🌻', '🌹', '🌷', '🌼', '💮', '💐', '🌱', '🌿', '🍀', '🌳', '🌲', '🌴', '🌵', '🍁'],
  },
];

export default function EntryBodyEmojiBar({ disabled = false, onPick }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-2 space-y-1.5">
      {EMOJI_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-slate-400 w-7 shrink-0 select-none">{group.label}</span>
          {group.emojis.map((emoji) => (
            <button
              key={`${group.label}-${emoji}`}
              type="button"
              disabled={disabled}
              className="h-8 w-8 rounded-md text-lg leading-none hover:bg-white hover:shadow-sm disabled:opacity-40 active:scale-95 transition-transform"
              title={`插入 ${emoji}`}
              onClick={() => onPick?.(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
