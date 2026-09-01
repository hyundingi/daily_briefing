# -*- coding: utf-8 -*-
"""새 폴더 구조 기준 일일 브리핑 실행 파일."""
from __future__ import annotations

import json
import os
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


def unsent_disclosure_receipts() -> list[str]:
    state = load_state()
    disclosures = newsletter_renderer.load_disclosures()
    target_date = newsletter_renderer.pick_disclosure_date(disclosures, newsletter_renderer.report_date_from_env())
    daily = disclosures[disclosures["_date"] == target_date].copy() if not disclosures.empty else disclosures
    if daily.empty:
        return []
    sent = set(map(str, state.get("sent_receipts", [])))
    return [str(value) for value in daily.get("접수번호", []) if str(value) not in sent]


def unsent_news_links() -> list[str]:
    state = load_state()
    disclosures = newsletter_renderer.load_disclosures()
    target_date = newsletter_renderer.pick_disclosure_date(disclosures, newsletter_renderer.report_date_from_env())
    news = newsletter_renderer.load_news(target_date)
    if news.empty:
        return []
    sent = set(map(str, state.get("sent_news_links", [])))
    links = []
    for _, row in news.iterrows():
        link = str(row.get("링크") or row.get("원문링크") or row.get("제목") or "").strip()
        if link and link not in sent:
            links.append(link)
    return links


def remember_sent_items(receipts: list[str], news_links: list[str]) -> None:
    if not receipts and not news_links:
        return
    state = load_state()
    state["sent_receipts"] = sorted(set(map(str, state.get("sent_receipts", []))) | set(map(str, receipts)))
    state["sent_news_links"] = sorted(set(map(str, state.get("sent_news_links", []))) | set(map(str, news_links)))
    state["last_sent_date"] = newsletter_renderer.display_date_from_env().isoformat()
    save_state(state)


def make_subject(receipts: list[str], news_links: list[str]) -> str:
    parts = []
    if receipts:
        parts.append(f"신규 공시 {len(receipts)}건")
    if news_links:
        parts.append(f"최신 뉴스 {len(news_links)}건")
    summary = " · ".join(parts) if parts else "업데이트 없음"
    return f"[경쟁사 브리핑] {newsletter_renderer.display_date_from_env():%Y.%m.%d} {summary}"


def email_enabled() -> bool:
    value = os.getenv("SEND_EMAIL", "true").strip().lower()
    return value not in {"0", "false", "no", "n"}


def main() -> None:
    dart_collector.main()
    news_collector.collect_news()
    briefing_analyzer.analyze_today()
    html_path = newsletter_renderer.render_html()
    page_renderer.render_pages(html_path)

    receipts = unsent_disclosure_receipts()
    news_links = unsent_news_links()
    if not email_enabled():
        print("[메일발송] SEND_EMAIL=false 설정으로 발송하지 않습니다.")
        return
    if receipts or news_links:
        subject = make_subject(receipts, news_links)
        sent = email_sender.send_newsletter(html_path, subject)
        if sent:
            remember_sent_items(receipts, news_links)
        else:
            print("[메일발송] 실제 발송되지 않아 중복 방지 기록도 남기지 않았습니다.")
    else:
        print("[메일발송] 새 신규 공시 또는 최신 뉴스가 없어 발송하지 않습니다.")


if __name__ == "__main__":
    main()
