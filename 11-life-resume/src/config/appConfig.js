/**
 * Frontend runtime config.
 */

const trimSlash = (value) => String(value || '').replace(/\/$/, '');

export const appConfig = {
  serviceName: 'life-resume',
  /** 11 API；开发环境走 Vite proxy → 3011 */
  lifeResumeApiBase: trimSlash(import.meta.env.VITE_LIFE_RESUME_API_BASE || '/api/life-resume'),
  /** 认证走 11 后端（读同一张 accounts 表）；不再依赖 05 进程 */
  sanStormAuthBase: trimSlash(
    import.meta.env.VITE_SAN_STORM_AUTH_BASE ||
      `${trimSlash(import.meta.env.VITE_LIFE_RESUME_API_BASE || '/api/life-resume')}/auth`
  ),
  /** React Router basename（与 vite base 一致） */
  routerBasename: '/11-life-resume',
};
