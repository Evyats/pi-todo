export const TASKS_API = '/todo/api/tasks'
export const SUGGESTIONS_API = '/todo/api/suggestions'
export const RECURRING_API = '/todo/api/recurring-tasks'
export const NOTICES_API = '/todo/api/notices'

export async function request(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || 'Something went wrong')
  }
  return response.status === 204 ? null : response.json()
}

export function jsonOptions(method, body) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
