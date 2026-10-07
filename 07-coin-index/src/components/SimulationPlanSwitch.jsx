import { SIM_PLAN } from '../utils/simulationTrades'

const PLANS = [
  { id: SIM_PLAN.INDICATOR, label: '指标方案' },
  { id: SIM_PLAN.BADGE, label: '「必」「荐」方案' },
]

export default function SimulationPlanSwitch({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="开仓方案">
      {PLANS.map((plan) => {
        const active = value === plan.id
        return (
          <button
            key={plan.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(plan.id)}
            className={[
              'px-3 py-1.5 rounded-full text-sm border whitespace-nowrap',
              active
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
            ].join(' ')}
          >
            {plan.label}
          </button>
        )
      })}
    </div>
  )
}
