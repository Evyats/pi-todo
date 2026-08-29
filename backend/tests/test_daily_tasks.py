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
        divider_count = self.connection.execute(
            "SELECT COUNT(*) FROM tasks WHERE is_divider = 1"
        ).fetchone()[0]
        self.assertEqual(divider_count, 1)

    def test_new_day_orders_planned_carried_divider_and_recurring_groups(self) -> None:
        today = date.today().isoformat()
        self.connection.executemany(
            "INSERT INTO recurring_tasks (title, sort_order) VALUES (?, ?)",
            [("First routine", 0), ("Second routine", 1)],
        )
        self.connection.execute(
            "INSERT INTO tasks (title, sort_order, scheduled_date) VALUES ('Already planned', 4, ?)",
            (today,),
        )
        parent_id = self.connection.execute(
            "INSERT INTO tasks (title, sort_order, scheduled_date) VALUES ('Old parent', 0, '2000-01-01')"
        ).lastrowid
        child_id = self.connection.execute(
            """
            INSERT INTO tasks (title, sort_order, scheduled_date, parent_task_id)
            VALUES ('Old child', 0, '2000-01-01', ?)
            """,
            (parent_id,),
        ).lastrowid
        self.connection.execute(
            "INSERT INTO tasks (title, sort_order, scheduled_date) VALUES ('Old second', 1, '2000-01-01')"
        )

        carry_over_incomplete_tasks(self.connection)
        create_today_recurring_tasks(self.connection)

        main_items = [
            (row["title"], bool(row["is_divider"]))
            for row in self.connection.execute(
                """
                SELECT title, is_divider FROM tasks
                WHERE scheduled_date = ? AND parent_task_id IS NULL
                ORDER BY sort_order, id
                """,
                (today,),
            )
        ]
        self.assertEqual(
            main_items,
            [
                ("Already planned", False),
                ("Old parent", False),
                ("Old second", False),
                ("Divider", True),
                ("First routine", False),
                ("Second routine", False),
            ],
        )
        child = self.connection.execute(
            "SELECT scheduled_date, parent_task_id FROM tasks WHERE id = ?",
            (child_id,),
        ).fetchone()
        self.assertEqual(child["scheduled_date"], today)
        self.assertEqual(child["parent_task_id"], parent_id)


if __name__ == "__main__":
    unittest.main()
