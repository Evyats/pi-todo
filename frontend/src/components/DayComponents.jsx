import { useDroppable } from '@dnd-kit/core'
import { keyframes } from '@emotion/react'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import List from '@mui/material/List'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { StaticTaskItem } from './TaskItem'
import { organizeTasks } from '../taskSelectors'

const dayDropRipple = keyframes`
  0% { transform: scale(.92); opacity: .8; }
  100% { transform: scale(1.12); opacity: 0; }
`

export function DayTab({ day, selected, celebrating, onSelect }) {
  const { isOver, setNodeRef } = useDroppable({ id: `day:${day.key}` })

  return (
    <Button
      ref={setNodeRef}
      onClick={() => onSelect(day.key)}
      aria-pressed={selected}
      sx={{
        minWidth: 0,
        flex: 1,
        position: 'relative',
        zIndex: 1,
        py: 0.45,
        borderRadius: 2,
        color: selected ? 'primary.contrastText' : 'text.secondary',
        bgcolor: isOver ? 'action.hover' : 'transparent',
        boxShadow: 0,
        transition: 'background-color 120ms ease, box-shadow 120ms ease',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            bgcolor: selected ? 'primary.dark' : 'action.hover',
          },
        },
      }}
    >
      {celebrating && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 2,
            border: 2,
            borderColor: 'primary.light',
            borderRadius: 2,
            pointerEvents: 'none',
            animation: `${dayDropRipple} 380ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
          }}
        />
      )}
      <Stack spacing={0} sx={{ alignItems: 'center' }}>
        <Typography component="span" variant="caption" sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1.15 }}>
          {day.weekday}
        </Typography>
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>
          {day.day}
        </Typography>
      </Stack>
    </Button>
  )
}

export function DraggedTask({ task, leavingParent = false, removingDivider = false }) {
  if (!task) return null

  return (
    <Paper elevation={5} sx={{ px: 2, py: 1.5, borderRadius: 2, cursor: 'grabbing' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <DragIndicatorRoundedIcon color="disabled" />
        <Typography
          sx={{
            color: task.completed ? 'text.disabled' : 'text.primary',
            textDecoration: task.completed ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </Typography>
      </Stack>
      {leavingParent && (
        <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5, fontWeight: 700 }}>
          Release to move to main list
        </Typography>
      )}
      {removingDivider && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, fontWeight: 700 }}>
          Release to remove divider
        </Typography>
      )}
    </Paper>
  )
}

export function StaticDayPanel({ tasks, completedOpen, onOpenCompleted }) {
  const { pending, main, completed, childrenByParent } = organizeTasks(tasks)
  const ignore = async () => {}
  return (
    <Stack spacing={3} sx={{ px: 0.5, pointerEvents: 'none' }}>
      {pending.length === 0 ? (
        <Stack spacing={1.5} sx={{ alignItems: 'center', py: 7, color: 'text.secondary' }}>
          <CheckCircleRoundedIcon sx={{ fontSize: 52, color: 'action.disabled' }} />
          <Typography>Nothing planned for this day.</Typography>
        </Stack>
      ) : (
        <Paper elevation={0} sx={{ px: { xs: 0.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <List disablePadding>
            {main.map((task) => {
              const subtasks = childrenByParent.get(task.id) ?? []
              return (
                <StaticTaskItem
                  key={task.id}
                  task={task}
                  collapsing={false}
                  hideDivider={subtasks.length > 0}
                  soundEnabled={false}
                  onUpdate={ignore}
                  onDelete={ignore}
                >
                  {subtasks.length > 0 && (
                    <List disablePadding sx={{ mr: { xs: 4.5, sm: 6 }, pr: 1 }}>
                      {subtasks.map((subtask) => (
                        <StaticTaskItem
                          key={subtask.id}
                          task={subtask}
                          collapsing={false}
                          soundEnabled={false}
                          onUpdate={ignore}
                          onDelete={ignore}
                        />
                      ))}
                    </List>
                  )}
                </StaticTaskItem>
              )
            })}
          </List>
        </Paper>
      )}
      {completed.length > 0 && (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Button
            color="inherit"
            fullWidth
            onClick={onOpenCompleted}
            sx={{ justifyContent: 'space-between', px: 2, py: 1.25, color: 'text.secondary', pointerEvents: 'auto' }}
          >
            Completed ({completed.length})
            <ExpandMoreRoundedIcon sx={{ transform: completedOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }} />
          </Button>
          <Collapse in={completedOpen}>
            <Box sx={{ px: { xs: 0.5, sm: 2 }, borderTop: 1, borderColor: 'divider' }}>
              <List disablePadding>
                {completed.map((task) => (
                  <StaticTaskItem key={task.id} task={task} collapsing={false} soundEnabled={false} onUpdate={ignore} onDelete={ignore} />
                ))}
              </List>
            </Box>
          </Collapse>
        </Paper>
      )}
    </Stack>
  )
}
