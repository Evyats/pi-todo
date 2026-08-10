import { useEffect, useState } from 'react'

const API = '/api/tasks'

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

  return (
    <li className={`task ${task.completed ? 'completed' : ''}`}>
      <button
        className="check"
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        onClick={() => onUpdate(task.id, { completed: !task.completed })}
      >
        {task.completed ? '✓' : ''}
      </button>

      {editing ? (
        <form className="edit-form" onSubmit={save}>
          <input
            autoFocus
            maxLength="300"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={save}
          />
        </form>
      ) : (
        <button className="task-title" onClick={() => setEditing(true)}>
          {task.title}
        </button>
      )}

      <button className="delete" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}>
        ×
      </button>
    </li>
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

  const remaining = tasks.filter((task) => !task.completed).length

  return (
    <main className="app">
      <header>
        <p className="eyebrow">MY DAY</p>
        <h1>Tasks</h1>
        <p className="summary">{remaining} {remaining === 1 ? 'task' : 'tasks'} remaining</p>
      </header>

      <form className="add-form" onSubmit={addTask}>
        <span aria-hidden="true">+</span>
        <input
          aria-label="New task title"
          maxLength="300"
          placeholder="Add a task"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
        />
        <button disabled={!newTitle.trim()}>Add</button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {loading ? (
        <p className="empty">Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="empty">
          <span>✓</span>
          <p>Nothing to do yet.</p>
        </div>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} onUpdate={updateTask} onDelete={deleteTask} />
          ))}
        </ul>
      )}
    </main>
  )
}

