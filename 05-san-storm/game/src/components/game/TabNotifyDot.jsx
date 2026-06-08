/**
 * 底栏势力 Tab / 顶栏个人中心等共用的红点角标
 */

export default function TabNotifyDot() {
  return (
    <span
      className="pointer-events-none absolute -right-1 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-amber-950 shadow-[0_0_6px_rgba(239,68,68,0.85)]"
      aria-hidden
    />
  );
}
