import { useEffect, useState } from 'react'

export function useTaskComposer(screen) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  function start() {
    setOpen(true)
  }

  function cancel() {
    setTitle('')
    setOpen(false)
  }

  useEffect(() => {
    function handleEnterToAdd(event) {
      if (event.key !== 'Enter' || event.repeat || event.isComposing || event.defaultPrevented) return
      if (screen !== 'tasks' || open || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && (
        target.isContentEditable
        || target.closest('input, textarea, select, button, [role="dialog"]')
      )) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', handleEnterToAdd)
    return () => window.removeEventListener('keydown', handleEnterToAdd)
  }, [open, screen])

  return { open, title, setTitle, start, cancel }
}
