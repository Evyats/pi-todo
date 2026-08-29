import { useEffect, useState } from 'react'
import { dateKey } from '../dates'

export function useCurrentDate() {
  const [today, setToday] = useState(() => dateKey())

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentDate = dateKey()
      setToday((current) => current === currentDate ? current : currentDate)
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return today
}
