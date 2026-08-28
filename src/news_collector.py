# -*- coding: utf-8 -*-
"""NAVER API HUB 뉴스 수집기 v3."""
from __future__ import annotations

import html
import os
import re
import time
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import requests
from dotenv import load_dotenv

from .dart_collector import TARGET_COMPANIES, save_csv_atomic


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "state"
DATA_DIR.mkdir(exist_ok=True)
load_dotenv(PROJECT_ROOT / ".env")

NEWS_CSV = DATA_DIR / "news_articles.csv"
NAVER_NEWS_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news"
REQUEST_TIMEOUT = 20
REQUEST_GAP_SECONDS = 0.2

NEWS_LOOKBACK_DAYS = int(os.getenv("NEWS_LOOKBACK_DAYS", "2") or "2")
NEWS_DISPLAY_COUNT = int(os.getenv("NEWS_DISPLAY_COUNT", "10") or "10")

NAVER_CLIENT_ID = (
    os.getenv("NAVER_API_HUB_CLIENT_ID")
    or os.getenv("NAVER_CLIENT_ID")
    or ""
).strip()
NAVER_CLIENT_SECRET = (
    os.getenv("NAVER_API_HUB_CLIENT_SECRET")
    or os.getenv("NAVER_CLIENT_SECRET")
    or ""
).strip()

OUTPUT_COLUMNS = [
    "수집일",
    "회사",
    "제목",
    "요약",
    "링크",
    "원문링크",
    "매체",
    "기사일시",
]


def has_news_api_key() -> bool:
    return bool(NAVER_CLIENT_ID and NAVER_CLIENT_SECRET)


def clean_text(value: str) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"</?b>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


def parse_pub_date(value: str) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = parsedate_to_datetime(raw)
        if parsed.tzinfo:
            parsed = parsed.astimezone().replace(tzinfo=None)
        return parsed
    except (TypeError, ValueError):
        return None


def media_from_url(value: str) -> str:
    host = urlparse(str(value or "")).netloc.lower()
    host = host.removeprefix("www.")
    if not host:
        return ""
    parts = host.split(".")
    if len(parts) >= 3 and parts[-2] in {"co", "com", "or", "ne"} and parts[-1] == "kr":
        return parts[-3]
    return parts[-2] if len(parts) >= 2 else host


def normalize_title(value: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣]", "", str(value or "")).lower()


def is_company_article(company: str, title: str, description: str) -> bool:
    # 뉴스레터에는 시황/테마주 기사보다 회사명이 제목에 직접 잡힌 기사를 우선 사용합니다.
    haystack = normalize_title(title)
    needles = {normalize_title(company)}
    if company == "녹십자":
        needles.add(normalize_title("GC녹십자"))
    if company == "보령":
        needles.add(normalize_title("보령제약"))
    if company == "JW중외제약":
        needles.add(normalize_title("제이더블유중외제약"))
    return any(needle and needle in haystack for needle in needles)


def fetch_company_news(company: str, since: datetime) -> list[dict[str, str]]:
    headers = {
        "X-NCP-APIGW-API-KEY-ID": NAVER_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": NAVER_CLIENT_SECRET,
    }
    query = f'"{company}" 제약'
    response = requests.get(
        NAVER_NEWS_URL,
        headers=headers,
        params={
            "query": query,
            "display": max(1, min(100, NEWS_DISPLAY_COUNT)),
            "start": 1,
            "sort": "date",
            "format": "json",
        },
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()

    rows: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in payload.get("items", []):
        title = clean_text(item.get("title", ""))
        description = clean_text(item.get("description", ""))
        if not is_company_article(company, title, description):
            continue
        key = normalize_title(title)
        if not title or key in seen:
            continue
        seen.add(key)

        published = parse_pub_date(item.get("pubDate", ""))
        if published and published < since:
            continue

        link = str(item.get("originallink") or item.get("link") or "").strip()
        rows.append(
            {
                "수집일": datetime.now().strftime("%Y%m%d"),
                "회사": company,
                "제목": title,
                "요약": description,
                "링크": link,
                "원문링크": str(item.get("originallink") or "").strip(),
                "매체": media_from_url(link),
                "기사일시": published.strftime("%Y-%m-%d %H:%M:%S") if published else "",
            }
        )
    return rows


def collect_news() -> pd.DataFrame:
    if not has_news_api_key():
        print("[뉴스수집] NAVER API HUB 키가 없어 뉴스 수집을 건너뜁니다.")
        return pd.DataFrame(columns=OUTPUT_COLUMNS)

    since = datetime.now() - timedelta(days=max(1, NEWS_LOOKBACK_DAYS))
    all_rows: list[dict[str, str]] = []
    for index, company in enumerate(TARGET_COMPANIES.keys(), start=1):
        try:
            rows = fetch_company_news(company, since)
            all_rows.extend(rows)
            print(f"[뉴스수집] {index}/{len(TARGET_COMPANIES)} {company}: {len(rows)}건")
        except Exception as exc:
            print(f"[뉴스수집] {company} 실패: {exc}")
        time.sleep(REQUEST_GAP_SECONDS)

    frame = pd.DataFrame(all_rows, columns=OUTPUT_COLUMNS)
    if not frame.empty:
        frame = frame.drop_duplicates(subset=["회사", "제목"], keep="first")
        frame = frame.sort_values(["기사일시", "회사"], ascending=[False, True])
    save_csv_atomic(frame, NEWS_CSV)
    print(f"[뉴스수집] 저장 완료: {NEWS_CSV} ({len(frame)}건)")
    return frame


if __name__ == "__main__":
    collect_news()
