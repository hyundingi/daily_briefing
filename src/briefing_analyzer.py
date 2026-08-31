# -*- coding: utf-8 -*-
"""회사 프로필, 과거 이력, 오늘 공시/뉴스를 결합해 브리핑 분석 JSON을 만듭니다."""
from __future__ import annotations

import json
import os
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from dotenv import load_dotenv

from . import newsletter_renderer
from .company_profiles import get_profile_context, load_company_profiles
from .dart_collector import TARGET_COMPANIES
from .issue_clusterer import normalize_text


PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = PROJECT_ROOT / "state"
DAILY_DIR = STATE_DIR / "daily_briefings"
ISSUE_HISTORY_PATH = STATE_DIR / "issue_history.json"
load_dotenv(PROJECT_ROOT / ".env")

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_META: dict[str, Any] = {
    "attempted": False,
    "key_present": False,
    "model": "",
    "status": "not_configured",
    "error": "",
}


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


def company_order_key(company: str) -> tuple[int, str]:
    names = list(TARGET_COMPANIES.keys()) if isinstance(TARGET_COMPANIES, dict) else list(TARGET_COMPANIES)
    try:
        return (names.index(company), company)
    except ValueError:
        return (999, company)


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

    priority = "low"
    if disclosure_count:
        priority = "medium"
    if not disclosures.empty and "_score" in disclosures.columns and disclosures["_score"].max() >= 30:
        priority = "high"
    if news_count >= 5 and priority == "low":
        priority = "medium"

    return {
        "company": company,
        "issue_type": "공시/뉴스" if disclosure_count and news_count else "공시" if disclosure_count else "뉴스",
        "priority": priority,
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


def build_gemini_context(disclosures: pd.DataFrame, news: pd.DataFrame, profiles: dict[str, dict], recent: list[dict[str, Any]]) -> dict[str, Any]:
    companies = sorted(
        set(disclosures.get("회사", pd.Series(dtype=str)).tolist()) | set(news.get("회사", pd.Series(dtype=str)).tolist()),
        key=company_order_key,
    )
    context: dict[str, Any] = {"companies": []}
    for company in companies:
        company_disclosures = disclosures[disclosures["회사"] == company] if not disclosures.empty else pd.DataFrame()
        company_news = news[news["회사"] == company] if not news.empty else pd.DataFrame()
        context["companies"].append(
            {
                "company": company,
                "profile": profiles.get(company, {}),
                "recent_history": past_company_context(company, recent),
                "disclosures": row_records(company_disclosures, ["접수번호", "공시일", "카테고리", "공시명", "정정여부", "actual_summary"], 10),
                "news": row_records(company_news, ["기사일시", "매체", "제목", "링크"], 15),
            }
        )
    return context


def extract_gemini_text(data: dict[str, Any]) -> str:
    chunks: list[str] = []
    for candidate in data.get("candidates") or []:
        content = candidate.get("content") or {}
        for part in content.get("parts") or []:
            text = part.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks).strip()


def normalize_gemini_result(data: Any) -> dict[str, dict[str, Any]]:
    if isinstance(data, dict) and isinstance(data.get("companies"), list):
        rows = data["companies"]
    elif isinstance(data, list):
        rows = data
    else:
        return {}

    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        company = clean(row.get("company"))
        if not company:
            continue
        check_points = row.get("check_points") or []
        evidence = row.get("evidence") or []
        result[company] = {
            "company": company,
            "issue_type": clean(row.get("issue_type")) or "뉴스/공시",
            "priority": clean(row.get("priority")) or "medium",
            "today_summary": clean(row.get("today_summary")),
            "news_summary": clean(row.get("summary")) or clean(row.get("news_summary")),
            "watch_reason": clean(row.get("why_it_matters")) or clean(row.get("watch_reason")),
            "previous_context": clean(row.get("change_from_previous")) or clean(row.get("previous_context")),
            "check_points": [clean(item) for item in check_points if clean(item)][:4],
            "topics": [clean(item) for item in (row.get("topics") or []) if clean(item)][:6],
            "confidence": clean(row.get("confidence")) or "medium",
            "evidence": evidence,
            "generated_by": "gemini",
        }
    return result


def call_gemini_analysis(context: dict[str, Any]) -> dict[str, dict[str, Any]]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    GEMINI_META.update({"attempted": False, "key_present": bool(api_key), "status": "not_configured", "error": ""})
    if not api_key:
        print("[Gemini분석] GEMINI_API_KEY가 없어 규칙 기반으로 분석합니다.")
        return {}
    model = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL
    GEMINI_META.update({"attempted": True, "model": model, "status": "running"})
    prompt = {
        "role": "경쟁사 공시/뉴스 브리핑 분석가",
        "goal": "제목 빈도가 아니라 사업 영향, 리스크, 회사 맥락, 과거 흐름 기준으로 오늘 볼 만한 이슈인지 판단합니다.",
        "decision_rules": [
            "뉴스 건수가 많아도 수상, 캠페인, 인터뷰, 단순 홍보, 사회공헌, 채용, 행사 보도면 priority를 low 또는 reference로 둡니다.",
            "계약, 기술이전, 임상 단계 변화, 품목허가, 실적, 투자, M&A, 소송, 품질/안전, 경영권, 대규모 공급은 더 주의 깊게 봅니다.",
            "회사 프로필의 watch_points와 직접 연결되면 왜 중요한지 설명합니다.",
            "최근 이력과 같은 주제가 반복되면 변화인지 반복 홍보인지 구분합니다.",
            "제공된 데이터에 없는 금액, 임상 결과, 계약 상대방, 사실관계는 추정하지 않습니다.",
            "중요하지 않으면 중요하지 않다고 분명히 씁니다.",
        ],
        "output_format": {
            "companies": [
                {
                    "company": "회사명",
                    "issue_type": "계약/R&D/허가/실적/투자/리스크/홍보/대외평가/참고 중 하나",
                    "priority": "high | medium | low | reference",
                    "today_summary": "오늘 요약 1문장",
                    "summary": "주요 이슈 요약 1~2문장",
                    "why_it_matters": "왜 봐야 하는지 1~2문장",
                    "change_from_previous": "이전 흐름과 비교. 근거 부족하면 부족하다고 작성",
                    "check_points": ["확인할 점 1", "확인할 점 2"],
                    "topics": ["의미 단위 토픽"],
                    "confidence": "low | medium | high",
                    "evidence": ["근거 1", "근거 2"],
                }
            ]
        },
        "input": context,
    }
    try:
        response = requests.post(
            GEMINI_API_URL.format(model=model),
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json={
                "contents": [{"role": "user", "parts": [{"text": json.dumps(prompt, ensure_ascii=False)}]}],
                "generationConfig": {"responseMimeType": "application/json"},
            },
            timeout=75,
        )
        if response.status_code >= 400:
            GEMINI_META.update({"status": "http_error", "error": f"HTTP {response.status_code}: {response.text[:500]}"})
        response.raise_for_status()
        text = extract_gemini_text(response.json())
        parsed = normalize_gemini_result(json.loads(text))
        if parsed:
            GEMINI_META.update({"status": "success", "error": ""})
        else:
            GEMINI_META.update({"status": "empty_result", "error": "Gemini returned no usable company items."})
        return parsed
    except Exception as exc:
        if not GEMINI_META.get("error"):
            GEMINI_META.update({"status": "exception", "error": str(exc)[:500]})
        print(f"[Gemini분석] 호출 실패, 규칙 기반으로 대체합니다: {GEMINI_META['error']}")
        return {}


def merge_analysis(gemini: dict[str, dict[str, Any]], fallback: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    merged = fallback.copy()
    for company, item in gemini.items():
        if company not in merged:
            continue
        base = merged[company].copy()
        base.update({key: value for key, value in item.items() if value not in (None, "", [])})
        merged[company] = base
    return merged


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

    companies = sorted(set(daily.get("회사", pd.Series(dtype=str)).tolist()) | set(news.get("회사", pd.Series(dtype=str)).tolist()), key=company_order_key)
    fallback = {}
    for company in companies:
        company_disclosures = daily[daily["회사"] == company] if not daily.empty else pd.DataFrame()
        company_news = news[news["회사"] == company] if not news.empty else pd.DataFrame()
        fallback[company] = fallback_company_analysis(company, company_disclosures, company_news, profiles, recent)

    gemini = call_gemini_analysis(build_gemini_context(daily, news, profiles, recent))
    results = merge_analysis(gemini, fallback)

    report = {
        "date": display_date.isoformat(),
        "source_disclosure_date": target_date.isoformat(),
        "generated_by": "gemini" if gemini else "rules",
        "analysis_meta": GEMINI_META,
        "companies": results,
    }
    output = daily_path(display_date)
    write_json(output, report)
    update_issue_history(report)
    print(f"[AI분석] 저장 완료: {output}")
    return output


if __name__ == "__main__":
    analyze_today()
