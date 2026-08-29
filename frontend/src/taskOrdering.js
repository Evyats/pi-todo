import { arrayMove } from '@dnd-kit/sortable'

export function taskFamily(tasks, parentId) {
  return tasks.filter((task) => task.id === parentId || task.parent_task_id === parentId)
}

export function reorderTaskGroup(tasks, activeId, overId, parentTaskId) {
  const group = tasks.filter(
    (task) => !task.completed && task.parent_task_id === parentTaskId,
  )
  const oldIndex = group.findIndex((task) => task.id === activeId)
  const newIndex = group.findIndex((task) => task.id === overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
    return { tasks, group }
  }

  const reorderedGroup = arrayMove(group, oldIndex, newIndex)
  return {
    tasks: replaceTaskGroup(tasks, group, reorderedGroup),
    group: reorderedGroup,
  }
}

export function moveRootTaskToBoundary(tasks, taskId, boundary) {
  const roots = tasks.filter((task) => !task.completed && task.parent_task_id === null)
  const currentIndex = roots.findIndex((task) => task.id === taskId)
  const targetIndex = boundary === 'first' ? 0 : roots.length - 1
  if (currentIndex < 0 || currentIndex === targetIndex) return tasks
  return replaceTaskGroup(tasks, roots, arrayMove(roots, currentIndex, targetIndex))
}

export function changeTaskParent(tasks, taskId, parentTaskId, placement = null) {
  const task = tasks.find((item) => item.id === taskId)
  if (!task) return tasks
  const remaining = tasks.filter((item) => item.id !== taskId)
  const updatedTask = { ...task, parent_task_id: parentTaskId }

  if (parentTaskId === null && placement && task.parent_task_id !== null) {
    const parentIndex = remaining.findIndex((item) => item.id === task.parent_task_id)
    if (parentIndex >= 0) {
      remaining.splice(parentIndex + (placement === 'after' ? 1 : 0), 0, updatedTask)
      return remaining
    }
  }
  return [...remaining, updatedTask]
}

function replaceTaskGroup(tasks, originalGroup, reorderedGroup) {
  const groupIds = new Set(originalGroup.map((task) => task.id))
  let position = 0
  return tasks.map((task) => (
    groupIds.has(task.id) ? reorderedGroup[position++] : task
  ))
}
