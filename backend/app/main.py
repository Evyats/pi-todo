from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, field_validator

from .database import get_connection, initialize_database

API_PREFIX = "/todo/api"


class TaskCreate(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Task title cannot be empty")
        if len(title) > 300:
            raise ValueError("Task title cannot exceed 300 characters")
        return title


class TaskUpdate(BaseModel):
    title: str | None = None
    completed: bool | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        title = value.strip()
        if not title:
            raise ValueError("Task title cannot be empty")
        if len(title) > 300:
            raise ValueError("Task title cannot exceed 300 characters")
        return title


class Task(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    completed: bool
    created_at: str


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
            "SELECT id, title, completed, created_at FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**dict(row))


@app.get(f"{API_PREFIX}/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(f"{API_PREFIX}/tasks", response_model=list[Task])
def list_tasks() -> list[Task]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, completed, created_at
            FROM tasks
            ORDER BY completed ASC, id DESC
            """
        ).fetchall()
    return [Task(**dict(row)) for row in rows]


@app.post(f"{API_PREFIX}/tasks", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate) -> Task:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO tasks (title) VALUES (?)", (payload.title,)
        )
        task_id = cursor.lastrowid
    return fetch_task(task_id)


@app.delete(f"{API_PREFIX}/tasks/completed", status_code=status.HTTP_204_NO_CONTENT)
def delete_completed_tasks() -> Response:
    with get_connection() as connection:
        connection.execute("DELETE FROM tasks WHERE completed = 1")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.patch(f"{API_PREFIX}/tasks/{{task_id}}", response_model=Task)
def update_task(task_id: int, payload: TaskUpdate) -> Task:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return fetch_task(task_id)

    assignments: list[str] = []
    values: list[str | int | bool] = []
    for field, value in updates.items():
        assignments.append(f"{field} = ?")
        values.append(int(value) if field == "completed" else value)
    values.append(task_id)

    with get_connection() as connection:
        cursor = connection.execute(
            f"UPDATE tasks SET {', '.join(assignments)} WHERE id = ?", values
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
    return fetch_task(task_id)


@app.delete(f"{API_PREFIX}/tasks/{{task_id}}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int) -> Response:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
