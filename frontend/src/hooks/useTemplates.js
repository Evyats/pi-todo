import { useRemoteCollection } from './useRemoteCollection'

function templateBody(title, estimatedMinutes) {
  const cleanTitle = title.trim()
  if (!cleanTitle) return null
  return {
    title: cleanTitle,
    estimated_minutes: estimatedMinutes === '' ? null : estimatedMinutes,
  }
}

export function useTemplates(endpoint, setError, onCreated, ordered = false) {
  return useRemoteCollection({
    endpoint,
    setError,
    sortItems: ordered
      ? (items) => items
      : (items) => [...items].sort((first, second) => first.title.localeCompare(second.title)),
    createBody: templateBody,
    updateBody: templateBody,
    orderBody: ordered
      ? (items) => ({ recurring_task_ids: items.map((item) => item.id) })
      : null,
    onCreated,
  })
}
