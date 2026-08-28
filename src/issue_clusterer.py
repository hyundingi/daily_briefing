# -*- coding: utf-8 -*-
"""뉴스 제목 기반 이슈 클러스터링."""
from __future__ import annotations

import re
from typing import Iterable

import pandas as pd


STOPWORDS = {"관련", "뉴스", "오늘", "단독", "종합", "기자", "제약", "바이오", "헬스", "공개", "확대", "강화"}


def normalize_text(value: object, company_names: Iterable[str] = ()) -> str:
    text = str(value or "").lower()
    text = re.sub(r"\[[^\]]+\]", " ", text)
    for company in company_names:
        text = text.replace(str(company).lower(), " ")
    text = re.sub(r"[0-9]+(?:조|억|만|개|건|%)?", " ", text)
    text = re.sub(r"[^0-9a-z가-힣]", " ", text)
    words = [word for word in text.split() if len(word) >= 2 and word not in STOPWORDS]
    return " ".join(words[:8])


def similarity(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def cluster_news(news: pd.DataFrame, company_names: Iterable[str], threshold: float = 0.34) -> list[dict[str, object]]:
    if news.empty or "회사" not in news.columns:
        return []
    clusters: list[dict[str, object]] = []
    sort_columns = [col for col in ["_published", "기사일시"] if col in news.columns]
    ordered = news.sort_values(sort_columns, ascending=False) if sort_columns else news
    for _, row in ordered.iterrows():
        company = str(row.get("회사", "")).strip()
        tokens = set(normalize_text(row.get("제목", ""), company_names).split())
        match = None
        for cluster in clusters:
            if cluster["company"] == company and similarity(tokens, cluster["tokens"]) >= threshold:
                match = cluster
                break
        if match is None:
            match = {"company": company, "tokens": tokens, "articles": []}
            clusters.append(match)
        match["articles"].append(row)
        match["tokens"] = set(match["tokens"]) | tokens
    clusters.sort(key=lambda item: len(item["articles"]), reverse=True)
    return clusters
