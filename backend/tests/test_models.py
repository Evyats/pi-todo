import unittest

from pydantic import ValidationError

from app.models import NoticeCreate, SuggestionCreate, TaskCreate


class ModelValidationTests(unittest.TestCase):
    def test_task_title_is_trimmed(self) -> None:
        self.assertEqual(TaskCreate(title="  Buy milk  ").title, "Buy milk")

    def test_empty_task_title_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            TaskCreate(title="   ")

    def test_estimate_must_be_between_one_and_120_minutes(self) -> None:
        with self.assertRaises(ValidationError):
            SuggestionCreate(title="Exercise", estimated_minutes=121)

    def test_notice_duration_must_be_between_one_and_365_days(self) -> None:
        with self.assertRaises(ValidationError):
            NoticeCreate(title="Remember", duration_days=0)


if __name__ == "__main__":
    unittest.main()
