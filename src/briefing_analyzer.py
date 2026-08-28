# -*- coding: utf-8 -*-
"""회사 프로필, 과거 이력, 오늘 공시/뉴스를 결합해 브리핑 분석 JSON을 만듭니다."""
from __future__ import annotations

import json
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd

from . import newsletter_renderer
from .company_profiles import get_profile_context, load_company_profiles
from .dart_collector import TARGET_COMPANIES
from .issue_clusterer import normalize_text


PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = PROJECT_ROOT / "state"
DAILY_DIR = STATE_DIR / "daily_briefings"
ISSUE_HISTORY_PATH = STATE_DIR / "issue_history.json"


def clean(value: object) -> str:
    return " ".join(str(value or "").split())


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def daily_path(report_date: date | None = None) -> Path:
    target = report_date or newsletter_renderer.display_date_from_env()
    return DAILY_DIR / f"{target.isoformat()}.json"


def load_recent_daily_briefings(limit: int = 14) -> list[dict[str, Any]]:
    if not DAILY_DIR.exists():
        return []
    items: list[dict[str, Any]] = []
    for path in sorted(DAILY_DIR.glob("*.json"), reverse=True):
        data = read_json(path, {})
        if data:
            items.append(data)
        if len(items) >= limit:
            break
    return items


def row_records(frame: pd.DataFrame, columns: list[str], max_rows: int = 20) -> list[dict[str, str]]:
    if frame.empty:
        return []
    usable = [column for column in columns if column in frame.columns]
    rows = []
    for _, row in frame.head(max_rows).iterrows():
        rows.append({column: clean(row.get(column, "")) for column in usable})
    return rows


def topic_words(rows: pd.DataFrame) -> list[str]:
    words: list[str] = []
    if rows.empty or "제목" not in rows.columns:
        return words
    for title in rows["제목"].head(12):
        words.extend(normalize_text(title, TARGET_COMPANIES).split())
    counter = Counter(word for word in words if len(word) >= 2)
    return [word for word, _ in counter.most_common(5)]


def past_company_context(company: str, recent: list[dict[str, Any]]) -> list[dict[str, str]]:
    contexts: list[dict[str, str]] = []
    for item in recent:
        company_data = (item.get("companies") or {}).get(company) or {}
        if not company_data:
            continue
        contexts.append(
            {
                "date": clean(item.get("date")),
                "summary": clean(company_data.get("today_summary")),
                "watch_reason": clean(company_data.get("watch_reason")),
                "topics": ", ".join(map(str, company_data.get("topics") or [])),
            }
        )
    return contexts[:5]


def fallback_company_analysis(company: str, disclosures: pd.DataFrame, news: pd.DataFrame, profiles: dict[str, dict], recent: list[dict[str, Any]]) -> dict[str, Any]:
    topics = topic_words(news)
    disclosure_count = len(disclosures)
    news_count = len(news)
    profile_context = get_profile_context(company, profiles)
    past = past_company_context(company, recent)

    if disclosure_count and news_count:
        today_summary = f"{company}은 신규 공시 {disclosure_count}건과 관련 뉴스 {news_count}건이 함께 확인됐습니다."
    elif disclosure_count:
        today_summary = f"{company}은 신규 공시 {disclosure_count}건이 확인됐습니다."
    elif news_count:
        today_summary = f"{company} 관련 최신 뉴스 {news_count}건이 확인됐습니다."
    else:
        today_summary = f"{company}은 오늘 확인된 신규 이슈가 제한적입니다."

    if topics:
        news_summary = f"오늘 뉴스는 {', '.join(topics[:4])} 키워드가 반복됩니다."
    else:
        news_summary = "오늘 뉴스에서 뚜렷하게 반복되는 키워드는 제한적입니다."

    if past:
        previous_context = f"최근 브리핑에서도 {past[0].get('topics') or '유사 이슈'}가 관찰됐는지 이어서 비교할 필요가 있습니다."
    else:
        previous_context = "아직 누적 이력이 많지 않아 오늘 이슈를 기준점으로 저장합니다."

    watch_bits = []
    if disclosure_count:
        watch_bits.append("공시는 제목만으로 판단하지 말고 원문에서 금액, 일정, 상대방, 정정 여부를 확인해야 합니다")
    if news_count >= 3:
        watch_bits.append("동일 기업 뉴스가 여러 건 반복되어 시장 관심도가 높아졌는지 볼 필요가 있습니다")
    if profile_context:
        watch_bits.append("회사 프로필상 관찰 포인트와 연결되는지 확인해야 합니다")
    watch_reason = "; ".join(watch_bits) + "." if watch_bits else "현재는 참고 수준으로 기록하고 후속 공시·뉴스 발생 여부를 보면 됩니다."

    return {
        "company": company,
        "today_summary": today_summary,
        "news_summary": news_summary,
        "watch_reason": watch_reason,
        "previous_context": previous_context,
        "check_points": [
            "후속 DART 공시 여부",
            "동일 주제 뉴스 반복 여부",
            "회사 프로필의 핵심 관찰 포인트와의 연결성",
        ],
        "topics": topics,
        "confidence": "medium" if disclosure_count or news_count >= 2 else "low",
        "evidence": {
            "disclosure_count": disclosure_count,
            "news_count": news_count,
            "profile_used": bool(profile_context),
            "past_context_count": len(past),
        },
        "generated_by": "rules",
    }


def update_issue_history(report: dict[str, Any]) -> None:
    history = read_json(ISSUE_HISTORY_PATH, {"issues": []})
    issues = history.get("issues") if isinstance(history, dict) else []
    if not isinstance(issues, list):
        issues = []
    report_date = report.get("date")
    issues = [item for item in issues if item.get("date") != report_date]
    for company, data in (report.get("companies") or {}).items():
        topics = data.get("topics") or []
        if not topics:
            continue
        issues.append(
            {
                "date": report.get("date"),
                "company": company,
                "topics": topics,
                "summary": data.get("today_summary", ""),
                "watch_reason": data.get("watch_reason", ""),
                "confidence": data.get("confidence", ""),
            }
        )
    issues = issues[-500:]
    write_json(ISSUE_HISTORY_PATH, {"issues": issues})


def analyze_today() -> Path:
    profiles = load_company_profiles()
    disclosures = newsletter_renderer.load_disclosures()
    target_date = newsletter_renderer.pick_disclosure_date(disclosures, newsletter_renderer.report_date_from_env())
    display_date = newsletter_renderer.display_date_from_env()
    daily = disclosures[disclosures["_date"] == target_date].copy() if not disclosures.empty else pd.DataFrame()
    news = newsletter_renderer.load_news(target_date)
    recent = load_recent_daily_briefings()

    companies = sorted(set(daily.get("회사", pd.Series(dtype=str)).tolist()) | set(news.get("회사", pd.Series(dtype=str)).tolist()))
    fallback = {}
    for company in companies:
        company_disclosures = daily[daily["회사"] == company] if not daily.empty else pd.DataFrame()
        company_news = news[news["회사"] == company] if not news.empty else pd.DataFrame()
        fallback[company] = fallback_company_analysis(company, company_disclosures, company_news, profiles, recent)

    report = {
        "date": display_date.isoformat(),
        "source_disclosure_date": target_date.isoformat(),
        "generated_by": "rules",
        "companies": fallback,
    }
    output = daily_path(display_date)
    write_json(output, report)
    update_issue_history(report)
    print(f"[AI분석] 저장 완료: {output}")
    return output


if __name__ == "__main__":
    analyze_today()
