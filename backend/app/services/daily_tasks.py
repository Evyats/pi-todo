from datetime import date
from sqlite3 import Connection


def carry_over_incomplete_tasks(connection: Connection) -> None:
    today = date.today().isoformat()
    connection.execute(
        """
        UPDATE tasks SET parent_task_id = NULL
        WHERE scheduled_date < ? AND recurring_task_id IS NOT NULL
        """,
        (today,),
    )
    overdue = connection.execute(
        """
        SELECT task.id, task.parent_task_id
        FROM tasks AS task
        LEFT JOIN tasks AS parent ON parent.id = task.parent_task_id
        WHERE task.completed = 0 AND task.recurring_task_id IS NULL
          AND task.is_divider = 0 AND task.scheduled_date < ?
        ORDER BY task.scheduled_date,
                 COALESCE(parent.sort_order, task.sort_order),
                 CASE WHEN task.parent_task_id IS NULL THEN 0 ELSE 1 END,
                 task.sort_order, task.id
        """,
        (today,),
    ).fetchall()
    if not overdue:
        return

    moving_ids = {row["id"] for row in overdue}
    next_order = connection.execute(
        """
        SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks
        WHERE scheduled_date = ? AND parent_task_id IS NULL
        """,
        (today,),
    ).fetchone()[0]
    main_position = 0
    for row in overdue:
        parent_moves_too = row["parent_task_id"] in moving_ids
        if row["parent_task_id"] is None or not parent_moves_too:
            connection.execute(
                """
                UPDATE tasks
                SET scheduled_date = ?, sort_order = ?, parent_task_id = NULL
                WHERE id = ?
                """,
                (today, next_order + main_position, row["id"]),
            )
            main_position += 1
        else:
            connection.execute(
                "UPDATE tasks SET scheduled_date = ? WHERE id = ?",
                (today, row["id"]),
            )


def create_today_recurring_tasks(connection: Connection) -> None:
    today = date.today().isoformat()
    has_existing_recurring = connection.execute(
        """
        SELECT EXISTS(
            SELECT 1 FROM tasks
            WHERE recurring_task_id IS NOT NULL AND scheduled_date = ?
        )
        """,
        (today,),
    ).fetchone()[0]
    templates = connection.execute(
        """
        SELECT id, title, estimated_minutes FROM recurring_tasks
        WHERE NOT EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.recurring_task_id = recurring_tasks.id
              AND tasks.scheduled_date = ?
        )
        ORDER BY sort_order, id
        """,
        (today,),
    ).fetchall()
    if not templates:
        return
    first_order = connection.execute(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks WHERE scheduled_date = ?",
        (today,),
    ).fetchone()[0]
    if not has_existing_recurring:
        connection.execute(
            """
            INSERT INTO tasks (title, completed, sort_order, scheduled_date, is_divider)
            VALUES ('Divider', 0, ?, ?, 1)
            """,
            (first_order, today),
        )
        first_order += 1
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
                first_order + position,
                today,
                template["estimated_minutes"],
                template["id"],
            )
            for position, template in enumerate(templates)
        ],
    )
