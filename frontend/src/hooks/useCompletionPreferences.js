import { useEffect, useState } from 'react'
import { SOUND_OPTION_VALUES } from '../completionSound'

const ENABLED_KEY = 'pi-todo-completion-sound'
const STYLE_KEY = 'pi-todo-completion-sound-style'

export function useCompletionPreferences() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(ENABLED_KEY) !== 'false')
  const [style, setStyle] = useState(() => {
    const saved = localStorage.getItem(STYLE_KEY)
    return SOUND_OPTION_VALUES.has(saved) ? saved : 'glass-clink'
  })

  useEffect(() => localStorage.setItem(ENABLED_KEY, String(enabled)), [enabled])
  useEffect(() => localStorage.setItem(STYLE_KEY, style), [style])

  return { enabled, setEnabled, style, setStyle }
}
