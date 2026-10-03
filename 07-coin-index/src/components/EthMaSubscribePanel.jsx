import { useState } from 'react'
import { ETH_MA_CROSS } from '../constants/ethMaCross'
import { ETH_NOTIFY_PLAN_OPTIONS } from '../constants/ethSubscribe'
import { formatEthPrice, formatSignalTime } from '../utils/ethMaFormat'

function EthMaSubscribePanel({ auth, ma }) {
  const {
    ready: authReady,
    busy: authBusy,
    error: authError,
    accountId,
    login,
    logout,
  } = auth
  const {
    ready: maReady,
    busy: maBusy,
    error: maError,
    pushSupported,
    thisDeviceSubscribed,
    notifyPlan,
    setNotifyPlan,
    latest,
    subscribe,
    unsubscribe,
  } = ma

  const [accountInput, setAccountInput] = useState('')
  const [password, setPassword] = useState('')
  const busy = authBusy || maBusy
  const error = authError || maError
  const lastSignal = latest?.lastSignal || null

  const handleLogin = async (event) => {
    event.preventDefault()
    const ok = await login(accountInput, password)
    if (ok) {
      setPassword('')
    }
  }

  return (
    <div className="eth-ma-subscribe">
      <h3 className="eth-ma-subscribe__title">订阅 ETH</h3>
      <p className="eth-ma-subscribe__meta">
        {ETH_MA_CROSS.SYMBOL} 永续 · {ETH_MA_CROSS.KLINE_INTERVAL} 均线 · 周指标
      </p>
      <p className="eth-ma-subscribe__hint">
        均线：金叉看多 · 死叉看空（已收盘后约数秒到一两分钟）。周指标：每周一采数成功后，按所选方案推送。
      </p>

      {lastSignal && (
        <div className={`eth-ma-subscribe__signal eth-ma-subscribe__signal--${lastSignal.cross}`}>
          最近均线：{lastSignal.kindLabel} · {lastSignal.biasLabel}
          {lastSignal.at ? ` · ${formatSignalTime(lastSignal.at)}` : ''}
          {lastSignal.close != null ? ` · 收盘 ${formatEthPrice(lastSignal.close)}` : ''}
        </div>
      )}

      {!authReady || !maReady ? (
        <p className="eth-ma-subscribe__muted">检查登录与推送状态…</p>
      ) : !accountId ? (
        <form className="eth-ma-subscribe__form" onSubmit={handleLogin}>
          <p className="eth-ma-subscribe__muted">
            使用与「真三风云 / 人生片段」相同的 4 位 ID 登录后授权通知。没有账号请先到
            {' '}
            <a href="/08-life-resume/" className="eth-ma-subscribe__link">人生片段</a>
            {' '}注册。
          </p>
          <label className="eth-ma-subscribe__label" htmlFor="eth-ma-account">
            账号 ID
          </label>
          <input
            id="eth-ma-account"
            className="eth-ma-subscribe__input"
            maxLength={4}
            autoComplete="username"
            value={accountInput}
            onChange={(e) => setAccountInput(e.target.value.toUpperCase())}
          />
          <label className="eth-ma-subscribe__label" htmlFor="eth-ma-password">
            密码
          </label>
          <input
            id="eth-ma-password"
            className="eth-ma-subscribe__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="eth-ma-subscribe__btn" disabled={busy}>
            {busy ? '登录中…' : '登录'}
          </button>
        </form>
      ) : (
        <div className="eth-ma-subscribe__logged">
          <p className="eth-ma-subscribe__muted">
            已登录 {accountId}
            {thisDeviceSubscribed ? ' · 本机已订阅' : ' · 本机未订阅'}
          </p>

          <fieldset className="eth-ma-subscribe__plans">
            <legend className="eth-ma-subscribe__label">通知方案（单选）</legend>
            {ETH_NOTIFY_PLAN_OPTIONS.map((option) => (
              <label key={option.value} className="eth-ma-subscribe__plan">
                <input
                  type="radio"
                  name="eth-notify-plan"
                  value={option.value}
                  checked={notifyPlan === option.value}
                  disabled={busy}
                  onChange={() => setNotifyPlan(option.value)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <span className="eth-ma-subscribe__plan-hint">{option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {!pushSupported && (
            <p className="eth-ma-subscribe__warn">
              当前环境不能推送。请用 HTTPS 下的 Chrome / Edge（生产站点或 localhost）。
            </p>
          )}
          {thisDeviceSubscribed ? (
            <button type="button" className="eth-ma-subscribe__btn eth-ma-subscribe__btn--ghost" disabled={busy} onClick={unsubscribe}>
              {busy ? '处理中…' : '取消订阅'}
            </button>
          ) : (
            <button type="button" className="eth-ma-subscribe__btn" disabled={busy || !pushSupported} onClick={subscribe}>
              {busy ? '订阅中…' : '允许通知并订阅'}
            </button>
          )}
          <button type="button" className="eth-ma-subscribe__link" onClick={logout}>
            退出登录
          </button>
        </div>
      )}

      {error && <p className="eth-ma-subscribe__error">{error}</p>}
    </div>
  )
}

export default EthMaSubscribePanel
