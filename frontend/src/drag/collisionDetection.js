import { closestCenter, pointerWithin } from '@dnd-kit/core'

export function taskOrDayCollision(args, dragMode) {
  const collisionsUnderPointer = pointerWithin(args)
  const unassignedUnderPointer = collisionsUnderPointer.find(
    (collision) => collision.id === 'unassigned',
  )
  if (unassignedUnderPointer) return [unassignedUnderPointer]
  const dayUnderPointer = collisionsUnderPointer.find((collision) =>
    String(collision.id).startsWith('day:'),
  )
  if (dayUnderPointer) return [dayUnderPointer]

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
      && container.id !== 'unassigned'
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

  return closestCenter({ ...args, droppableContainers: siblingContainers })
}
