import { useEffect, useRef, useState } from 'react'
import { keyframes } from '@emotion/react'
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import Fab from '@mui/material/Fab'
import List from '@mui/material/List'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { taskOrDayCollision } from '../drag/collisionDetection'
import { DayTab, DraggedTask, StaticDayPanel } from './DayComponents'
import { TaskItem } from './TaskItem'
import { InlineTaskComposer } from './InlineTaskComposer'
import { playCompletionSound } from '../completionSound'
import { remainingNoticeDays } from '../hooks/useNotices'
import { calendarWeek } from '../dates'
import { SCREEN_TOGGLE_WIDTH, ScreenToggle } from './ScreenToggle'
import { useConstantAutoScroll } from '../drag/useConstantAutoScroll'

const COMPLETION_DURATION = 340
const COMPLETION_STAGGER = 70
const dayPillTravel = keyframes`
  0%, 100% { transform: scaleY(1); }
  22%, 56% { transform: scaleY(.72); }
`
const weekPillTeleportIn = keyframes`
  from { transform: scale(0); }
  to { transform: scale(1); }
`
const weekPillTeleportOut = keyframes`
  from { transform: scale(1); }
  to { transform: scale(0); }
`

function ArchiveHeader({ active, teleportPhase, notices, today, selectedDate, onOpen, onOpenSettings }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'archive' })

  return (
    <Stack spacing={0.75}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `${SCREEN_TOGGLE_WIDTH}px minmax(0, 1fr) ${SCREEN_TOGGLE_WIDTH}px`, alignItems: 'center', gap: 1, minHeight: 48 }}>
        <Box aria-hidden sx={{ width: SCREEN_TOGGLE_WIDTH, flexShrink: 0 }} />
        <Button
          ref={setNodeRef}
          color="inherit"
          onClick={onOpen}
          aria-label="Open archived tasks"
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
                ? `${weekPillTeleportIn} 190ms cubic-bezier(0.16, 1, 0.3, 1)`
                : teleportPhase === 'return-depart'
                ? `${weekPillTeleportOut} 140ms cubic-bezier(.4, 0, 1, 1) forwards`
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
          {notices.map((notice) => {
            const daysLeft = remainingNoticeDays(notice.expires_on, today)
            return (
              <Typography component="div" key={notice.id} dir="rtl" sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start', justifyContent: 'center', width: 'fit-content', maxWidth: '100%', gap: 0.5, color: 'text.secondary', fontSize: { xs: 12, sm: 13 }, fontWeight: 400 }}>
                <span dir="ltr" style={{ flexShrink: 0 }}>{daysLeft}</span>
                <span aria-hidden="true" style={{ flexShrink: 0 }}>·</span>
                <bdi dir="auto" style={{ minWidth: 0, overflowWrap: 'anywhere', textAlign: 'center' }}>{notice.title}</bdi>
              </Typography>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}

export function TasksScreen({ data, navigation, drag, actions, ui }) {
  const [completionWave, setCompletionWave] = useState(new Map())
  const [pillTravel, setPillTravel] = useState(null)
  const [archiveTeleportPhase, setArchiveTeleportPhase] = useState(null)
  const pillTravelIdRef = useRef(0)
  const pillTravelTimerRef = useRef(null)
  const archiveTeleportTimerRef = useRef(null)
  const {
    tasks, tasksByDate, pendingTasks, mainTasks, completedTasks, childrenByParent,
  } = data
  const {
    days, indicatorPosition, swipeAnimating, weekStartIndex, weekendStartIndex, celebratingDay,
    selectDate, swipePagerRef, daySwipeHandlers, swipeX, previousDate, nextDate,
    openCompletedForDate, archiveOpen, openArchive, selectedDate,
  } = navigation
  const {
    sensors, dragModeRef, setDragMode, pointerStartRef, boundaryPositionRef,
    dragStartTasksRef, setDraggedTask, handleDragMove,
    handleDragOver, handleDragEnd, nestingTargetRef, setNestingTargetId,
    removingDividerRef, setRemovingDivider, setLeavingParent, mainListRef,
    nestingTargetId, collapsingTaskId, dragMode, draggedTask, leavingParent,
    removingDivider, leavingParentDirectionRef,
  } = drag
  const { updateTask, deleteTask, updateSelectedDayTasks, openSettings, addDivider, openTaskDraft, addTask, cancelTaskDraft } = actions
  const {
    error, setError, loading, completedOpen, setCompletedOpen,
    completionSound, completionSoundStyle, taskDraftOpen, newTitle, setNewTitle, suggestions,
    notices, today,
  } = ui
  const completed = completedTasks.length
  const activeNotices = notices.filter((notice) => remainingNoticeDays(notice.expires_on, today) > 0)
  useConstantAutoScroll(Boolean(draggedTask))

  useEffect(() => () => {
    if (pillTravelTimerRef.current) window.clearTimeout(pillTravelTimerRef.current)
    if (archiveTeleportTimerRef.current) window.clearTimeout(archiveTeleportTimerRef.current)
  }, [])

  async function teleportToArchive() {
    if (archiveOpen || archiveTeleportPhase) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await openArchive()
      return
    }
    setArchiveTeleportPhase('depart')
    archiveTeleportTimerRef.current = window.setTimeout(async () => {
      const opened = await openArchive()
      if (!opened) {
        setArchiveTeleportPhase(null)
        return
      }
      setArchiveTeleportPhase('arrive')
      archiveTeleportTimerRef.current = window.setTimeout(
        () => setArchiveTeleportPhase(null),
        230,
      )
    }, 150)
  }

  function teleportFromArchive(value) {
    if (!archiveOpen || archiveTeleportPhase) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      selectDate(value)
      return
    }
    setArchiveTeleportPhase('return-depart')
    archiveTeleportTimerRef.current = window.setTimeout(() => {
      selectDate(value)
      setArchiveTeleportPhase('return-arrive')
      archiveTeleportTimerRef.current = window.setTimeout(
        () => setArchiveTeleportPhase(null),
        230,
      )
    }, 150)
  }

  function animatePillTo(value) {
    if (archiveOpen || value === selectedDate) return
    const currentIndex = days.findIndex((day) => day.key === selectedDate)
    const targetIndex = days.findIndex((day) => day.key === value)
    if (currentIndex < 0 || targetIndex < 0) return
    const duration = Math.min(340, 190 + (Math.abs(targetIndex - currentIndex) * 30))
    pillTravelIdRef.current += 1
    setPillTravel({ id: pillTravelIdRef.current, duration })
    if (pillTravelTimerRef.current) window.clearTimeout(pillTravelTimerRef.current)
    pillTravelTimerRef.current = window.setTimeout(() => setPillTravel(null), duration + 80)
  }

  const pillDistance = Math.abs(indicatorPosition - Math.round(indicatorPosition))
  const pillScaleY = 1 - (0.28 * Math.sin(Math.PI * pillDistance))

  async function completeTask(task) {
    const family = [task, ...(childrenByParent.get(task.id) ?? [])]
    setCompletionWave(new Map([[task.id, 0]]))
    family.slice(1).forEach((item, index) => {
      window.setTimeout(() => {
        setCompletionWave((current) => new Map(current).set(item.id, 0))
      }, (index + 1) * COMPLETION_STAGGER)
    })
    if (completionSound) playCompletionSound(completionSoundStyle)
    const waveDuration = COMPLETION_DURATION + ((family.length - 1) * COMPLETION_STAGGER)
    await new Promise((resolve) => window.setTimeout(resolve, waveDuration))
    await updateTask(task.id, { completed: true })
    setCompletionWave(new Map())
  }
  return (
      <Stack spacing={3}>
        <DndContext
          sensors={sensors}
          autoScroll={false}
          collisionDetection={(args) => taskOrDayCollision(args, dragModeRef.current)}
          onDragStart={({ active, activatorEvent }) => {
            dragModeRef.current = 'reorder'
            setDragMode('reorder')
            const pointer = activatorEvent.touches?.[0] ?? activatorEvent
            pointerStartRef.current = {
              x: pointer.clientX,
              y: pointer.clientY,
            }
            boundaryPositionRef.current = null
            dragStartTasksRef.current = tasks
            setDraggedTask(tasks.find((task) => task.id === active.id) ?? null)
          }}
          onDragMove={handleDragMove}
          onDragOver={handleDragOver}
          onDragCancel={() => {
            nestingTargetRef.current = null
            setNestingTargetId(null)
            dragModeRef.current = 'reorder'
            setDragMode('reorder')
            setLeavingParent(false)
            removingDividerRef.current = false
            setRemovingDivider(false)
            leavingParentDirectionRef.current = null
            boundaryPositionRef.current = null
            if (dragStartTasksRef.current) updateSelectedDayTasks(dragStartTasksRef.current)
            dragStartTasksRef.current = null
            setDraggedTask(null)
          }}
          onDragEnd={handleDragEnd}
        >
          <ArchiveHeader
            active={archiveOpen}
            teleportPhase={archiveTeleportPhase}
            notices={activeNotices}
            today={today}
            selectedDate={selectedDate}
            onOpen={teleportToArchive}
            onOpenSettings={openSettings}
          />
          <Stack spacing={3}>
            <Box
              sx={{
                position: 'sticky',
                zIndex: 9,
                top: 0,
                display: 'flex',
                minHeight: { xs: 48, sm: 52 },
                py: 0.5,
                bgcolor: 'background.default',
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: '100%',
                  height: { xs: 16, sm: 20 },
                  pointerEvents: 'none',
                  backgroundImage: (theme) => `linear-gradient(to top, ${theme.palette.background.default}, transparent)`,
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: '100%',
                  height: { xs: 16, sm: 20 },
                  pointerEvents: 'none',
                  backgroundImage: (theme) => `linear-gradient(to bottom, ${theme.palette.background.default}, transparent)`,
                }}
              />
              {!archiveOpen && <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '20%',
                  transform: `translateX(${indicatorPosition * 100}%)`,
                  transition: swipeAnimating || swipeX === 0
                    ? `transform ${pillTravel?.duration ?? 120}ms cubic-bezier(0.16, 1, 0.3, 1)`
                    : 'none',
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                }}
              >
                <Box
                  key={pillTravel?.id ?? 'pill-idle'}
                  sx={{
                    position: 'absolute',
                    inset: { xs: '0 14px', sm: '0 18px' },
                    borderRadius: { xs: 2.75, sm: 3 },
                    bgcolor: 'primary.main',
                    backgroundImage: 'linear-gradient(145deg, #4b88ff, #225eff)',
                    boxShadow: '0 0 28px rgba(35, 99, 255, .4)',
                    transform: archiveTeleportPhase === 'depart'
                      ? 'scale(0)'
                      : `scaleY(${pillScaleY})`,
                    transformOrigin: 'center',
                    transition: archiveTeleportPhase === 'depart'
                      ? 'transform 140ms cubic-bezier(.4, 0, 1, 1)'
                      : pillTravel || (!swipeAnimating && swipeX !== 0)
                      ? 'none'
                      : 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
                    animation: pillTravel
                      ? `${dayPillTravel} ${pillTravel.duration}ms cubic-bezier(0.16, 1, 0.3, 1)`
                      : archiveTeleportPhase === 'return-arrive'
                      ? `${weekPillTeleportIn} 190ms cubic-bezier(0.16, 1, 0.3, 1)`
                      : 'none',
                    '@media (prefers-reduced-motion: reduce)': {
                      transform: 'scaleY(1)',
                      transition: 'none',
                      animation: 'none',
                    },
                  }}
                />
              </Box>}
              {weekStartIndex > 0 && (
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    zIndex: 2,
                    top: 15,
                    bottom: 15,
                    left: `calc(${weekStartIndex * 20}% - 1px)`,
                    width: 2,
                    borderRadius: 1,
                    bgcolor: 'divider',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {weekendStartIndex > 0 && (
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    zIndex: 2,
                    top: 15,
                    bottom: 15,
                    left: `calc(${weekendStartIndex * 20}% - 1px)`,
                    width: 2,
                    borderRadius: 1,
                    bgcolor: 'divider',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {days.map((day, index) => (
                <DayTab
                  key={day.key}
                  day={day}
                  selected={!archiveOpen && Math.round(indicatorPosition) === index}
                  teleporting={archiveTeleportPhase === 'depart' && day.key === selectedDate}
                  celebrating={celebratingDay === day.key}
                  onSelect={(value) => {
                    setCompletedOpen(false)
                    if (archiveOpen) {
                      teleportFromArchive(value)
                      return
                    }
                    animatePillTo(value)
                    selectDate(value)
                  }}
                />
              ))}
            </Box>

            <Box
              ref={swipePagerRef}
              {...(archiveOpen ? {} : daySwipeHandlers)}
              sx={{
                touchAction: 'pan-y',
                overflow: 'hidden',
                minHeight: {
                  xs: 'calc(100dvh - 204px)',
                  sm: 'calc(100dvh - 268px)',
                },
              }}
            >
            <Box
              sx={{
                display: 'flex',
                width: '300%',
                alignItems: 'flex-start',
                transform: `translateX(calc(-33.333333% + ${swipeX}px))`,
                transition: swipeAnimating ? 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
              }}
            >
            <Box sx={{ width: '33.333333%', flexShrink: 0 }}>
              {previousDate && (
                <StaticDayPanel
                  tasks={tasksByDate[previousDate] ?? []}
                  completedOpen={false}
                  onOpenCompleted={() => openCompletedForDate(previousDate)}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', width: '33.333333%', flexShrink: 0, flexDirection: 'column', gap: 3, px: 0.5 }}>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

            {loading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 7 }}><CircularProgress size={30} /></Box>
            ) : pendingTasks.length === 0 && !taskDraftOpen ? (
              <Stack spacing={1.5} sx={{ alignItems: 'center', py: 7, color: 'text.secondary', WebkitUserSelect: 'none', userSelect: 'none' }}>
                <CheckCircleOutlineRoundedIcon sx={{ fontSize: 52, color: 'action.disabled' }} />
                <Typography>{archiveOpen ? 'No archived tasks.' : 'Nothing planned for this day.'}</Typography>
              </Stack>
            ) : (
            <SortableContext items={mainTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
              <Box ref={mainListRef} sx={{ px: { xs: 0.5, sm: 1 }, bgcolor: 'transparent' }}>
                <List disablePadding>
                  {taskDraftOpen && (
                    <InlineTaskComposer
                      title={newTitle}
                      suggestions={suggestions}
                      onTitleChange={setNewTitle}
                      onAdd={addTask}
                      onAddDivider={addDivider}
                      onCancel={cancelTaskDraft}
                    />
                  )}
                  {mainTasks.map((task) => {
                    const subtasks = childrenByParent.get(task.id) ?? []
                    return (
                      <Box
                        key={task.id}
                        data-task-group-id={task.id}
                        sx={{
                          bgcolor: task.id === nestingTargetId ? 'action.selected' : 'transparent',
                          borderRadius: 2,
                          transition: 'background-color 120ms ease',
                        }}
                      >
                        <TaskItem
                          task={task}
                          collapsing={task.id === collapsingTaskId}
                          dragMode={dragMode}
                          hideDivider={subtasks.length > 0}
                          celebrating={completionWave.has(task.id)}
                          celebrationDelay={completionWave.get(task.id) ?? 0}
                          soundEnabled={completionSound}
                          soundStyle={completionSoundStyle}
                          onUpdate={updateTask}
                          onDelete={deleteTask}
                          onComplete={completeTask}
                        >
                          {subtasks.length > 0 && (
                            <SortableContext items={subtasks.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                              <List disablePadding sx={{ mr: { xs: 4.5, sm: 5 } }}>
                                {subtasks.map((subtask) => (
                                  <TaskItem
                                    key={subtask.id}
                                    task={subtask}
                                    collapsing={subtask.id === collapsingTaskId}
                                    dragMode={dragMode}
                                    celebrating={completionWave.has(subtask.id)}
                                    celebrationDelay={completionWave.get(subtask.id) ?? 0}
                                    soundEnabled={completionSound}
                                    soundStyle={completionSoundStyle}
                                    onUpdate={updateTask}
                                    onDelete={deleteTask}
                                    onComplete={completeTask}
                                  />
                                ))}
                              </List>
                            </SortableContext>
                          )}
                        </TaskItem>
                      </Box>
                    )
                  })}
                </List>
              </Box>
            </SortableContext>
            )}

            {completed > 0 && (
              <Paper
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 23, 30, .72)' : 'background.paper',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Button
                  color="inherit"
                  fullWidth
                  onClick={() => setCompletedOpen((current) => !current)}
                  aria-expanded={completedOpen}
                  sx={{ justifyContent: 'space-between', px: 2, py: 1.25, color: 'text.secondary' }}
                >
                  Completed ({completed})
                  <ExpandMoreRoundedIcon
                    sx={{ transform: completedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
                  />
                </Button>
                <Collapse in={completedOpen}>
                  <Box sx={{ px: { xs: 0.5, sm: 2 }, borderTop: 1, borderColor: 'divider' }}>
                    <List disablePadding>
                      {completedTasks.map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          collapsing={false}
                          soundEnabled={completionSound}
                          soundStyle={completionSoundStyle}
                          onUpdate={updateTask}
                          onDelete={deleteTask}
                        />
                      ))}
                    </List>
                  </Box>
                </Collapse>
              </Paper>
            )}
            <Box aria-hidden sx={{ height: { xs: 72, sm: 88 }, flexShrink: 0 }} />
            </Box>
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
          </Stack>
          <DragOverlay dropAnimation={null}>
            <DraggedTask
              task={draggedTask}
              leavingParent={leavingParent}
              removingDivider={removingDivider}
            />
          </DragOverlay>
        </DndContext>

        <Box sx={{ position: 'fixed', right: { xs: 20, sm: 32 }, bottom: { xs: 20, sm: 32 }, zIndex: 10 }}>
          <Fab
            color="primary"
            aria-label="Add task"
            onClick={openTaskDraft}
            sx={{
              width: 64,
              height: 64,
              bgcolor: '#3478ff',
              backgroundImage: 'linear-gradient(145deg, #4b88ff, #225eff)',
              boxShadow: '0 0 30px rgba(35, 99, 255, .32)',
              '&:hover': { bgcolor: '#2868ee' },
            }}
          >
            <AddRoundedIcon />
          </Fab>
        </Box>
      </Stack>
  )
}
