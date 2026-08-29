import { useDroppable } from '@dnd-kit/core'
import { keyframes } from '@emotion/react'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { StaticTaskItem } from './TaskItem'
import { CompletedSection, TaskTree } from './TaskTree'
import { organizeTasks } from '../taskSelectors'

const dayDropRipple = keyframes`
  0% { transform: scale(.92); opacity: .8; }
  100% { transform: scale(1.12); opacity: 0; }
`

export function DayTab({ day, selected, celebrating, teleporting = false, onSelect }) {
  const { isOver, setNodeRef } = useDroppable({ id: `day:${day.key}` })

  return (
    <Box ref={setNodeRef} sx={{ minWidth: 0, flex: 1, position: 'relative', height: { xs: 48, sm: 52 } }}>
      <Button
        onClick={() => onSelect(day.key)}
        aria-pressed={selected}
        sx={{
          position: 'absolute',
          inset: { xs: '0 14px', sm: '0 18px' },
          zIndex: 1,
          minWidth: 0,
          width: 'auto',
          height: 'auto',
          borderRadius: { xs: 2.75, sm: 3 },
          color: selected && !teleporting ? 'primary.contrastText' : 'text.secondary',
          bgcolor: isOver ? 'action.hover' : 'transparent',
          boxShadow: 0,
          transition: 'background-color 120ms ease, box-shadow 120ms ease, color 120ms ease',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          '@media (hover: hover) and (pointer: fine)': {
            '&:hover': {
              bgcolor: 'action.hover',
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
        <Stack spacing={0.35} sx={{ alignItems: 'center' }}>
          <Typography component="span" variant="caption" sx={{ fontSize: { xs: 11, sm: 12 }, fontWeight: 700, lineHeight: 1.15, letterSpacing: '.02em' }}>
            {day.weekday}
          </Typography>
          <Typography component="span" sx={{ fontSize: { xs: 15, sm: 17 }, fontWeight: 700, lineHeight: 1.15 }}>
            {day.day}
          </Typography>
        </Stack>
      </Button>
    </Box>
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
  return (
    <Stack spacing={3} sx={{ px: 0.5, pointerEvents: 'none' }}>
      {pending.length === 0 ? (
        <Stack spacing={1.5} sx={{ alignItems: 'center', py: 7, color: 'text.secondary', WebkitUserSelect: 'none', userSelect: 'none' }}>
          <CheckCircleOutlineRoundedIcon sx={{ fontSize: 52, color: 'action.disabled' }} />
          <Typography>Nothing planned for this day.</Typography>
        </Stack>
      ) : (
        <Box sx={{ px: { xs: 0.5, sm: 1 }, bgcolor: 'transparent' }}>
          <TaskTree
            mainTasks={main}
            childrenByParent={childrenByParent}
            renderTask={(task, options) => (
              <StaticTaskItem
                key={task.id}
                task={task}
                hideDivider={options.hideDivider}
              >
                {options.children}
              </StaticTaskItem>
            )}
          />
        </Box>
      )}
      <CompletedSection
        tasks={completed}
        open={completedOpen}
        onToggle={onOpenCompleted}
        renderTask={(task) => <StaticTaskItem key={task.id} task={task} />}
      />
      <Box aria-hidden sx={{ height: { xs: 72, sm: 88 }, flexShrink: 0 }} />
    </Stack>
  )
}
