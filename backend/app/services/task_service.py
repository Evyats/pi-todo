from datetime import date
import sqlite3

from fastapi import HTTPException

from ..database import get_connection
from ..models import (
    DividerCreate,
    Task,
    TaskCreate,
    TaskOrder,
    TaskParent,
    TaskSchedule,
    TaskUpdate,
)
from .daily_tasks import carry_over_incomplete_tasks, create_today_recurring_tasks
from .task_ordering import (
    apply_order,
    area_start_order,
    completed_start_order,
    group_end_order,
    pending_root_end_order,
)

TASK_COLUMNS = """
    id, title, completed, created_at, scheduled_date,
    estimated_minutes, recurring_task_id, parent_task_id, is_divider
"""


def _task(row: sqlite3.Row) -> Task:
    return Task(**dict(row))


def fetch_task(task_id: int) -> Task:
    with get_connection() as connection:
        row = connection.execute(
            f"SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task(row)


def prepare_today() -> None:
    """Idempotently materialize today's task list before it is read."""
    with get_connection() as connection:
        carry_over_incomplete_tasks(connection)
        create_today_recurring_tasks(connection)


def list_tasks(
    scheduled_date: date | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    unassigned: bool = False,
) -> list[Task]:
    if (start_date is None) != (end_date is None):
        raise HTTPException(
            status_code=400, detail="start_date and end_date must be provided together"
        )
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must not follow end_date")

    with get_connection() as connection:
        if unassigned:
            rows = connection.execute(
                f"""
                SELECT {TASK_COLUMNS} FROM tasks
                WHERE scheduled_date IS NULL
                ORDER BY sort_order ASC, id DESC
                """
            ).fetchall()
        else:
            range_start = (start_date or scheduled_date or date.today()).isoformat()
            range_end = (end_date or scheduled_date or date.today()).isoformat()
            rows = connection.execute(
                f"""
                SELECT {TASK_COLUMNS} FROM tasks
                WHERE scheduled_date BETWEEN ? AND ?
                ORDER BY scheduled_date ASC, sort_order ASC, id DESC
                """,
                (range_start, range_end),
            ).fetchall()
    return [_task(row) for row in rows]


def create_task(payload: TaskCreate) -> Task:
    scheduled_date = (
        None
        if payload.unassigned
        else (payload.scheduled_date or date.today()).isoformat()
    )
    with get_connection() as connection:
        title = payload.title
        estimated_minutes = None
        if payload.suggestion_id is not None:
            suggestion = connection.execute(
                "SELECT title, estimated_minutes FROM suggestions WHERE id = ?",
                (payload.suggestion_id,),
            ).fetchone()
            if suggestion is None:
                raise HTTPException(status_code=404, detail="Suggestion not found")
            title = suggestion["title"]
            estimated_minutes = suggestion["estimated_minutes"]
        cursor = connection.execute(
            """
            INSERT INTO tasks (title, sort_order, scheduled_date, estimated_minutes)
            VALUES (?, ?, ?, ?)
            """,
            (title, area_start_order(connection, scheduled_date), scheduled_date, estimated_minutes),
        )
        task_id = cursor.lastrowid
    return fetch_task(task_id)


def create_divider(payload: DividerCreate) -> Task:
    scheduled_date = (
        None
        if payload.unassigned
        else (payload.scheduled_date or date.today()).isoformat()
    )
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO tasks (title, sort_order, scheduled_date, is_divider)
            VALUES ('Divider', ?, ?, 1)
            """,
            (area_start_order(connection, scheduled_date), scheduled_date),
        )
        task_id = cursor.lastrowid
    return fetch_task(task_id)


def reorder_tasks(payload: TaskOrder) -> None:
    if len(payload.task_ids) != len(set(payload.task_ids)):
        raise HTTPException(status_code=400, detail="Task IDs must be unique")

    scheduled_date = payload.scheduled_date.isoformat() if payload.scheduled_date else None
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id FROM tasks
            WHERE scheduled_date IS ? AND parent_task_id IS ? AND completed = 0
            ORDER BY sort_order, id
            """,
            (scheduled_date, payload.parent_task_id),
        ).fetchall()
        existing_ids = [row["id"] for row in rows]
        if not set(payload.task_ids).issubset(existing_ids):
            raise HTTPException(status_code=409, detail="Task list is out of date")
        submitted_ids = set(payload.task_ids)
        apply_order(
            connection,
            payload.task_ids + [task_id for task_id in existing_ids if task_id not in submitted_ids],
        )


def set_task_parent(task_id: int, payload: TaskParent) -> Task:
    with get_connection() as connection:
        task = connection.execute(
            """
            SELECT id, scheduled_date, parent_task_id, is_divider
            FROM tasks WHERE id = ?
            """,
            (task_id,),
        ).fetchone()
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task["is_divider"]:
            raise HTTPException(status_code=400, detail="Dividers cannot become subtasks")

        if payload.parent_task_id is not None:
            _validate_parent(connection, task_id, task, payload.parent_task_id)

        placed_relative_to_parent = (
            payload.parent_task_id is None
            and payload.placement is not None
            and task["parent_task_id"] is not None
        )
        if placed_relative_to_parent:
            root_ids = [
                row["id"]
                for row in connection.execute(
                    """
                    SELECT id FROM tasks
                    WHERE scheduled_date IS ? AND parent_task_id IS NULL AND completed = 0
                    ORDER BY sort_order, id
                    """,
                    (task["scheduled_date"],),
                ).fetchall()
            ]
            try:
                parent_index = root_ids.index(task["parent_task_id"])
            except ValueError as error:
                raise HTTPException(status_code=409, detail="Parent task is out of date") from error
            insert_at = parent_index + (1 if payload.placement == "after" else 0)
            root_ids.insert(insert_at, task_id)
            connection.execute(
                "UPDATE tasks SET parent_task_id = NULL WHERE id = ?", (task_id,)
            )
            apply_order(connection, root_ids)
        else:
            next_order = group_end_order(
                connection, task["scheduled_date"], payload.parent_task_id
            )
            connection.execute(
                "UPDATE tasks SET parent_task_id = ?, sort_order = ? WHERE id = ?",
                (payload.parent_task_id, next_order, task_id),
            )
    return fetch_task(task_id)


def _validate_parent(
    connection: sqlite3.Connection,
    task_id: int,
    task: sqlite3.Row,
    parent_task_id: int,
) -> None:
    if parent_task_id == task_id:
        raise HTTPException(status_code=400, detail="A task cannot contain itself")
    parent = connection.execute(
        """
        SELECT id, scheduled_date, parent_task_id, recurring_task_id, is_divider
        FROM tasks WHERE id = ?
        """,
        (parent_task_id,),
    ).fetchone()
    if parent is None:
        raise HTTPException(status_code=404, detail="Parent task not found")
    if parent["scheduled_date"] != task["scheduled_date"]:
        raise HTTPException(status_code=400, detail="Subtasks must be on the same day")
    if parent["parent_task_id"] is not None:
        raise HTTPException(status_code=400, detail="Only one subtask level is supported")
    if parent["recurring_task_id"] is not None:
        raise HTTPException(status_code=400, detail="Recurring tasks cannot have subtasks")
    if parent["is_divider"]:
        raise HTTPException(status_code=400, detail="Dividers cannot have subtasks")
    if connection.execute(
        "SELECT 1 FROM tasks WHERE parent_task_id = ? LIMIT 1", (task_id,)
    ).fetchone() is not None:
        raise HTTPException(
            status_code=400, detail="A task with subtasks cannot become a subtask"
        )


def schedule_task(task_id: int, payload: TaskSchedule) -> Task:
    target_date = payload.scheduled_date.isoformat() if payload.scheduled_date else None
    with get_connection() as connection:
        task = connection.execute(
            """
            SELECT recurring_task_id, parent_task_id, is_divider
            FROM tasks WHERE id = ?
            """,
            (task_id,),
        ).fetchone()
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task["recurring_task_id"] is not None:
            raise HTTPException(status_code=400, detail="Recurring tasks cannot be moved")
        if task["is_divider"]:
            raise HTTPException(status_code=400, detail="Dividers cannot be moved to another day")
        if connection.execute(
            """
            SELECT 1 FROM tasks
            WHERE parent_task_id = ? AND recurring_task_id IS NOT NULL LIMIT 1
            """,
            (task_id,),
        ).fetchone() is not None:
            raise HTTPException(
                status_code=400,
                detail="A parent with recurring subtasks cannot be moved to another day",
            )
        cursor = connection.execute(
            """
            UPDATE tasks
            SET scheduled_date = ?, sort_order = ?, parent_task_id = NULL
            WHERE id = ?
            """,
            (target_date, area_start_order(connection, target_date), task_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        connection.execute(
            "UPDATE tasks SET scheduled_date = ? WHERE parent_task_id = ?",
            (target_date, task_id),
        )
    return fetch_task(task_id)


def update_task(task_id: int, payload: TaskUpdate) -> Task:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return fetch_task(task_id)

    with get_connection() as connection:
        if "completed" in updates:
            task_date = connection.execute(
                "SELECT scheduled_date FROM tasks WHERE id = ?", (task_id,)
            ).fetchone()
            if task_date is None:
                raise HTTPException(status_code=404, detail="Task not found")
            if updates["completed"] is True:
                updates["sort_order"] = completed_start_order(
                    connection, task_date["scheduled_date"], task_id
                )
            else:
                updates["sort_order"] = pending_root_end_order(
                    connection, task_date["scheduled_date"], task_id
                )

        assignments = [f"{field} = ?" for field in updates]
        values = [int(value) if field == "completed" else value for field, value in updates.items()]
        cursor = connection.execute(
            f"UPDATE tasks SET {', '.join(assignments)} WHERE id = ?",
            [*values, task_id],
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        if updates.get("completed") is True:
            children = connection.execute(
                "SELECT id FROM tasks WHERE parent_task_id = ? ORDER BY sort_order, id",
                (task_id,),
            ).fetchall()
            connection.executemany(
                """
                UPDATE tasks SET completed = 1, parent_task_id = NULL, sort_order = ?
                WHERE id = ?
                """,
                [
                    (updates["sort_order"] + position + 1, child["id"])
                    for position, child in enumerate(children)
                ],
            )
    return fetch_task(task_id)


def delete_task(task_id: int) -> None:
    with get_connection() as connection:
        connection.execute(
            "UPDATE tasks SET parent_task_id = NULL WHERE parent_task_id = ?", (task_id,)
        )
        cursor = connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
