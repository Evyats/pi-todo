import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import List from '@mui/material/List'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTaskCompletion } from '../hooks/useTaskCompletion'
import { InlineTaskComposer } from './InlineTaskComposer'
import { TaskItem } from './TaskItem'
import { CompletedSection, TaskTree } from './TaskTree'

export function ActiveTaskPanel({ data, drag, actions, ui, unassignedOpen }) {
  const {
    pending, main, completed, childrenByParent,
  } = data
  const {
    error, setError, loading, completedOpen, setCompletedOpen,
    completionSound, completionSoundStyle, taskDraftOpen, newTitle,
    setNewTitle, suggestions,
  } = ui
  const { mainListRef, state: dragState } = drag
  const completion = useTaskCompletion({
    childrenByParent,
    soundEnabled: completionSound,
    soundStyle: completionSoundStyle,
    updateTask: actions.updateTask,
  })

  const renderTask = (task, options = {}) => (
    <TaskItem
      key={task.id}
      task={task}
      collapsing={task.id === dragState.collapsingTaskId}
      dragMode={dragState.mode}
      hideDivider={options.hideDivider}
      celebrating={completion.wave.has(task.id)}
      celebrationDelay={completion.wave.get(task.id) ?? 0}
      soundEnabled={completionSound}
      soundStyle={completionSoundStyle}
      onUpdate={actions.updateTask}
      onDelete={actions.deleteTask}
      onComplete={completion.completeTask}
    >
      {options.children}
    </TaskItem>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, px: 0.5 }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 7 }}>
          <CircularProgress size={30} />
        </Box>
      ) : pending.length === 0 && !taskDraftOpen ? (
        <Stack spacing={1.5} sx={{ alignItems: 'center', py: 7, color: 'text.secondary', WebkitUserSelect: 'none', userSelect: 'none' }}>
          <CheckCircleOutlineRoundedIcon sx={{ fontSize: 52, color: 'action.disabled' }} />
          <Typography>{unassignedOpen ? 'No unassigned tasks.' : 'Nothing planned for this day.'}</Typography>
        </Stack>
      ) : (
        <Box ref={mainListRef} sx={{ px: { xs: 0.5, sm: 1 }, bgcolor: 'transparent' }}>
          {taskDraftOpen && (
            <List disablePadding>
              <InlineTaskComposer
                title={newTitle}
                suggestions={suggestions}
                onTitleChange={setNewTitle}
                onAdd={actions.addTask}
                onAddDivider={actions.addDivider}
                onCancel={actions.cancelTaskDraft}
              />
            </List>
          )}
          <TaskTree
            mainTasks={main}
            childrenByParent={childrenByParent}
            nestingTargetId={dragState.nestingTargetId}
            sortable
            renderTask={renderTask}
          />
        </Box>
      )}
      <CompletedSection
        tasks={completed}
        open={completedOpen}
        onToggle={() => setCompletedOpen((current) => !current)}
        renderTask={(task) => (
          <TaskItem
            key={task.id}
            task={task}
            collapsing={false}
            soundEnabled={completionSound}
            soundStyle={completionSoundStyle}
            onUpdate={actions.updateTask}
            onDelete={actions.deleteTask}
          />
        )}
      />
      <Box aria-hidden sx={{ height: { xs: 72, sm: 88 }, flexShrink: 0 }} />
    </Box>
  )
}
