# -*- coding: utf-8 -*-
"""새 폴더 구조 기준 일일 브리핑 실행 파일."""
from __future__ import annotations

import json
from pathlib import Path

from src import briefing_analyzer, dart_collector, email_sender, news_collector, newsletter_renderer, page_renderer


PROJECT_ROOT = Path(__file__).resolve().parent
STATE_PATH = PROJECT_ROOT / "state" / "newsletter_state.json"


def load_state() -> dict:
    if not STATE_PATH.exists():
        return {"sent_receipts": [], "sent_news_links": []}
    return json.loads(STATE_PATH.read_text(encoding="utf-8"))


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def unsent_important_receipts() -> list[str]:
    state = load_state()
    disclosures = newsletter_renderer.load_disclosures()
    target_date = newsletter_renderer.pick_disclosure_date(disclosures, newsletter_renderer.report_date_from_env())
    daily = disclosures[disclosures["_date"] == target_date].copy() if not disclosures.empty else disclosures
    if daily.empty:
        return []
    important = daily[daily["_score"] > 0]
    sent = set(map(str, state.get("sent_receipts", [])))
    return [str(value) for value in important.get("접수번호", []) if str(value) not in sent]


def remember_sent_receipts(receipts: list[str]) -> None:
    if not receipts:
        return
    state = load_state()
    merged = sorted(set(map(str, state.get("sent_receipts", []))) | set(map(str, receipts)))
    state["sent_receipts"] = merged
    state["last_sent_date"] = newsletter_renderer.display_date_from_env().isoformat()
    save_state(state)


def main() -> None:
    dart_collector.main()
    news_collector.collect_news()
    briefing_analyzer.analyze_today()
    html_path = newsletter_renderer.render_html()
    page_renderer.render_pages(html_path)

    receipts = unsent_important_receipts()
    if receipts:
        subject = f"[경쟁사 브리핑] {newsletter_renderer.display_date_from_env():%Y.%m.%d} 중요 공시 {len(receipts)}건"
        sent = email_sender.send_newsletter(html_path, subject)
        if sent:
            remember_sent_receipts(receipts)
        else:
            print("[메일발송] 실제 발송되지 않아 중복 방지 기록도 남기지 않았습니다.")
    else:
        print("[메일발송] 새 중요 공시가 없어 발송하지 않습니다.")


if __name__ == "__main__":
    main()
