import { keyframes } from '@emotion/react'
import Box from '@mui/material/Box'
const completionRing = keyframes`
  from { transform: scale(.55); opacity: .38; }
  to { transform: scale(2); opacity: 0; }
`
const completionParticle = keyframes`
  from { transform: translate(0, 0) scale(1); opacity: 1; }
  to { transform: translate(var(--particle-x), var(--particle-y)) scale(0); opacity: 0; }
`

export function CompletionEffect() {
  return (
    <>
      <Box sx={{ position: 'absolute', inset: 8, border: 1.5, borderColor: 'success.main', borderRadius: '50%', animation: `${completionRing} 340ms ease-out forwards` }} />
      <Box sx={{ position: 'absolute', inset: 8, border: 1, borderColor: 'success.light', borderRadius: '50%', animation: `${completionRing} 300ms 70ms ease-out forwards` }} />
      {[[0, -27], [22, -15], [25, 10], [8, 27], [-17, 23], [-26, -7], [-10, -25]].map(([x, y], index) => (
        <Box
          key={`${x}-${y}`}
          sx={{
            '--particle-x': `${x}px`,
            '--particle-y': `${y}px`,
            position: 'absolute',
            top: 18,
            left: 18,
            width: index % 2 ? 4 : 6,
            height: index % 2 ? 7 : 4,
            bgcolor: ['#34a853', '#fbbc04', '#4285f4', '#ea4335'][index % 4],
            borderRadius: 0.5,
            animation: `${completionParticle} 340ms ease-out forwards`,
          }}
        />
      ))}
    </>
  )
}
