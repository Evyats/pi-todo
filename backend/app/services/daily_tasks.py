from datetime import date
from sqlite3 import Connection


def carry_over_incomplete_tasks(connection: Connection) -> None:
    today = date.today().isoformat()
    overdue = connection.execute(
        """
        SELECT id FROM tasks
        WHERE completed = 0 AND recurring_task_id IS NULL
          AND is_divider = 0 AND scheduled_date < ?
        ORDER BY scheduled_date, sort_order, id
        """,
        (today,),
    ).fetchall()
    if not overdue:
        return

    next_order = connection.execute(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks WHERE scheduled_date = ?",
        (today,),
    ).fetchone()[0]
    connection.executemany(
        """
        UPDATE tasks SET scheduled_date = ?, sort_order = ?, parent_task_id = NULL
        WHERE id = ?
        """,
        [(today, next_order + position, row[0]) for position, row in enumerate(overdue)],
    )


def create_today_recurring_tasks(connection: Connection) -> None:
    today = date.today().isoformat()
    templates = connection.execute(
        """
        SELECT id, title, estimated_minutes FROM recurring_tasks
        WHERE NOT EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.recurring_task_id = recurring_tasks.id
              AND tasks.scheduled_date = ?
        )
        ORDER BY id
        """,
        (today,),
    ).fetchall()
    if not templates:
        return
    next_order = connection.execute(
        "SELECT COALESCE(MIN(sort_order), 1) - 1 FROM tasks WHERE scheduled_date = ?",
        (today,),
    ).fetchone()[0]
    connection.executemany(
        """
        INSERT INTO tasks (
            title, completed, sort_order, scheduled_date,
            estimated_minutes, recurring_task_id
        ) VALUES (?, 0, ?, ?, ?, ?)
        """,
        [
            (
                template["title"],
                next_order - position,
                today,
                template["estimated_minutes"],
                template["id"],
            )
            for position, template in enumerate(templates)
        ],
    )
