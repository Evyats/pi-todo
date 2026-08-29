from fastapi import APIRouter, Response, status

from ..constants import API_PREFIX
from ..models import (
    RecurringTask,
    RecurringTaskCreate,
    RecurringTaskOrder,
    RecurringTaskUpdate,
    Suggestion,
    SuggestionCreate,
    SuggestionUpdate,
)
from ..services import template_service

router = APIRouter(tags=["templates"])


@router.get(f"{API_PREFIX}/suggestions", response_model=list[Suggestion])
def list_suggestions() -> list[Suggestion]:
    return template_service.list_suggestions()


@router.post(
    f"{API_PREFIX}/suggestions",
    response_model=Suggestion,
    status_code=status.HTTP_201_CREATED,
)
def create_suggestion(payload: SuggestionCreate) -> Suggestion:
    return template_service.create_suggestion(payload)


@router.patch(
    f"{API_PREFIX}/suggestions/{{suggestion_id}}", response_model=Suggestion
)
def update_suggestion(suggestion_id: int, payload: SuggestionUpdate) -> Suggestion:
    return template_service.update_suggestion(suggestion_id, payload)


@router.delete(
    f"{API_PREFIX}/suggestions/{{suggestion_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_suggestion(suggestion_id: int) -> Response:
    template_service.delete_suggestion(suggestion_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(f"{API_PREFIX}/recurring-tasks", response_model=list[RecurringTask])
def list_recurring_tasks() -> list[RecurringTask]:
    return template_service.list_recurring_tasks()


@router.post(
    f"{API_PREFIX}/recurring-tasks",
    response_model=RecurringTask,
    status_code=status.HTTP_201_CREATED,
)
def create_recurring_task(payload: RecurringTaskCreate) -> RecurringTask:
    return template_service.create_recurring_task(payload)


@router.put(
    f"{API_PREFIX}/recurring-tasks/order",
    status_code=status.HTTP_204_NO_CONTENT,
)
def reorder_recurring_tasks(payload: RecurringTaskOrder) -> Response:
    template_service.reorder_recurring_tasks(payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    f"{API_PREFIX}/recurring-tasks/{{recurring_task_id}}",
    response_model=RecurringTask,
)
def update_recurring_task(
    recurring_task_id: int, payload: RecurringTaskUpdate
) -> RecurringTask:
    return template_service.update_recurring_task(recurring_task_id, payload)


@router.delete(
    f"{API_PREFIX}/recurring-tasks/{{recurring_task_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_recurring_task(recurring_task_id: int) -> Response:
    template_service.delete_recurring_task(recurring_task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
