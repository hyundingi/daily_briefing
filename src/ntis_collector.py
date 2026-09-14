# -*- coding: utf-8 -*-
"""NTIS API를 고정 IP 환경에서 수집해 Cloudflare Worker로 업로드합니다."""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime
from math import ceil
from typing import Any
from urllib.parse import quote
from xml.etree import ElementTree as ET

import requests
from dotenv import load_dotenv


load_dotenv()

DEFAULT_NTIS_API_URL = (
    "https://www.ntis.go.kr/rndopen/openApi/public_project"
    "?apprvKey={key}&collection=project&SRWR={keyword}&searchFd=BI&startPosition={page}&displayCnt={limit}"
)
DEFAULT_KEYWORDS = "바이오,헬스,제약,의료,디지털헬스,R&D"


def env_value(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def worker_base_url() -> str:
    return env_value("WORKER_BASE_URL", "https://competitor-newsletter.hyundingi.workers.dev").rstrip("/")


def worker_password() -> str:
    value = env_value("WORKER_UPDATE_PASSWORD") or env_value("UPDATE_PASSWORD")
    if not value:
        raise RuntimeError("WORKER_UPDATE_PASSWORD 또는 UPDATE_PASSWORD 환경변수가 필요합니다.")
    return value


def ntis_api_key() -> str:
    value = env_value("NTIS_API_KEY")
    if not value:
        raise RuntimeError("NTIS_API_KEY 환경변수가 필요합니다.")
    return value


def keywords() -> list[str]:
    raw = env_value("GOV_PROJECT_KEYWORDS", DEFAULT_KEYWORDS)
    return [item.strip() for item in re.split(r"[,|]", raw) if item.strip()]


def max_pages() -> int:
    raw = env_value("NTIS_MAX_PAGES", "3")
    try:
        return max(1, min(int(raw), 20))
    except ValueError:
        return 3


def page_limit() -> int:
    raw = env_value("NTIS_PAGE_LIMIT", "100")
    try:
        return max(10, min(int(raw), 100))
    except ValueError:
        return 100


def upload_batch_size() -> int:
    raw = env_value("NTIS_UPLOAD_BATCH_SIZE", "100")
    try:
        return max(20, min(int(raw), 200))
    except ValueError:
        return 100


def add_cloudflare_access_headers(headers: dict[str, str]) -> None:
    client_id = env_value("CF_ACCESS_CLIENT_ID")
    client_secret = env_value("CF_ACCESS_CLIENT_SECRET")
    if client_id and client_secret:
        headers["CF-Access-Client-Id"] = client_id
        headers["CF-Access-Client-Secret"] = client_secret


def ntis_url(keyword: str, page: int, limit: int) -> str:
    template = env_value("NTIS_API_URL", DEFAULT_NTIS_API_URL)
    return (
        template.replace("{key}", quote(ntis_api_key()))
        .replace("{apiKey}", quote(ntis_api_key()))
        .replace("{serviceKey}", quote(ntis_api_key()))
        .replace("{keyword}", quote(keyword))
        .replace("{query}", quote(keyword))
        .replace("{page}", str(page))
        .replace("{limit}", str(limit))
    )


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def clean(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    return re.sub(r"\s+", " ", text).strip()


def first_text(node: ET.Element, paths: list[str]) -> str:
    for path in paths:
      current: ET.Element | None = node
      for part in path.split("/"):
          if current is None:
              break
          found = None
          for child in list(current):
              if local_name(child.tag).lower() == part.lower():
                  found = child
                  break
          current = found
      if current is not None:
          text = clean(" ".join(current.itertext()))
          if text:
              return text
    return ""


def normalize_date(value: str) -> str:
    raw = clean(value)
    if not raw:
        return ""
    spaced = re.search(r"(20\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})", raw)
    if spaced:
        return f"{spaced.group(1)}-{int(spaced.group(2)):02d}-{int(spaced.group(3)):02d}"
    compact = re.search(r"(20\d{2})(\d{2})(\d{2})", raw)
    if compact:
        return f"{compact.group(1)}-{compact.group(2)}-{compact.group(3)}"
    year = re.search(r"(20\d{2})", raw)
    return f"{year.group(1)}-12-31" if year else raw[:20]


def parse_total(root: ET.Element) -> int:
    for node in root.iter():
        if local_name(node.tag).lower() == "totalhits":
            try:
                return int(clean(node.text))
            except ValueError:
                return 0
    return 0


def parse_projects(xml_text: str, keyword: str) -> tuple[list[dict[str, str]], int]:
    root = ET.fromstring(xml_text)
    total = parse_total(root)
    projects: list[dict[str, str]] = []
    for hit in root.iter():
        if local_name(hit.tag).lower() != "hit":
            continue
        title = first_text(hit, ["ProjectTitle/Korean", "ProjectTitle", "Korean"])
        if not title:
            continue
        project_number = first_text(hit, ["ProjectNumber"])
        projects.append(
            {
                "source": "NTIS",
                "external_id": project_number,
                "title": title,
                "agency": first_text(hit, ["OrderAgency/Name", "ResearchAgency/Name", "Ministry/Name"]),
                "category": first_text(hit, ["ScienceClass/Large", "MinistryScienceClass/Large", "DevelopAgent/Name"]) or "NTIS 과제",
                "summary": first_text(hit, ["Goal/Full", "Abstract/Full", "Effect/Full"]),
                "announcement_date": normalize_date(first_text(hit, ["ProjectYear", "ProjectPeriod/Start"])),
                "deadline": normalize_date(first_text(hit, ["ProjectPeriod/End"])),
                "status": "NTIS 과제",
                "budget": first_text(hit, ["TotalFunds", "GovernmentFunds"]),
                "target": first_text(hit, ["OrganizationPNumber", "Manager/Name"]),
                "keywords": keyword,
                "link": "",
            }
        )
    return projects, total


def collect_ntis() -> list[dict[str, str]]:
    collected: list[dict[str, str]] = []
    seen: set[str] = set()
    limit = page_limit()
    for keyword in keywords():
        for page_index in range(max_pages()):
            start_position = page_index * limit + 1
            url = ntis_url(keyword, start_position, limit)
            response = requests.get(url, headers={"Accept": "application/xml,text/xml,*/*"}, timeout=60)
            text = response.text
            if not response.ok:
                raise RuntimeError(f"NTIS 요청 실패: {response.status_code} {clean(text)[:200]}")
            if "접근 허용 IP" in text:
                raise RuntimeError("NTIS 요청 실패: 접근 허용 IP가 아닙니다. 이 수집기를 NTIS에 등록한 공인 IP에서 실행해야 합니다.")
            projects, total = parse_projects(text, keyword)
            print(f"[NTIS] {keyword} start={start_position} total={total} parsed={len(projects)}")
            for project in projects:
                key = project.get("external_id") or f"{project.get('title')}:{project.get('deadline')}"
                if key in seen:
                    continue
                seen.add(key)
                collected.append(project)
            if not projects or start_position + limit > total:
                break
    return collected


def upload_projects(projects: list[dict[str, str]], batch_no: int = 1, batch_total: int = 1) -> dict[str, Any]:
    headers = {"x-update-password": worker_password(), "Content-Type": "application/json"}
    add_cloudflare_access_headers(headers)
    payload = {
        "source": "NTIS",
        "imported_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "batch_no": batch_no,
        "batch_total": batch_total,
        "projects": projects,
    }
    response = requests.post(worker_base_url() + "/api/grants/import", headers=headers, json=payload, timeout=180)
    if not response.ok:
        raise RuntimeError(f"Worker 업로드 실패({batch_no}/{batch_total}): {response.status_code} {response.text[:500]}")
    return response.json()


def upload_projects_in_batches(projects: list[dict[str, str]]) -> dict[str, int]:
    size = upload_batch_size()
    total_batches = ceil(len(projects) / size)
    totals = {"received": 0, "saved": 0, "added": 0}
    for index in range(total_batches):
        chunk = projects[index * size : (index + 1) * size]
        result = upload_projects(chunk, index + 1, total_batches)
        totals["received"] += int(result.get("received", 0) or 0)
        totals["saved"] += int(result.get("saved", 0) or 0)
        totals["added"] += int(result.get("added", 0) or 0)
        print(
            f"[Worker] 배치 {index + 1}/{total_batches} 업로드 완료: "
            f"수신 {result.get('received', 0)}건 / 저장 {result.get('saved', 0)}건 / 신규 {result.get('added', 0)}건"
        )
    return totals


def main() -> None:
    projects = collect_ntis()
    print(f"[NTIS] 총 수집 {len(projects)}건")
    if not projects:
        return
    result = upload_projects_in_batches(projects)
    print(f"[Worker] NTIS 업로드 전체 완료: 수신 {result.get('received', 0)}건 / 저장 {result.get('saved', 0)}건 / 신규 {result.get('added', 0)}건")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[오류] {exc}", file=sys.stderr)
        raise


