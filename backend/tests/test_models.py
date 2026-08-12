import unittest

from pydantic import ValidationError

from app.models import SuggestionCreate, TaskCreate


class ModelValidationTests(unittest.TestCase):
    def test_task_title_is_trimmed(self) -> None:
        self.assertEqual(TaskCreate(title="  Buy milk  ").title, "Buy milk")

    def test_empty_task_title_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            TaskCreate(title="   ")

    def test_estimate_must_be_between_one_and_120_minutes(self) -> None:
        with self.assertRaises(ValidationError):
            SuggestionCreate(title="Exercise", estimated_minutes=121)


if __name__ == "__main__":
    unittest.main()
