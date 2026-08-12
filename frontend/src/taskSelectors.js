export function organizeTasks(tasks) {
  const pending = []
  const completed = []
  const main = []
  const childrenByParent = new Map()

  tasks.forEach((task) => {
    if (task.completed) {
      completed.push(task)
      return
    }
    pending.push(task)
    if (task.parent_task_id === null) {
      main.push(task)
      return
    }
    const children = childrenByParent.get(task.parent_task_id) ?? []
    children.push(task)
    childrenByParent.set(task.parent_task_id, children)
  })

  return { pending, completed, main, childrenByParent }
}
