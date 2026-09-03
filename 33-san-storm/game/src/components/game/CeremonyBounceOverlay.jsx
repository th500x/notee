/**
 * 全屏居中弹跳仪式浮层（教程官职授予、政策谏言禀报等共用）。
 *
 * @see WorldMap.jsx 官职装配 · FactionPolicyRemonstranceModal 禀报君主
 */

/**
 * @param {{
 *   icon?: string,
 *   title: string,
 *   subtitle?: string|null,
 *   caption?: string|null,
 *   zIndexClass?: string,
 * }} props
 */
export default function CeremonyBounceOverlay({
  icon = '👑',
  title,
  subtitle = null,
  caption = null,
  zIndexClass = 'z-[200]',
}) {
  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/60`}>
      <div className="text-center animate-bounce">
        <div className="text-6xl mb-4">{icon}</div>
        <div className="text-amber-400 text-2xl font-bold mb-2">{title}</div>
        {subtitle ? <div className="text-white text-lg">{subtitle}</div> : null}
        {caption ? <div className="text-amber-300/60 text-sm mt-2">{caption}</div> : null}
      </div>
    </div>
  );
}
