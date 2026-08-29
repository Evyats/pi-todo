import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Box from '@mui/material/Box'
import { playCompletionSound } from '../completionSound'
import { TaskEditorDialog } from './TaskEditorDialog'
import { TaskRowView } from './TaskRowView'

export function TaskItem({
  task,
  collapsing,
  dragMode = 'reorder',
  hideDivider = false,
  celebrating = false,
  celebrationDelay = 0,
  children,
  soundEnabled,
  soundStyle,
  onUpdate,
  onDelete,
  onComplete,
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const optimistic = task.optimistic === true
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
    disabled: optimistic || task.completed,
    data: { task },
  })

  async function save(event) {
    event?.preventDefault()
    event?.stopPropagation()
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
    } else if (onComplete) {
      await onComplete(task)
    } else {
      if (soundEnabled) playCompletionSound(soundStyle)
      await onUpdate(task.id, { completed: true })
    }
  }

  return (
    <Box
      ref={setNodeRef}
      sx={{
        position: 'relative',
        zIndex: isDragging ? 1 : 'auto',
        opacity: isDragging || collapsing ? 0 : optimistic ? 0.62 : 1,
        transform: dragMode === 'reorder' ? CSS.Transform.toString(transform) : undefined,
        transition: [transition, 'opacity 120ms ease'].filter(Boolean).join(', '),
      }}
    >
      <TaskRowView
        task={task}
        editing={editing}
        title={title}
        optimistic={optimistic}
        collapsing={collapsing}
        isDragging={isDragging}
        hideDivider={hideDivider}
        celebrating={celebrating}
        celebrationDelay={celebrationDelay}
        activatorRef={setActivatorNodeRef}
        dragAttributes={attributes}
        dragListeners={listeners}
        onStartEditing={() => {
          setTitle(task.title)
          setEditing(true)
        }}
        onToggleCompleted={toggleCompleted}
        onDelete={() => onDelete(task.id)}
      >
        {children}
      </TaskRowView>
      <TaskEditorDialog
        open={editing && !task.completed && task.recurring_task_id === null}
        title={title}
        onTitleChange={setTitle}
        onSave={save}
        onCancel={cancel}
      />
    </Box>
  )
}

export function StaticTaskItem({ task, hideDivider = false, children }) {
  return (
    <Box>
      <TaskRowView task={task} interactive={false} hideDivider={hideDivider}>
        {children}
      </TaskRowView>
    </Box>
  )
}
