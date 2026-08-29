import os
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

from app.database import get_connection, initialize_database
from app.models import NoticeCreate, NoticeOrder, NoticeUpdate
from app.services.notice_service import (
    create_notice,
    list_notices,
    reorder_notices,
    update_notice,
)


class NoticeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.previous_path = os.environ.get("TODO_DATABASE_PATH")
        os.environ["TODO_DATABASE_PATH"] = str(Path(self.directory.name) / "tasks.db")
        initialize_database()

    def tearDown(self) -> None:
        if self.previous_path is None:
            os.environ.pop("TODO_DATABASE_PATH", None)
        else:
            os.environ["TODO_DATABASE_PATH"] = self.previous_path
        self.directory.cleanup()

    def test_notice_duration_is_inclusive_of_today(self) -> None:
        notice = create_notice(NoticeCreate(title="Remember this", duration_days=3))
        self.assertEqual(notice.expires_on, date.today() + timedelta(days=2))

    def test_notice_can_be_edited_and_reordered(self) -> None:
        first = create_notice(NoticeCreate(title="First", duration_days=2))
        second = create_notice(NoticeCreate(title="Second", duration_days=2))

        update_notice(first.id, NoticeUpdate(title="Changed", duration_days=5))
        reorder_notices(NoticeOrder(notice_ids=[second.id, first.id]))

        notices = list_notices()
        self.assertEqual([notice.title for notice in notices], ["Second", "Changed"])
        self.assertEqual(notices[1].expires_on, date.today() + timedelta(days=4))

    def test_expired_notices_are_removed(self) -> None:
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO notices (title, expires_on) VALUES (?, ?)",
                ("Expired", (date.today() - timedelta(days=1)).isoformat()),
            )

        self.assertEqual(list_notices(), [])
        with get_connection() as connection:
            count = connection.execute("SELECT COUNT(*) FROM notices").fetchone()[0]
        self.assertEqual(count, 0)


if __name__ == "__main__":
    unittest.main()
