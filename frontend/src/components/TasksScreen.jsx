import { DndContext, DragOverlay } from '@dnd-kit/core'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import Box from '@mui/material/Box'
import Fab from '@mui/material/Fab'
import Stack from '@mui/material/Stack'
import { taskOrDayCollision } from '../drag/collisionDetection'
import { useConstantAutoScroll } from '../drag/useConstantAutoScroll'
import { ActiveTaskPanel } from './ActiveTaskPanel'
import { DayNavigation } from './DayNavigation'
import { DayPager } from './DayPager'
import { DraggedTask } from './DayComponents'

export function TasksScreen({ data, navigation, drag, actions, ui }) {
  useConstantAutoScroll(Boolean(drag.state.draggedTask))

  return (
    <Stack spacing={3}>
      <DndContext
        sensors={drag.sensors}
        autoScroll={false}
        collisionDetection={(args) => taskOrDayCollision(args, drag.getDragMode())}
        {...drag.dndHandlers}
      >
        <Stack spacing={3}>
          <DayNavigation
            navigation={navigation}
            notices={ui.notices.filter((notice) => notice.expires_on >= ui.today)}
            today={ui.today}
            onOpenSettings={actions.openSettings}
            onCloseCompleted={() => ui.setCompletedOpen(false)}
          />
          <DayPager navigation={navigation} tasksByDate={data.tasksByDate}>
            <ActiveTaskPanel
              data={data}
              drag={drag}
              actions={actions}
              ui={ui}
              unassignedOpen={navigation.unassignedOpen}
            />
          </DayPager>
        </Stack>
        <DragOverlay dropAnimation={null}>
          <DraggedTask
            task={drag.state.draggedTask}
            leavingParent={drag.state.leavingParent}
            removingDivider={drag.state.removingDivider}
          />
        </DragOverlay>
      </DndContext>

      <Box sx={{ position: 'fixed', right: { xs: 20, sm: 32 }, bottom: { xs: 20, sm: 32 }, zIndex: 10 }}>
        <Fab
          color="primary"
          aria-label="Add task"
          onClick={actions.openTaskDraft}
          sx={{
            width: 64,
            height: 64,
            bgcolor: '#3478ff',
            backgroundImage: 'linear-gradient(145deg, #4b88ff, #225eff)',
            boxShadow: '0 0 30px rgba(35, 99, 255, .32)',
            '&:hover': { bgcolor: '#2868ee' },
          }}
        >
          <AddRoundedIcon />
        </Fab>
      </Box>
    </Stack>
  )
}
