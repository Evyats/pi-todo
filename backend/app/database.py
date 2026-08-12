import os
import sqlite3
from contextlib import closing, contextmanager
from datetime import date
from pathlib import Path
from typing import Iterator


DEFAULT_DATABASE = Path(__file__).resolve().parent.parent / "data" / "tasks.db"


def database_path() -> Path:
    return Path(os.environ.get("TODO_DATABASE_PATH", DEFAULT_DATABASE))


def initialize_database() -> None:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL CHECK(length(trim(title)) > 0),
                completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "sort_order" not in columns:
            connection.execute("ALTER TABLE tasks ADD COLUMN sort_order INTEGER")
            connection.execute("UPDATE tasks SET sort_order = -id")
        if "scheduled_date" not in columns:
            connection.execute("ALTER TABLE tasks ADD COLUMN scheduled_date TEXT")
            connection.execute(
                "UPDATE tasks SET scheduled_date = ? WHERE scheduled_date IS NULL",
                (date.today().isoformat(),),
            )
        if "estimated_minutes" not in columns:
            connection.execute(
                """
                ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER
                CHECK(estimated_minutes BETWEEN 1 AND 120)
                """
            )
        if "recurring_task_id" not in columns:
            connection.execute("ALTER TABLE tasks ADD COLUMN recurring_task_id INTEGER")
        if "parent_task_id" not in columns:
            connection.execute("ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL COLLATE NOCASE UNIQUE
                    CHECK(length(trim(title)) > 0),
                estimated_minutes INTEGER
                    CHECK(estimated_minutes BETWEEN 1 AND 120),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        suggestion_columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(suggestions)").fetchall()
        }
        if "estimated_minutes" not in suggestion_columns:
            connection.execute(
                """
                ALTER TABLE suggestions ADD COLUMN estimated_minutes INTEGER
                CHECK(estimated_minutes BETWEEN 1 AND 120)
                """
            )
        else:
            estimate_column = next(
                row
                for row in connection.execute("PRAGMA table_info(suggestions)").fetchall()
                if row[1] == "estimated_minutes"
            )
            if estimate_column[3] == 1:
                connection.executescript(
                    """
                    ALTER TABLE suggestions RENAME TO suggestions_with_default;
                    CREATE TABLE suggestions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL COLLATE NOCASE UNIQUE
                            CHECK(length(trim(title)) > 0),
                        estimated_minutes INTEGER
                            CHECK(estimated_minutes BETWEEN 1 AND 120),
                        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    INSERT INTO suggestions (id, title, estimated_minutes, created_at)
                    SELECT id, title,
                           CASE WHEN estimated_minutes = 15 THEN NULL ELSE estimated_minutes END,
                           created_at
                    FROM suggestions_with_default;
                    DROP TABLE suggestions_with_default;
                    """
                )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS recurring_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL COLLATE NOCASE UNIQUE
                    CHECK(length(trim(title)) > 0),
                estimated_minutes INTEGER
                    CHECK(estimated_minutes BETWEEN 1 AND 120),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS one_recurring_task_per_day
            ON tasks(recurring_task_id, scheduled_date)
            WHERE recurring_task_id IS NOT NULL
            """
        )
        connection.execute(
            """
            UPDATE tasks SET parent_task_id = NULL
            WHERE parent_task_id IN (
                SELECT id FROM tasks WHERE recurring_task_id IS NOT NULL
            )
            """
        )
        connection.commit()


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    connection = sqlite3.connect(database_path())
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()
