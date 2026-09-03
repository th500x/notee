/**
 * 周历行下方：左订阅、右操作记录（登录后才出现右侧）。
 */

import EthMaSubscribePanel from './EthMaSubscribePanel'
import EthMaTradeLogPanel from './EthMaTradeLogPanel'
import { useEthMaSubscribe } from '../hooks/useEthMaSubscribe'
import { useLifeResumeAuth } from '../hooks/useLifeResumeAuth'

function EthMaWorkbench() {
  const auth = useLifeResumeAuth()
  const ma = useEthMaSubscribe(auth)
  const split = Boolean(auth.accountId)

  return (
    <div className={split ? 'eth-ma-workbench eth-ma-workbench--split' : 'eth-ma-workbench eth-ma-workbench--subscribe-only'}>
      <section className="eth-ma-workbench__pane">
        <EthMaSubscribePanel auth={auth} ma={ma} />
      </section>
      {split ? (
        <section className="eth-ma-workbench__pane eth-ma-workbench__pane--journal">
          <EthMaTradeLogPanel accountId={auth.accountId} />
        </section>
      ) : null}
    </div>
  )
}

export default EthMaWorkbench
