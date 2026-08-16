from contextlib import asynccontextmanager
from datetime import date
import sqlite3
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from .database import get_connection, initialize_database
from .models import (
    DividerCreate,
    RecurringTask,
    RecurringTaskCreate,
    RecurringTaskOrder,
    RecurringTaskUpdate,
    Suggestion,
    SuggestionCreate,
    SuggestionUpdate,
    Task,
    TaskCreate,
    TaskOrder,
    TaskParent,
    TaskSchedule,
    TaskUpdate,
)
from .services.daily_tasks import carry_over_incomplete_tasks, create_today_recurring_tasks

API_PREFIX = "/todo/api"


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="Todo API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def fetch_task(task_id: int) -> Task:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, title, completed, created_at, scheduled_date,
                   estimated_minutes, recurring_task_id, parent_task_id, is_divider
            FROM tasks WHERE id = ?
            """,
            (task_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**dict(row))


@app.get(f"{API_PREFIX}/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(f"{API_PREFIX}/suggestions", response_model=list[Suggestion])
def list_suggestions() -> list[Suggestion]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, estimated_minutes, created_at
            FROM suggestions ORDER BY title COLLATE NOCASE
            """
        ).fetchall()
    return [Suggestion(**dict(row)) for row in rows]


@app.post(
    f"{API_PREFIX}/suggestions",
    response_model=Suggestion,
    status_code=status.HTTP_201_CREATED,
)
def create_suggestion(payload: SuggestionCreate) -> Suggestion:
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                "INSERT INTO suggestions (title, estimated_minutes) VALUES (?, ?)",
                (payload.title, payload.estimated_minutes),
            )
            suggestion_id = cursor.lastrowid
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


@app.patch(f"{API_PREFIX}/suggestions/{{suggestion_id}}", response_model=Suggestion)
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


@app.delete(
    f"{API_PREFIX}/suggestions/{{suggestion_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_suggestion(suggestion_id: int) -> Response:
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM suggestions WHERE id = ?", (suggestion_id,)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Suggestion not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{API_PREFIX}/recurring-tasks", response_model=list[RecurringTask])
def list_recurring_tasks() -> list[RecurringTask]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, estimated_minutes, sort_order, created_at
            FROM recurring_tasks ORDER BY sort_order, id
            """
        ).fetchall()
    return [RecurringTask(**dict(row)) for row in rows]


@app.post(
    f"{API_PREFIX}/recurring-tasks",
    response_model=RecurringTask,
    status_code=status.HTTP_201_CREATED,
)
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
            recurring_task_id = cursor.lastrowid
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


@app.put(
    f"{API_PREFIX}/recurring-tasks/order",
    status_code=status.HTTP_204_NO_CONTENT,
)
def reorder_recurring_tasks(payload: RecurringTaskOrder) -> Response:
    if len(payload.recurring_task_ids) != len(set(payload.recurring_task_ids)):
        raise HTTPException(status_code=400, detail="Recurring task IDs must be unique")
    with get_connection() as connection:
        current_ids = {
            row[0] for row in connection.execute("SELECT id FROM recurring_tasks")
        }
        if set(payload.recurring_task_ids) != current_ids:
            raise HTTPException(status_code=409, detail="Recurring task list is out of date")
        connection.executemany(
            "UPDATE recurring_tasks SET sort_order = ? WHERE id = ?",
            [(position, task_id) for position, task_id in enumerate(payload.recurring_task_ids)],
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.patch(
    f"{API_PREFIX}/recurring-tasks/{{recurring_task_id}}",
    response_model=RecurringTask,
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


@app.delete(
    f"{API_PREFIX}/recurring-tasks/{{recurring_task_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_recurring_task(recurring_task_id: int) -> Response:
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM recurring_tasks WHERE id = ?", (recurring_task_id,)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Recurring task not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get(f"{API_PREFIX}/tasks", response_model=list[Task])
def list_tasks(
    scheduled_date: Annotated[date | None, Query()] = None,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
) -> list[Task]:
    if (start_date is None) != (end_date is None):
        raise HTTPException(
            status_code=400, detail="start_date and end_date must be provided together"
        )
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must not follow end_date")

    range_start = (start_date or scheduled_date or date.today()).isoformat()
    range_end = (end_date or scheduled_date or date.today()).isoformat()
    today = date.today().isoformat()
    with get_connection() as connection:
        carry_over_incomplete_tasks(connection)
        if range_start <= today <= range_end:
            create_today_recurring_tasks(connection)
        rows = connection.execute(
            """
            SELECT id, title, completed, created_at, scheduled_date,
                   estimated_minutes, recurring_task_id, parent_task_id, is_divider
            FROM tasks
            WHERE scheduled_date BETWEEN ? AND ?
            ORDER BY scheduled_date ASC, sort_order ASC, id DESC
            """,
            (range_start, range_end),
        ).fetchall()
    return [Task(**dict(row)) for row in rows]


@app.post(f"{API_PREFIX}/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate) -> Task:
    scheduled_date = (payload.scheduled_date or date.today()).isoformat()
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
        next_order = connection.execute(
            "SELECT COALESCE(MIN(sort_order), 1) - 1 FROM tasks WHERE scheduled_date = ?",
            (scheduled_date,),
        ).fetchone()[0]
        cursor = connection.execute(
            """
            INSERT INTO tasks (title, sort_order, scheduled_date, estimated_minutes)
            VALUES (?, ?, ?, ?)
            """,
            (title, next_order, scheduled_date, estimated_minutes),
        )
        task_id = cursor.lastrowid
    return fetch_task(task_id)


@app.post(
    f"{API_PREFIX}/tasks/divider",
    response_model=Task,
    status_code=status.HTTP_201_CREATED,
)
def create_divider(payload: DividerCreate) -> Task:
    scheduled_date = (payload.scheduled_date or date.today()).isoformat()
    with get_connection() as connection:
        next_order = connection.execute(
            "SELECT COALESCE(MIN(sort_order), 1) - 1 FROM tasks WHERE scheduled_date = ?",
            (scheduled_date,),
        ).fetchone()[0]
        cursor = connection.execute(
            """
            INSERT INTO tasks (title, sort_order, scheduled_date, is_divider)
            VALUES ('Divider', ?, ?, 1)
            """,
            (next_order, scheduled_date),
        )
        task_id = cursor.lastrowid
    return fetch_task(task_id)


@app.put(f"{API_PREFIX}/tasks/order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_tasks(payload: TaskOrder) -> Response:
    if len(payload.task_ids) != len(set(payload.task_ids)):
        raise HTTPException(status_code=400, detail="Task IDs must be unique")

    with get_connection() as connection:
        existing_rows = connection.execute(
                """
                SELECT id FROM tasks
                WHERE scheduled_date = ? AND parent_task_id IS ? AND completed = 0
                ORDER BY sort_order, id
                """,
                (payload.scheduled_date.isoformat(), payload.parent_task_id),
            ).fetchall()
        existing_ids = [row[0] for row in existing_rows]
        if not set(payload.task_ids).issubset(existing_ids):
            raise HTTPException(status_code=400, detail="Task list is out of date")
        submitted_ids = set(payload.task_ids)
        final_order = payload.task_ids + [
            task_id for task_id in existing_ids if task_id not in submitted_ids
        ]
        connection.executemany(
            "UPDATE tasks SET sort_order = ? WHERE id = ?",
            [(position, task_id) for position, task_id in enumerate(final_order)],
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.put(f"{API_PREFIX}/tasks/{{task_id}}/parent", response_model=Task)
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
            if payload.parent_task_id == task_id:
                raise HTTPException(status_code=400, detail="A task cannot contain itself")
            parent = connection.execute(
                """
                SELECT id, scheduled_date, parent_task_id, recurring_task_id, is_divider
                FROM tasks WHERE id = ?
                """,
                (payload.parent_task_id,),
            ).fetchone()
            if parent is None:
                raise HTTPException(status_code=404, detail="Parent task not found")
            if parent["scheduled_date"] != task["scheduled_date"]:
                raise HTTPException(status_code=400, detail="Subtasks must be on the same day")
            if parent["parent_task_id"] is not None:
                raise HTTPException(status_code=400, detail="Only one subtask level is supported")
            if parent["recurring_task_id"] is not None:
                raise HTTPException(
                    status_code=400, detail="Recurring tasks cannot have subtasks"
                )
            if parent["is_divider"]:
                raise HTTPException(status_code=400, detail="Dividers cannot have subtasks")
            has_children = connection.execute(
                "SELECT 1 FROM tasks WHERE parent_task_id = ? LIMIT 1", (task_id,)
            ).fetchone()
            if has_children is not None:
                raise HTTPException(
                    status_code=400, detail="A task with subtasks cannot become a subtask"
                )

        placed_relative_to_parent = (
            payload.parent_task_id is None
            and payload.placement is not None
            and task["parent_task_id"] is not None
        )
        if placed_relative_to_parent:
            main_ids = [
                row["id"]
                for row in connection.execute(
                    """
                    SELECT id FROM tasks
                    WHERE scheduled_date = ? AND parent_task_id IS NULL AND completed = 0
                    ORDER BY sort_order, id
                    """,
                    (task["scheduled_date"],),
                ).fetchall()
            ]
            try:
                parent_index = main_ids.index(task["parent_task_id"])
            except ValueError as error:
                raise HTTPException(status_code=409, detail="Parent task is out of date") from error
            insert_at = parent_index + (1 if payload.placement == "after" else 0)
            main_ids.insert(insert_at, task_id)
            connection.execute(
                "UPDATE tasks SET parent_task_id = NULL WHERE id = ?", (task_id,)
            )
            connection.executemany(
                "UPDATE tasks SET sort_order = ? WHERE id = ?",
                [(position, current_id) for position, current_id in enumerate(main_ids)],
            )
        else:
            next_order = connection.execute(
                """
                SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks
                WHERE scheduled_date = ? AND parent_task_id IS ?
                """,
                (task["scheduled_date"], payload.parent_task_id),
            ).fetchone()[0]
            connection.execute(
                "UPDATE tasks SET parent_task_id = ?, sort_order = ? WHERE id = ?",
                (payload.parent_task_id, next_order, task_id),
            )
    return fetch_task(task_id)


@app.delete(f"{API_PREFIX}/tasks/completed", status_code=status.HTTP_204_NO_CONTENT)
def delete_completed_tasks(scheduled_date: date | None = Query(default=None)) -> Response:
    requested_date = (scheduled_date or date.today()).isoformat()
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM tasks WHERE completed = 1 AND scheduled_date = ?",
            (requested_date,),
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.put(f"{API_PREFIX}/tasks/{{task_id}}/schedule", response_model=Task)
def schedule_task(task_id: int, payload: TaskSchedule) -> Task:
    target_date = payload.scheduled_date.isoformat()
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
        recurring_child = connection.execute(
            """
            SELECT 1 FROM tasks
            WHERE parent_task_id = ? AND recurring_task_id IS NOT NULL
            LIMIT 1
            """,
            (task_id,),
        ).fetchone()
        if recurring_child is not None:
            raise HTTPException(
                status_code=400,
                detail="A parent with recurring subtasks cannot be moved to another day",
            )
        next_order = connection.execute(
            "SELECT COALESCE(MIN(sort_order), 1) - 1 FROM tasks WHERE scheduled_date = ?",
            (target_date,),
        ).fetchone()[0]
        cursor = connection.execute(
            """
            UPDATE tasks
            SET scheduled_date = ?, sort_order = ?, parent_task_id = NULL
            WHERE id = ?
            """,
            (target_date, next_order, task_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        connection.execute(
            "UPDATE tasks SET scheduled_date = ? WHERE parent_task_id = ?",
            (target_date, task_id),
        )
    return fetch_task(task_id)


@app.patch(f"{API_PREFIX}/tasks/{{task_id}}", response_model=Task)
def update_task(task_id: int, payload: TaskUpdate) -> Task:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return fetch_task(task_id)

    with get_connection() as connection:
        if updates.get("completed") is True:
            task_date = connection.execute(
                "SELECT scheduled_date FROM tasks WHERE id = ?", (task_id,)
            ).fetchone()
            if task_date is None:
                raise HTTPException(status_code=404, detail="Task not found")
            updates["sort_order"] = connection.execute(
                """
                SELECT COALESCE(MIN(sort_order), 1) - 1 FROM tasks
                WHERE scheduled_date = ? AND completed = 1 AND id != ?
                """,
                (task_date["scheduled_date"], task_id),
            ).fetchone()[0]
        elif updates.get("completed") is False:
            task_date = connection.execute(
                "SELECT scheduled_date FROM tasks WHERE id = ?", (task_id,)
            ).fetchone()
            if task_date is None:
                raise HTTPException(status_code=404, detail="Task not found")
            updates["sort_order"] = connection.execute(
                """
                SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks
                WHERE scheduled_date = ? AND completed = 0
                  AND parent_task_id IS NULL AND id != ?
                """,
                (task_date["scheduled_date"], task_id),
            ).fetchone()[0]

        assignments: list[str] = []
        values: list[str | int | bool] = []
        for field, value in updates.items():
            assignments.append(f"{field} = ?")
            values.append(int(value) if field == "completed" else value)
        values.append(task_id)

        cursor = connection.execute(
            f"UPDATE tasks SET {', '.join(assignments)} WHERE id = ?", values
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


@app.delete(f"{API_PREFIX}/tasks/{{task_id}}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int) -> Response:
    with get_connection() as connection:
        connection.execute(
            "UPDATE tasks SET parent_task_id = NULL WHERE parent_task_id = ?",
            (task_id,),
        )
        cursor = connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
