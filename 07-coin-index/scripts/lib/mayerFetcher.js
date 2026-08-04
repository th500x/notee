/**
 * Mayer Multiple — 复用 btcDailySeries
 */
import { fetchMayerAndFourYear, MA_WINDOW_MAYER, computePriceMaRatioWeek, fetchBtcDailySeries } from './btcDailySeries.js'

export async function fetchMayerMultiple(startDate, endDate) {
  const series = await fetchBtcDailySeries(startDate, endDate, MA_WINDOW_MAYER)
  return { ...computePriceMaRatioWeek(series, startDate, endDate, MA_WINDOW_MAYER), source: series.source }
}

export { fetchMayerAndFourYear }
