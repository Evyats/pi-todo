import { useEffect, useRef, useState } from 'react'
import { keyframes } from '@emotion/react'
import { useDroppable } from '@dnd-kit/core'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { calendarWeek } from '../dates'
import { remainingNoticeDays } from '../hooks/useNotices'
import { DayTab } from './DayComponents'
import { SCREEN_TOGGLE_WIDTH, ScreenToggle } from './ScreenToggle'

const dayPillTravel = keyframes`
  0%, 100% { transform: scaleY(1); }
  22%, 56% { transform: scaleY(.72); }
`
const pillTeleportIn = keyframes`
  from { transform: scale(0); }
  to { transform: scale(1); }
`
const pillTeleportOut = keyframes`
  from { transform: scale(1); }
  to { transform: scale(0); }
`

function WeekHeader({ active, teleportPhase, notices, today, selectedDate, onOpen, onOpenSettings }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'unassigned' })

  return (
    <Stack spacing={0.75}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `${SCREEN_TOGGLE_WIDTH}px minmax(0, 1fr) ${SCREEN_TOGGLE_WIDTH}px`, alignItems: 'center', gap: 1, minHeight: 48 }}>
        <Box aria-hidden sx={{ width: SCREEN_TOGGLE_WIDTH, flexShrink: 0 }} />
        <Button
          ref={setNodeRef}
          color="inherit"
          onClick={onOpen}
          aria-label="Open unassigned tasks"
          aria-pressed={active}
          sx={{
            minWidth: 'auto',
            minHeight: 'auto',
            position: 'relative',
            justifySelf: 'center',
            px: 1.5,
            py: 0.6,
            borderRadius: 999,
            color: active ? 'primary.contrastText' : 'text.primary',
            textTransform: 'none',
            bgcolor: isOver && !active ? 'action.hover' : 'transparent',
            transition: 'background-color 120ms ease, color 120ms ease',
            isolation: 'isolate',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              zIndex: -1,
              borderRadius: 'inherit',
              bgcolor: active ? 'primary.main' : 'transparent',
              backgroundImage: active ? 'linear-gradient(145deg, #4b88ff, #225eff)' : 'none',
              boxShadow: active ? '0 0 24px rgba(35, 99, 255, .32)' : 0,
              transformOrigin: 'center',
              animation: teleportPhase === 'arrive'
                ? `${pillTeleportIn} 190ms cubic-bezier(0.16, 1, 0.3, 1)`
                : teleportPhase === 'return-depart'
                  ? `${pillTeleportOut} 140ms cubic-bezier(.4, 0, 1, 1) forwards`
                  : 'none',
            },
            '&:hover': { bgcolor: active ? 'transparent' : 'action.hover' },
            '@media (prefers-reduced-motion: reduce)': {
              '&::before': { animation: 'none' },
            },
          }}
        >
          <Typography component="span" variant="h2" sx={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: { xs: 23, sm: 27 }, fontWeight: 800, letterSpacing: '-.045em' }}>
            Week {calendarWeek(selectedDate)}
          </Typography>
        </Button>
        <ScreenToggle screen="tasks" onChange={(screen) => screen === 'settings' && onOpenSettings()} />
      </Box>
      {notices.length > 0 && (
        <Stack spacing={0.4} sx={{ alignItems: 'center' }}>
          {notices.map((notice) => (
            <Typography component="div" key={notice.id} dir="rtl" sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start', justifyContent: 'center', width: 'fit-content', maxWidth: '100%', gap: 0.5, color: 'text.secondary', fontSize: { xs: 12, sm: 13 }, fontWeight: 400 }}>
              <span dir="ltr" style={{ flexShrink: 0 }}>{remainingNoticeDays(notice.expires_on, today)}</span>
              <span aria-hidden="true" style={{ flexShrink: 0 }}>·</span>
              <bdi dir="auto" style={{ minWidth: 0, overflowWrap: 'anywhere', textAlign: 'center' }}>{notice.title}</bdi>
            </Typography>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

export function DayNavigation({ navigation, notices, today, onOpenSettings, onCloseCompleted }) {
  const {
    days, indicatorPosition, swipeAnimating, swipeX, weekStartIndex,
    weekendStartIndex, celebratingDay, selectedDate, unassignedOpen,
    openUnassigned, selectDate,
  } = navigation
  const [pillTravel, setPillTravel] = useState(null)
  const [teleportPhase, setTeleportPhase] = useState(null)
  const pillTravelIdRef = useRef(0)
  const pillTimerRef = useRef(null)
  const teleportTimerRef = useRef(null)

  useEffect(() => () => {
    if (pillTimerRef.current) window.clearTimeout(pillTimerRef.current)
    if (teleportTimerRef.current) window.clearTimeout(teleportTimerRef.current)
  }, [])

  async function teleportToUnassigned() {
    if (unassignedOpen || teleportPhase) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await openUnassigned()
      return
    }
    setTeleportPhase('depart')
    teleportTimerRef.current = window.setTimeout(async () => {
      const opened = await openUnassigned()
      if (!opened) {
        setTeleportPhase(null)
        return
      }
      setTeleportPhase('arrive')
      teleportTimerRef.current = window.setTimeout(() => setTeleportPhase(null), 230)
    }, 150)
  }

  function teleportFromUnassigned(value) {
    if (!unassignedOpen || teleportPhase) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      selectDate(value)
      return
    }
    setTeleportPhase('return-depart')
    teleportTimerRef.current = window.setTimeout(() => {
      selectDate(value)
      setTeleportPhase('return-arrive')
      teleportTimerRef.current = window.setTimeout(() => setTeleportPhase(null), 230)
    }, 150)
  }

  function animatePillTo(value) {
    if (unassignedOpen || value === selectedDate) return
    const currentIndex = days.findIndex((day) => day.key === selectedDate)
    const targetIndex = days.findIndex((day) => day.key === value)
    if (currentIndex < 0 || targetIndex < 0) return
    const duration = Math.min(340, 190 + (Math.abs(targetIndex - currentIndex) * 30))
    pillTravelIdRef.current += 1
    setPillTravel({ id: pillTravelIdRef.current, duration })
    if (pillTimerRef.current) window.clearTimeout(pillTimerRef.current)
    pillTimerRef.current = window.setTimeout(() => setPillTravel(null), duration + 80)
  }

  const pillDistance = Math.abs(indicatorPosition - Math.round(indicatorPosition))
  const pillScaleY = 1 - (0.28 * Math.sin(Math.PI * pillDistance))

  return (
    <Stack spacing={3}>
      <WeekHeader
        active={unassignedOpen}
        teleportPhase={teleportPhase}
        notices={notices}
        today={today}
        selectedDate={selectedDate}
        onOpen={teleportToUnassigned}
        onOpenSettings={onOpenSettings}
      />
      <Box sx={{ position: 'sticky', zIndex: 9, top: 0, display: 'flex', minHeight: { xs: 48, sm: 52 }, py: 0.5, bgcolor: 'background.default' }}>
        <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, bottom: '100%', height: { xs: 16, sm: 20 }, pointerEvents: 'none', backgroundImage: (theme) => `linear-gradient(to top, ${theme.palette.background.default}, transparent)` }} />
        <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, top: '100%', height: { xs: 16, sm: 20 }, pointerEvents: 'none', backgroundImage: (theme) => `linear-gradient(to bottom, ${theme.palette.background.default}, transparent)` }} />
        {!unassignedOpen && (
          <Box sx={{ position: 'absolute', inset: 0, width: '20%', transform: `translateX(${indicatorPosition * 100}%)`, transition: swipeAnimating || swipeX === 0 ? `transform ${pillTravel?.duration ?? 120}ms cubic-bezier(0.16, 1, 0.3, 1)` : 'none', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}>
            <Box
              key={pillTravel?.id ?? 'pill-idle'}
              sx={{
                position: 'absolute',
                inset: { xs: '0 14px', sm: '0 18px' },
                borderRadius: { xs: 2.75, sm: 3 },
                bgcolor: 'primary.main',
                backgroundImage: 'linear-gradient(145deg, #4b88ff, #225eff)',
                boxShadow: '0 0 28px rgba(35, 99, 255, .4)',
                transform: teleportPhase === 'depart' ? 'scale(0)' : `scaleY(${pillScaleY})`,
                transformOrigin: 'center',
                transition: teleportPhase === 'depart'
                  ? 'transform 140ms cubic-bezier(.4, 0, 1, 1)'
                  : pillTravel || (!swipeAnimating && swipeX !== 0)
                    ? 'none'
                    : 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
                animation: pillTravel
                  ? `${dayPillTravel} ${pillTravel.duration}ms cubic-bezier(0.16, 1, 0.3, 1)`
                  : teleportPhase === 'return-arrive'
                    ? `${pillTeleportIn} 190ms cubic-bezier(0.16, 1, 0.3, 1)`
                    : 'none',
                '@media (prefers-reduced-motion: reduce)': { transform: 'scaleY(1)', transition: 'none', animation: 'none' },
              }}
            />
          </Box>
        )}
        {[weekStartIndex, weekendStartIndex].map((index) => index > 0 && (
          <Box key={index} aria-hidden sx={{ position: 'absolute', zIndex: 2, top: 15, bottom: 15, left: `calc(${index * 20}% - 1px)`, width: 2, borderRadius: 1, bgcolor: 'divider', pointerEvents: 'none' }} />
        ))}
        {days.map((day, index) => (
          <DayTab
            key={day.key}
            day={day}
            selected={!unassignedOpen && Math.round(indicatorPosition) === index}
            teleporting={teleportPhase === 'depart' && day.key === selectedDate}
            celebrating={celebratingDay === day.key}
            onSelect={(value) => {
              onCloseCompleted()
              if (unassignedOpen) teleportFromUnassigned(value)
              else {
                animatePillTo(value)
                selectDate(value)
              }
            }}
          />
        ))}
      </Box>
    </Stack>
  )
}
