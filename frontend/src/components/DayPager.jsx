import Box from '@mui/material/Box'
import { StaticDayPanel } from './DayComponents'

export function DayPager({ navigation, tasksByDate, children }) {
  const {
    unassignedOpen, swipePagerRef, daySwipeHandlers, swipeX, swipeAnimating,
    previousDate, nextDate, openCompletedForDate,
  } = navigation

  return (
    <Box
      ref={swipePagerRef}
      {...(unassignedOpen ? {} : daySwipeHandlers)}
      sx={{ touchAction: 'pan-y', overflow: 'hidden', minHeight: { xs: 'calc(100dvh - 204px)', sm: 'calc(100dvh - 268px)' } }}
    >
      <Box sx={{ display: 'flex', width: '300%', alignItems: 'flex-start', transform: `translateX(calc(-33.333333% + ${swipeX}px))`, transition: swipeAnimating ? 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none' }}>
        <Box sx={{ width: '33.333333%', flexShrink: 0 }}>
          {previousDate && (
            <StaticDayPanel
              tasks={tasksByDate[previousDate] ?? []}
              completedOpen={false}
              onOpenCompleted={() => openCompletedForDate(previousDate)}
            />
          )}
        </Box>
        <Box sx={{ width: '33.333333%', flexShrink: 0 }}>{children}</Box>
        <Box sx={{ width: '33.333333%', flexShrink: 0 }}>
          {nextDate && (
            <StaticDayPanel
              tasks={tasksByDate[nextDate] ?? []}
              completedOpen={false}
              onOpenCompleted={() => openCompletedForDate(nextDate)}
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}
