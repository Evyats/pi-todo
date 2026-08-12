import { useState } from 'react'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import HorizontalRuleRoundedIcon from '@mui/icons-material/HorizontalRuleRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import Fab from '@mui/material/Fab'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { taskOrDayCollision } from '../drag/collisionDetection'
import { DayTab, DraggedTask, StaticDayPanel } from './DayComponents'
import { TaskItem } from './TaskItem'
import { playCompletionSound } from '../completionSound'

const COMPLETION_DURATION = 340
const COMPLETION_STAGGER = 70

export function TasksScreen({ data, navigation, drag, actions, ui }) {
  const [completionWave, setCompletionWave] = useState(new Map())
  const {
    tasks, tasksByDate, pendingTasks, mainTasks, completedTasks, childrenByParent,
  } = data
  const {
    days, indicatorPosition, swipeAnimating, weekStartIndex, celebratingDay,
    selectDate, swipePagerRef, daySwipeHandlers, swipeX, previousDate, nextDate,
    openCompletedForDate,
  } = navigation
  const {
    sensors, dragModeRef, setDragMode, pointerStartRef, boundaryPositionRef,
    dragStartTasksRef, setDraggedTask, handleDragMove,
    handleDragOver, handleDragEnd, nestingTargetRef, setNestingTargetId,
    removingDividerRef, setRemovingDivider, setLeavingParent, mainListRef,
    nestingTargetId, collapsingTaskId, dragMode, draggedTask, leavingParent,
    removingDivider,
  } = drag
  const { updateTask, deleteTask, updateSelectedDayTasks, openSettings, addDivider, openTaskComposer } = actions
  const {
    error, setError, loading, completedOpen, setCompletedOpen,
    completionSound, completionSoundStyle,
  } = ui
  const completed = completedTasks.length

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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography
            variant="h2"
            sx={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: { xs: 31, sm: 38 },
              fontWeight: 800,
              letterSpacing: '-.045em',
            }}
          >
            Tasks
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <IconButton
              color="inherit"
              onClick={openSettings}
              aria-label="Open settings"
            >
              <SettingsRoundedIcon />
            </IconButton>
          </Stack>
        </Box>

        <DndContext
          sensors={sensors}
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
            boundaryPositionRef.current = null
            if (dragStartTasksRef.current) updateSelectedDayTasks(dragStartTasksRef.current)
            dragStartTasksRef.current = null
            setDraggedTask(null)
          }}
          onDragEnd={handleDragEnd}
        >
          <Stack spacing={3}>
            <Paper elevation={0} sx={{ position: 'relative', display: 'flex', gap: 0.4, p: 0.4, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: 3,
                  bottom: 3,
                  left: 3,
                  width: 'calc((100% - 6px) / 5)',
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  transform: `translateX(${indicatorPosition * 100}%)`,
                  transition: swipeAnimating ? 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                }}
              />
              {weekStartIndex > 0 && (
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    zIndex: 2,
                    top: 7,
                    bottom: 7,
                    left: `calc(${weekStartIndex * 20}% - 1px)`,
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
                  selected={Math.round(indicatorPosition) === index}
                  celebrating={celebratingDay === day.key}
                  onSelect={(value) => {
                    setCompletedOpen(false)
                    selectDate(value)
                  }}
                />
              ))}
            </Paper>

            <Box
              ref={swipePagerRef}
              {...daySwipeHandlers}
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
            ) : pendingTasks.length === 0 ? (
              <Stack spacing={1.5} sx={{ alignItems: 'center', py: 7, color: 'text.secondary' }}>
                <CheckCircleRoundedIcon sx={{ fontSize: 52, color: 'action.disabled' }} />
                <Typography>Nothing planned for this day.</Typography>
              </Stack>
            ) : (
            <SortableContext items={mainTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
              <Paper ref={mainListRef} elevation={0} sx={{ px: { xs: 0.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <List disablePadding>
                  {mainTasks.map((task) => {
                    const subtasks = childrenByParent.get(task.id) ?? []
                    return (
                      <Box
                        key={task.id}
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
                              <List disablePadding sx={{ mr: { xs: 4.5, sm: 6 }, pr: 1 }}>
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
              </Paper>
            </SortableContext>
            )}

            {completed > 0 && (
              <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
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

        <Box sx={{ position: 'fixed', right: { xs: 20, sm: 32 }, bottom: { xs: 20, sm: 32 }, zIndex: 10, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Fab size="small" color="default" aria-label="Add divider" onClick={addDivider}>
            <HorizontalRuleRoundedIcon />
          </Fab>
          <Fab color="primary" aria-label="Add task" onClick={openTaskComposer}>
            <AddRoundedIcon />
          </Fab>
        </Box>
      </Stack>
  )
}
