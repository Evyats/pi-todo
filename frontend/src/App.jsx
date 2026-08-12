import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { keyframes } from '@emotion/react'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import HorizontalRuleRoundedIcon from '@mui/icons-material/HorizontalRuleRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Fab from '@mui/material/Fab'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Radio from '@mui/material/Radio'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const API = '/todo/api/tasks'
const SUGGESTIONS_API = '/todo/api/suggestions'
const RECURRING_API = '/todo/api/recurring-tasks'
const SOUND_OPTIONS = [
  ['glass-clink', 'Glass clink'],
  ['soft-bell', 'Soft bell'],
  ['coin-pickup', 'Coin pickup'],
  ['digital-success', 'Digital success'],
  ['crystal-sparkle', 'Crystal sparkle'],
  ['soft-marimba', 'Soft marimba'],
]
const SOUND_OPTION_VALUES = new Set(SOUND_OPTIONS.map(([value]) => value))

const checkBounce = keyframes`
  0% { transform: scale(1); }
  45% { transform: scale(1.45); }
  75% { transform: scale(.9); }
  100% { transform: scale(1); }
`
const completionRing = keyframes`
  from { transform: scale(.45); opacity: .9; }
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

function playCompletionSound(style = 'glass-clink') {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  const context = new AudioContext()
  const presets = {
    'glass-clink': [[1350, 0, .16, 'sine'], [1900, .035, .2, 'sine']],
    'soft-bell': [[660, 0, .42, 'sine'], [990, .04, .36, 'sine']],
    'coin-pickup': [[880, 0, .1, 'square'], [1320, .065, .11, 'square'], [1760, .13, .14, 'sine']],
    'digital-success': [[523, 0, .12, 'sine'], [659, .075, .13, 'sine'], [784, .15, .18, 'sine']],
    'crystal-sparkle': [[1760, 0, .14, 'sine'], [2349, .055, .15, 'sine'], [2093, .12, .2, 'sine']],
    'soft-marimba': [[440, 0, .2, 'sine'], [880, 0, .11, 'sine']],
  }
  const notes = presets[style] || presets['glass-clink']
  let finishAt = 0
  notes.forEach(([frequency, delay, duration, type, endFrequency]) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        context.currentTime + delay + duration,
      )
    }
    oscillator.connect(gain)
    gain.connect(context.destination)
    const startsAt = context.currentTime + delay
    gain.gain.setValueAtTime(0.0001, startsAt)
    gain.gain.exponentialRampToValueAtTime(0.11, startsAt + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration)
    oscillator.start(startsAt)
    oscillator.stop(startsAt + duration)
    finishAt = Math.max(finishAt, delay + duration)
  })
  window.setTimeout(() => context.close(), (finishAt + 0.15) * 1000)
}

function dateKey(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function upcomingDays(today) {
  const start = new Date(`${today}T12:00:00`)
  return Array.from({ length: 5 }, (_, offset) => {
    const value = new Date(start)
    value.setDate(start.getDate() + offset)
    return {
      key: dateKey(value),
      weekday: value.toLocaleDateString(undefined, { weekday: 'short' }),
      day: value.getDate(),
    }
  })
}

function taskOrDayCollision(args, dragMode) {
  const collisionsUnderPointer = pointerWithin(args)
  const dayUnderPointer = collisionsUnderPointer.find((collision) =>
    String(collision.id).startsWith('day:'),
  )
  if (dayUnderPointer && dragMode !== 'reorder') return [dayUnderPointer]

  const activeTask = args.active.data.current?.task
  if (activeTask && activeTask.parent_task_id !== null) {
    const siblingUnderPointer = collisionsUnderPointer.find((collision) =>
      args.droppableContainers
        .find((container) => container.id === collision.id)
        ?.data.current?.task?.parent_task_id
        === activeTask.parent_task_id,
    )
    return siblingUnderPointer ? [siblingUnderPointer] : []
  }

  if (dragMode === 'nest') {
    const taskUnderPointer = collisionsUnderPointer.find((collision) =>
      typeof collision.id === 'number',
    )
    return taskUnderPointer ? [taskUnderPointer] : []
  }

  const siblingContainers = args.droppableContainers.filter(
    (container) => !String(container.id).startsWith('day:')
      && container.data.current?.task?.parent_task_id
        === args.active.data.current?.task?.parent_task_id,
  )
  const measuredSiblings = siblingContainers
    .filter((container) => container.rect.current)
    .sort((first, second) => first.rect.current.top - second.rect.current.top)
  const pointerY = args.pointerCoordinates?.y
    ?? args.collisionRect.top + (args.collisionRect.height / 2)

  if (measuredSiblings.length > 0) {
    const first = measuredSiblings[0]
    const last = measuredSiblings[measuredSiblings.length - 1]
    if (pointerY < first.rect.current.top) {
      return closestCenter({ ...args, droppableContainers: [first] })
    }
    if (pointerY > last.rect.current.bottom) {
      return closestCenter({ ...args, droppableContainers: [last] })
    }
  }

  return closestCenter({
    ...args,
    droppableContainers: siblingContainers,
  })
}

async function request(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || 'Something went wrong')
  }
  return response.status === 204 ? null : response.json()
}

function TaskItem({ task, collapsing, dragMode = 'reorder', hideDivider = false, children, soundEnabled, soundStyle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [celebrating, setCelebrating] = useState(false)
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: task.completed,
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
    setCelebrating(true)
    if (soundEnabled) playCompletionSound(soundStyle)
    await new Promise((resolve) => window.setTimeout(resolve, 340))
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
        <ListItem disableGutters sx={{ minHeight: 40, gap: { xs: 0.5, sm: 1.25 }, py: 0 }}>
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
          <Box sx={{ flex: 1, borderTop: 1, borderColor: 'divider' }} />
          <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0 }} />
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
        gap: { xs: 0.5, sm: 1.25 },
        py: collapsing ? 0 : 0.35,
        overflow: 'hidden',
        bgcolor: isDragging ? 'action.hover' : 'transparent',
        animation: celebrating ? `${completionPulse} 340ms ease-out` : 'none',
        transition: 'max-height 220ms ease, min-height 220ms ease, padding 220ms ease',
        borderBottom: collapsing ? 'none' : undefined,
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <IconButton
        ref={setActivatorNodeRef}
        data-no-day-swipe
        aria-label={`Move ${task.title}`}
        disabled={task.completed}
        {...attributes}
        {...listeners}
        sx={{ color: 'text.disabled', cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        {task.recurring_task_id === null ? <DragIndicatorRoundedIcon /> : <RepeatRoundedIcon />}
      </IconButton>

      <Box sx={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
        {celebrating && (
          <>
            <Box sx={{ position: 'absolute', inset: 8, border: 2, borderColor: 'success.main', borderRadius: '50%', animation: `${completionRing} 340ms ease-out forwards` }} />
            {[[0, -25], [22, -13], [22, 13], [0, 25], [-22, 13], [-22, -13]].map(([x, y]) => (
              <Box
                key={`${x}-${y}`}
                sx={{
                  '--particle-x': `${x}px`,
                  '--particle-y': `${y}px`,
                  position: 'absolute',
                  top: 18,
                  left: 18,
                  width: 5,
                  height: 5,
                  bgcolor: 'success.main',
                  borderRadius: '50%',
                  animation: `${completionParticle} 320ms ease-out forwards`,
                }}
              />
            ))}
          </>
        )}
        <IconButton
          color={task.completed || celebrating ? 'success' : 'default'}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          disabled={celebrating}
          onClick={toggleCompleted}
          sx={{ animation: celebrating ? `${checkBounce} 340ms ease-out` : 'none' }}
        >
          {task.completed || celebrating ? <CheckCircleRoundedIcon /> : <RadioButtonUncheckedRoundedIcon />}
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
      {editing ? (
        <Box component="form" onSubmit={save}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            variant="standard"
            value={title}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => event.key === 'Escape' && cancel()}
          />
        </Box>
      ) : (
        <Button
          color="inherit"
          onClick={() => setEditing(true)}
          sx={{
            width: '100%',
            justifyContent: 'flex-start',
            px: 0.5,
            py: 0.7,
            overflowWrap: 'anywhere',
            color: task.completed ? 'text.disabled' : 'text.primary',
            fontWeight: 400,
            textAlign: 'left',
            textDecoration: task.completed ? 'line-through' : 'none',
            textTransform: 'none',
          }}
        >
          {task.title}
        </Button>
      )}
      {task.estimated_minutes && (
        <Box sx={{ px: 0.5, pb: 0.5 }}>
          <LinearProgress
            variant="determinate"
            value={(task.estimated_minutes / 120) * 100}
            aria-label={`${task.estimated_minutes} minute estimate`}
            sx={{ height: 5, borderRadius: 99 }}
          />
        </Box>
      )}
      </Box>

      {task.completed && task.recurring_task_id === null && (
        <IconButton color="error" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}>
          <DeleteOutlineRoundedIcon />
        </IconButton>
      )}
      {(!task.completed || task.recurring_task_id !== null) && (
        <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0 }} />
      )}
    </ListItem>
    {children}
    </Box>
  )
}

function DayTab({ day, selected, onSelect }) {
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
        bgcolor: isOver ? 'primary.light' : 'transparent',
        boxShadow: isOver ? 3 : 0,
        transition: 'background-color 120ms ease, box-shadow 120ms ease',
        '@media (hover: hover) and (pointer: fine)': {
          '&:hover': {
            bgcolor: selected ? 'primary.dark' : 'action.hover',
          },
        },
      }}
    >
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

function DraggedTask({ task, leavingParent = false, removingDivider = false }) {
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

function TemplatesManager({ emptyText, suggestions, onAdd, onUpdate, onDelete }) {
  const [newTitle, setNewTitle] = useState('')
  const [newMinutes, setNewMinutes] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingMinutes, setEditingMinutes] = useState('')

  async function addSuggestion(event) {
    event.preventDefault()
    if (await onAdd(newTitle, newMinutes)) {
      setNewTitle('')
      setNewMinutes('')
    }
  }

  async function saveSuggestion(event) {
    event.preventDefault()
    if (await onUpdate(editingId, editingTitle, editingMinutes)) setEditingId(null)
  }

  return (
    <Box sx={{ px: 2, pb: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack component="form" direction="row" spacing={1} onSubmit={addSuggestion} sx={{ pt: 2, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="New suggestion"
            value={newTitle}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            onChange={(event) => setNewTitle(event.target.value)}
          />
          <TextField
            type="number"
            size="small"
            label="Minutes"
            value={newMinutes}
            slotProps={{ htmlInput: { min: 1, max: 120 } }}
            onChange={(event) => setNewMinutes(event.target.value === '' ? '' : Number(event.target.value))}
            sx={{ width: 105, flexShrink: 0 }}
          />
          <Button type="submit" variant="contained" disabled={!newTitle.trim() || (newMinutes !== '' && (newMinutes < 1 || newMinutes > 120))} aria-label="Add suggestion">
            +
          </Button>
        </Stack>

        {suggestions.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            {emptyText}
          </Typography>
        ) : (
          <List disablePadding>
            {suggestions.map((suggestion) => (
              <ListItem key={suggestion.id} disableGutters divider sx={{ gap: 1, '&:last-child': { borderBottom: 0 } }}>
                {editingId === suggestion.id ? (
                  <Box component="form" onSubmit={saveSuggestion} sx={{ display: 'flex', flex: 1, gap: 1 }}>
                    <TextField
                      autoFocus
                      fullWidth
                      size="small"
                      value={editingTitle}
                      slotProps={{ htmlInput: { maxLength: 300 } }}
                      onChange={(event) => setEditingTitle(event.target.value)}
                    />
                    <TextField
                      type="number"
                      size="small"
                      label="Minutes"
                      value={editingMinutes}
                      slotProps={{ htmlInput: { min: 1, max: 120 } }}
                      onChange={(event) => setEditingMinutes(event.target.value === '' ? '' : Number(event.target.value))}
                      sx={{ width: 105, flexShrink: 0 }}
                    />
                    <Button type="submit" disabled={!editingTitle.trim() || (editingMinutes !== '' && (editingMinutes < 1 || editingMinutes > 120))}>Save</Button>
                  </Box>
                ) : (
                  <Button
                    color="inherit"
                    onClick={() => {
                      setEditingId(suggestion.id)
                      setEditingTitle(suggestion.title)
                      setEditingMinutes(suggestion.estimated_minutes ?? '')
                    }}
                    sx={{ flex: 1, justifyContent: 'flex-start', textTransform: 'none' }}
                  >
                    <Box sx={{ width: '100%', textAlign: 'left' }}>
                      {suggestion.title}
                      {suggestion.estimated_minutes && (
                        <LinearProgress
                          variant="determinate"
                          value={(suggestion.estimated_minutes / 120) * 100}
                          aria-label={`${suggestion.estimated_minutes} minute estimate`}
                          sx={{ height: 5, mt: 0.75, borderRadius: 99 }}
                        />
                      )}
                    </Box>
                  </Button>
                )}
                <IconButton
                  color="error"
                  aria-label={`Delete suggestion ${suggestion.title}`}
                  onClick={() => onDelete(suggestion.id)}
                >
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </ListItem>
            ))}
          </List>
        )}
    </Box>
  )
}

function SettingsSection({ title, expanded, onToggle, children }) {
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Button
        color="inherit"
        fullWidth
        onClick={onToggle}
        aria-expanded={expanded}
        sx={{ justifyContent: 'space-between', px: 2, py: 1.25, textTransform: 'none' }}
      >
        {title}
        <ExpandMoreRoundedIcon
          sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}
        />
      </Button>
      <Collapse in={expanded}>{children}</Collapse>
    </Paper>
  )
}

export default function App({ mode, onToggleMode }) {
  const [today, setToday] = useState(() => dateKey())
  const [selectedDate, setSelectedDate] = useState(() => dateKey())
  const [tasks, setTasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [recurringTasks, setRecurringTasks] = useState([])
  const [settingsSection, setSettingsSection] = useState(null)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [screen, setScreen] = useState('tasks')
  const [completionSound, setCompletionSound] = useState(() => (
    localStorage.getItem('pi-todo-completion-sound') !== 'false'
  ))
  const [completionSoundStyle, setCompletionSoundStyle] = useState(() => (
    SOUND_OPTION_VALUES.has(localStorage.getItem('pi-todo-completion-sound-style'))
      ? localStorage.getItem('pi-todo-completion-sound-style')
      : 'glass-clink'
  ))
  const [taskComposerOpen, setTaskComposerOpen] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const [pagerWidth, setPagerWidth] = useState(1)
  const swipeXRef = useRef(0)
  const [swipeAnimating, setSwipeAnimating] = useState(false)
  const swipeStartRef = useRef(null)
  const swipePagerRef = useRef(null)
  const [nestingTargetId, setNestingTargetId] = useState(null)
  const nestingTargetRef = useRef(null)
  const [dragMode, setDragMode] = useState('reorder')
  const dragModeRef = useRef('reorder')
  const [leavingParent, setLeavingParent] = useState(false)
  const [removingDivider, setRemovingDivider] = useState(false)
  const removingDividerRef = useRef(false)
  const pointerStartRef = useRef(null)
  const mainListRef = useRef(null)
  const boundaryPositionRef = useRef(null)
  const dragStartTasksRef = useRef(null)
  const composerScrollYRef = useRef(0)
  const [draggedTask, setDraggedTask] = useState(null)
  const [collapsingTaskId, setCollapsingTaskId] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const days = useMemo(() => upcomingDays(today), [today])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentDate = dateKey()
      if (currentDate !== today) {
        setLoading(true)
        setToday(currentDate)
        setSelectedDate(currentDate)
      }
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [today])

  useEffect(() => {
    request(`${API}?scheduled_date=${selectedDate}`)
      .then(setTasks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedDate])

  useEffect(() => {
    request(SUGGESTIONS_API)
      .then(setSuggestions)
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!taskComposerOpen) return undefined
    const preserveScroll = () => window.scrollTo({ top: composerScrollYRef.current })
    window.visualViewport?.addEventListener('resize', preserveScroll)
    return () => window.visualViewport?.removeEventListener('resize', preserveScroll)
  }, [taskComposerOpen])

  useEffect(() => {
    localStorage.setItem('pi-todo-completion-sound', String(completionSound))
  }, [completionSound])

  useEffect(() => {
    localStorage.setItem('pi-todo-completion-sound-style', completionSoundStyle)
  }, [completionSoundStyle])

  useEffect(() => {
    const handleHistoryChange = () => {
      setScreen(window.history.state?.todoScreen === 'settings' ? 'settings' : 'tasks')
    }
    window.addEventListener('popstate', handleHistoryChange)
    return () => window.removeEventListener('popstate', handleHistoryChange)
  }, [])

  useEffect(() => {
    request(RECURRING_API)
      .then(setRecurringTasks)
      .catch((err) => setError(err.message))
  }, [])

  function selectDate(value) {
    if (value === selectedDate) return
    setLoading(true)
    setCompletedOpen(false)
    setSelectedDate(value)
  }

  function openSettings() {
    window.history.pushState({ ...window.history.state, todoScreen: 'settings' }, '')
    setScreen('settings')
  }

  function closeSettings() {
    if (window.history.state?.todoScreen === 'settings') {
      window.history.back()
    } else {
      setScreen('tasks')
    }
  }

  function startDaySwipe(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target.closest('input, textarea, [data-no-day-swipe]')) return
    setPagerWidth(swipePagerRef.current?.clientWidth || 1)
    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      pointerId: event.pointerId,
      horizontal: false,
    }
  }

  function moveDaySwipe(event) {
    const start = swipeStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (!start.horizontal) {
      if (Math.abs(deltaX) < 8) return
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        swipeStartRef.current = null
        return
      }
      start.horizontal = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    event.preventDefault()
    const currentIndex = days.findIndex((day) => day.key === selectedDate)
    const blocked = (currentIndex === 0 && deltaX > 0)
      || (currentIndex === days.length - 1 && deltaX < 0)
    const nextX = blocked ? deltaX * 0.18 : deltaX
    swipeXRef.current = nextX
    setSwipeX(nextX)
  }

  function finishDaySwipe(event) {
    const start = swipeStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    swipeStartRef.current = null
    if (!start.horizontal) return
    const width = swipePagerRef.current?.clientWidth || 1
    const elapsed = Math.max(performance.now() - start.time, 1)
    const currentSwipeX = swipeXRef.current
    const velocity = currentSwipeX / elapsed
    const direction = currentSwipeX < 0 ? 1 : -1
    const currentIndex = days.findIndex((day) => day.key === selectedDate)
    const targetIndex = currentIndex + direction
    const shouldChange = targetIndex >= 0
      && targetIndex < days.length
      && (Math.abs(currentSwipeX) > width * 0.22 || Math.abs(velocity) > 0.45)

    setSwipeAnimating(true)
    if (shouldChange) {
      setSwipeX(direction === 1 ? -width : width)
      swipeXRef.current = direction === 1 ? -width : width
      window.setTimeout(() => {
        selectDate(days[targetIndex].key)
        setSwipeAnimating(false)
        swipeXRef.current = 0
        setSwipeX(0)
      }, 120)
    } else {
      setSwipeX(0)
      swipeXRef.current = 0
      window.setTimeout(() => setSwipeAnimating(false), 120)
    }
  }

  function openTaskComposer() {
    composerScrollYRef.current = window.scrollY
    setTaskComposerOpen(true)
  }

  function focusTaskComposer(dialogElement) {
    const input = dialogElement.querySelector('input')
    input?.focus({ preventScroll: true })
    window.scrollTo({ top: composerScrollYRef.current })
    window.setTimeout(() => window.scrollTo({ top: composerScrollYRef.current }), 250)
  }

  async function addTask(event, suggestion = null) {
    event?.preventDefault()
    const title = (suggestion?.title ?? newTitle).trim()
    if (!title) return
    try {
      const task = await request(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          scheduled_date: selectedDate,
          suggestion_id: suggestion?.id ?? null,
        }),
      })
      setTasks((current) => [task, ...current])
      setNewTitle('')
      setTaskComposerOpen(false)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function addDivider() {
    try {
      const divider = await request(`${API}/divider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: selectedDate }),
      })
      setTasks((current) => [divider, ...current])
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function addSuggestion(title, estimatedMinutes) {
    const cleanTitle = title.trim()
    if (!cleanTitle) return false
    try {
      const suggestion = await request(SUGGESTIONS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          estimated_minutes: estimatedMinutes === '' ? null : estimatedMinutes,
        }),
      })
      setSuggestions((current) => [...current, suggestion].sort((a, b) => a.title.localeCompare(b.title)))
      setError('')
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  async function updateSuggestion(id, title, estimatedMinutes) {
    const cleanTitle = title.trim()
    if (!cleanTitle) return false
    try {
      const updated = await request(`${SUGGESTIONS_API}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          estimated_minutes: estimatedMinutes === '' ? null : estimatedMinutes,
        }),
      })
      setSuggestions((current) => current
        .map((suggestion) => (suggestion.id === id ? updated : suggestion))
        .sort((a, b) => a.title.localeCompare(b.title)))
      setError('')
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  async function deleteSuggestion(id) {
    try {
      await request(`${SUGGESTIONS_API}/${id}`, { method: 'DELETE' })
      setSuggestions((current) => current.filter((suggestion) => suggestion.id !== id))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function addRecurringTask(title, estimatedMinutes) {
    const cleanTitle = title.trim()
    if (!cleanTitle) return false
    try {
      const recurringTask = await request(RECURRING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          estimated_minutes: estimatedMinutes === '' ? null : estimatedMinutes,
        }),
      })
      setRecurringTasks((current) => [...current, recurringTask].sort((a, b) => a.title.localeCompare(b.title)))
      if (selectedDate === today) {
        request(`${API}?scheduled_date=${today}`).then(setTasks).catch((err) => setError(err.message))
      }
      setError('')
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  async function updateRecurringTask(id, title, estimatedMinutes) {
    const cleanTitle = title.trim()
    if (!cleanTitle) return false
    try {
      const updated = await request(`${RECURRING_API}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          estimated_minutes: estimatedMinutes === '' ? null : estimatedMinutes,
        }),
      })
      setRecurringTasks((current) => current
        .map((item) => (item.id === id ? updated : item))
        .sort((a, b) => a.title.localeCompare(b.title)))
      setError('')
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  async function deleteRecurringTask(id) {
    try {
      await request(`${RECURRING_API}/${id}`, { method: 'DELETE' })
      setRecurringTasks((current) => current.filter((item) => item.id !== id))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function updateTask(id, changes) {
    try {
      const updated = await request(`${API}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      setTasks((current) => current.map((task) => {
        if (task.id === id) return updated
        if (changes.completed === true && task.parent_task_id === id) {
          return { ...task, completed: true, parent_task_id: null }
        }
        return task
      }))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteTask(id) {
    try {
      await request(`${API}/${id}`, { method: 'DELETE' })
      setTasks((current) => current
        .filter((task) => task.id !== id)
        .map((task) => task.parent_task_id === id ? { ...task, parent_task_id: null } : task))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    const armedParentId = nestingTargetRef.current
    nestingTargetRef.current = null
    setNestingTargetId(null)
    dragModeRef.current = 'reorder'
    setDragMode('reorder')
    setLeavingParent(false)
    setDraggedTask(null)
    const activeTask = tasks.find((task) => task.id === active.id)
    if (!activeTask) return
    if (activeTask.is_divider && removingDividerRef.current) {
      removingDividerRef.current = false
      setRemovingDivider(false)
      await deleteTask(activeTask.id)
      return
    }
    removingDividerRef.current = false
    setRemovingDivider(false)
    const boundaryPosition = boundaryPositionRef.current
    const tasksBeforeDrag = dragStartTasksRef.current
    boundaryPositionRef.current = null
    dragStartTasksRef.current = null
    if (boundaryPosition && activeTask.parent_task_id === null && !activeTask.is_divider) {
      const group = tasks.filter((task) => !task.completed && task.parent_task_id === null)
      try {
        await request(`${API}/order`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_ids: group.map((task) => task.id),
            scheduled_date: selectedDate,
            parent_task_id: null,
          }),
        })
        setError('')
      } catch (err) {
        if (tasksBeforeDrag) setTasks(tasksBeforeDrag)
        setError(err.message)
      }
      return
    }
    if (!over) {
      if (activeTask.parent_task_id !== null) await moveTaskToParent(activeTask.id, null)
      return
    }
    const overTask = tasks.find((task) => task.id === over.id)

    if (activeTask.parent_task_id === null && armedParentId !== null) {
      await moveTaskToParent(activeTask.id, armedParentId)
      return
    }

    if (activeTask.parent_task_id !== null) {
      if (!overTask || overTask.parent_task_id !== activeTask.parent_task_id) {
        await moveTaskToParent(activeTask.id, null)
        return
      }
    }

    const overId = String(over.id)
    if (overId.startsWith('day:')) {
      const targetDate = overId.slice(4)
      if (targetDate === selectedDate) return
      if (activeTask.recurring_task_id !== null) {
        setError('Recurring tasks cannot be moved to another day')
        return
      }
      if (activeTask.is_divider) {
        setError('Dividers cannot be moved to another day')
        return
      }
      const previous = tasks
      setCollapsingTaskId(active.id)
      const collapseTimer = window.setTimeout(() => {
        setTasks((current) => current.filter((task) => task.id !== active.id))
        setCollapsingTaskId(null)
      }, 220)
      try {
        await request(`${API}/${active.id}/schedule`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduled_date: targetDate }),
        })
        setError('')
      } catch (err) {
        window.clearTimeout(collapseTimer)
        setTasks(previous)
        setCollapsingTaskId(null)
        setError(err.message)
      }
      return
    }

    if (!overTask || active.id === over.id) return
    if (overTask.parent_task_id !== activeTask.parent_task_id) return

    const group = pendingTasks.filter(
      (task) => task.parent_task_id === activeTask.parent_task_id,
    )
    const oldIndex = group.findIndex((task) => task.id === active.id)
    const newIndex = group.findIndex((task) => task.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const previous = tasks
    const reorderedGroup = arrayMove(group, oldIndex, newIndex)
    const groupIds = new Set(group.map((task) => task.id))
    let groupPosition = 0
    const reordered = tasks.map((task) => (
      groupIds.has(task.id) ? reorderedGroup[groupPosition++] : task
    ))
    setTasks(reordered)

    try {
      await request(`${API}/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_ids: reorderedGroup.map((task) => task.id),
          scheduled_date: selectedDate,
          parent_task_id: activeTask.parent_task_id,
        }),
      })
      setError('')
    } catch (err) {
      setTasks(previous)
      setError(err.message)
    }
  }

  function handleDragOver({ active, over }) {
    const activeTask = tasks.find((task) => task.id === active.id)
    if (!activeTask || activeTask.parent_task_id !== null || dragModeRef.current !== 'nest') {
      nestingTargetRef.current = null
      setNestingTargetId(null)
      return
    }
    const overTask = tasks.find((task) => task.id === over?.id)
    const candidateId = overTask?.parent_task_id ?? overTask?.id ?? null
    const candidate = tasks.find((task) => task.id === candidateId)
    const hasChildren = tasks.some((task) => task.parent_task_id === active.id)
    const validCandidate = candidateId !== null
      && candidateId !== active.id
      && candidateId !== activeTask?.parent_task_id
      && candidate?.recurring_task_id === null
      && candidate?.is_divider === false
      && activeTask?.is_divider === false
      && !hasChildren

    if (!validCandidate) {
      nestingTargetRef.current = null
      setNestingTargetId(null)
      return
    }
    nestingTargetRef.current = candidateId
    setNestingTargetId(candidateId)
  }

  function handleDragMove({ active, delta, over }) {
    const activeTask = tasks.find((task) => task.id === active.id)
    const activeTaskHasChildren = tasks.some((task) => task.parent_task_id === active.id)
    if (activeTask?.parent_task_id === null && pointerStartRef.current && mainListRef.current) {
      const pointerY = pointerStartRef.current.y + delta.y
      const listBounds = mainListRef.current.getBoundingClientRect()
      const boundaryPosition = pointerY < listBounds.top
        ? 'first'
        : pointerY > listBounds.bottom
          ? 'last'
          : null
      if (boundaryPosition && boundaryPosition !== boundaryPositionRef.current && !activeTask.is_divider) {
        setTasks((current) => {
          const group = current.filter((task) => !task.completed && task.parent_task_id === null)
          const currentIndex = group.findIndex((task) => task.id === active.id)
          const targetIndex = boundaryPosition === 'first' ? 0 : group.length - 1
          if (currentIndex < 0 || currentIndex === targetIndex) return current
          const movedGroup = arrayMove(group, currentIndex, targetIndex)
          const groupIds = new Set(group.map((task) => task.id))
          let position = 0
          return current.map((task) => groupIds.has(task.id) ? movedGroup[position++] : task)
        })
      }
      boundaryPositionRef.current = boundaryPosition
    }
    if (activeTask?.is_divider && pointerStartRef.current && mainListRef.current) {
      const pointerY = pointerStartRef.current.y + delta.y
      const listBounds = mainListRef.current.getBoundingClientRect()
      const outsideList = pointerY < listBounds.top || pointerY > listBounds.bottom
      removingDividerRef.current = outsideList
      setRemovingDivider(outsideList)
    } else if (removingDividerRef.current) {
      removingDividerRef.current = false
      setRemovingDivider(false)
    }
    if (activeTask && activeTask.parent_task_id !== null) {
      const overTask = tasks.find((task) => task.id === over?.id)
      setLeavingParent(overTask?.parent_task_id !== activeTask.parent_task_id)
    } else {
      setLeavingParent(false)
    }
    const nextMode = activeTask?.parent_task_id === null
      && !activeTaskHasChildren
      && activeTask?.is_divider === false
      && delta.x > 48
      ? 'nest'
      : 'reorder'
    if (nextMode === dragModeRef.current) return
    dragModeRef.current = nextMode
    setDragMode(nextMode)
    nestingTargetRef.current = null
    setNestingTargetId(null)
  }

  async function moveTaskToParent(taskId, parentTaskId) {
    const previous = tasks
    setTasks((current) => {
      const task = current.find((item) => item.id === taskId)
      if (!task) return current
      return [
        ...current.filter((item) => item.id !== taskId),
        { ...task, parent_task_id: parentTaskId },
      ]
    })
    try {
      const updated = await request(`${API}/${taskId}/parent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_task_id: parentTaskId }),
      })
      setTasks((current) => current.map((task) => task.id === taskId ? updated : task))
      setError('')
    } catch (err) {
      setTasks(previous)
      setError(err.message)
    }
  }

  const pendingTasks = tasks.filter((task) => !task.completed)
  const completedTasks = tasks.filter((task) => task.completed)
  const mainTasks = pendingTasks.filter((task) => task.parent_task_id === null)
  const completed = completedTasks.length
  const selectedDayIndex = days.findIndex((day) => day.key === selectedDate)
  const indicatorPosition = Math.max(
    0,
    Math.min(days.length - 1, selectedDayIndex - (swipeX / pagerWidth)),
  )

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 }, overflowX: 'hidden' }}>
      {screen === 'settings' ? (
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton aria-label="Back to tasks" onClick={closeSettings}>
              <ArrowBackRoundedIcon />
            </IconButton>
            <Typography variant="h2" sx={{ fontSize: { xs: 30, sm: 36 }, fontWeight: 750, letterSpacing: '-.035em' }}>
              Settings
            </Typography>
          </Box>

          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Button
              color="inherit"
              fullWidth
              onClick={onToggleMode}
              sx={{ justifyContent: 'space-between', px: 2, py: 1.5, borderRadius: 0, textTransform: 'none' }}
            >
              Dark mode
              {mode === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
            </Button>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.75, borderTop: 1, borderColor: 'divider' }}>
              <Typography>Completion sound</Typography>
              <Switch
                checked={completionSound}
                onChange={(event) => setCompletionSound(event.target.checked)}
                slotProps={{ input: { 'aria-label': 'Completion sound' } }}
              />
            </Box>
          </Paper>

          <SettingsSection
            title="Sound style"
            expanded={settingsSection === 'sound'}
            onToggle={() => setSettingsSection((current) => current === 'sound' ? null : 'sound')}
          >
            <List disablePadding sx={{ borderTop: 1, borderColor: 'divider' }}>
              {SOUND_OPTIONS.map(([value, label]) => (
                <ListItem key={value} divider sx={{ py: 0.35, '&:last-child': { borderBottom: 0 } }}>
                  <Radio
                    checked={completionSoundStyle === value}
                    onChange={() => setCompletionSoundStyle(value)}
                    value={value}
                    name="completion-sound-style"
                    slotProps={{ input: { 'aria-label': `Choose ${label}` } }}
                  />
                  <Typography sx={{ flex: 1 }}>{label}</Typography>
                  <IconButton aria-label={`Preview ${label}`} onClick={() => playCompletionSound(value)}>
                    <VolumeUpRoundedIcon />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          </SettingsSection>

          <SettingsSection
            title="Suggestions"
            expanded={settingsSection === 'suggestions'}
            onToggle={() => setSettingsSection((current) => current === 'suggestions' ? null : 'suggestions')}
          >
            <TemplatesManager
              emptyText="No suggestions yet."
              suggestions={suggestions}
              onAdd={addSuggestion}
              onUpdate={updateSuggestion}
              onDelete={deleteSuggestion}
            />
          </SettingsSection>

          <SettingsSection
            title="Recurring tasks"
            expanded={settingsSection === 'recurring'}
            onToggle={() => setSettingsSection((current) => current === 'recurring' ? null : 'recurring')}
          >
            <TemplatesManager
              emptyText="No recurring tasks yet."
              suggestions={recurringTasks}
              onAdd={addRecurringTask}
              onUpdate={updateRecurringTask}
              onDelete={deleteRecurringTask}
            />
          </SettingsSection>
        </Stack>
      ) : (
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="h2" sx={{ fontSize: { xs: 30, sm: 36 }, fontWeight: 750, letterSpacing: '-.035em' }}>
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
            if (dragStartTasksRef.current) setTasks(dragStartTasksRef.current)
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
              {days.map((day, index) => (
                <DayTab key={day.key} day={day} selected={Math.round(indicatorPosition) === index} onSelect={selectDate} />
              ))}
            </Paper>

            <Box
              ref={swipePagerRef}
              onPointerDown={startDaySwipe}
              onPointerMove={moveDaySwipe}
              onPointerUp={finishDaySwipe}
              onPointerCancel={finishDaySwipe}
              sx={{
                touchAction: 'pan-y',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                minHeight: 'calc(100dvh - 210px)',
                transform: `translateX(${swipeX}px)`,
                transition: swipeAnimating ? 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
              }}
            >
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
                    const subtasks = pendingTasks.filter((item) => item.parent_task_id === task.id)
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
                          soundEnabled={completionSound}
                          soundStyle={completionSoundStyle}
                          onUpdate={updateTask}
                          onDelete={deleteTask}
                        >
                          {subtasks.length > 0 && (
                            <SortableContext items={subtasks.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                              <List disablePadding sx={{ ml: { xs: 4.5, sm: 6 }, pl: 1 }}>
                                {subtasks.map((subtask) => (
                                  <TaskItem
                                    key={subtask.id}
                                    task={subtask}
                                    collapsing={subtask.id === collapsingTaskId}
                                    dragMode={dragMode}
                                    soundEnabled={completionSound}
                                    soundStyle={completionSoundStyle}
                                    onUpdate={updateTask}
                                    onDelete={deleteTask}
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
      )}
      <Dialog
        open={taskComposerOpen}
        onClose={() => setTaskComposerOpen(false)}
        fullWidth
        maxWidth="xs"
        disableScrollLock
        slotProps={{ transition: { onEntered: focusTaskComposer } }}
        sx={{
          '& .MuiDialog-container': {
            alignItems: 'flex-start',
          },
          '& .MuiDialog-paper': {
            mt: { xs: 2, sm: 6 },
            maxHeight: 'calc(100dvh - 32px)',
          },
        }}
      >
        <DialogTitle>Add task</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={addTask} sx={{ display: 'flex', gap: 1, pt: 1 }}>
            <Autocomplete
              freeSolo
              autoHighlight
              fullWidth
              options={suggestions}
              inputValue={newTitle}
              getOptionLabel={(option) => typeof option === 'string' ? option : option.title}
              filterOptions={(options, state) => {
                const prefix = state.inputValue.trim().toLocaleLowerCase()
                if (!prefix) return []
                return options.filter((option) => option.title.toLocaleLowerCase().startsWith(prefix))
              }}
              onInputChange={(_, value) => setNewTitle(value)}
              onChange={(_, value) => {
                if (value && typeof value !== 'string') addTask(null, value)
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Task"
                  slotProps={{
                    ...params.slotProps,
                    htmlInput: { ...params.slotProps.htmlInput, maxLength: 300 },
                  }}
                />
              )}
            />
            <Fab type="submit" size="small" color="primary" disabled={!newTitle.trim()} aria-label="Save task" sx={{ mt: 0.75, flexShrink: 0 }}>
              <AddRoundedIcon />
            </Fab>
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  )
}
