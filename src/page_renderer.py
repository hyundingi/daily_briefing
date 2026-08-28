# -*- coding: utf-8 -*-
"""GitHub Pages용 브리핑 아카이브 생성."""
from __future__ import annotations

import json
import re
import shutil
from datetime import date, datetime
from pathlib import Path

import pandas as pd

from . import newsletter_renderer
from .dart_collector import TARGET_COMPANIES


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = PROJECT_ROOT / "public"
ARCHIVE_DIR = PUBLIC_DIR / "archive"
STATE_DIR = PROJECT_ROOT / "state"
ARCHIVE_INDEX = STATE_DIR / "archive_index.json"


def esc(value: object) -> str:
    return newsletter_renderer.esc(value)


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, encoding="utf-8-sig", dtype=str).fillna("")


def load_archive_index() -> list[dict[str, object]]:
    if not ARCHIVE_INDEX.exists():
        return []
    try:
        data = json.loads(ARCHIVE_INDEX.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def save_archive_index(items: list[dict[str, object]]) -> None:
    STATE_DIR.mkdir(exist_ok=True)
    ARCHIVE_INDEX.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_report_date() -> date:
    raw = newsletter_renderer.display_date_from_env()
    return raw


def make_archive_entry(report_date: date) -> dict[str, object]:
    disclosures = newsletter_renderer.load_disclosures()
    target_date = newsletter_renderer.pick_disclosure_date(disclosures, newsletter_renderer.report_date_from_env())
    daily = disclosures[disclosures["_date"] == target_date].copy() if not disclosures.empty else pd.DataFrame()
    news = newsletter_renderer.load_news(target_date)
    companies = sorted(set(daily.get("회사", pd.Series(dtype=str)).tolist()) | set(news.get("회사", pd.Series(dtype=str)).tolist()))
    categories = sorted(set(daily.get("카테고리", pd.Series(dtype=str)).tolist()))
    return {
        "date": report_date.isoformat(),
        "title": f"{report_date:%Y.%m.%d} 경쟁사 모닝 브리핑",
        "path": f"archive/{report_date.isoformat()}.html",
        "disclosure_count": int(len(daily)),
        "news_count": int(len(news)),
        "companies": companies,
        "categories": categories,
    }


def upsert_archive_entry(entry: dict[str, object]) -> list[dict[str, object]]:
    items = [item for item in load_archive_index() if item.get("date") != entry.get("date")]
    items.append(entry)
    items.sort(key=lambda item: str(item.get("date", "")), reverse=True)
    save_archive_index(items)
    return items


def render_filter_options(items: list[dict[str, object]], key: str) -> str:
    values: set[str] = set()
    for item in items:
        values.update(str(value) for value in item.get(key, []) if value)
    return "".join(f'<option value="{esc(value)}">{esc(value)}</option>' for value in sorted(values))


def render_archive_cards(items: list[dict[str, object]]) -> str:
    cards = []
    for item in items:
        companies = ",".join(map(str, item.get("companies", [])))
        categories = ",".join(map(str, item.get("categories", [])))
        company_labels = ", ".join(map(str, item.get("companies", []))) or "-"
        category_labels = ", ".join(map(str, item.get("categories", []))) or "-"
        cards.append(
            f'''
        <article class="archive-card" data-company="{esc(companies)}" data-category="{esc(categories)}">
          <a href="{esc(item.get('path', ''))}">{esc(item.get('title', ''))}</a>
          <p>신규 공시 {esc(item.get('disclosure_count', 0))}건 · 최신 뉴스 {esc(item.get('news_count', 0))}건</p>
          <small>{esc(company_labels)} · {esc(category_labels)}</small>
        </article>'''
        )
    return "".join(cards) or '<p class="empty">아직 저장된 브리핑이 없습니다.</p>'


def render_index(items: list[dict[str, object]]) -> None:
    latest_link = esc(items[0]["path"]) if items else "#"
    html = f'''<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>경쟁사 브리핑 아카이브</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin:0; background:#f6f4ef; color:#243244; font-family:Arial,'Malgun Gothic','Apple SD Gothic Neo',sans-serif; }}
    main {{ max-width:920px; margin:0 auto; padding:34px 18px 54px; }}
    header {{ margin-bottom:24px; }}
    h1 {{ margin:0 0 10px; font-size:32px; line-height:1.25; letter-spacing:-0.02em; }}
    p {{ line-height:1.7; }}
    .latest {{ display:inline-block; margin-top:10px; padding:11px 15px; border-radius:999px; background:#243244; color:#fff; text-decoration:none; font-weight:700; }}
    .filters {{ display:flex; gap:10px; flex-wrap:wrap; margin:24px 0 18px; }}
    select {{ min-width:180px; padding:10px 12px; border:1px solid #ddd4c7; border-radius:12px; background:#fffdf8; color:#243244; font-size:15px; }}
    .archive-card {{ margin-bottom:12px; padding:18px 20px; border-radius:16px; background:#fffdf8; }}
    .archive-card a {{ color:#1f2d3d; text-decoration:none; font-size:19px; line-height:1.45; font-weight:700; }}
    .archive-card p {{ margin:8px 0 5px; color:#665f57; }}
    .archive-card small {{ color:#82786d; line-height:1.6; }}
    .empty {{ padding:18px 20px; border-radius:16px; background:#fffdf8; color:#665f57; }}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>경쟁사 브리핑 아카이브</h1>
      <p>매일 생성된 공시·뉴스 브리핑을 날짜, 회사, 공시 카테고리 기준으로 다시 볼 수 있습니다.</p>
      <a class="latest" href="{latest_link}">최신 브리핑 보기</a>
    </header>
    <section class="filters" aria-label="브리핑 필터">
      <select id="company-filter"><option value="">전체 회사</option>{render_filter_options(items, 'companies')}</select>
      <select id="category-filter"><option value="">전체 카테고리</option>{render_filter_options(items, 'categories')}</select>
    </section>
    <section id="archive-list">{render_archive_cards(items)}</section>
  </main>
  <script>
    const company = document.getElementById('company-filter');
    const category = document.getElementById('category-filter');
    const cards = [...document.querySelectorAll('.archive-card')];
    function applyFilters() {{
      const c = company.value;
      const k = category.value;
      cards.forEach(card => {{
        const okCompany = !c || card.dataset.company.split(',').includes(c);
        const okCategory = !k || card.dataset.category.split(',').includes(k);
        card.style.display = okCompany && okCategory ? '' : 'none';
      }});
    }}
    company.addEventListener('change', applyFilters);
    category.addEventListener('change', applyFilters);
  </script>
</body>
</html>'''
    PUBLIC_DIR.mkdir(exist_ok=True)
    (PUBLIC_DIR / "index.html").write_text(html, encoding="utf-8")


def render_pages(email_html_path: Path) -> None:
    report_date = parse_report_date()
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    archive_path = ARCHIVE_DIR / f"{report_date.isoformat()}.html"
    shutil.copyfile(email_html_path, archive_path)
    items = upsert_archive_entry(make_archive_entry(report_date))
    render_index(items)
    print(f"[페이지] 저장 완료: {PUBLIC_DIR}")
