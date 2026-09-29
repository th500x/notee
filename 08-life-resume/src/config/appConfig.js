/**
 * Frontend runtime config.
 */

const trimSlash = (value) => String(value || '').replace(/\/$/, '');

export const appConfig = {
  serviceName: 'life-resume',
  /** 开发环境走 Vite proxy → 3000（全站 00 后端） */
  lifeResumeApiBase: trimSlash(import.meta.env.VITE_LIFE_RESUME_API_BASE || '/api/life-resume'),
  /** 人生片段登录走本进程 /api/life-resume/auth；全站管理员口令是另一路 /api/auth */
  lifeResumeAuthBase: trimSlash(
    `${trimSlash(import.meta.env.VITE_LIFE_RESUME_API_BASE || '/api/life-resume')}/auth`
  ),
  /** React Router basename（与 vite base 一致） */
  routerBasename: '/08-life-resume',
};
