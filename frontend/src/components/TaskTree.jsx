import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import List from '@mui/material/List'
import Paper from '@mui/material/Paper'

export function TaskTree({
  mainTasks,
  childrenByParent,
  nestingTargetId = null,
  sortable = false,
  renderTask,
}) {
  const content = (
    <List disablePadding>
      {mainTasks.map((task) => {
        const children = childrenByParent.get(task.id) ?? []
        const childList = children.length > 0 ? (
          <MaybeSortable sortable={sortable} taskIds={children.map((item) => item.id)}>
            <List disablePadding sx={{ mr: { xs: 4.5, sm: 5 } }}>
              {children.map((child) => renderTask(child, { hideDivider: false }))}
            </List>
          </MaybeSortable>
        ) : null
        return (
          <Box
            key={task.id}
            data-task-group-id={task.id}
            sx={{
              bgcolor: task.id === nestingTargetId ? 'action.selected' : 'transparent',
              borderRadius: 2,
              transition: 'background-color 120ms ease',
            }}
          >
            {renderTask(task, {
              children: childList,
              hideDivider: children.length > 0,
            })}
          </Box>
        )
      })}
    </List>
  )

  return (
    <MaybeSortable sortable={sortable} taskIds={mainTasks.map((task) => task.id)}>
      {content}
    </MaybeSortable>
  )
}

function MaybeSortable({ sortable, taskIds, children }) {
  return sortable ? (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  ) : children
}

export function CompletedSection({ tasks, open, onToggle, renderTask, interactive = true }) {
  if (tasks.length === 0) return null
  return (
    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: (theme) => theme.palette.mode === 'dark'
          ? 'rgba(20, 23, 30, .72)'
          : 'background.paper',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Button
        color="inherit"
        fullWidth
        onClick={onToggle}
        aria-expanded={open}
        sx={{
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          color: 'text.secondary',
          pointerEvents: interactive ? 'auto' : undefined,
        }}
      >
        Completed ({tasks.length})
        <ExpandMoreRoundedIcon sx={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }} />
      </Button>
      <Collapse in={open}>
        <Box sx={{ px: { xs: 0.5, sm: 2 }, borderTop: 1, borderColor: 'divider' }}>
          <List disablePadding>{tasks.map(renderTask)}</List>
        </Box>
      </Collapse>
    </Paper>
  )
}
