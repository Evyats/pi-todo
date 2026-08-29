from datetime import date
from sqlite3 import Connection

from .constants import MAX_ESTIMATE_MINUTES


def migrate(connection: Connection) -> None:
    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL CHECK(length(trim(title)) > 0),
            completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(tasks)")}
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
            "ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER "
            f"CHECK(estimated_minutes BETWEEN 1 AND {MAX_ESTIMATE_MINUTES})"
        )
    if "recurring_task_id" not in columns:
        connection.execute("ALTER TABLE tasks ADD COLUMN recurring_task_id INTEGER")
    if "parent_task_id" not in columns:
        connection.execute("ALTER TABLE tasks ADD COLUMN parent_task_id INTEGER")
    if "is_divider" not in columns:
        connection.execute(
            "ALTER TABLE tasks ADD COLUMN is_divider INTEGER NOT NULL DEFAULT 0 "
            "CHECK(is_divider IN (0, 1))"
        )

    connection.execute(
        f"""
        CREATE TABLE IF NOT EXISTS suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(title)) > 0),
            estimated_minutes INTEGER CHECK(estimated_minutes BETWEEN 1 AND {MAX_ESTIMATE_MINUTES}),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    suggestion_columns = {
        row[1]: row for row in connection.execute("PRAGMA table_info(suggestions)")
    }
    if "estimated_minutes" not in suggestion_columns:
        connection.execute(
            "ALTER TABLE suggestions ADD COLUMN estimated_minutes INTEGER "
            f"CHECK(estimated_minutes BETWEEN 1 AND {MAX_ESTIMATE_MINUTES})"
        )
    elif suggestion_columns["estimated_minutes"][3] == 1:
        connection.executescript(
            f"""
            ALTER TABLE suggestions RENAME TO suggestions_with_default;
            CREATE TABLE suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(title)) > 0),
                estimated_minutes INTEGER CHECK(estimated_minutes BETWEEN 1 AND {MAX_ESTIMATE_MINUTES}),
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
        f"""
        CREATE TABLE IF NOT EXISTS recurring_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(title)) > 0),
            estimated_minutes INTEGER CHECK(estimated_minutes BETWEEN 1 AND {MAX_ESTIMATE_MINUTES}),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    recurring_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(recurring_tasks)")
    }
    if "sort_order" not in recurring_columns:
        connection.execute(
            "ALTER TABLE recurring_tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
        )
        connection.execute("UPDATE recurring_tasks SET sort_order = id")
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

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS notices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL CHECK(length(trim(title)) > 0),
            expires_on TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
