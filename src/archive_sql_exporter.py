# -*- coding: utf-8 -*-
"""기존 public/archive HTML을 Cloudflare D1 import SQL로 변환합니다."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def sql_quote(value: object) -> str:
    return "'" + str(value or "").replace("'", "''") + "'"


def archive_counts(date_key: str) -> tuple[int, int]:
    path = PROJECT_ROOT / "state" / "archive_index.json"
    if not path.exists():
        return 0, 0
    data = json.loads(path.read_text(encoding="utf-8"))
    item = next((row for row in data if row.get("date") == date_key), {})
    disclosure_count = int(item.get("disclosure_count") or item.get("disclosures") or 0)
    news_count = int(item.get("news_count") or item.get("news") or 0)
    return disclosure_count, news_count


def build_sql(date_key: str, html: str, subject: str, sent_at: str) -> str:
    disclosure_count, news_count = archive_counts(date_key)
    summary = json.dumps(
        {"disclosure_count": disclosure_count, "news_count": news_count, "imported": True},
        ensure_ascii=False,
    )
    return f"""INSERT INTO newsletter_runs (id, newsletter_date, created_at, sent_at, subject, html, summary_json)
VALUES ('archive:{date_key}', '{date_key}', {sql_quote(sent_at)}, {sql_quote(sent_at)}, {sql_quote(subject)}, {sql_quote(html)}, {sql_quote(summary)})
ON CONFLICT(id) DO UPDATE SET sent_at=excluded.sent_at, subject=excluded.subject, html=excluded.html, summary_json=excluded.summary_json;
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("date", help="YYYY-MM-DD")
    parser.add_argument("--output", default="", help="SQL output path")
    args = parser.parse_args()

    html_path = PROJECT_ROOT / "public" / "archive" / f"{args.date}.html"
    if not html_path.exists():
        raise FileNotFoundError(html_path)
    html = html_path.read_text(encoding="utf-8")
    subject = f"{args.date.replace('-', '.')} 경쟁사 모닝 브리핑"
    sent_at = f"{args.date} 08:10:00"
    sql = build_sql(args.date, html, subject, sent_at)
    output = Path(args.output) if args.output else PROJECT_ROOT / "worker" / f"import_{args.date.replace('-', '_')}.sql"
    output.write_text(sql, encoding="utf-8")
    disclosure_count, news_count = archive_counts(args.date)
    print(f"created={output} html_chars={len(html)} disclosures={disclosure_count} news={news_count}")


if __name__ == "__main__":
    main()
