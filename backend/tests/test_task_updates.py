import os
import tempfile
import unittest
from datetime import date
from pathlib import Path

from app.database import get_connection, initialize_database
from app.main import list_tasks, update_task
from app.models import TaskUpdate


class TaskUpdateTests(unittest.TestCase):
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

    def test_newly_completed_task_is_first_in_completed_list(self) -> None:
        today = date.today().isoformat()
        with get_connection() as connection:
            connection.executemany(
                """
                INSERT INTO tasks (title, completed, sort_order, scheduled_date)
                VALUES (?, ?, ?, ?)
                """,
                [
                    ("Previously done", 1, 10, today),
                    ("Just completed", 0, 20, today),
                ],
            )
            task_id = connection.execute(
                "SELECT id FROM tasks WHERE title = 'Just completed'"
            ).fetchone()["id"]

        update_task(task_id, TaskUpdate(completed=True))

        completed = [task.title for task in list_tasks(date.today()) if task.completed]
        self.assertEqual(completed, ["Just completed", "Previously done"])

    def test_lists_tasks_for_an_inclusive_date_range(self) -> None:
        with get_connection() as connection:
            connection.executemany(
                """
                INSERT INTO tasks (title, sort_order, scheduled_date)
                VALUES (?, 0, ?)
                """,
                [
                    ("First", "2099-01-01"),
                    ("Second", "2099-01-02"),
                    ("Outside", "2099-01-03"),
                ],
            )

        tasks = list_tasks(
            start_date=date(2099, 1, 1),
            end_date=date(2099, 1, 2),
        )

        self.assertEqual([task.title for task in tasks], ["First", "Second"])


if __name__ == "__main__":
    unittest.main()
