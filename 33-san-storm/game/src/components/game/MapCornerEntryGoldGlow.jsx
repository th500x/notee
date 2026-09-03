/**
 * 角钮未读传书红环脉动层（66×36 入口；脉冲节奏与 31-2 §9.8.1 大中城一致）
 */
export default function MapCornerEntryGoldGlow() {
  return (
    <>
      <span className="map-corner-entry-gold-glow__ring" aria-hidden />
      <span className="map-corner-entry-gold-glow__sheen" aria-hidden />
    </>
  );
}
