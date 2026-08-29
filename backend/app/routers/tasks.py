from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from ..constants import API_PREFIX
from ..models import DividerCreate, Task, TaskCreate, TaskOrder, TaskParent, TaskSchedule, TaskUpdate
from ..services import task_service

router = APIRouter(prefix=f"{API_PREFIX}/tasks", tags=["tasks"])


@router.post("/prepare-today", status_code=status.HTTP_204_NO_CONTENT)
def prepare_today() -> Response:
    task_service.prepare_today()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=list[Task])
def list_tasks(
    scheduled_date: Annotated[date | None, Query()] = None,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    unassigned: Annotated[bool, Query()] = False,
) -> list[Task]:
    return task_service.list_tasks(
        scheduled_date,
        start_date,
        end_date,
        unassigned=unassigned,
    )


@router.post("", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate) -> Task:
    return task_service.create_task(payload)


@router.post("/divider", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_divider(payload: DividerCreate) -> Task:
    return task_service.create_divider(payload)


@router.put("/order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_tasks(payload: TaskOrder) -> Response:
    task_service.reorder_tasks(payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{task_id}/parent", response_model=Task)
def set_task_parent(task_id: int, payload: TaskParent) -> Task:
    return task_service.set_task_parent(task_id, payload)


@router.put("/{task_id}/schedule", response_model=Task)
def schedule_task(task_id: int, payload: TaskSchedule) -> Task:
    return task_service.schedule_task(task_id, payload)


@router.patch("/{task_id}", response_model=Task)
def update_task(task_id: int, payload: TaskUpdate) -> Task:
    return task_service.update_task(task_id, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int) -> Response:
    task_service.delete_task(task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
