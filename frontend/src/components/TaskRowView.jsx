import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ListItem from '@mui/material/ListItem'
import Typography from '@mui/material/Typography'
import { checkBounce, completionPulse } from '../completionAnimations'
import { MAX_ESTIMATE_MINUTES } from '../constants'
import { CompletionEffect } from './CompletionEffect'

export function TaskRowView({
  task,
  interactive = true,
  editing = false,
  title = task.title,
  optimistic = false,
  collapsing = false,
  isDragging = false,
  hideDivider = false,
  celebrating = false,
  celebrationDelay = 0,
  activatorRef,
  dragAttributes = {},
  dragListeners = {},
  onStartEditing,
  onToggleCompleted,
  onDelete,
  children,
}) {
  if (task.is_divider) {
    return (
      <ListItem disableGutters sx={{ minHeight: 40, gap: { xs: 0.15, sm: 0.5 }, py: 0 }}>
        <Box sx={{ flex: 1, borderTop: 1, borderColor: 'divider' }} />
        <IconButton
          component={interactive ? 'button' : 'div'}
          ref={activatorRef}
          data-no-day-swipe
          aria-label={interactive ? 'Move divider' : undefined}
          tabIndex={interactive ? 0 : -1}
          {...dragAttributes}
          {...dragListeners}
          sx={{ color: 'text.disabled', cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
        >
          <DragIndicatorRoundedIcon />
        </IconButton>
      </ListItem>
    )
  }

  const titleEditable = interactive
    && !optimistic
    && !task.completed
    && task.recurring_task_id === null

  return (
    <>
      <ListItem
        divider={!hideDivider}
        disableGutters
        aria-disabled={optimistic || undefined}
        aria-busy={optimistic || undefined}
        sx={{
          minHeight: collapsing ? 0 : 56,
          maxHeight: collapsing ? 0 : 500,
          alignItems: 'center',
          gap: { xs: 0.15, sm: 0.5 },
          py: 0,
          overflow: 'hidden',
          pointerEvents: optimistic ? 'none' : 'auto',
          userSelect: optimistic ? 'none' : 'auto',
          borderRadius: celebrating ? 1.5 : 0,
          bgcolor: isDragging ? 'action.hover' : 'transparent',
          animation: celebrating ? `${completionPulse} 340ms ${celebrationDelay}ms ease-out both` : 'none',
          transition: 'max-height 220ms ease, min-height 220ms ease, padding 220ms ease',
          borderBottom: collapsing ? 'none' : undefined,
          '&:last-child': { borderBottom: 'none' },
        }}
      >
        <LeadingIndicator task={task} interactive={interactive} onDelete={onDelete} />
        <Box sx={{ display: 'flex', minWidth: 0, minHeight: 40, flex: 1, alignItems: 'center' }}>
          {editing && titleEditable ? (
            <TaskTitle text={title} />
          ) : titleEditable ? (
            <Button color="inherit" dir="auto" onClick={onStartEditing} sx={titleStyles(task)}>
              {task.title}
            </Button>
          ) : (
            <TaskTitle text={task.title} task={task} />
          )}
        </Box>
        <Box sx={{ display: 'flex', height: 40, alignItems: 'center', gap: 0, flexShrink: 0 }}>
          <Box sx={{ position: 'relative', display: 'grid', width: 36, height: 40, flexShrink: 0, placeItems: 'center' }}>
            {celebrating && <CompletionEffect />}
            <IconButton
              component={interactive ? 'button' : 'div'}
              color={task.completed || celebrating ? 'success' : 'default'}
              aria-label={interactive ? (task.completed ? 'Mark incomplete' : 'Mark complete') : undefined}
              tabIndex={interactive ? 0 : -1}
              disabled={interactive && (optimistic || celebrating)}
              onClick={interactive ? onToggleCompleted : undefined}
              sx={{ width: 36, height: 36, p: 0.75, animation: celebrating ? `${checkBounce} 340ms ${celebrationDelay}ms ease-out both` : 'none' }}
            >
              {task.completed || celebrating ? <CheckCircleOutlineRoundedIcon /> : <RadioButtonUncheckedRoundedIcon />}
            </IconButton>
          </Box>
          <IconButton
            component={interactive ? 'button' : 'div'}
            ref={activatorRef}
            data-no-day-swipe
            aria-label={interactive ? `Move ${task.title}` : undefined}
            tabIndex={interactive ? 0 : -1}
            disabled={interactive && (optimistic || task.completed)}
            {...dragAttributes}
            {...dragListeners}
            sx={{ width: 36, height: 36, p: 0.75, color: 'text.disabled', cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
          >
            {task.recurring_task_id === null ? <DragIndicatorRoundedIcon /> : <RepeatRoundedIcon />}
          </IconButton>
        </Box>
      </ListItem>
      {children}
    </>
  )
}

function LeadingIndicator({ task, interactive, onDelete }) {
  if (task.completed && task.recurring_task_id === null) {
    return (
      <IconButton
        component={interactive ? 'button' : 'div'}
        color="error"
        aria-label={interactive ? `Delete ${task.title}` : undefined}
        tabIndex={interactive ? 0 : -1}
        onClick={interactive ? onDelete : undefined}
      >
        <DeleteOutlineRoundedIcon />
      </IconButton>
    )
  }
  if (!task.estimated_minutes) {
    return <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0 }} />
  }
  return (
    <Box aria-label={`${task.estimated_minutes} minute estimate`} sx={{ display: 'grid', width: 40, height: 40, flexShrink: 0, placeItems: 'center' }}>
      <Box sx={{ display: 'grid', width: 28, height: 28, placeItems: 'center', alignContent: 'center', gap: 0.2, borderRadius: 1.25, color: 'primary.contrastText', bgcolor: 'primary.main', fontWeight: 800, lineHeight: 1, opacity: 0.22 + ((Math.min(task.estimated_minutes, MAX_ESTIMATE_MINUTES) / MAX_ESTIMATE_MINUTES) * 0.78) }}>
        <Box component="span" sx={{ fontSize: 11 }}>{task.estimated_minutes}</Box>
        <Box component="span" sx={{ fontSize: 7 }}>min</Box>
      </Box>
    </Box>
  )
}

function TaskTitle({ text, task = null }) {
  return (
    <Typography component="div" dir="auto" sx={{ ...titleStyles(task), color: task?.completed ? 'text.disabled' : 'text.primary' }}>
      {text}
    </Typography>
  )
}

function titleStyles(task) {
  return {
    display: 'block',
    width: '100%',
    px: 0.5,
    py: 0.7,
    overflowWrap: 'anywhere',
    color: task?.completed ? 'text.disabled' : 'text.primary',
    fontSize: '0.875rem',
    lineHeight: 1.75,
    fontWeight: 400,
    textAlign: 'right',
    textDecoration: task?.completed ? 'line-through' : 'none',
    textTransform: 'none',
  }
}
