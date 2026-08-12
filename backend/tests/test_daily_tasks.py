import sqlite3
import unittest
from datetime import date

from app.migrations import migrate
from app.services.daily_tasks import (
    carry_over_incomplete_tasks,
    create_today_recurring_tasks,
)


class DailyTaskServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        migrate(self.connection)

    def tearDown(self) -> None:
        self.connection.close()

    def test_carries_incomplete_tasks_but_not_completed_or_dividers(self) -> None:
        self.connection.executemany(
            """
            INSERT INTO tasks (title, completed, sort_order, scheduled_date, is_divider)
            VALUES (?, ?, ?, '2000-01-01', ?)
            """,
            [
                ("Carry me", 0, 0, 0),
                ("Already done", 1, 1, 0),
                ("Divider", 0, 2, 1),
            ],
        )

        carry_over_incomplete_tasks(self.connection)

        rows = self.connection.execute(
            "SELECT title, scheduled_date FROM tasks ORDER BY id"
        ).fetchall()
        self.assertEqual(rows[0]["scheduled_date"], date.today().isoformat())
        self.assertEqual(rows[1]["scheduled_date"], "2000-01-01")
        self.assertEqual(rows[2]["scheduled_date"], "2000-01-01")

    def test_creates_each_recurring_task_only_once_per_day(self) -> None:
        self.connection.execute(
            "INSERT INTO recurring_tasks (title, estimated_minutes) VALUES ('Exercise', 30)"
        )

        create_today_recurring_tasks(self.connection)
        create_today_recurring_tasks(self.connection)

        rows = self.connection.execute(
            "SELECT title, estimated_minutes FROM tasks WHERE recurring_task_id IS NOT NULL"
        ).fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(dict(rows[0]), {"title": "Exercise", "estimated_minutes": 30})


if __name__ == "__main__":
    unittest.main()
