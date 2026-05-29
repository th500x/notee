/**
 * 攻城城防倍率（13-1 §7 · 13-2 §6.4）
 * siegeCityDefenseMult = cityDefense / 100；仅守城方作为 calcDamage 的 def 时传入。
 */

function resolveSiegeCityDefenseMult(cityDefense) {
  const n = Number(cityDefense);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n / 100;
}

/** @param {{ cityDefense?: number, siegeCityDefenseMult?: number }|null|undefined} opts */
function resolveSiegeCityDefenseMultFromOpts(opts) {
  if (!opts || typeof opts !== 'object') return 1;
  if (opts.siegeCityDefenseMult != null) {
    const m = Number(opts.siegeCityDefenseMult);
    if (Number.isFinite(m) && m > 0) return m;
  }
  if (opts.cityDefense != null) return resolveSiegeCityDefenseMult(opts.cityDefense);
  return 1;
}

/** 攻城开战 API 响应：附带 cityDefense / siegeCityDefenseMult */
function attachSiegeCityDefenseToPayload(payload, cityOrDefense) {
  const raw =
    typeof cityOrDefense === 'object' && cityOrDefense != null
      ? (cityOrDefense.defense ?? cityOrDefense.cityDefense)
      : cityOrDefense;
  const n = Number(raw);
  const cityDefense = Number.isFinite(n) && n > 0 ? n : 100;
  return {
    ...payload,
    cityDefense,
    siegeCityDefenseMult: resolveSiegeCityDefenseMult(cityDefense),
  };
}

module.exports = {
  resolveSiegeCityDefenseMult,
  resolveSiegeCityDefenseMultFromOpts,
  attachSiegeCityDefenseToPayload,
};
