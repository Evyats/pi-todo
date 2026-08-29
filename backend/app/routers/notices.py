from fastapi import APIRouter, Response, status

from ..constants import API_PREFIX
from ..models import Notice, NoticeCreate, NoticeOrder, NoticeUpdate
from ..services import notice_service

router = APIRouter(prefix=f"{API_PREFIX}/notices", tags=["notices"])


@router.get("", response_model=list[Notice])
def list_notices() -> list[Notice]:
    return notice_service.list_notices()


@router.post("", response_model=Notice, status_code=status.HTTP_201_CREATED)
def create_notice(payload: NoticeCreate) -> Notice:
    return notice_service.create_notice(payload)


@router.put("/order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_notices(payload: NoticeOrder) -> Response:
    notice_service.reorder_notices(payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{notice_id}", response_model=Notice)
def update_notice(notice_id: int, payload: NoticeUpdate) -> Notice:
    return notice_service.update_notice(notice_id, payload)


@router.delete("/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notice(notice_id: int) -> Response:
    notice_service.delete_notice(notice_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
