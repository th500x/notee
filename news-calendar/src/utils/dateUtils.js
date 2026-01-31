export function formatDate(date) {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
}

export function formatDateKey(date) {
  // 使用本地时间避免时区偏移问题
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isSameDate(date1, date2) {
  return formatDateKey(date1) === formatDateKey(date2)
}