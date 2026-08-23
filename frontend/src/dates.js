export function dateKey(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function upcomingDays(today) {
  const start = new Date(`${today}T12:00:00`)
  return Array.from({ length: 5 }, (_, offset) => {
    const value = new Date(start)
    value.setDate(start.getDate() + offset)
    return {
      key: dateKey(value),
      weekday: value.toLocaleDateString(undefined, { weekday: 'short' }),
      weekdayIndex: value.getDay(),
      day: value.getDate(),
    }
  })
}

export function calendarWeek(date) {
  const value = new Date(`${date}T12:00:00`)
  const year = value.getFullYear()
  const dayOfYear = Math.floor(
    (Date.UTC(year, value.getMonth(), value.getDate()) - Date.UTC(year, 0, 1)) / 86_400_000,
  )
  return Math.floor((dayOfYear + new Date(year, 0, 1).getDay()) / 7) + 1
}
