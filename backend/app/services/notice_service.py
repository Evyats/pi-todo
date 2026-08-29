from datetime import date, timedelta

from fastapi import HTTPException

from ..database import get_connection
from ..models import Notice, NoticeCreate, NoticeOrder, NoticeUpdate


def fetch_notice(notice_id: int) -> Notice:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, title, expires_on, sort_order, created_at
            FROM notices WHERE id = ?
            """,
            (notice_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Notice not found")
    return Notice(**dict(row))


def list_notices() -> list[Notice]:
    today = date.today().isoformat()
    with get_connection() as connection:
        connection.execute("DELETE FROM notices WHERE expires_on < ?", (today,))
        rows = connection.execute(
            """
            SELECT id, title, expires_on, sort_order, created_at
            FROM notices ORDER BY sort_order, id
            """
        ).fetchall()
    return [Notice(**dict(row)) for row in rows]


def create_notice(payload: NoticeCreate) -> Notice:
    expires_on = date.today() + timedelta(days=payload.duration_days - 1)
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO notices (title, expires_on, sort_order)
            VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM notices))
            """,
            (payload.title, expires_on.isoformat()),
        )
        notice_id = cursor.lastrowid
    return fetch_notice(notice_id)


def reorder_notices(payload: NoticeOrder) -> None:
    if len(payload.notice_ids) != len(set(payload.notice_ids)):
        raise HTTPException(status_code=400, detail="Notice IDs must be unique")
    today = date.today().isoformat()
    with get_connection() as connection:
        current_ids = {
            row["id"]
            for row in connection.execute(
                "SELECT id FROM notices WHERE expires_on >= ?", (today,)
            )
        }
        if set(payload.notice_ids) != current_ids:
            raise HTTPException(status_code=409, detail="Notice list is out of date")
        connection.executemany(
            "UPDATE notices SET sort_order = ? WHERE id = ?",
            [
                (position, notice_id)
                for position, notice_id in enumerate(payload.notice_ids)
            ],
        )


def update_notice(notice_id: int, payload: NoticeUpdate) -> Notice:
    expires_on = date.today() + timedelta(days=payload.duration_days - 1)
    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE notices SET title = ?, expires_on = ? WHERE id = ?",
            (payload.title, expires_on.isoformat(), notice_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notice not found")
    return fetch_notice(notice_id)


def delete_notice(notice_id: int) -> None:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM notices WHERE id = ?", (notice_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notice not found")
