import { useEffect, useMemo, useRef, useState } from 'react'
import '@fontsource/space-grotesk/700.css'
import Container from '@mui/material/Container'
import { NOTICES_API, RECURRING_API, SUGGESTIONS_API } from './api'
import { upcomingDays } from './dates'
import { SettingsScreen } from './components/SettingsScreen'
import { TasksScreen } from './components/TasksScreen'
import { useCompletionPreferences } from './hooks/useCompletionPreferences'
import { useCurrentDate } from './hooks/useCurrentDate'
import { useDaySwipe } from './hooks/useDaySwipe'
import { useNotices } from './hooks/useNotices'
import { useTaskComposer } from './hooks/useTaskComposer'
import { useTaskDrag } from './hooks/useTaskDrag'
import { useTaskMutations } from './hooks/useTaskMutations'
import { useTaskStore } from './hooks/useTaskStore'
import { useTemplates } from './hooks/useTemplates'
import { useTodoNavigation } from './hooks/useTodoNavigation'
import { organizeTasks } from './taskSelectors'

export default function App({ mode, onToggleMode }) {
  const [error, setError] = useState('')
  const today = useCurrentDate()
  const days = useMemo(() => upcomingDays(today), [today])
  const taskStore = useTaskStore({ days, today, setError })
  const cancelDraftRef = useRef(() => {})
  const navigation = useTodoNavigation({
    today,
    loadUnassigned: taskStore.loadUnassigned,
    setError,
    setLoading: taskStore.setLoading,
    onViewChange: () => cancelDraftRef.current(),
  })
  const composer = useTaskComposer(navigation.screen)
  useEffect(() => {
    cancelDraftRef.current = composer.cancel
  }, [composer.cancel])

  const tasks = navigation.unassignedOpen
    ? taskStore.unassignedTasks
    : taskStore.tasksForDate(navigation.selectedDate)
  const taskGroups = useMemo(() => organizeTasks(tasks), [tasks])
  const completionPreferences = useCompletionPreferences()
  const suggestionsStore = useTemplates(SUGGESTIONS_API, setError)
  const recurringStore = useTemplates(
    RECURRING_API,
    setError,
    () => taskStore.refreshArea(false, today).catch((cause) => setError(cause.message)),
    true,
  )
  const noticesStore = useNotices(NOTICES_API, setError, today)
  const mutations = useTaskMutations({
    unassignedOpen: navigation.unassignedOpen,
    selectedDate: navigation.selectedDate,
    currentTasks: tasks,
    updateArea: taskStore.updateArea,
    refreshArea: taskStore.refreshArea,
    setError,
    composer,
  })
  const drag = useTaskDrag({
    tasks,
    unassignedOpen: navigation.unassignedOpen,
    selectedDate: navigation.selectedDate,
    updateCurrent: mutations.updateCurrent,
    refreshArea: taskStore.refreshArea,
    mutations,
    setError,
  })
  const daySwipe = useDaySwipe({
    days,
    selectedDate: navigation.selectedDate,
    onSelectDate: navigation.selectDate,
    onBeforeSelect: () => navigation.setCompletedOpen(false),
  })

  const selectedDayIndex = days.findIndex(
    (day) => day.key === navigation.selectedDate,
  )
  const previousDate = navigation.unassignedOpen
    ? null
    : (days[selectedDayIndex - 1]?.key ?? null)
  const nextDate = navigation.unassignedOpen
    ? null
    : (days[selectedDayIndex + 1]?.key ?? null)
  const indicatorPosition = Math.max(
    0,
    Math.min(
      days.length - 1,
      selectedDayIndex - (daySwipe.offset / daySwipe.pagerWidth),
    ),
  )
  const weekStartIndex = days.findIndex(
    (day, index) => index > 0 && day.weekdayIndex === 0,
  )
  const weekendStartIndex = days.findIndex(
    (day, index) => index > 0 && day.weekdayIndex === 5,
  )

  useEffect(() => {
    function handleArrowDayChange(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (navigation.screen !== 'tasks' || navigation.unassignedOpen) return
      const target = event.target
      if (target instanceof HTMLElement && (
        target.isContentEditable
        || target.closest('input, textarea, select, button, [role="dialog"]')
      )) return
      const direction = event.key === 'ArrowRight' ? 1 : -1
      if (direction === 1 && !nextDate) return
      if (direction === -1 && !previousDate) return
      event.preventDefault()
      navigation.setCompletedOpen(false)
      daySwipe.stepDay(direction)
    }
    window.addEventListener('keydown', handleArrowDayChange)
    return () => window.removeEventListener('keydown', handleArrowDayChange)
  }, [navigation, previousDate, nextDate, daySwipe])

  return (
    <Container
      maxWidth="sm"
      sx={{ px: { xs: 1, sm: 2 }, py: { xs: 2.5, sm: 4 }, overflowX: 'clip' }}
    >
      {navigation.screen === 'settings' ? (
        <SettingsScreen
          mode={mode}
          onToggleMode={onToggleMode}
          onClose={navigation.closeSettings}
          section={navigation.settingsSection}
          onSectionChange={navigation.setSettingsSection}
          completionSound={completionPreferences.enabled}
          onCompletionSoundChange={completionPreferences.setEnabled}
          completionSoundStyle={completionPreferences.style}
          onCompletionSoundStyleChange={completionPreferences.setStyle}
          suggestionsStore={suggestionsStore}
          recurringStore={recurringStore}
          noticesStore={noticesStore}
        />
      ) : (
        <TasksScreen
          data={{
            tasks,
            tasksByDate: taskStore.tasksByDate,
            ...taskGroups,
          }}
          navigation={{
            ...navigation,
            days,
            indicatorPosition,
            swipeAnimating: daySwipe.animating,
            swipeX: daySwipe.offset,
            swipePagerRef: daySwipe.pagerRef,
            daySwipeHandlers: daySwipe.pointerHandlers,
            weekStartIndex,
            weekendStartIndex,
            previousDate,
            nextDate,
            celebratingDay: drag.celebratingDay,
          }}
          drag={drag}
          actions={{
            updateTask: mutations.updateTask,
            deleteTask: mutations.deleteTask,
            updateCurrentTasks: mutations.updateCurrent,
            openSettings: navigation.openSettings,
            addDivider: mutations.addDivider,
            openTaskDraft: composer.start,
            addTask: mutations.addTask,
            cancelTaskDraft: composer.cancel,
          }}
          ui={{
            error,
            setError,
            loading: taskStore.loading,
            completedOpen: navigation.completedOpen,
            setCompletedOpen: navigation.setCompletedOpen,
            completionSound: completionPreferences.enabled,
            completionSoundStyle: completionPreferences.style,
            taskDraftOpen: composer.open,
            newTitle: composer.title,
            setNewTitle: composer.setTitle,
            suggestions: suggestionsStore.items,
            notices: noticesStore.items,
            today,
          }}
        />
      )}
    </Container>
  )
}
