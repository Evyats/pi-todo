import { useRef, useState } from 'react'

const ANIMATION_MS = 120

export function useDaySwipe({ days, selectedDate, onSelectDate, onBeforeSelect }) {
  const [offset, setOffset] = useState(0)
  const [pagerWidth, setPagerWidth] = useState(1)
  const [animating, setAnimating] = useState(false)
  const offsetRef = useRef(0)
  const startRef = useRef(null)
  const pagerRef = useRef(null)

  function start(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target.closest('input, textarea, [data-no-day-swipe]')) return
    setPagerWidth(pagerRef.current?.clientWidth || 1)
    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      pointerId: event.pointerId,
      horizontal: false,
    }
  }

  function move(event) {
    const gesture = startRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const deltaX = event.clientX - gesture.x
    const deltaY = event.clientY - gesture.y
    if (!gesture.horizontal) {
      if (Math.abs(deltaX) < 8) return
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        startRef.current = null
        return
      }
      gesture.horizontal = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    event.preventDefault()
    const currentIndex = days.findIndex((day) => day.key === selectedDate)
    const blocked = (currentIndex === 0 && deltaX > 0)
      || (currentIndex === days.length - 1 && deltaX < 0)
    const nextOffset = blocked ? deltaX * 0.18 : deltaX
    offsetRef.current = nextOffset
    setOffset(nextOffset)
  }

  function finish(event) {
    const gesture = startRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    startRef.current = null
    if (!gesture.horizontal) return
    const width = pagerRef.current?.clientWidth || 1
    const velocity = offsetRef.current / Math.max(performance.now() - gesture.time, 1)
    const direction = offsetRef.current < 0 ? 1 : -1
    const currentIndex = days.findIndex((day) => day.key === selectedDate)
    const targetIndex = currentIndex + direction
    const shouldChange = targetIndex >= 0
      && targetIndex < days.length
      && (Math.abs(offsetRef.current) > width * 0.22 || Math.abs(velocity) > 0.45)

    setAnimating(true)
    if (shouldChange) {
      onBeforeSelect?.()
      const targetOffset = direction === 1 ? -width : width
      setOffset(targetOffset)
      offsetRef.current = targetOffset
      window.setTimeout(() => {
        onSelectDate(days[targetIndex].key)
        setAnimating(false)
        offsetRef.current = 0
        setOffset(0)
      }, ANIMATION_MS)
    } else {
      setOffset(0)
      offsetRef.current = 0
      window.setTimeout(() => setAnimating(false), ANIMATION_MS)
    }
  }

  return {
    offset,
    pagerWidth,
    animating,
    pagerRef,
    pointerHandlers: {
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  }
}
