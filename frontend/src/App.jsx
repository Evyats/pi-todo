import { useEffect, useMemo, useRef, useState } from 'react'
import '@fontsource/space-grotesk/700.css'
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import Container from '@mui/material/Container'
import { request, RECURRING_API, SUGGESTIONS_API, TASKS_API as API } from './api'
import { dateKey, upcomingDays } from './dates'
import { useCompletionPreferences } from './hooks/useCompletionPreferences'
import { useDaySwipe } from './hooks/useDaySwipe'
import { useTemplates } from './hooks/useTemplates'
import { SettingsScreen } from './components/SettingsScreen'
import { TasksScreen } from './components/TasksScreen'
import { organizeTasks } from './taskSelectors'

const EMPTY_TASKS = []
const DRAG_HANDLE_ZONE_WIDTH = 64

export default function App({ mode, onToggleMode }) {
  const [today, setToday] = useState(() => dateKey())
  const [selectedDate, setSelectedDate] = useState(() => dateKey())
  const [tasksByDate, setTasksByDate] = useState({})
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [settingsSection, setSettingsSection] = useState(null)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [screen, setScreen] = useState('tasks')
  const {
    enabled: completionSound,
    setEnabled: setCompletionSound,
    style: completionSoundStyle,
    setStyle: setCompletionSoundStyle,
  } = useCompletionPreferences()
  const [celebratingDay, setCelebratingDay] = useState(null)
  const [taskDraftOpen, setTaskDraftOpen] = useState(false)
  const [nestingTargetId, setNestingTargetId] = useState(null)
  const nestingTargetRef = useRef(null)
  const [dragMode, setDragMode] = useState('reorder')
  const dragModeRef = useRef('reorder')
  const [leavingParent, setLeavingParent] = useState(false)
  const leavingParentDirectionRef = useRef(null)
  const [removingDivider, setRemovingDivider] = useState(false)
  const removingDividerRef = useRef(false)
  const pointerStartRef = useRef(null)
  const mainListRef = useRef(null)
  const boundaryPositionRef = useRef(null)
  const dragStartTasksRef = useRef(null)
  const [draggedTask, setDraggedTask] = useState(null)
  const [collapsingTaskId, setCollapsingTaskId] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const days = useMemo(() => upcomingDays(today), [today])
  const tasks = tasksByDate[selectedDate] ?? EMPTY_TASKS
  function updateSelectedDayTasks(value) {
    setTasksByDate((current) => {
      const currentDay = current[selectedDate] ?? []
      const nextDay = typeof value === 'function' ? value(currentDay) : value
      return { ...current, [selectedDate]: nextDay }
    })
  }
  const suggestionsStore = useTemplates(SUGGESTIONS_API, setError)
  const recurringStore = useTemplates(RECURRING_API, setError, () => {
    if (selectedDate === today) {
      request(`${API}?scheduled_date=${today}`).then(updateSelectedDayTasks).catch((err) => setError(err.message))
    }
  })
  const suggestions = suggestionsStore.items

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentDate = dateKey()
      if (currentDate !== today) {
        setLoading(true)
        setToday(currentDate)
        setSelectedDate(currentDate)
      }
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [today])

  useEffect(() => {
    const startDate = days[0].key
    const endDate = days[days.length - 1].key
    request(`${API}?start_date=${startDate}&end_date=${endDate}`)
      .then((loadedTasks) => {
        const grouped = Object.fromEntries(days.map((day) => [day.key, []]))
        loadedTasks.forEach((task) => grouped[task.scheduled_date]?.push(task))
        setTasksByDate(grouped)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [days])

  useEffect(() => {
    const handleHistoryChange = () => {
      setScreen(window.history.state?.todoScreen === 'settings' ? 'settings' : 'tasks')
    }
    window.addEventListener('popstate', handleHistoryChange)
    return () => window.removeEventListener('popstate', handleHistoryChange)
  }, [])

  function selectDate(value) {
    if (value === selectedDate) return
    setSelectedDate(value)
  }

  function openCompletedForDate(value) {
    setSelectedDate(value)
    setCompletedOpen(true)
  }

  const {
    offset: swipeX,
    pagerWidth,
    animating: swipeAnimating,
    pagerRef: swipePagerRef,
    pointerHandlers: daySwipeHandlers,
  } = useDaySwipe({
    days,
    selectedDate,
    onSelectDate: selectDate,
    onBeforeSelect: () => setCompletedOpen(false),
  })

  function openSettings() {
    window.history.pushState({ ...window.history.state, todoScreen: 'settings' }, '')
    setScreen('settings')
  }

  function closeSettings() {
    if (window.history.state?.todoScreen === 'settings') {
      window.history.back()
    } else {
      setScreen('tasks')
    }
  }

  function openTaskDraft() {
    setTaskDraftOpen(true)
  }

  function cancelTaskDraft() {
    setNewTitle('')
    setTaskDraftOpen(false)
  }

  async function addTask(event, suggestion = null) {
    event?.preventDefault()
    const title = (suggestion?.title ?? newTitle).trim()
    if (!title) return
    try {
      const task = await request(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          scheduled_date: selectedDate,
          suggestion_id: suggestion?.id ?? null,
        }),
      })
      updateSelectedDayTasks((current) => [task, ...current])
      setNewTitle('')
      setTaskDraftOpen(false)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function addDivider() {
    try {
      const divider = await request(`${API}/divider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: selectedDate }),
      })
      updateSelectedDayTasks((current) => [divider, ...current])
      setNewTitle('')
      setTaskDraftOpen(false)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function updateTask(id, changes) {
    try {
      const updated = await request(`${API}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      updateSelectedDayTasks((current) => {
        if (changes.completed === false) {
          return [...current.filter((task) => task.id !== id), updated]
        }
        if (changes.completed !== true) {
          return current.map((task) => task.id === id ? updated : task)
        }
        const remaining = current
          .filter((task) => task.id !== id)
          .map((task) => (
            task.parent_task_id === id
              ? { ...task, completed: true, parent_task_id: null }
              : task
          ))
        return [updated, ...remaining]
      })
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteTask(id) {
    try {
      await request(`${API}/${id}`, { method: 'DELETE' })
      updateSelectedDayTasks((current) => current
        .filter((task) => task.id !== id)
        .map((task) => task.parent_task_id === id ? { ...task, parent_task_id: null } : task))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    const armedParentId = nestingTargetRef.current
    const detachPlacement = leavingParentDirectionRef.current
    leavingParentDirectionRef.current = null
    nestingTargetRef.current = null
    setNestingTargetId(null)
    dragModeRef.current = 'reorder'
    setDragMode('reorder')
    setLeavingParent(false)
    setDraggedTask(null)
    const activeTask = tasks.find((task) => task.id === active.id)
    if (!activeTask) return
    if (activeTask.is_divider && removingDividerRef.current) {
      removingDividerRef.current = false
      setRemovingDivider(false)
      await deleteTask(activeTask.id)
      return
    }
    removingDividerRef.current = false
    setRemovingDivider(false)
    const boundaryPosition = boundaryPositionRef.current
    const tasksBeforeDrag = dragStartTasksRef.current
    boundaryPositionRef.current = null
    dragStartTasksRef.current = null
    const overId = String(over?.id ?? '')
    if (overId.startsWith('day:')) {
      const targetDate = overId.slice(4)
      if (targetDate === selectedDate) return
      if (activeTask.recurring_task_id !== null) {
        setError('Recurring tasks cannot be moved to another day')
        return
      }
      if (activeTask.is_divider) {
        setError('Dividers cannot be moved to another day')
        return
      }
      const previous = tasksBeforeDrag || tasks
      const movedFamily = previous.filter(
        (task) => task.id === active.id || task.parent_task_id === active.id,
      )
      const movedIds = new Set(movedFamily.map((task) => task.id))
      setCollapsingTaskId(active.id)
      const collapseTimer = window.setTimeout(() => {
        updateSelectedDayTasks((current) => current.filter((task) => !movedIds.has(task.id)))
        setCollapsingTaskId(null)
      }, 220)
      try {
        const updatedParent = await request(`${API}/${active.id}/schedule`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduled_date: targetDate }),
        })
        const movedTasks = movedFamily.map((task) => (
          task.id === active.id
            ? updatedParent
            : { ...task, scheduled_date: targetDate }
        ))
        setTasksByDate((current) => ({
          ...current,
          [targetDate]: [...movedTasks, ...(current[targetDate] ?? [])],
        }))
        setCelebratingDay(targetDate)
        window.setTimeout(() => setCelebratingDay(null), 340)
        setError('')
      } catch (err) {
        window.clearTimeout(collapseTimer)
        updateSelectedDayTasks(previous)
        setCollapsingTaskId(null)
        setError(err.message)
      }
      return
    }
    if (boundaryPosition && activeTask.parent_task_id === null && !activeTask.is_divider) {
      const group = tasks.filter((task) => !task.completed && task.parent_task_id === null)
      try {
        await request(`${API}/order`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_ids: group.map((task) => task.id),
            scheduled_date: selectedDate,
            parent_task_id: null,
          }),
        })
        setError('')
      } catch (err) {
        if (tasksBeforeDrag) updateSelectedDayTasks(tasksBeforeDrag)
        setError(err.message)
      }
      return
    }
    if (!over) {
      if (activeTask.parent_task_id !== null && detachPlacement) {
        await moveTaskToParent(activeTask.id, null, detachPlacement)
      }
      return
    }
    const overTask = tasks.find((task) => task.id === over.id)

    if (activeTask.parent_task_id === null && armedParentId !== null) {
      await moveTaskToParent(activeTask.id, armedParentId)
      return
    }

    if (activeTask.parent_task_id !== null) {
      if (!overTask || overTask.parent_task_id !== activeTask.parent_task_id) {
        if (detachPlacement) await moveTaskToParent(activeTask.id, null, detachPlacement)
        return
      }
    }

    if (!overTask || active.id === over.id) return
    if (overTask.parent_task_id !== activeTask.parent_task_id) return

    const group = pendingTasks.filter(
      (task) => task.parent_task_id === activeTask.parent_task_id,
    )
    const oldIndex = group.findIndex((task) => task.id === active.id)
    const newIndex = group.findIndex((task) => task.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const previous = tasks
    const reorderedGroup = arrayMove(group, oldIndex, newIndex)
    const groupIds = new Set(group.map((task) => task.id))
    let groupPosition = 0
    const reordered = tasks.map((task) => (
      groupIds.has(task.id) ? reorderedGroup[groupPosition++] : task
    ))
    updateSelectedDayTasks(reordered)

    try {
      await request(`${API}/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_ids: reorderedGroup.map((task) => task.id),
          scheduled_date: selectedDate,
          parent_task_id: activeTask.parent_task_id,
        }),
      })
      setError('')
    } catch (err) {
      updateSelectedDayTasks(previous)
      setError(err.message)
    }
  }

  function handleDragOver({ active, over }) {
    const activeTask = tasks.find((task) => task.id === active.id)
    if (!activeTask || activeTask.parent_task_id !== null || dragModeRef.current !== 'nest') {
      nestingTargetRef.current = null
      setNestingTargetId(null)
      return
    }
    const overTask = tasks.find((task) => task.id === over?.id)
    const candidateId = overTask?.parent_task_id ?? overTask?.id ?? null
    const candidate = tasks.find((task) => task.id === candidateId)
    const hasChildren = tasks.some((task) => task.parent_task_id === active.id)
    const validCandidate = candidateId !== null
      && candidateId !== active.id
      && candidateId !== activeTask?.parent_task_id
      && candidate?.recurring_task_id === null
      && candidate?.is_divider === false
      && activeTask?.is_divider === false
      && !hasChildren

    if (!validCandidate) {
      nestingTargetRef.current = null
      setNestingTargetId(null)
      return
    }
    nestingTargetRef.current = candidateId
    setNestingTargetId(candidateId)
  }

  function handleDragMove({ active, delta }) {
    const activeTask = tasks.find((task) => task.id === active.id)
    const activeTaskHasChildren = tasks.some((task) => task.parent_task_id === active.id)
    const listBounds = mainListRef.current?.getBoundingClientRect()
    const pointerX = pointerStartRef.current ? pointerStartRef.current.x + delta.x : null
    const pointerIsInHandleZone = listBounds && pointerX !== null
      ? pointerX >= listBounds.right - DRAG_HANDLE_ZONE_WIDTH
      : true
    const nextMode = activeTask?.parent_task_id === null
      && !activeTaskHasChildren
      && activeTask?.is_divider === false
      && !pointerIsInHandleZone
      ? 'nest'
      : 'reorder'

    if (activeTask?.parent_task_id === null && pointerStartRef.current && mainListRef.current) {
      const pointerY = pointerStartRef.current.y + delta.y
      const boundaryPosition = pointerY < listBounds.top
        ? 'first'
        : pointerY > listBounds.bottom
          ? 'last'
          : null
      if (nextMode === 'reorder'
        && boundaryPosition
        && boundaryPosition !== boundaryPositionRef.current
        && !activeTask.is_divider) {
        updateSelectedDayTasks((current) => {
          const group = current.filter((task) => !task.completed && task.parent_task_id === null)
          const currentIndex = group.findIndex((task) => task.id === active.id)
          const targetIndex = boundaryPosition === 'first' ? 0 : group.length - 1
          if (currentIndex < 0 || currentIndex === targetIndex) return current
          const movedGroup = arrayMove(group, currentIndex, targetIndex)
          const groupIds = new Set(group.map((task) => task.id))
          let position = 0
          return current.map((task) => groupIds.has(task.id) ? movedGroup[position++] : task)
        })
      }
      boundaryPositionRef.current = boundaryPosition
    }
    if (activeTask?.is_divider && pointerStartRef.current && mainListRef.current) {
      const pointerY = pointerStartRef.current.y + delta.y
      const outsideList = pointerY < listBounds.top || pointerY > listBounds.bottom
      removingDividerRef.current = outsideList
      setRemovingDivider(outsideList)
    } else if (removingDividerRef.current) {
      removingDividerRef.current = false
      setRemovingDivider(false)
    }
    if (activeTask && activeTask.parent_task_id !== null) {
      const pointerY = pointerStartRef.current ? pointerStartRef.current.y + delta.y : null
      const group = mainListRef.current?.querySelector(
        `[data-task-group-id="${activeTask.parent_task_id}"]`,
      )
      const groupBounds = group?.getBoundingClientRect()
      const direction = pointerY !== null && groupBounds
        ? pointerY < groupBounds.top
          ? 'before'
          : pointerY > groupBounds.bottom
            ? 'after'
            : null
        : null
      leavingParentDirectionRef.current = direction
      setLeavingParent(direction !== null)
    } else {
      leavingParentDirectionRef.current = null
      setLeavingParent(false)
    }
    if (nextMode === 'nest') boundaryPositionRef.current = null
    if (nextMode === dragModeRef.current) return
    dragModeRef.current = nextMode
    setDragMode(nextMode)
    nestingTargetRef.current = null
    setNestingTargetId(null)
  }

  async function moveTaskToParent(taskId, parentTaskId, placement = null) {
    const previous = tasks
    updateSelectedDayTasks((current) => {
      const task = current.find((item) => item.id === taskId)
      if (!task) return current
      const remaining = current.filter((item) => item.id !== taskId)
      const updatedTask = { ...task, parent_task_id: parentTaskId }
      if (parentTaskId === null && placement && task.parent_task_id !== null) {
        const parentIndex = remaining.findIndex((item) => item.id === task.parent_task_id)
        if (parentIndex >= 0) {
          remaining.splice(parentIndex + (placement === 'after' ? 1 : 0), 0, updatedTask)
          return remaining
        }
      }
      return [...remaining, updatedTask]
    })
    try {
      const updated = await request(`${API}/${taskId}/parent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_task_id: parentTaskId, placement }),
      })
      updateSelectedDayTasks((current) => current.map((task) => task.id === taskId ? updated : task))
      setError('')
    } catch (err) {
      updateSelectedDayTasks(previous)
      setError(err.message)
    }
  }

  const {
    pending: pendingTasks,
    completed: completedTasks,
    main: mainTasks,
    childrenByParent,
  } = useMemo(() => organizeTasks(tasks), [tasks])
  const selectedDayIndex = days.findIndex((day) => day.key === selectedDate)
  const previousDate = days[selectedDayIndex - 1]?.key ?? null
  const nextDate = days[selectedDayIndex + 1]?.key ?? null
  const indicatorPosition = Math.max(
    0,
    Math.min(days.length - 1, selectedDayIndex - (swipeX / pagerWidth)),
  )
  const weekStartIndex = days.findIndex((day, index) => index > 0 && day.weekdayIndex === 0)

  return (
    <Container
      maxWidth="sm"
      sx={{ px: { xs: 1, sm: 2 }, py: { xs: 2.5, sm: 4 }, overflowX: 'hidden' }}
    >
      {screen === 'settings' ? (
        <SettingsScreen
          mode={mode}
          onToggleMode={onToggleMode}
          onClose={closeSettings}
          section={settingsSection}
          onSectionChange={setSettingsSection}
          completionSound={completionSound}
          onCompletionSoundChange={setCompletionSound}
          completionSoundStyle={completionSoundStyle}
          onCompletionSoundStyleChange={setCompletionSoundStyle}
          suggestionsStore={suggestionsStore}
          recurringStore={recurringStore}
        />
      ) : (
      <TasksScreen
        data={{ tasks, tasksByDate, pendingTasks, mainTasks, completedTasks, childrenByParent }}
        navigation={{
          days, indicatorPosition, swipeAnimating, weekStartIndex, celebratingDay,
          selectDate, swipePagerRef, daySwipeHandlers, swipeX, previousDate, nextDate,
          openCompletedForDate,
        }}
        drag={{
          sensors, dragModeRef, setDragMode, pointerStartRef, boundaryPositionRef,
          dragStartTasksRef, setDraggedTask, handleDragMove, handleDragOver,
          handleDragEnd, nestingTargetRef, setNestingTargetId, removingDividerRef,
          setRemovingDivider, setLeavingParent, mainListRef, nestingTargetId,
          collapsingTaskId, dragMode, draggedTask, leavingParent, removingDivider,
          leavingParentDirectionRef,
        }}
        actions={{ updateSelectedDayTasks, updateTask, deleteTask, openSettings, addDivider, openTaskDraft, addTask, cancelTaskDraft }}
        ui={{
          error, setError, loading, completedOpen, setCompletedOpen,
          completionSound, completionSoundStyle, taskDraftOpen, newTitle, setNewTitle, suggestions,
        }}
      />
      )}
    </Container>
  )
}
