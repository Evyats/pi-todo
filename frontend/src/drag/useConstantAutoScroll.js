import { useEffect, useRef } from 'react'

const EDGE_ZONE = 88
const SCROLL_SPEED = 360

export function useConstantAutoScroll(active) {
  const pointerYRef = useRef(null)

  useEffect(() => {
    if (!active) {
      pointerYRef.current = null
      return undefined
    }

    let animationFrame = null
    let previousTime = null

    function trackPointer(event) {
      pointerYRef.current = event.clientY
    }

    function scroll(time) {
      const pointerY = pointerYRef.current
      let direction = 0

      if (pointerY !== null) {
        if (pointerY <= EDGE_ZONE) direction = -1
        else if (pointerY >= window.innerHeight - EDGE_ZONE) direction = 1
      }

      if (direction && previousTime !== null) {
        const elapsedSeconds = Math.min(time - previousTime, 50) / 1000
        window.scrollBy(0, direction * SCROLL_SPEED * elapsedSeconds)
      }

      previousTime = time
      animationFrame = window.requestAnimationFrame(scroll)
    }

    window.addEventListener('pointermove', trackPointer, { capture: true })
    animationFrame = window.requestAnimationFrame(scroll)

    return () => {
      window.removeEventListener('pointermove', trackPointer, { capture: true })
      window.cancelAnimationFrame(animationFrame)
      pointerYRef.current = null
    }
  }, [active])
}
