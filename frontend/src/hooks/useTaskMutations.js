import { useRef } from 'react'
import { jsonOptions, request, TASKS_API } from '../api'
import { changeTaskParent } from '../taskOrdering'

export function useTaskMutations({
  unassignedOpen,
  selectedDate,
  currentTasks,
  updateArea,
  refreshArea,
  setError,
  composer,
}) {
  const nextOptimisticIdRef = useRef(-1)

  function updateCurrent(value) {
    updateArea(unassignedOpen, selectedDate, value)
  }

  async function addTask(event, suggestion = null) {
    event?.preventDefault()
    const title = (suggestion?.title ?? composer.title).trim()
    if (!title) return
    const targetUnassigned = unassignedOpen
    const targetDate = selectedDate
    const optimisticId = nextOptimisticIdRef.current--
    const optimisticTask = {
      id: optimisticId,
      title,
      completed: false,
      created_at: new Date().toISOString(),
      scheduled_date: targetUnassigned ? null : targetDate,
      estimated_minutes: suggestion?.estimated_minutes ?? null,
      recurring_task_id: null,
      parent_task_id: null,
      is_divider: false,
      optimistic: true,
    }
    updateArea(targetUnassigned, targetDate, (tasks) => [optimisticTask, ...tasks])
    composer.cancel()
    setError('')
    try {
      await request(TASKS_API, jsonOptions('POST', {
        title,
        scheduled_date: targetUnassigned ? null : targetDate,
        suggestion_id: suggestion?.id ?? null,
        unassigned: targetUnassigned,
      }))
      await refreshArea(targetUnassigned, targetDate)
      setError('')
    } catch (error) {
      updateArea(targetUnassigned, targetDate, (tasks) => (
        tasks.filter((task) => task.id !== optimisticId)
      ))
      setError(`Task was not saved: ${error.message}`)
    }
  }

  async function addDivider() {
    const targetUnassigned = unassignedOpen
    const targetDate = selectedDate
    try {
      await request(`${TASKS_API}/divider`, jsonOptions('POST', {
        scheduled_date: targetUnassigned ? null : targetDate,
        unassigned: targetUnassigned,
      }))
      composer.cancel()
      await refreshArea(targetUnassigned, targetDate)
      setError('')
    } catch (error) {
      setError(error.message)
    }
  }

  async function updateTask(id, changes) {
    const targetUnassigned = unassignedOpen
    const targetDate = selectedDate
    try {
      const updated = await request(`${TASKS_API}/${id}`, jsonOptions('PATCH', changes))
      await refreshArea(targetUnassigned, targetDate)
      setError('')
      return updated
    } catch (error) {
      setError(error.message)
      return null
    }
  }

  async function deleteTask(id) {
    const targetUnassigned = unassignedOpen
    const targetDate = selectedDate
    try {
      await request(`${TASKS_API}/${id}`, { method: 'DELETE' })
      await refreshArea(targetUnassigned, targetDate)
      setError('')
      return true
    } catch (error) {
      setError(error.message)
      return false
    }
  }

  async function moveTaskToParent(taskId, parentTaskId, placement = null) {
    const previous = currentTasks
    updateCurrent((tasks) => changeTaskParent(tasks, taskId, parentTaskId, placement))
    try {
      await request(`${TASKS_API}/${taskId}/parent`, jsonOptions('PUT', {
        parent_task_id: parentTaskId,
        placement,
      }))
      await refreshArea(unassignedOpen, selectedDate)
      setError('')
      return true
    } catch (error) {
      updateCurrent(previous)
      setError(error.message)
      return false
    }
  }

  async function persistOrder(taskIds, parentTaskId) {
    await request(`${TASKS_API}/order`, jsonOptions('PUT', {
      task_ids: taskIds,
      scheduled_date: unassignedOpen ? null : selectedDate,
      parent_task_id: parentTaskId,
    }))
  }

  async function scheduleTask(taskId, targetDate) {
    return request(`${TASKS_API}/${taskId}/schedule`, jsonOptions('PUT', {
      scheduled_date: targetDate,
    }))
  }

  return {
    updateCurrent,
    addTask,
    addDivider,
    updateTask,
    deleteTask,
    moveTaskToParent,
    persistOrder,
    scheduleTask,
  }
}
