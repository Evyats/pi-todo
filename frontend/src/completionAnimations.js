import { keyframes } from '@emotion/react'

export const checkBounce = keyframes`
  0% { transform: scale(1); }
  45% { transform: scale(1.45); }
  75% { transform: scale(.9); }
  100% { transform: scale(1); }
`

export const completionPulse = keyframes`
  0%, 100% { background-color: transparent; }
  45% { background-color: rgba(52, 168, 83, .13); }
`
