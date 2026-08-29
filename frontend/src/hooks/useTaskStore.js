import { useCallback, useEffect, useState } from 'react'
import { request, TASKS_API } from '../api'

const EMPTY_TASKS = []

export function useTaskStore({ days, today, setError }) {
  const [tasksByDate, setTasksByDate] = useState({})
  const [unassignedTasks, setUnassignedTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const updateTasksForDate = useCallback((targetDate, value) => {
    setTasksByDate((current) => {
      const currentDay = current[targetDate] ?? []
      const nextDay = typeof value === 'function' ? value(currentDay) : value
      return { ...current, [targetDate]: nextDay }
    })
  }, [])

  const updateArea = useCallback((unassigned, targetDate, value) => {
    if (unassigned) {
      setUnassignedTasks((current) => (
        typeof value === 'function' ? value(current) : value
      ))
      return
    }
    updateTasksForDate(targetDate, value)
  }, [updateTasksForDate])

  const prepareToday = useCallback(async () => {
    await request(`${TASKS_API}/prepare-today`, { method: 'POST' })
  }, [])

  const loadUnassigned = useCallback(async () => {
    const loaded = await request(`${TASKS_API}?unassigned=true`)
    setUnassignedTasks(loaded)
    return loaded
  }, [])

  const refreshArea = useCallback(async (unassigned, targetDate) => {
    if (unassigned) return loadUnassigned()
    if (targetDate === today) await prepareToday()
    const loaded = await request(`${TASKS_API}?scheduled_date=${targetDate}`)
    updateTasksForDate(targetDate, loaded)
    return loaded
  }, [loadUnassigned, prepareToday, today, updateTasksForDate])

  useEffect(() => {
    if (days.length === 0) return undefined
    let cancelled = false
    const startDate = days[0].key
    const endDate = days[days.length - 1].key
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => days.some((day) => day.key === today) ? prepareToday() : null)
      .then(() => request(`${TASKS_API}?start_date=${startDate}&end_date=${endDate}`))
      .then((loaded) => {
        if (cancelled) return
        const grouped = Object.fromEntries(days.map((day) => [day.key, []]))
        loaded.forEach((task) => grouped[task.scheduled_date]?.push(task))
        setTasksByDate(grouped)
        setError('')
      })
      .catch((error) => {
        if (!cancelled) setError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [days, prepareToday, setError, today])

  return {
    tasksByDate,
    unassignedTasks,
    loading,
    setLoading,
    tasksForDate: (targetDate) => tasksByDate[targetDate] ?? EMPTY_TASKS,
    updateTasksForDate,
    updateArea,
    loadUnassigned,
    refreshArea,
  }
}
