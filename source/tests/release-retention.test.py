from datetime import datetime, timedelta, timezone
from pathlib import Path
import importlib.util
import unittest

PATH = Path(__file__).resolve().parent.parent / "scripts" / "release-retention.py"
spec = importlib.util.spec_from_file_location("release_retention", PATH)
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)
NOW = datetime(2026, 10, 21, 12, tzinfo=timezone.utc)


def release(number, days_old, *, prefix="rebuilt-v2", draft=False, prerelease=False):
    published = NOW - timedelta(days=days_old)
    return {"tag_name": f"{prefix}-{number}-1", "id": number,
            "published_at": published.isoformat().replace("+00:00", "Z"),
            "draft": draft, "prerelease": prerelease}


class RetentionTests(unittest.TestCase):
    def test_three_newest_preserved_even_when_all_are_old(self):
        records = [release(i, 500 + i) for i in range(7)]
        keep, remove = retention.choose(records, NOW)
        self.assertEqual([r["id"] for r in keep], [0, 1, 2])
        self.assertEqual(len(remove), 4)

    def test_preserves_daily_weekly_monthly_and_removes_extra(self):
        records = [release(i * 10 + j, i + (j / 100)) for i in range(400) for j in range(3)]
        keep, remove = retention.choose(records, NOW)
        self.assertTrue(remove)
        self.assertTrue(any(r["id"] in {0, 1, 2} for r in keep))
        def same_month(item):
            t = retention.when(item["published_at"])
            return t.year == 2026 and t.month == 8
        self.assertTrue(any(same_month(item) for item in keep))
        self.assertLess(len(keep), 40)
        self.assertLess(len(keep), len(records))

    def test_other_release_families_unpublished_and_prerelease_are_untouched(self):
        records = [release(i, i) for i in range(9)]
        records += [release(90, 120, prefix="public-data"),
                    release(91, 20, prefix="v1"), release(92, 20, draft=True),
                    release(93, 12, prerelease=True)]
        keep, remove = retention.choose(records, NOW)
        names = {r["tag_name"] for r in keep + remove}
        self.assertNotIn("public-data-90-1", names)
        self.assertNotIn("v1-91-1", names)
        self.assertNotIn("rebuilt-v2-92-1", names)
        self.assertNotIn("rebuilt-v2-93-1", names)

    def test_empty_generations_no_removal(self):
        self.assertEqual(retention.choose([], NOW), ([], []))


if __name__ == "__main__":
    unittest.main()
