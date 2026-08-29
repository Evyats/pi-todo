import { useEffect, useRef, useState } from 'react'
import { playCompletionSound } from '../completionSound'

const COMPLETION_DURATION = 340
const COMPLETION_STAGGER = 70

export function useTaskCompletion({ childrenByParent, soundEnabled, soundStyle, updateTask }) {
  const [wave, setWave] = useState(new Map())
  const timersRef = useRef([])

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  async function completeTask(task) {
    const family = [task, ...(childrenByParent.get(task.id) ?? [])]
    setWave(new Map([[task.id, 0]]))
    family.slice(1).forEach((item, index) => {
      const timer = window.setTimeout(() => {
        setWave((current) => new Map(current).set(item.id, 0))
      }, (index + 1) * COMPLETION_STAGGER)
      timersRef.current.push(timer)
    })
    if (soundEnabled) playCompletionSound(soundStyle)
    const waveDuration = COMPLETION_DURATION
      + ((family.length - 1) * COMPLETION_STAGGER)
    await new Promise((resolve) => {
      const timer = window.setTimeout(resolve, waveDuration)
      timersRef.current.push(timer)
    })
    await updateTask(task.id, { completed: true })
    setWave(new Map())
    timersRef.current = []
  }

  return { wave, completeTask }
}
