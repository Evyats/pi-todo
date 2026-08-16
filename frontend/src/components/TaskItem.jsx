import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { keyframes } from '@emotion/react'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { playCompletionSound } from '../completionSound'

const checkBounce = keyframes`
  0% { transform: scale(1); }
  45% { transform: scale(1.45); }
  75% { transform: scale(.9); }
  100% { transform: scale(1); }
`
const subtleCompletionRing = keyframes`
  from { transform: scale(.55); opacity: .38; }
  to { transform: scale(2); opacity: 0; }
`
const completionParticle = keyframes`
  from { transform: translate(0, 0) scale(1); opacity: 1; }
  to { transform: translate(var(--particle-x), var(--particle-y)) scale(0); opacity: 0; }
`
const completionPulse = keyframes`
  0%, 100% { background-color: transparent; }
  45% { background-color: rgba(52, 168, 83, .13); }
`
function CompletionEffect() {
  return (
    <>
      <Box sx={{ position: 'absolute', inset: 8, border: 1.5, borderColor: 'success.main', borderRadius: '50%', animation: `${subtleCompletionRing} 340ms ease-out forwards` }} />
      <Box sx={{ position: 'absolute', inset: 8, border: 1, borderColor: 'success.light', borderRadius: '50%', animation: `${subtleCompletionRing} 300ms 70ms ease-out forwards` }} />
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


export function TaskItem({ task, collapsing, dragMode = 'reorder', hideDivider = false, preview = false, celebrating = false, celebrationDelay = 0, children, soundEnabled, soundStyle, onUpdate, onDelete, onComplete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const titleEditable = !task.completed && task.recurring_task_id === null
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: preview ? `preview:${task.id}` : task.id,
    disabled: task.completed || preview,
    data: { task },
  })

  async function save(event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      cancel()
      return
    }
    if (cleanTitle !== task.title) await onUpdate(task.id, { title: cleanTitle })
    setEditing(false)
  }

  function cancel() {
    setTitle(task.title)
    setEditing(false)
  }

  async function toggleCompleted() {
    if (task.completed) {
      await onUpdate(task.id, { completed: false })
      return
    }
    if (onComplete) {
      await onComplete(task)
      return
    }
    if (soundEnabled) playCompletionSound(soundStyle)
    await onUpdate(task.id, { completed: true })
  }

  if (task.is_divider) {
    return (
      <Box
        ref={setNodeRef}
        sx={{
          opacity: isDragging ? 0 : 1,
          transform: CSS.Transform.toString(transform),
          transition,
        }}
      >
        <ListItem disableGutters sx={{ minHeight: 40, gap: { xs: 0.15, sm: 0.5 }, py: 0 }}>
          <Box sx={{ flex: 1, borderTop: 1, borderColor: 'divider' }} />
          <IconButton
            ref={setActivatorNodeRef}
            data-no-day-swipe
            aria-label="Move divider"
            {...attributes}
            {...listeners}
            sx={{ color: 'text.disabled', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
          >
            <DragIndicatorRoundedIcon />
          </IconButton>
        </ListItem>
      </Box>
    )
  }

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'relative',
        zIndex: isDragging ? 1 : 'auto',
        opacity: isDragging || collapsing ? 0 : 1,
        transform: dragMode === 'reorder' ? CSS.Transform.toString(transform) : undefined,
        transition: [transition, 'opacity 120ms ease'].filter(Boolean).join(', '),
      }}
    >
    <ListItem
      divider={!hideDivider}
      disableGutters
      sx={{
        minHeight: collapsing ? 0 : 56,
        maxHeight: collapsing ? 0 : 500,
        gap: { xs: 0.15, sm: 0.5 },
        py: collapsing ? 0 : 0.35,
        overflow: 'hidden',
        borderRadius: celebrating ? 1.5 : 0,
        bgcolor: isDragging ? 'action.hover' : 'transparent',
        animation: celebrating ? `${completionPulse} 340ms ${celebrationDelay}ms ease-out both` : 'none',
        transition: 'max-height 220ms ease, min-height 220ms ease, padding 220ms ease',
        borderBottom: collapsing ? 'none' : undefined,
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {task.completed && task.recurring_task_id === null ? (
        <IconButton color="error" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}>
          <DeleteOutlineRoundedIcon />
        </IconButton>
      ) : task.estimated_minutes ? (
        <Box
          aria-label={`${task.estimated_minutes} minute estimate`}
          sx={{
            display: 'grid',
            width: 40,
            height: 40,
            flexShrink: 0,
            placeItems: 'center',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              width: 28,
              height: 28,
              placeItems: 'center',
              alignContent: 'center',
              gap: 0.2,
              borderRadius: 1.25,
              color: 'primary.contrastText',
              bgcolor: 'primary.main',
              fontWeight: 800,
              lineHeight: 1,
              opacity: 0.22 + ((task.estimated_minutes / 120) * 0.78),
            }}
          >
            <Box component="span" sx={{ fontSize: 11 }}>{task.estimated_minutes}</Box>
            <Box component="span" sx={{ fontSize: 7 }}>min</Box>
          </Box>
        </Box>
      ) : (
        <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0 }} />
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
      {editing && titleEditable ? (
        <Box component="form" onSubmit={save}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            variant="standard"
            value={title}
            slotProps={{ htmlInput: { maxLength: 300, dir: 'auto' } }}
            sx={{ '& input': { textAlign: 'right' } }}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => event.key === 'Escape' && cancel()}
          />
        </Box>
      ) : titleEditable ? (
        <Button
          color="inherit"
          dir="auto"
          onClick={() => setEditing(true)}
          sx={{
            display: 'block',
            width: '100%',
            px: 0.5,
            py: 0.7,
            overflowWrap: 'anywhere',
            color: task.completed ? 'text.disabled' : 'text.primary',
            fontSize: '0.875rem',
            lineHeight: 1.75,
            fontWeight: 400,
            textAlign: 'right',
            textDecoration: task.completed ? 'line-through' : 'none',
            textTransform: 'none',
          }}
        >
          {task.title}
        </Button>
      ) : (
        <Typography
          component="div"
          dir="auto"
          sx={{
            width: '100%',
            px: 0.5,
            py: 0.7,
            overflowWrap: 'anywhere',
            color: task.completed ? 'text.disabled' : 'text.primary',
            fontSize: '0.875rem',
            lineHeight: 1.75,
            fontWeight: 400,
            textAlign: 'right',
            textDecoration: task.completed ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </Typography>
      )}
      </Box>

      <Box sx={{ position: 'relative', width: 36, height: 40, flexShrink: 0 }}>
        {celebrating && <CompletionEffect />}
        <IconButton
          color={task.completed || celebrating ? 'success' : 'default'}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          disabled={celebrating}
          onClick={toggleCompleted}
          sx={{
            width: 36,
            height: 36,
            p: 0.75,
            animation: celebrating ? `${checkBounce} 340ms ${celebrationDelay}ms ease-out both` : 'none',
          }}
        >
          {task.completed || celebrating ? <CheckCircleOutlineRoundedIcon /> : <RadioButtonUncheckedRoundedIcon />}
        </IconButton>
      </Box>

      <IconButton
        ref={setActivatorNodeRef}
        data-no-day-swipe
        aria-label={`Move ${task.title}`}
        disabled={task.completed}
        {...attributes}
        {...listeners}
        sx={{ width: 36, height: 36, p: 0.75, color: 'text.disabled', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        {task.recurring_task_id === null ? <DragIndicatorRoundedIcon /> : <RepeatRoundedIcon />}
      </IconButton>
    </ListItem>
    {children}
    </Box>
  )
}

export function StaticTaskItem(props) {
  return <TaskItem {...props} preview />
}
