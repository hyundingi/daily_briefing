# -*- coding: utf-8 -*-
"""DART 공시와 뉴스 CSV로 이메일용 뉴스레터 HTML을 생성합니다."""
from __future__ import annotations

import html
import os
import re
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from .dart_collector import TARGET_COMPANIES


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "state"
load_dotenv(PROJECT_ROOT / ".env")

DISCLOSURE_CSV = DATA_DIR / "dart_disclosure_view.csv"
SUMMARY_CSV = DATA_DIR / "dart_disclosure_summary_cache.csv"
NEWS_CSV = DATA_DIR / "news_articles.csv"
OUTPUT_HTML = PROJECT_ROOT / "newsletter_preview.html"

DART_VIEWER_URL = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo="
MAX_MAJOR_ISSUES = int(os.getenv("NEWSLETTER_MAX_MAJOR_ISSUES", "5") or "5")
MAX_NEWS_PER_COMPANY = int(os.getenv("NEWSLETTER_MAX_NEWS_PER_COMPANY", "4") or "4")
MAX_NEWS_GROUPS = int(os.getenv("NEWSLETTER_MAX_NEWS_GROUPS", "50") or "50")
MAX_NEWS_TOPIC_WORDS = 4

COMPANY_COLORS = {
    "동아에스티": "#2f6fb3",
    "한미약품": "#c45636",
    "종근당": "#7457a8",
    "유한양행": "#16805d",
    "녹십자": "#2f8f3a",
    "제일약품": "#b27322",
    "대웅제약": "#365c9f",
    "보령": "#b23b62",
    "JW중외제약": "#54606f",
    "일동제약": "#8b5f2a",
}

IMPORTANT_KEYWORDS = [
    "기술이전",
    "라이선스",
    "임상",
    "품목허가",
    "계약",
    "중대재해",
    "투자판단",
    "합병",
    "분할",
    "취득",
    "처분",
    "유상증자",
    "전환사채",
]
IMPORTANT_CATEGORIES = {"사업/계약", "투자/M&A", "자금조달"}


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_for_cluster(value: object) -> str:
    text = clean_text(value).lower()
    text = re.sub(r"\[[^\]]+\]", " ", text)
    for company in TARGET_COMPANIES:
        text = text.replace(company.lower(), " ")
    text = re.sub(r"[0-9]+(?:조|억|만|개|건|%)?", " ", text)
    text = re.sub(r"[^0-9a-z가-힣]", " ", text)
    stopwords = {"관련", "뉴스", "오늘", "단독", "종합", "기자", "제약", "바이오", "헬스", "공개", "확대", "강화"}
    words = [word for word in text.split() if len(word) >= 2 and word not in stopwords]
    return " ".join(words[:8])


def token_set(value: object) -> set[str]:
    return set(normalize_for_cluster(value).split())


def format_display_date(value: date) -> str:
    weekdays = "월화수목금토일"
    return f"{value:%Y.%m.%d} {weekdays[value.weekday()]}요일"


def parse_yyyymmdd(value: object) -> date | None:
    raw = re.sub(r"[^0-9]", "", str(value or ""))
    if len(raw) != 8:
        return None
    try:
        return datetime.strptime(raw, "%Y%m%d").date()
    except ValueError:
        return None


def report_date_from_env() -> date:
    raw = os.getenv("NEWSLETTER_REPORT_DATE", "").strip()
    if raw:
        parsed = parse_yyyymmdd(raw)
        if parsed:
            return parsed
    return date.today() - timedelta(days=1)


def display_date_from_env() -> date:
    raw = os.getenv("NEWSLETTER_DISPLAY_DATE", "").strip()
    if raw:
        parsed = parse_yyyymmdd(raw)
        if parsed:
            return parsed
    return date.today()


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, encoding="utf-8-sig", dtype=str).fillna("")


def load_disclosures() -> pd.DataFrame:
    frame = read_csv(DISCLOSURE_CSV)
    if frame.empty:
        return frame
    summary = read_csv(SUMMARY_CSV)
    if not summary.empty and "접수번호" in summary.columns:
        summary = summary[["접수번호", "actual_summary"]].drop_duplicates("접수번호", keep="last")
        frame = frame.merge(summary, on="접수번호", how="left")
    if "actual_summary" not in frame.columns:
        frame["actual_summary"] = ""
    frame["_date"] = frame["공시일"].map(parse_yyyymmdd)
    frame["_score"] = frame.apply(score_disclosure, axis=1)
    return frame


def score_disclosure(row: pd.Series) -> int:
    title = clean_text(row.get("공시명", ""))
    category = clean_text(row.get("카테고리", ""))
    score = 0
    if category in IMPORTANT_CATEGORIES:
        score += 30
    if str(row.get("정정여부", "")).upper() == "Y":
        score += 12
    for keyword in IMPORTANT_KEYWORDS:
        if keyword in title:
            score += 10
    if "공정거래자율준수" in title or "의결권대리" in title or "주주총회소집" in title:
        score -= 18
    return score


def pick_disclosure_date(frame: pd.DataFrame, preferred: date) -> date:
    if frame.empty or "_date" not in frame.columns:
        return preferred
    dates = [d for d in frame["_date"].dropna().unique()]
    if preferred in dates:
        return preferred
    return max(dates) if dates else preferred


def load_news(target_date: date) -> pd.DataFrame:
    frame = read_csv(NEWS_CSV)
    if frame.empty:
        return frame
    if "기사일시" in frame.columns:
        parsed = pd.to_datetime(frame["기사일시"], errors="coerce")
        frame = frame[(parsed.dt.date >= target_date) | parsed.isna()].copy()
        frame["_published"] = parsed
    return frame


def company_color(company: str) -> str:
    return COMPANY_COLORS.get(company, "#6f7f91")


def short_title(title: str) -> str:
    text = clean_text(title)
    text = re.sub(r"^\[기재정정\]", "[기재정정] ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def make_issue_summary(row: pd.Series) -> str:
    cached = clean_text(row.get("actual_summary", ""))
    if cached and not cached.startswith("원문 요약 실패"):
        return cached
    title = short_title(row.get("공시명", ""))
    return f"{title} 공시가 접수됐습니다. 제목을 눌러 원문을 확인해 주세요."


def make_check_point(row: pd.Series) -> str:
    title = clean_text(row.get("공시명", ""))
    if "정정" in title:
        return "기존 공시 대비 변경된 항목이 무엇인지 원문과 이전 공시를 함께 확인해야 합니다."
    if "중대재해" in title:
        return "대상 사업장, 조업 영향, 후속 행정조치 여부를 우선 확인해야 합니다."
    if "기술이전" in title or "계약" in title:
        return "계약 상대방, 금액, 권리 범위, 조건부 수익 인식 여부를 확인해야 합니다."
    return "재무수치, 사업 내용, 일정 등 실무 판단에 영향을 주는 변경 사항이 있는지 확인해야 합니다."


def render_company_news_list(news: pd.DataFrame, company: str) -> str:
    if news.empty or "회사" not in news.columns:
        return ""
    rows = news[news["회사"] == company].head(MAX_NEWS_PER_COMPANY)
    if rows.empty:
        return ""

    items = []
    for _, row in rows.iterrows():
        title = esc(row.get("제목", ""))
        link = esc(row.get("링크", ""))
        media = esc(row.get("매체", ""))
        media_html = f'<span style="color:#82786d; font-size:13px; font-weight:400;"> · {media}</span>' if media else ""
        items.append(
            f'''<li style="margin:0 0 10px; padding-left:4px; font-size:15px; line-height:1.68; color:{company_color(company)};">
                          <a href="{link}" style="color:#26384a; text-decoration:none; font-weight:700;">{title}</a>{media_html}
                        </li>'''
        )
    return f'''
                    <div style="margin-top:24px; padding-top:20px; border-top:1px solid #eee9df;">
                      <div style="margin-bottom:8px; font-size:14px; line-height:1.5; color:#6d6255; font-weight:700;">최신 뉴스</div>
                      <ul class="news-tail" style="margin:0; padding:0 0 0 22px; color:{company_color(company)};">
                        {''.join(items)}
                      </ul>
                    </div>'''


def news_similarity(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def cluster_news(news: pd.DataFrame) -> list[dict[str, object]]:
    if news.empty or "회사" not in news.columns:
        return []

    clusters: list[dict[str, object]] = []
    sort_columns = [col for col in ["_published", "기사일시"] if col in news.columns]
    ordered = news.sort_values(sort_columns, ascending=False) if sort_columns else news
    for _, row in ordered.iterrows():
        company = clean_text(row.get("회사", ""))
        tokens = token_set(row.get("제목", ""))
        matched = None
        for cluster in clusters:
            if cluster["company"] != company:
                continue
            if news_similarity(tokens, cluster["tokens"]) >= 0.34:
                matched = cluster
                break
        if matched is None:
            matched = {"company": company, "tokens": tokens, "articles": []}
            clusters.append(matched)
        matched["articles"].append(row)
        matched["tokens"] = set(matched["tokens"]) | tokens
    clusters.sort(key=lambda item: len(item["articles"]), reverse=True)
    return clusters[:MAX_NEWS_GROUPS]


def render_news_item(row: pd.Series, company: str) -> str:
    title = esc(row.get("제목", ""))
    link = esc(row.get("링크", ""))
    media = esc(row.get("매체", ""))
    media_html = f'<span style="color:#82786d; font-size:13px; font-weight:400;"> · {media}</span>' if media else ""
    return f'''<li style="margin:0 0 10px; padding-left:4px; font-size:15px; line-height:1.68; color:{company_color(company)};">
                              <a href="{link}" style="color:#26384a; text-decoration:none; font-weight:700;">{title}</a>{media_html}
                            </li>'''


def summarize_company_news(rows: pd.DataFrame) -> str:
    if rows.empty:
        return ""
    words: list[str] = []
    for title in rows.get("제목", pd.Series(dtype=str)).head(8):
        words.extend(normalize_for_cluster(title).split())
    counts: dict[str, int] = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    topics = [word for word, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:MAX_NEWS_TOPIC_WORDS]]
    if not topics:
        return "오늘 나온 주요 기사들을 기업별로 모았습니다."
    return "오늘은 " + ", ".join(topics) + " 관련 보도가 눈에 띕니다."


def render_news_section(news: pd.DataFrame) -> str:
    if news.empty or "회사" not in news.columns:
        return '''
          <tr>
            <td class="page-pad" style="padding:0 42px 0;">
              <div style="font-size:15px; line-height:1.5; color:#6d6255; font-weight:700; letter-spacing:0.02em; margin-bottom:10px;">최신 뉴스</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden;">
                <tr><td style="padding:21px 22px; font-size:15px; line-height:1.75; color:#64747a;">수집된 최신 뉴스가 없습니다.</td></tr>
              </table>
            </td>
          </tr>'''

    sections = []
    grouped = news.groupby("회사", sort=False)
    for company, rows in grouped:
        company = clean_text(company)
        items = "".join(render_news_item(row, company) for _, row in rows.iterrows())
        topic_summary = esc(summarize_company_news(rows))
        sections.append(
            f'''
                    <div style="padding:20px 0; border-bottom:1px solid #eee9df;">
                      <div style="margin-bottom:10px; font-size:0;"><span class="company-tag" style="display:inline-block; padding:6px 11px; background-color:{company_color(company)}; color:#ffffff; border-radius:999px; font-size:14px; line-height:1.35; font-weight:700;">{esc(company)}</span></div>
                      <div style="background-color:#faf8f3; border-radius:12px; padding:12px 14px; margin-bottom:12px; font-size:14px; line-height:1.7; color:#665f57;">{topic_summary}</div>
                      <ul class="news-tail" style="margin:0; padding:0 0 0 22px; color:{company_color(company)};">
                        {items}
                      </ul>
                    </div>'''
        )
    return f'''
          <tr>
            <td class="page-pad" style="padding:0 42px 0;">
              <div style="font-size:15px; line-height:1.5; color:#6d6255; font-weight:700; letter-spacing:0.02em; margin-bottom:10px;">최신 뉴스</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden;">
                <tr><td style="padding:0 22px;">{''.join(sections)}</td></tr>
              </table>
            </td>
          </tr>'''


def render_issue_card(row: pd.Series) -> str:
    company = clean_text(row.get("회사", ""))
    color = company_color(company)
    title = short_title(row.get("공시명", ""))
    link = clean_text(row.get("DART링크", "")) or DART_VIEWER_URL + clean_text(row.get("접수번호", ""))
    summary = make_issue_summary(row)
    check = make_check_point(row)

    return f'''
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:18px; background-color:#ffffff; border-radius:16px; overflow:hidden;">
                <tr>
                  <td class="issue-card" style="padding:26px 26px 25px;">
                    <div style="margin-bottom:11px; font-size:0;">
                      <span class="company-tag" style="display:inline-block; margin:0 8px 0 0; padding:7px 13px; background-color:{color}; color:#ffffff; border-radius:999px; font-size:14px; line-height:1.35; font-weight:700;">{esc(company)}</span>
                    </div>

                    <div class="section-label" style="margin:0 0 8px; font-size:14px; line-height:1.5; color:#6d6255; font-weight:700;">공시</div>
                    <h2 class="issue-title" style="margin:0 0 13px; font-size:25px; line-height:1.42; letter-spacing:-0.015em; color:#172536; font-weight:700;">
                      <a href="{esc(link)}" style="color:#172536; text-decoration:none;">{esc(title)}</a>
                    </h2>
                    <p style="margin:0 0 18px; font-size:17px; line-height:1.82; color:#3f4d5d;">{esc(summary)}</p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#faf8f3; border-radius:12px;">
                      <tr>
                        <td style="padding:16px 18px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td class="info-label" style="width:74px; padding:2px 14px 0 0; vertical-align:top; font-size:14px; line-height:1.65; color:#756c61; font-weight:700;">확인할 점</td>
                              <td class="info-body" style="vertical-align:top; font-size:15px; line-height:1.75; color:#424f5e;">{esc(check)}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>'''


def render_other_disclosure(row: pd.Series) -> str:
    company = clean_text(row.get("회사", ""))
    title = short_title(row.get("공시명", ""))
    link = clean_text(row.get("DART링크", "")) or DART_VIEWER_URL + clean_text(row.get("접수번호", ""))
    summary = make_issue_summary(row)
    return f'''
                      <tr>
                        <td class="other-company" style="width:110px; padding:21px 14px 21px 0; vertical-align:top; font-size:14px; line-height:1.6; color:#526269; font-weight:700;"><span style="display:inline-block; padding:6px 11px; background-color:{company_color(company)}; color:#ffffff; border-radius:999px;">{esc(company)}</span></td>
                        <td class="other-detail" style="padding:21px 0; vertical-align:top;">
                          <div style="font-size:18px; line-height:1.58; color:#26363b; font-weight:700; margin-bottom:4px;"><a href="{esc(link)}" style="color:#26363b; text-decoration:none;">{esc(title)}</a></div>
                          <div style="font-size:15px; line-height:1.75; color:#64747a;">{esc(summary)}</div>
                        </td>
                      </tr>'''


def render_html() -> Path:
    disclosures = load_disclosures()
    target_date = pick_disclosure_date(disclosures, report_date_from_env())
    display_date = display_date_from_env()
    daily = disclosures[disclosures["_date"] == target_date].copy() if not disclosures.empty else pd.DataFrame()
    news = load_news(target_date)

    if not daily.empty:
        daily = daily.sort_values(["_score", "공시일", "회사"], ascending=[False, False, True])
    major = daily[daily["_score"] > 0].head(MAX_MAJOR_ISSUES) if not daily.empty else pd.DataFrame()
    if major.empty and not daily.empty:
        major = daily.head(min(MAX_MAJOR_ISSUES, len(daily)))
    other = daily.drop(major.index, errors="ignore") if not daily.empty else pd.DataFrame()

    disclosure_rows = "".join(render_other_disclosure(row) for _, row in daily.iterrows())
    other_rows = "".join(render_other_disclosure(row) for _, row in other.iterrows())
    news_section = render_news_section(news)
    if not disclosure_rows:
        disclosure_rows = '<tr><td style="padding:21px 0; font-size:15px; line-height:1.75; color:#64747a;">전일 신규 공시는 없습니다.</td></tr>'
    if not other_rows:
        other_rows = '<tr><td style="padding:21px 0; font-size:15px; line-height:1.75; color:#64747a;">그 밖의 신규 공시는 없습니다.</td></tr>'

    no_issue_companies = [name for name in TARGET_COMPANIES if daily.empty or name not in set(daily["회사"])]
    no_issue_text = ", ".join(no_issue_companies) if no_issue_companies else "없음"
    lead = "확인할 주요 이슈가 있습니다." if not major.empty else "전일 확인된 주요 공시는 제한적입니다."
    if not major.empty:
        top_companies = ", ".join(major["회사"].drop_duplicates().head(3).tolist())
        lead = f"💡 {top_companies} 공시 우선 확인 필요"

    html_text = f'''<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>경쟁사 모닝 브리핑</title>
  <style>
    table {{ border-collapse: collapse; border-spacing: 0; }}
    @media only screen and (max-width: 720px) {{
      .email-shell {{ width: 100% !important; }}
      .page-pad {{ padding-left: 20px !important; padding-right: 20px !important; }}
      .top-line td {{ display: block !important; text-align: left !important; }}
      .date-cell {{ padding-top: 6px !important; }}
      .headline {{ font-size: 28px !important; line-height: 1.3 !important; }}
      .metric-cell {{ display: block !important; width: auto !important; padding: 0 0 10px !important; }}
      .issue-card {{ padding: 22px 18px !important; }}
      .issue-title {{ font-size: 22px !important; }}
      .summary-count {{ display: block !important; padding: 4px 0 !important; }}
      .company-tag {{ margin-bottom: 6px !important; }}
      .section-label {{ margin-top: 18px !important; }}
      .info-label, .info-body {{ display: block !important; width: auto !important; }}
      .info-label {{ padding: 0 0 6px !important; }}
      .news-tail {{ padding-left: 18px !important; }}
      .other-company, .other-detail {{ display: block !important; width: auto !important; }}
      .other-company {{ padding: 17px 0 5px !important; }}
      .other-detail {{ padding: 0 0 18px !important; }}
    }}
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f6f4ef; color:#243244; font-family:Arial,'Malgun Gothic','Apple SD Gothic Neo',sans-serif; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">전일 경쟁사 뉴스와 DART 공시를 한 번에 정리했습니다.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6f4ef;">
    <tr>
      <td align="center" style="padding:28px 12px 46px;">
        <table role="presentation" class="email-shell" width="680" cellspacing="0" cellpadding="0" border="0" style="width:680px; max-width:680px; background-color:#fffdf8; border-radius:18px; overflow:hidden;">
          <tr>
            <td class="page-pad" style="padding:36px 42px 24px;">
              <table role="presentation" class="top-line" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size:13px; line-height:1.5; color:#6d6255; font-weight:700; letter-spacing:0.03em;">경영기획팀 · 경쟁사 모니터링</td>
                  <td class="date-cell" align="right" style="font-size:13px; line-height:1.5; color:#8a8074; white-space:nowrap;">{format_display_date(display_date)}</td>
                </tr>
              </table>
              <h1 class="headline" style="margin:18px 0 9px; font-size:34px; line-height:1.25; letter-spacing:-0.02em; color:#1e2b3b; font-weight:700;">경쟁사 모닝 브리핑</h1>
              <p style="margin:0; font-size:16px; line-height:1.75; color:#665f57;">경쟁사 공시와 최신 뉴스를 아침에 보기 좋게 정리했습니다.</p>
            </td>
          </tr>
          <tr>
            <td class="page-pad" style="padding:0 42px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1eee7; border-radius:14px;">
                <tr>
                  <td style="padding:22px 24px;">
                    <div style="font-size:14px; line-height:1.5; color:#6d6255; font-weight:700; margin-bottom:12px;">오늘 브리핑 요약</div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td class="metric-cell" width="50%" style="width:50%; padding-right:7px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fffdf8; border-radius:14px;">
                            <tr><td style="padding:15px 17px; white-space:nowrap;"><span style="font-size:15px; line-height:1.45; color:#756c61; font-weight:700; vertical-align:baseline;">신규 공시&nbsp;</span><span style="font-size:28px; line-height:1.25; color:#1f2d3d; font-weight:700; vertical-align:baseline; padding-left:6px;">{len(daily)}건</span></td></tr>
                          </table>
                        </td>
                        <td class="metric-cell" width="50%" style="width:50%; padding-left:7px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fffdf8; border-radius:14px;">
                            <tr><td style="padding:15px 17px; white-space:nowrap;"><span style="font-size:15px; line-height:1.45; color:#756c61; font-weight:700; vertical-align:baseline;">최신 뉴스&nbsp;</span><span style="font-size:28px; line-height:1.25; color:#1f2d3d; font-weight:700; vertical-align:baseline; padding-left:6px;">{len(news)}건</span></td></tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <div style="font-size:15px; line-height:1.7; color:#665f57; margin-top:13px;">{esc(lead)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="page-pad" style="padding:2px 42px 0;">
              <div style="font-size:15px; line-height:1.5; color:#6d6255; font-weight:700; letter-spacing:0.02em; margin-bottom:10px;">신규 공시 전체</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden;">
                <tr><td style="padding:0 22px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">{disclosure_rows}</table></td></tr>
              </table>
            </td>
          </tr>
          {news_section}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
'''
    OUTPUT_HTML.write_text(html_text, encoding="utf-8")
    print(f"[뉴스레터] 저장 완료: {OUTPUT_HTML}")
    return OUTPUT_HTML


if __name__ == "__main__":
    render_html()
