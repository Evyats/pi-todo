import { useEffect, useReducer, useRef, useState } from 'react'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { DRAG_HANDLE_ZONE_WIDTH } from '../constants'
import {
  moveRootTaskToBoundary,
  reorderTaskGroup,
  taskFamily,
} from '../taskOrdering'

const INITIAL_DRAG_STATE = {
  mode: 'reorder',
  nestingTargetId: null,
  leavingParent: false,
  removingDivider: false,
  draggedTask: null,
  collapsingTaskId: null,
}

function dragReducer(state, action) {
  if (action.type === 'reset') {
    return { ...INITIAL_DRAG_STATE, collapsingTaskId: state.collapsingTaskId }
  }
  if (action.type === 'patch') return { ...state, ...action.value }
  return state
}

export function useTaskDrag({
  tasks,
  unassignedOpen,
  selectedDate,
  updateCurrent,
  refreshArea,
  mutations,
  setError,
}) {
  const [state, dispatch] = useReducer(dragReducer, INITIAL_DRAG_STATE)
  const [celebratingDay, setCelebratingDay] = useState(null)
  const runtimeRef = useRef({
    mode: 'reorder',
    nestingTargetId: null,
    leavingPlacement: null,
    removingDivider: false,
    boundary: null,
    pointerStart: null,
    tasksBefore: null,
  })
  const mainListRef = useRef(null)
  const collapseTimerRef = useRef(null)
  const celebrationTimerRef = useRef(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => () => {
    if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current)
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current)
  }, [])

  function patch(value) {
    dispatch({ type: 'patch', value })
  }

  function clearInteraction() {
    const runtime = runtimeRef.current
    runtime.mode = 'reorder'
    runtime.nestingTargetId = null
    runtime.leavingPlacement = null
    runtime.removingDivider = false
    runtime.boundary = null
    runtime.pointerStart = null
    dispatch({ type: 'reset' })
  }

  function handleDragStart({ active, activatorEvent }) {
    const pointer = activatorEvent.touches?.[0] ?? activatorEvent
    Object.assign(runtimeRef.current, {
      mode: 'reorder',
      nestingTargetId: null,
      leavingPlacement: null,
      removingDivider: false,
      boundary: null,
      pointerStart: { x: pointer.clientX, y: pointer.clientY },
      tasksBefore: tasks,
    })
    patch({
      mode: 'reorder',
      nestingTargetId: null,
      leavingParent: false,
      removingDivider: false,
      draggedTask: tasks.find((task) => task.id === active.id) ?? null,
    })
  }

  function handleDragCancel() {
    if (runtimeRef.current.tasksBefore) updateCurrent(runtimeRef.current.tasksBefore)
    runtimeRef.current.tasksBefore = null
    clearInteraction()
  }

  async function handleDragEnd({ active, over }) {
    const runtime = runtimeRef.current
    const armedParentId = runtime.nestingTargetId
    const detachPlacement = runtime.leavingPlacement
    const boundary = runtime.boundary
    const tasksBefore = runtime.tasksBefore
    const removingDivider = runtime.removingDivider
    runtime.tasksBefore = null
    clearInteraction()

    const activeTask = tasks.find((task) => task.id === active.id)
    if (!activeTask) return
    if (activeTask.is_divider && removingDivider) {
      await mutations.deleteTask(activeTask.id)
      return
    }

    const overId = String(over?.id ?? '')
    if (overId.startsWith('day:') || overId === 'unassigned') {
      await finishAreaMove(activeTask, overId, tasksBefore)
      return
    }

    if (boundary && activeTask.parent_task_id === null && !activeTask.is_divider) {
      await persistCurrentRootOrder(tasksBefore)
      return
    }

    if (!over) {
      if (activeTask.parent_task_id !== null && detachPlacement) {
        await mutations.moveTaskToParent(activeTask.id, null, detachPlacement)
      }
      return
    }

    const overTask = tasks.find((task) => task.id === over.id)
    if (activeTask.parent_task_id === null && armedParentId !== null) {
      await mutations.moveTaskToParent(activeTask.id, armedParentId)
      return
    }
    if (activeTask.parent_task_id !== null
      && (!overTask || overTask.parent_task_id !== activeTask.parent_task_id)) {
      if (detachPlacement) {
        await mutations.moveTaskToParent(activeTask.id, null, detachPlacement)
      }
      return
    }
    if (!overTask || active.id === over.id
      || overTask.parent_task_id !== activeTask.parent_task_id) return

    const previous = tasks
    const reordered = reorderTaskGroup(
      tasks, active.id, over.id, activeTask.parent_task_id,
    )
    updateCurrent(reordered.tasks)
    try {
      await mutations.persistOrder(
        reordered.group.map((task) => task.id), activeTask.parent_task_id,
      )
      await refreshArea(unassignedOpen, selectedDate)
      setError('')
    } catch (error) {
      updateCurrent(previous)
      setError(error.message)
    }
  }

  async function finishAreaMove(activeTask, overId, tasksBefore) {
    const movingToUnassigned = overId === 'unassigned'
    const targetDate = movingToUnassigned ? null : overId.slice(4)
    if ((movingToUnassigned && unassignedOpen)
      || (!movingToUnassigned && !unassignedOpen && targetDate === selectedDate)) return
    if (activeTask.recurring_task_id !== null) {
      setError(movingToUnassigned
        ? 'Recurring tasks cannot be unassigned'
        : 'Recurring tasks cannot be moved to another day')
      return
    }
    if (activeTask.is_divider) {
      setError('Dividers cannot be moved to another day')
      return
    }

    const previous = tasksBefore || tasks
    const movedIds = new Set(taskFamily(previous, activeTask.id).map((task) => task.id))
    patch({ collapsingTaskId: activeTask.id })
    const collapseFinished = new Promise((resolve) => {
      collapseTimerRef.current = window.setTimeout(() => {
        updateCurrent((current) => current.filter((task) => !movedIds.has(task.id)))
        resolve()
      }, 220)
    })
    try {
      await Promise.all([
        mutations.scheduleTask(activeTask.id, targetDate),
        collapseFinished,
      ])
      await Promise.all([
        refreshArea(unassignedOpen, selectedDate),
        refreshArea(movingToUnassigned, targetDate),
      ])
      if (!movingToUnassigned) {
        setCelebratingDay(targetDate)
        celebrationTimerRef.current = window.setTimeout(
          () => setCelebratingDay(null), 340,
        )
      }
      setError('')
    } catch (error) {
      if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current)
      updateCurrent(previous)
      setError(error.message)
    } finally {
      collapseTimerRef.current = null
      patch({ collapsingTaskId: null })
    }
  }

  async function persistCurrentRootOrder(tasksBefore) {
    const roots = tasks.filter(
      (task) => !task.completed && task.parent_task_id === null,
    )
    try {
      await mutations.persistOrder(roots.map((task) => task.id), null)
      await refreshArea(unassignedOpen, selectedDate)
      setError('')
    } catch (error) {
      if (tasksBefore) updateCurrent(tasksBefore)
      setError(error.message)
    }
  }

  function handleDragOver({ active, over }) {
    const runtime = runtimeRef.current
    const activeTask = tasks.find((task) => task.id === active.id)
    if (!activeTask || activeTask.parent_task_id !== null || runtime.mode !== 'nest') {
      runtime.nestingTargetId = null
      patch({ nestingTargetId: null })
      return
    }
    const overTask = tasks.find((task) => task.id === over?.id)
    const candidateId = overTask?.parent_task_id ?? overTask?.id ?? null
    const candidate = tasks.find((task) => task.id === candidateId)
    const hasChildren = tasks.some((task) => task.parent_task_id === active.id)
    const valid = candidateId !== null
      && candidateId !== active.id
      && candidateId !== activeTask.parent_task_id
      && candidate?.recurring_task_id === null
      && candidate?.is_divider === false
      && !activeTask.is_divider
      && !hasChildren
    runtime.nestingTargetId = valid ? candidateId : null
    patch({ nestingTargetId: runtime.nestingTargetId })
  }

  function handleDragMove({ active, delta }) {
    const runtime = runtimeRef.current
    const activeTask = tasks.find((task) => task.id === active.id)
    const hasChildren = tasks.some((task) => task.parent_task_id === active.id)
    const listBounds = mainListRef.current?.getBoundingClientRect()
    const pointerX = runtime.pointerStart
      ? runtime.pointerStart.x + delta.x
      : null
    const inHandleZone = listBounds && pointerX !== null
      ? pointerX >= listBounds.right - DRAG_HANDLE_ZONE_WIDTH
      : true
    const nextMode = activeTask?.parent_task_id === null
      && !hasChildren
      && !activeTask?.is_divider
      && !inHandleZone
      ? 'nest'
      : 'reorder'

    if (activeTask?.parent_task_id === null && runtime.pointerStart && listBounds) {
      const pointerY = runtime.pointerStart.y + delta.y
      const boundary = pointerY < listBounds.top
        ? 'first'
        : pointerY > listBounds.bottom
          ? 'last'
          : null
      if (nextMode === 'reorder' && boundary
        && boundary !== runtime.boundary && !activeTask.is_divider) {
        updateCurrent((current) => moveRootTaskToBoundary(current, active.id, boundary))
      }
      runtime.boundary = boundary
    }

    if (activeTask?.is_divider && runtime.pointerStart && listBounds) {
      const pointerY = runtime.pointerStart.y + delta.y
      runtime.removingDivider = pointerY < listBounds.top || pointerY > listBounds.bottom
      patch({ removingDivider: runtime.removingDivider })
    } else if (runtime.removingDivider) {
      runtime.removingDivider = false
      patch({ removingDivider: false })
    }

    if (activeTask?.parent_task_id !== null) {
      const pointerY = runtime.pointerStart
        ? runtime.pointerStart.y + delta.y
        : null
      const group = mainListRef.current?.querySelector(
        `[data-task-group-id="${activeTask.parent_task_id}"]`,
      )
      const bounds = group?.getBoundingClientRect()
      runtime.leavingPlacement = pointerY !== null && bounds
        ? pointerY < bounds.top
          ? 'before'
          : pointerY > bounds.bottom
            ? 'after'
            : null
        : null
      patch({ leavingParent: runtime.leavingPlacement !== null })
    } else {
      runtime.leavingPlacement = null
      patch({ leavingParent: false })
    }

    if (nextMode === 'nest') runtime.boundary = null
    if (nextMode === runtime.mode) return
    runtime.mode = nextMode
    runtime.nestingTargetId = null
    patch({ mode: nextMode, nestingTargetId: null })
  }

  return {
    sensors,
    getDragMode: () => runtimeRef.current.mode,
    mainListRef,
    celebratingDay,
    state,
    dndHandlers: {
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragOver: handleDragOver,
      onDragCancel: handleDragCancel,
      onDragEnd: handleDragEnd,
    },
  }
}
