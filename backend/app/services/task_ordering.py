from sqlite3 import Connection


def area_start_order(connection: Connection, scheduled_date: str | None) -> int:
    return connection.execute(
        "SELECT COALESCE(MIN(sort_order), 1) - 1 FROM tasks WHERE scheduled_date IS ?",
        (scheduled_date,),
    ).fetchone()[0]


def completed_start_order(
    connection: Connection, scheduled_date: str | None, task_id: int
) -> int:
    return connection.execute(
        """
        SELECT COALESCE(MIN(sort_order), 1) - 1 FROM tasks
        WHERE scheduled_date IS ? AND completed = 1 AND id != ?
        """,
        (scheduled_date, task_id),
    ).fetchone()[0]


def pending_root_end_order(
    connection: Connection, scheduled_date: str | None, task_id: int
) -> int:
    return connection.execute(
        """
        SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks
        WHERE scheduled_date IS ? AND completed = 0
          AND parent_task_id IS NULL AND id != ?
        """,
        (scheduled_date, task_id),
    ).fetchone()[0]


def group_end_order(
    connection: Connection,
    scheduled_date: str | None,
    parent_task_id: int | None,
) -> int:
    return connection.execute(
        """
        SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks
        WHERE scheduled_date IS ? AND parent_task_id IS ?
        """,
        (scheduled_date, parent_task_id),
    ).fetchone()[0]


def apply_order(connection: Connection, task_ids: list[int]) -> None:
    connection.executemany(
        "UPDATE tasks SET sort_order = ? WHERE id = ?",
        [(position, task_id) for position, task_id in enumerate(task_ids)],
    )
