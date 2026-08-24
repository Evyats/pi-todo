import { forwardRef } from 'react'
import Slide from '@mui/material/Slide'
import useMediaQuery from '@mui/material/useMediaQuery'

export const SlideUpTransition = forwardRef(function SlideUpTransition(props, ref) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  return (
    <Slide
      direction="up"
      ref={ref}
      timeout={reduceMotion ? 0 : { enter: 220, exit: 160 }}
      {...props}
    />
  )
})
