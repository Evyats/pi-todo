import test from 'node:test'
import assert from 'node:assert/strict'
import {
  changeTaskParent,
  moveRootTaskToBoundary,
  reorderTaskGroup,
  taskFamily,
} from './taskOrdering.js'

const tasks = [
  { id: 1, completed: false, parent_task_id: null },
  { id: 2, completed: false, parent_task_id: 1 },
  { id: 3, completed: false, parent_task_id: null },
  { id: 4, completed: true, parent_task_id: null },
]

test('finds a parent and its direct children', () => {
  assert.deepEqual(taskFamily(tasks, 1).map((task) => task.id), [1, 2])
})

test('reorders only tasks in the requested sibling group', () => {
  const source = [
    { id: 1, completed: false, parent_task_id: null },
    { id: 2, completed: false, parent_task_id: null },
    { id: 3, completed: false, parent_task_id: null },
  ]
  const result = reorderTaskGroup(source, 1, 3, null)
  assert.deepEqual(result.tasks.map((task) => task.id), [2, 3, 1])
  assert.deepEqual(result.group.map((task) => task.id), [2, 3, 1])
})

test('moves a root to a boundary without disturbing completed tasks', () => {
  const result = moveRootTaskToBoundary(tasks, 1, 'last')
  assert.deepEqual(result.map((task) => task.id), [3, 2, 1, 4])
})

test('detaches a child beside its former parent', () => {
  const result = changeTaskParent(tasks, 2, null, 'after')
  assert.deepEqual(result.map((task) => task.id), [1, 2, 3, 4])
  assert.equal(result[1].parent_task_id, null)
})
