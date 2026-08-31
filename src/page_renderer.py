# -*- coding: utf-8 -*-
"""GitHub Pages용 회사별 현황판과 브리핑 아카이브 생성."""
from __future__ import annotations

import json
import shutil
from datetime import date
from pathlib import Path

import pandas as pd

from . import newsletter_renderer
from .dart_collector import TARGET_COMPANIES


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = PROJECT_ROOT / "public"
ARCHIVE_DIR = PUBLIC_DIR / "archive"
STATE_DIR = PROJECT_ROOT / "state"
ARCHIVE_INDEX = STATE_DIR / "archive_index.json"
ANALYSIS_DIR = STATE_DIR / "daily_briefings"
COMPANY_ORDER = list(TARGET_COMPANIES.keys()) if isinstance(TARGET_COMPANIES, dict) else list(TARGET_COMPANIES)


def esc(value: object) -> str:
    return newsletter_renderer.esc(value)


def clean(value: object) -> str:
    return newsletter_renderer.clean_text(value)


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, encoding="utf-8-sig", dtype=str).fillna("")


def read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def load_archive_index() -> list[dict[str, object]]:
    data = read_json(ARCHIVE_INDEX, [])
    return data if isinstance(data, list) else []


def save_archive_index(items: list[dict[str, object]]) -> None:
    STATE_DIR.mkdir(exist_ok=True)
    ARCHIVE_INDEX.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_report_date() -> date:
    return newsletter_renderer.display_date_from_env()


def company_sort_key(company: str) -> tuple[int, str]:
    try:
        return (COMPANY_ORDER.index(company), company)
    except ValueError:
        return (999, company)


def latest_analysis(report_date: date) -> dict[str, dict]:
    path = ANALYSIS_DIR / f"{report_date.isoformat()}.json"
    data = read_json(path, {})
    companies = data.get("companies") if isinstance(data, dict) else {}
    return companies if isinstance(companies, dict) else {}


def load_current_data() -> tuple[pd.DataFrame, pd.DataFrame, date]:
    disclosures = newsletter_renderer.load_disclosures()
    target_date = newsletter_renderer.pick_disclosure_date(disclosures, newsletter_renderer.report_date_from_env())
    news = read_csv(newsletter_renderer.NEWS_CSV)
    if "기사일시" in news.columns:
        news["_published"] = pd.to_datetime(news["기사일시"], errors="coerce")
        news = news.sort_values(["회사", "_published"], ascending=[True, False], na_position="last")
    return disclosures, news, target_date


def make_archive_entry(report_date: date) -> dict[str, object]:
    disclosures = newsletter_renderer.load_disclosures()
    target_date = newsletter_renderer.pick_disclosure_date(disclosures, newsletter_renderer.report_date_from_env())
    daily = disclosures[disclosures["_date"] == target_date].copy() if not disclosures.empty else pd.DataFrame()
    news = newsletter_renderer.load_news(target_date)
    companies = sorted(set(daily.get("회사", pd.Series(dtype=str)).tolist()) | set(news.get("회사", pd.Series(dtype=str)).tolist()), key=company_sort_key)
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


def option_values(archives: list[dict[str, object]], disclosures: pd.DataFrame, news: pd.DataFrame, key: str) -> list[str]:
    values: set[str] = set()
    for item in archives:
        values.update(str(value) for value in item.get(key, []) if value)
    if key == "companies":
        values.update(clean(value) for value in disclosures.get("회사", pd.Series(dtype=str)).tolist() if clean(value))
        values.update(clean(value) for value in news.get("회사", pd.Series(dtype=str)).tolist() if clean(value))
        return sorted(values, key=company_sort_key)
    if key == "categories":
        values.update(clean(value) for value in disclosures.get("카테고리", pd.Series(dtype=str)).tolist() if clean(value))
    return sorted(values)


def render_options(values: list[str]) -> str:
    return "".join(f'<option value="{esc(value)}">{esc(value)}</option>' for value in values)


def render_disclosure_items(rows: pd.DataFrame) -> str:
    if rows.empty:
        return '<li class="muted">최근 공시가 없습니다.</li>'
    items = []
    ordered = rows.sort_values(["_date", "_score"], ascending=[False, False], na_position="last") if "_date" in rows.columns else rows
    for _, row in ordered.head(12).iterrows():
        title = clean(row.get("공시명", ""))
        category = clean(row.get("카테고리", ""))
        date_text = clean(row.get("공시일", ""))
        link = clean(row.get("DART링크", "")) or newsletter_renderer.DART_VIEWER_URL + clean(row.get("접수번호", ""))
        items.append(
            f'<li data-category="{esc(category)}"><a href="{esc(link)}">{esc(title)}</a><span>{esc(date_text)} · {esc(category or "기타")}</span></li>'
        )
    return "".join(items)


def render_news_items(rows: pd.DataFrame) -> str:
    if rows.empty:
        return '<li class="muted">최근 뉴스가 없습니다.</li>'
    items = []
    ordered = rows.sort_values("_published", ascending=False, na_position="last") if "_published" in rows.columns else rows
    for _, row in ordered.head(12).iterrows():
        title = clean(row.get("제목", ""))
        media = clean(row.get("매체", ""))
        date_text = clean(row.get("기사일시", ""))[:10]
        link = clean(row.get("링크", ""))
        items.append(f'<li><a href="{esc(link)}">{esc(title)}</a><span>{esc(date_text)} · {esc(media)}</span></li>')
    return "".join(items)


def render_detail_block(item: dict) -> str:
    check_points = [clean(value) for value in item.get("check_points", []) if clean(value)] if isinstance(item.get("check_points", []), list) else []
    rows = [
        ("판단", " · ".join(value for value in [clean(item.get("issue_type", "")), clean(item.get("priority", ""))] if value)),
        ("오늘 요약", clean(item.get("today_summary", ""))),
        ("주요 내용", clean(item.get("news_summary", ""))),
        ("왜 봐야 하나", clean(item.get("watch_reason", ""))),
        ("이전 흐름", clean(item.get("previous_context", ""))),
        ("확인할 점", " / ".join(check_points[:3])),
    ]
    parts = []
    for label, value in rows:
        if not value:
            continue
        parts.append(f'<div class="brief-row"><span>{esc(label)}</span><p>{esc(value)}</p></div>')
    return "".join(parts)


def render_company_cards(disclosures: pd.DataFrame, news: pd.DataFrame, analysis: dict[str, dict]) -> str:
    companies = sorted(set(COMPANY_ORDER) | set(disclosures.get("회사", pd.Series(dtype=str)).tolist()) | set(news.get("회사", pd.Series(dtype=str)).tolist()), key=company_sort_key)
    cards = []
    for company in companies:
        company = clean(company)
        drows = disclosures[disclosures["회사"] == company] if not disclosures.empty and "회사" in disclosures.columns else pd.DataFrame()
        nrows = news[news["회사"] == company] if not news.empty and "회사" in news.columns else pd.DataFrame()
        item = analysis.get(company, {}) if isinstance(analysis.get(company, {}), dict) else {}
        categories = ",".join(sorted(set(drows.get("카테고리", pd.Series(dtype=str)).tolist())))
        search_text = " ".join(
            [
                company,
                clean(item.get("today_summary", "")),
                clean(item.get("watch_reason", "")),
                " ".join(map(str, drows.get("공시명", pd.Series(dtype=str)).tolist())),
                " ".join(map(str, nrows.get("제목", pd.Series(dtype=str)).tolist())),
            ]
        ).lower()
        color = newsletter_renderer.company_color(company)
        summary = clean(item.get("today_summary", "")) or f"최근 공시 {len(drows)}건, 뉴스 {len(nrows)}건이 저장되어 있습니다."
        if not item:
            item = {
                "today_summary": summary,
                "watch_reason": "후속 공시와 반복 뉴스 발생 여부를 확인하면 됩니다.",
                "check_points": ["후속 DART 공시 여부", "동일 주제 뉴스 반복 여부"],
            }
        detail_block = render_detail_block(item)
        cards.append(
            f'''
        <article class="company-card" data-company="{esc(company)}" data-category="{esc(categories)}" data-search="{esc(search_text)}">
          <div class="card-head">
            <span class="company-chip" style="background:{color}">{esc(company)}</span>
            <span class="counts">공시 {len(drows)}건 · 뉴스 {len(nrows)}건</span>
          </div>
          <div class="brief-box">{detail_block}</div>
          <div class="columns">
            <section>
              <h3>최근 공시</h3>
              <ul class="item-list disclosure-list">{render_disclosure_items(drows)}</ul>
            </section>
            <section>
              <h3>최근 뉴스</h3>
              <ul class="item-list news-list">{render_news_items(nrows)}</ul>
            </section>
          </div>
        </article>'''
        )
    return "".join(cards)


def render_archive_cards(items: list[dict[str, object]]) -> str:
    cards = []
    for item in items:
        companies = ",".join(map(str, item.get("companies", [])))
        categories = ",".join(map(str, item.get("categories", [])))
        company_labels = ", ".join(map(str, item.get("companies", []))) or "-"
        category_labels = ", ".join(map(str, item.get("categories", []))) or "-"
        search_text = f"{item.get('title', '')} {company_labels} {category_labels}".lower()
        cards.append(
            f'''
        <article class="archive-card" data-company="{esc(companies)}" data-category="{esc(categories)}" data-search="{esc(search_text)}">
          <a href="{esc(item.get('path', ''))}">{esc(item.get('title', ''))}</a>
          <p>신규 공시 {esc(item.get('disclosure_count', 0))}건 · 최신 뉴스 {esc(item.get('news_count', 0))}건</p>
          <small>{esc(company_labels)} · {esc(category_labels)}</small>
        </article>'''
        )
    return "".join(cards) or '<p class="empty">아직 저장된 브리핑이 없습니다.</p>'


def render_index(items: list[dict[str, object]], report_date: date) -> None:
    disclosures, news, _ = load_current_data()
    analysis = latest_analysis(report_date)
    company_options = render_options(option_values(items, disclosures, news, "companies"))
    category_options = render_options(option_values(items, disclosures, news, "categories"))
    company_cards = render_company_cards(disclosures, news, analysis)
    archive_cards = render_archive_cards(items)
    latest_link = esc(items[0]["path"]) if items else "#"
    html = f'''<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>경쟁사 브리핑</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin:0; background:#f6f4ef; color:#243244; font-family:Arial,'Malgun Gothic','Apple SD Gothic Neo',sans-serif; }}
    main {{ max-width:1120px; margin:0 auto; padding:34px 18px 58px; }}
    header {{ margin-bottom:22px; }}
    h1 {{ margin:0 0 10px; font-size:33px; line-height:1.25; letter-spacing:-0.02em; }}
    p {{ line-height:1.7; }}
    .top-actions {{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:14px; }}
    .latest {{ display:inline-block; padding:11px 15px; border-radius:999px; background:#243244; color:#fff; text-decoration:none; font-weight:700; }}
    .tabs {{ display:flex; gap:8px; margin:24px 0 14px; }}
    .tab-button {{ border:0; border-radius:999px; padding:11px 16px; background:#e8e1d4; color:#5f554b; font-weight:800; cursor:pointer; }}
    .tab-button.active {{ background:#243244; color:#fff; }}
    .filters {{ display:grid; grid-template-columns: minmax(260px, 1fr) 190px 190px; gap:10px; margin:0 0 18px; }}
    input, select {{ width:100%; padding:12px 13px; border:1px solid #ddd4c7; border-radius:13px; background:#fffdf8; color:#243244; font-size:15px; }}
    .panel {{ display:none; }}
    .panel.active {{ display:block; }}
    .company-card, .archive-card, .empty {{ margin-bottom:14px; padding:20px 22px; border-radius:18px; background:#fffdf8; box-shadow:0 8px 24px rgba(45,37,25,.05); }}
    .card-head {{ display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:12px; }}
    .company-chip {{ display:inline-block; color:#fff; border-radius:999px; padding:7px 13px; font-size:15px; font-weight:800; }}
    .counts {{ color:#81766a; font-size:14px; font-weight:700; white-space:nowrap; }}
    .brief-box {{ margin:0 0 16px; padding:13px 15px; border-radius:14px; background:#faf4e9; }}
    .brief-row {{ display:grid; grid-template-columns:86px 1fr; gap:12px; padding:5px 0; }}
    .brief-row span {{ color:#756c61; font-size:13px; font-weight:800; white-space:nowrap; }}
    .brief-row p {{ margin:0; color:#4b5966; font-size:14px; line-height:1.65; }}
    .columns {{ display:grid; grid-template-columns:1fr 1.15fr; gap:20px; }}
    h3 {{ margin:0 0 9px; font-size:15px; color:#6d6255; }}
    .item-list {{ margin:0; padding-left:20px; }}
    .item-list li {{ margin:0 0 10px; color:#9a6d38; line-height:1.55; }}
    .item-list a {{ color:#26384a; text-decoration:none; font-weight:700; }}
    .item-list span {{ display:block; margin-top:2px; color:#887e73; font-size:13px; }}
    .muted {{ color:#9a9287 !important; }}
    .archive-card a {{ color:#1f2d3d; text-decoration:none; font-size:19px; line-height:1.45; font-weight:800; }}
    .archive-card p {{ margin:8px 0 5px; color:#665f57; }}
    .archive-card small {{ color:#82786d; line-height:1.6; }}
    .hidden {{ display:none !important; }}
    @media (max-width:760px) {{
      main {{ padding:26px 14px 44px; }}
      .filters {{ grid-template-columns:1fr; }}
      .columns {{ grid-template-columns:1fr; }}
      .brief-row {{ grid-template-columns:1fr; gap:2px; }}
      .card-head {{ align-items:flex-start; flex-direction:column; }}
      h1 {{ font-size:28px; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>경쟁사 브리핑</h1>
      <p>회사별 최근 공시와 뉴스를 한 화면에서 보고, 지난 브리핑은 아카이브 탭에서 다시 확인할 수 있습니다.</p>
      <div class="top-actions"><a class="latest" href="{latest_link}">최신 브리핑 원문 보기</a></div>
    </header>

    <nav class="tabs" aria-label="화면 선택">
      <button class="tab-button active" data-tab="dashboard" type="button">회사별 현황</button>
      <button class="tab-button" data-tab="archive" type="button">브리핑 아카이브</button>
    </nav>

    <section class="filters" aria-label="검색 및 필터">
      <input id="search-box" type="search" placeholder="회사명, 공시명, 뉴스 키워드로 검색">
      <select id="company-filter"><option value="">전체 회사</option>{company_options}</select>
      <select id="category-filter"><option value="">전체 공시 카테고리</option>{category_options}</select>
    </section>

    <section id="dashboard" class="panel active">{company_cards}</section>
    <section id="archive" class="panel">{archive_cards}</section>
  </main>
  <script>
    const searchBox = document.getElementById('search-box');
    const company = document.getElementById('company-filter');
    const category = document.getElementById('category-filter');
    const tabs = [...document.querySelectorAll('.tab-button')];
    const panels = [...document.querySelectorAll('.panel')];

    function activePanel() {{ return document.querySelector('.panel.active'); }}
    function items() {{ return [...activePanel().querySelectorAll('.company-card, .archive-card')]; }}
    function matchCompany(card, value) {{ return !value || card.dataset.company.split(',').includes(value); }}
    function matchCategory(card, value) {{ return !value || card.dataset.category.split(',').includes(value); }}
    function matchSearch(card, value) {{ return !value || (card.dataset.search || '').includes(value); }}
    function applyFilters() {{
      const q = searchBox.value.trim().toLowerCase();
      const c = company.value;
      const k = category.value;
      items().forEach(card => {{
        card.classList.toggle('hidden', !(matchCompany(card, c) && matchCategory(card, k) && matchSearch(card, q)));
      }});
    }}
    tabs.forEach(button => button.addEventListener('click', () => {{
      tabs.forEach(item => item.classList.remove('active'));
      panels.forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(button.dataset.tab).classList.add('active');
      applyFilters();
    }}));
    searchBox.addEventListener('input', applyFilters);
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
    render_index(items, report_date)
    print(f"[페이지] 저장 완료: {PUBLIC_DIR}")
