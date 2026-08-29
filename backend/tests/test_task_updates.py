import os
import tempfile
import unittest
from datetime import date
from pathlib import Path

from fastapi import HTTPException

from app.database import get_connection, initialize_database
from app.models import DividerCreate, TaskCreate, TaskOrder, TaskParent, TaskSchedule, TaskUpdate
from app.services.task_service import (
    create_divider,
    create_task,
    delete_task,
    list_tasks,
    prepare_today,
    reorder_tasks,
    schedule_task,
    set_task_parent,
    update_task,
)


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

    def test_restored_task_is_last_in_pending_list(self) -> None:
        today = date.today().isoformat()
        with get_connection() as connection:
            connection.executemany(
                """
                INSERT INTO tasks (title, completed, sort_order, scheduled_date)
                VALUES (?, ?, ?, ?)
                """,
                [
                    ("First pending", 0, 0, today),
                    ("Second pending", 0, 1, today),
                    ("Restore me", 1, -1, today),
                ],
            )
            task_id = connection.execute(
                "SELECT id FROM tasks WHERE title = 'Restore me'"
            ).fetchone()["id"]

        update_task(task_id, TaskUpdate(completed=False))

        pending = [task.title for task in list_tasks(date.today()) if not task.completed]
        self.assertEqual(pending, ["First pending", "Second pending", "Restore me"])

    def test_detached_child_is_placed_after_its_former_parent(self) -> None:
        today = date.today().isoformat()
        with get_connection() as connection:
            connection.executemany(
                """
                INSERT INTO tasks (title, sort_order, scheduled_date)
                VALUES (?, ?, ?)
                """,
                [("Before", 0, today), ("Parent", 1, today), ("After", 2, today)],
            )
            parent_id = connection.execute(
                "SELECT id FROM tasks WHERE title = 'Parent'"
            ).fetchone()["id"]
            cursor = connection.execute(
                """
                INSERT INTO tasks (title, sort_order, scheduled_date, parent_task_id)
                VALUES ('Child', 0, ?, ?)
                """,
                (today, parent_id),
            )
            child_id = cursor.lastrowid

        set_task_parent(child_id, TaskParent(parent_task_id=None, placement="after"))

        pending = [task.title for task in list_tasks(date.today()) if not task.completed]
        self.assertEqual(pending, ["Before", "Parent", "Child", "After"])

    def test_unassigns_and_reschedules_a_task_family(self) -> None:
        today = date.today().isoformat()
        with get_connection() as connection:
            parent_id = connection.execute(
                "INSERT INTO tasks (title, sort_order, scheduled_date) VALUES ('Parent', 0, ?)",
                (today,),
            ).lastrowid
            connection.execute(
                """
                INSERT INTO tasks (title, sort_order, scheduled_date, parent_task_id)
                VALUES ('Child', 0, ?, ?)
                """,
                (today, parent_id),
            )

        schedule_task(parent_id, TaskSchedule(scheduled_date=None))
        unassigned = list_tasks(None, None, None, True)

        self.assertEqual({task.title for task in unassigned}, {"Parent", "Child"})
        self.assertTrue(all(task.scheduled_date is None for task in unassigned))

        target = date(2099, 1, 2)
        schedule_task(parent_id, TaskSchedule(scheduled_date=target))
        moved = list_tasks(scheduled_date=target)

        self.assertEqual({task.title for task in moved}, {"Parent", "Child"})
        self.assertEqual(next(task for task in moved if task.title == "Child").parent_task_id, parent_id)

    def test_creates_a_task_directly_in_the_unassigned_area(self) -> None:
        task = create_task(TaskCreate(title="Later", unassigned=True))

        self.assertIsNone(task.scheduled_date)
        unassigned = list_tasks(None, None, None, True)
        self.assertEqual([item.title for item in unassigned], ["Later"])

    def test_creates_a_divider_directly_in_the_unassigned_area(self) -> None:
        divider = create_divider(DividerCreate(unassigned=True))

        self.assertIsNone(divider.scheduled_date)
        self.assertTrue(divider.is_divider)
        unassigned = list_tasks(None, None, None, True)
        self.assertEqual([item.id for item in unassigned], [divider.id])

    def test_reading_tasks_does_not_implicitly_roll_over_old_tasks(self) -> None:
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO tasks (title, sort_order, scheduled_date) VALUES ('Old', 0, '2000-01-01')"
            )

        self.assertEqual(list_tasks(date.today()), [])
        with get_connection() as connection:
            scheduled_date = connection.execute(
                "SELECT scheduled_date FROM tasks WHERE title = 'Old'"
            ).fetchone()["scheduled_date"]
        self.assertEqual(scheduled_date, "2000-01-01")

    def test_prepare_today_creates_a_regular_deletable_routine_divider(self) -> None:
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO recurring_tasks (title, sort_order) VALUES ('Routine', 0)"
            )

        prepare_today()
        divider = next(task for task in list_tasks(date.today()) if task.is_divider)
        delete_task(divider.id)

        self.assertFalse(any(task.is_divider for task in list_tasks(date.today())))

    def test_reordering_rejects_unknown_tasks_as_stale(self) -> None:
        with self.assertRaises(HTTPException) as context:
            reorder_tasks(TaskOrder(
                task_ids=[999], scheduled_date=date.today(), parent_task_id=None
            ))
        self.assertEqual(context.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
