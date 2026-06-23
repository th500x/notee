/**
 * Frontend runtime config.
 */

const trimSlash = (value) => String(value || '').replace(/\/$/, '');

export const appConfig = {
  serviceName: 'life-resume',
  /** 11 API；开发环境走 Vite proxy → 3011 */
  lifeResumeApiBase: trimSlash(import.meta.env.VITE_LIFE_RESUME_API_BASE || '/api/life-resume'),
  /** 05 认证 API；开发 Vite proxy → 3005；生产与 05 游戏一致走 /api/san-storm/auth → nginx → 3005 */
  sanStormAuthBase: trimSlash(
    import.meta.env.VITE_SAN_STORM_AUTH_BASE ||
      (import.meta.env.PROD ? '/api/san-storm/auth' : '/api/auth')
  ),
  /** React Router basename（与 vite base 一致） */
  routerBasename: '/11-life-resume',
};
