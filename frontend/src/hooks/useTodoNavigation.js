import { useCallback, useEffect, useRef, useState } from 'react'
import { dateKey } from '../dates'

export function useTodoNavigation({ today, loadUnassigned, setError, setLoading, onViewChange }) {
  const [selectedDate, setSelectedDate] = useState(() => dateKey())
  const [unassignedOpen, setUnassignedOpen] = useState(false)
  const [screen, setScreen] = useState('tasks')
  const [completedOpen, setCompletedOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState(null)
  const restoreIdRef = useRef(0)
  const callbacksRef = useRef({ loadUnassigned, onViewChange, setError, setLoading })
  useEffect(() => {
    callbacksRef.current = { loadUnassigned, onViewChange, setError, setLoading }
  }, [loadUnassigned, onViewChange, setError, setLoading])

  const restoreView = useCallback(async (state) => {
    const restoreId = ++restoreIdRef.current
    const view = state?.todoView ?? 'day'
    callbacksRef.current.onViewChange?.()
    setCompletedOpen(false)

    if (view === 'settings') {
      setScreen('settings')
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      return
    }

    setScreen('tasks')
    if (view === 'unassigned') {
      if (state?.todoDate) setSelectedDate(state.todoDate)
      callbacksRef.current.setLoading(true)
      try {
        await callbacksRef.current.loadUnassigned()
        if (restoreId !== restoreIdRef.current) return
        setUnassignedOpen(true)
        callbacksRef.current.setError('')
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      } catch (error) {
        if (restoreId === restoreIdRef.current) {
          callbacksRef.current.setError(error.message)
        }
      } finally {
        if (restoreId === restoreIdRef.current) callbacksRef.current.setLoading(false)
      }
      return
    }

    setUnassignedOpen(false)
    setSelectedDate(state?.todoDate ?? dateKey())
    callbacksRef.current.setLoading(false)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  useEffect(() => {
    window.history.replaceState({
      ...window.history.state,
      todoView: 'day',
      todoDate: dateKey(),
    }, '')
    const handleHistoryChange = () => restoreView(window.history.state ?? {})
    window.addEventListener('popstate', handleHistoryChange)
    return () => window.removeEventListener('popstate', handleHistoryChange)
  }, [restoreView])

  const previousTodayRef = useRef(today)
  useEffect(() => {
    if (previousTodayRef.current === today) return
    previousTodayRef.current = today
    setSelectedDate(today)
    setUnassignedOpen(false)
    setCompletedOpen(false)
    window.history.replaceState({
      ...window.history.state,
      todoView: 'day',
      todoDate: today,
    }, '')
  }, [today])

  function selectDate(value) {
    if (value === selectedDate && !unassignedOpen) return
    window.history.pushState({
      ...window.history.state,
      todoView: 'day',
      todoDate: value,
    }, '')
    callbacksRef.current.onViewChange?.()
    setCompletedOpen(false)
    setUnassignedOpen(false)
    setSelectedDate(value)
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  async function openUnassigned() {
    callbacksRef.current.setLoading(true)
    setCompletedOpen(false)
    callbacksRef.current.onViewChange?.()
    try {
      await callbacksRef.current.loadUnassigned()
      setUnassignedOpen(true)
      window.history.pushState({
        ...window.history.state,
        todoView: 'unassigned',
        todoDate: selectedDate,
      }, '')
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      callbacksRef.current.setError('')
      return true
    } catch (error) {
      callbacksRef.current.setError(error.message)
      return false
    } finally {
      callbacksRef.current.setLoading(false)
    }
  }

  function openCompletedForDate(value) {
    selectDate(value)
    setCompletedOpen(true)
  }

  function openSettings() {
    callbacksRef.current.onViewChange?.()
    window.history.pushState({
      ...window.history.state,
      todoView: 'settings',
      todoDate: selectedDate,
    }, '')
    setScreen('settings')
  }

  function closeSettings() {
    if (window.history.state?.todoView === 'settings') window.history.back()
    else setScreen('tasks')
  }

  return {
    today,
    selectedDate,
    unassignedOpen,
    screen,
    completedOpen,
    setCompletedOpen,
    settingsSection,
    setSettingsSection,
    selectDate,
    openUnassigned,
    openCompletedForDate,
    openSettings,
    closeSettings,
  }
}
