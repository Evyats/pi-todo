import sqlite3

from fastapi import HTTPException

from ..database import get_connection
from ..models import (
    RecurringTask,
    RecurringTaskCreate,
    RecurringTaskOrder,
    RecurringTaskUpdate,
    Suggestion,
    SuggestionCreate,
    SuggestionUpdate,
)


def list_suggestions() -> list[Suggestion]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, estimated_minutes, created_at
            FROM suggestions ORDER BY title COLLATE NOCASE
            """
        ).fetchall()
    return [Suggestion(**dict(row)) for row in rows]


def create_suggestion(payload: SuggestionCreate) -> Suggestion:
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                "INSERT INTO suggestions (title, estimated_minutes) VALUES (?, ?)",
                (payload.title, payload.estimated_minutes),
            )
            row = connection.execute(
                """
                SELECT id, title, estimated_minutes, created_at
                FROM suggestions WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="Suggestion already exists") from error
    return Suggestion(**dict(row))


def update_suggestion(suggestion_id: int, payload: SuggestionUpdate) -> Suggestion:
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                "UPDATE suggestions SET title = ?, estimated_minutes = ? WHERE id = ?",
                (payload.title, payload.estimated_minutes, suggestion_id),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Suggestion not found")
            row = connection.execute(
                """
                SELECT id, title, estimated_minutes, created_at
                FROM suggestions WHERE id = ?
                """,
                (suggestion_id,),
            ).fetchone()
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="Suggestion already exists") from error
    return Suggestion(**dict(row))


def delete_suggestion(suggestion_id: int) -> None:
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM suggestions WHERE id = ?", (suggestion_id,)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Suggestion not found")


def list_recurring_tasks() -> list[RecurringTask]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, estimated_minutes, sort_order, created_at
            FROM recurring_tasks ORDER BY sort_order, id
            """
        ).fetchall()
    return [RecurringTask(**dict(row)) for row in rows]


def create_recurring_task(payload: RecurringTaskCreate) -> RecurringTask:
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO recurring_tasks (title, estimated_minutes, sort_order)
                VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM recurring_tasks))
                """,
                (payload.title, payload.estimated_minutes),
            )
            row = connection.execute(
                """
                SELECT id, title, estimated_minutes, sort_order, created_at
                FROM recurring_tasks WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="Recurring task already exists") from error
    return RecurringTask(**dict(row))


def reorder_recurring_tasks(payload: RecurringTaskOrder) -> None:
    if len(payload.recurring_task_ids) != len(set(payload.recurring_task_ids)):
        raise HTTPException(status_code=400, detail="Recurring task IDs must be unique")
    with get_connection() as connection:
        current_ids = {
            row["id"] for row in connection.execute("SELECT id FROM recurring_tasks")
        }
        if set(payload.recurring_task_ids) != current_ids:
            raise HTTPException(status_code=409, detail="Recurring task list is out of date")
        connection.executemany(
            "UPDATE recurring_tasks SET sort_order = ? WHERE id = ?",
            [
                (position, task_id)
                for position, task_id in enumerate(payload.recurring_task_ids)
            ],
        )


def update_recurring_task(
    recurring_task_id: int, payload: RecurringTaskUpdate
) -> RecurringTask:
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                UPDATE recurring_tasks SET title = ?, estimated_minutes = ? WHERE id = ?
                """,
                (payload.title, payload.estimated_minutes, recurring_task_id),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Recurring task not found")
            row = connection.execute(
                """
                SELECT id, title, estimated_minutes, sort_order, created_at
                FROM recurring_tasks WHERE id = ?
                """,
                (recurring_task_id,),
            ).fetchone()
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="Recurring task already exists") from error
    return RecurringTask(**dict(row))


def delete_recurring_task(recurring_task_id: int) -> None:
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM recurring_tasks WHERE id = ?", (recurring_task_id,)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Recurring task not found")
