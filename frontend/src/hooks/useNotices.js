import { useRemoteCollection } from './useRemoteCollection'

export function remainingNoticeDays(expiresOn, today) {
  const toUtc = (value) => {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.max(
    0,
    Math.round((toUtc(expiresOn) - toUtc(today)) / 86_400_000) + 1,
  )
}

function noticeBody(title, durationDays) {
  const cleanTitle = title.trim()
  return cleanTitle
    ? { title: cleanTitle, duration_days: durationDays }
    : null
}

export function useNotices(endpoint, setError, currentDate) {
  return useRemoteCollection({
    endpoint,
    setError,
    reloadKey: currentDate,
    createBody: noticeBody,
    updateBody: noticeBody,
    orderBody: (items) => ({ notice_ids: items.map((item) => item.id) }),
  })
}
