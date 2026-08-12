import { useEffect, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Container from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const API = '/todo/api/tasks'

async function request(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || 'Something went wrong')
  }
  return response.status === 204 ? null : response.json()
}

function TaskItem({ task, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)

  async function save(event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    await onUpdate(task.id, { title: cleanTitle })
    setEditing(false)
  }

  function cancel() {
    setTitle(task.title)
    setEditing(false)
  }

  return (
    <ListItem
      divider
      disableGutters
      sx={{ minHeight: 68, gap: 1.25, py: 1 }}
    >
      <IconButton
        color={task.completed ? 'primary' : 'default'}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        onClick={() => onUpdate(task.id, { completed: !task.completed })}
      >
        {task.completed ? <CheckCircleRoundedIcon /> : <RadioButtonUncheckedRoundedIcon />}
      </IconButton>

      {editing ? (
        <Box component="form" onSubmit={save} sx={{ flex: 1 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            variant="standard"
            value={title}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && cancel()}
          />
        </Box>
      ) : (
        <Button
          color="inherit"
          onClick={() => setEditing(true)}
          sx={{
            flex: 1,
            justifyContent: 'flex-start',
            px: 0.5,
            py: 1.25,
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

      <IconButton color="error" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}>
        <DeleteOutlineRoundedIcon />
      </IconButton>
    </ListItem>
  )
}
export default function App() {
  const [tasks, setTasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    request(API)
      .then(setTasks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function addTask(event) {
    event.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    try {
      const task = await request(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      setTasks((current) => [task, ...current])
      setNewTitle('')
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
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteTask(id) {
    try {
      await request(`${API}/${id}`, { method: 'DELETE' })
      setTasks((current) => current.filter((task) => task.id !== id))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function clearCompleted() {
    try {
      await request(`${API}/completed`, { method: 'DELETE' })
      setTasks((current) => current.filter((task) => !task.completed))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  const remaining = tasks.filter((task) => !task.completed).length
  const completed = tasks.length - remaining

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 8 } }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: '.14em' }}>
            My day
          </Typography>
          <Typography variant="h2" sx={{ fontSize: { xs: 40, sm: 52 }, fontWeight: 750, letterSpacing: '-.045em' }}>
            Tasks
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {remaining} {remaining === 1 ? 'task' : 'tasks'} remaining
          </Typography>
        </Box>

        <Paper component="form" onSubmit={addTask} elevation={0} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, pl: 2, border: 1, borderColor: 'divider', borderRadius: 3 }}>
          <AddRoundedIcon color="primary" />
          <TextField
            fullWidth
            variant="standard"
            placeholder="Add a task"
            aria-label="New task title"
            value={newTitle}
            slotProps={{ input: { disableUnderline: true }, htmlInput: { maxLength: 300 } }}
            onChange={(event) => setNewTitle(event.target.value)}
          />
          <Button type="submit" variant="contained" disableElevation disabled={!newTitle.trim()} sx={{ borderRadius: 2.25 }}>
            Add
          </Button>
        </Paper>

        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 7 }}><CircularProgress size={30} /></Box>
        ) : tasks.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, color: 'text.secondary' }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 52, color: 'action.disabled' }} />
            <Typography>Nothing to do yet.</Typography>
          </Stack>
        ) : (
          <Paper elevation={0} sx={{ px: 2, border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <List disablePadding>
              {tasks.map((task) => (
                <TaskItem key={task.id} task={task} onUpdate={updateTask} onDelete={deleteTask} />
              ))}
            </List>
          </Paper>
        )}

        {completed > 0 && (
          <Button color="inherit" onClick={clearCompleted} sx={{ alignSelf: 'flex-end', color: 'text.secondary' }}>
            Clear completed ({completed})
          </Button>
        )}
      </Stack>
    </Container>
  )
}
