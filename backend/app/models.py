from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TaskCreate(BaseModel):
    title: str
    scheduled_date: date | None = None
    suggestion_id: int | None = None
    archived: bool = False

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
        return None if value is None else TaskCreate.validate_title(value)


class Task(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    completed: bool
    created_at: str
    scheduled_date: date | None
    estimated_minutes: int | None
    recurring_task_id: int | None
    parent_task_id: int | None
    is_divider: bool


class TaskOrder(BaseModel):
    task_ids: list[int]
    scheduled_date: date | None
    parent_task_id: int | None = None


class TaskSchedule(BaseModel):
    scheduled_date: date | None


class TaskParent(BaseModel):
    parent_task_id: int | None = None
    placement: Literal["before", "after"] | None = None


class DividerCreate(BaseModel):
    scheduled_date: date | None = None
    archived: bool = False


class SuggestionCreate(BaseModel):
    title: str
    estimated_minutes: int | None = Field(default=None, ge=1, le=90)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return TaskCreate.validate_title(value)


class SuggestionUpdate(SuggestionCreate):
    pass


class Suggestion(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    estimated_minutes: int | None
    created_at: str


class RecurringTaskCreate(SuggestionCreate):
    pass


class RecurringTaskUpdate(SuggestionCreate):
    pass


class RecurringTask(Suggestion):
    sort_order: int


class RecurringTaskOrder(BaseModel):
    recurring_task_ids: list[int]


class NoticeCreate(BaseModel):
    title: str
    duration_days: int = Field(ge=1, le=365)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return TaskCreate.validate_title(value)


class NoticeUpdate(NoticeCreate):
    pass


class Notice(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    expires_on: date
    sort_order: int
    created_at: str


class NoticeOrder(BaseModel):
    notice_ids: list[int]
