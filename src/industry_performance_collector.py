# -*- coding: utf-8 -*-
"""동업계 실적 엑셀에서 상세 행만 추출해 Insight Board로 전송합니다.

원본 엑셀 파일은 외부로 전송하지 않습니다. 회원사·사업구분별 월간 숫자와
해당 월의 증감사유만 Worker API로 전송합니다.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
from datetime import datetime
from math import ceil
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from openpyxl import load_workbook


load_dotenv()

VALID_SEGMENTS = {"ETC", "OTC", "수출", "기타"}
MONTH_HEADER_RE = re.compile(r"(?:(\d{2,4})\s*년\s*)?(\d{1,2})\s*월")


def env_value(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def worker_base_url() -> str:
    return env_value("WORKER_BASE_URL", "https://competitor-newsletter.hyundingi.workers.dev").rstrip("/")


def worker_password() -> str:
    value = env_value("WORKER_UPDATE_PASSWORD") or env_value("UPDATE_PASSWORD")
    if not value:
        raise RuntimeError("WORKER_UPDATE_PASSWORD 또는 UPDATE_PASSWORD 환경변수가 필요합니다.")
    return value


def upload_batch_size() -> int:
    try:
        return max(50, min(int(env_value("INDUSTRY_PERFORMANCE_UPLOAD_BATCH_SIZE", "80")), 500))
    except ValueError:
        return 80


def add_cloudflare_access_headers(headers: dict[str, str]) -> None:
    client_id = env_value("CF_ACCESS_CLIENT_ID")
    client_secret = env_value("CF_ACCESS_CLIENT_SECRET")
    if client_id and client_secret:
        headers["CF-Access-Client-Id"] = client_id
        headers["CF-Access-Client-Secret"] = client_secret


def clean_text(value: Any) -> str:
    return " ".join(str(value or "").replace("\n", " ").split())


def optional_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = clean_text(value).replace(",", "").replace("원", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def sheet_year(sheet_name: str) -> int | None:
    match = re.search(r"(20\d{2})\s*년", sheet_name)
    return int(match.group(1)) if match else None


def report_month(ws) -> int | None:
    # AO3은 이 양식에서 “누계 (26년 10월)” 헤더입니다.
    header = clean_text(ws.cell(3, 41).value)
    match = MONTH_HEADER_RE.search(header)
    if match:
        return int(match.group(2))
    return None


def value_or_none(ws, row: int, column: int) -> float | None:
    return optional_number(ws.cell(row, column).value)


def collect_sheet(formula_ws, value_ws, year: int, source_filename: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    active_company = ""
    active_report_month = report_month(formula_ws)

    for row in range(5, formula_ws.max_row + 1):
        company_cell = clean_text(formula_ws.cell(row, 3).value)
        if company_cell:
            active_company = company_cell
        segment = clean_text(formula_ws.cell(row, 4).value)
        if not active_company or segment not in VALID_SEGMENTS:
            continue

        # E:AG는 1~10월, AI:AN은 11~12월의 목표/실적/달성률 3개 묶음입니다.
        for month in range(1, 13):
            base_column = 5 + (month - 1) * 3
            target = value_or_none(formula_ws, row, base_column)
            actual = value_or_none(formula_ws, row, base_column + 1)
            if target is None and actual is None:
                continue

            achievement = actual / target if target not in (None, 0) and actual is not None else None
            is_report_month = month == active_report_month
            records.append(
                {
                    "report_year": year,
                    "report_month": month,
                    "company": active_company,
                    "business_segment": segment,
                    "monthly_target": target,
                    "monthly_actual": actual,
                    "monthly_achievement": achievement,
                    # 원본 양식의 누계/전년대비는 해당 취합 기준월에만 존재합니다.
                    "source_ytd_target": value_or_none(value_ws, row, 41) if is_report_month else None,
                    "source_ytd_actual": value_or_none(value_ws, row, 42) if is_report_month else None,
                    "source_ytd_achievement": value_or_none(value_ws, row, 43) if is_report_month else None,
                    "source_previous_year_actual": value_or_none(value_ws, row, 44) if is_report_month else None,
                    "source_yoy_amount": value_or_none(value_ws, row, 45) if is_report_month else None,
                    "source_yoy_rate": value_or_none(value_ws, row, 46) if is_report_month else None,
                    "note": clean_text(formula_ws.cell(row, 47).value) if is_report_month else "",
                    "source_sheet": formula_ws.title,
                    "source_row": row,
                    "source_filename": source_filename,
                }
            )
    return records


def collect_workbook(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"파일을 찾을 수 없습니다: {path}")
    # 이 파일은 월별 취합본 1개(약 600KB)만 다루므로 일반 모드가 더 적합합니다.
    # read_only 모드에서 셀을 반복 조회하면 대형 시트에서 행을 매번 다시 읽어
    # 수집 시간이 크게 늘어날 수 있습니다.
    formula_book = load_workbook(path, data_only=False, read_only=False)
    value_book = load_workbook(path, data_only=True, read_only=False)
    records: list[dict[str, Any]] = []
    try:
        for sheet_name in formula_book.sheetnames:
            year = sheet_year(sheet_name)
            if year is None or sheet_name not in value_book.sheetnames:
                continue
            records.extend(collect_sheet(formula_book[sheet_name], value_book[sheet_name], year, path.name))
    finally:
        formula_book.close()
        value_book.close()

    if not records:
        raise RuntimeError("ETC·OTC·수출·기타 상세 행을 찾지 못했습니다. 현재 약기회 실적 양식인지 확인해주세요.")
    return records


def source_import_id(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    return f"industry:{path.stem}:{digest}"


def upload_records(path: Path, records: list[dict[str, Any]]) -> dict[str, int]:
    headers = {"X-Update-Password": worker_password(), "Content-Type": "application/json"}
    add_cloudflare_access_headers(headers)
    batch_size = upload_batch_size()
    batches = ceil(len(records) / batch_size)
    result = {"received": 0, "inserted": 0, "updated": 0, "skipped": 0}
    import_id = source_import_id(path)

    for index in range(batches):
        batch = records[index * batch_size : (index + 1) * batch_size]
        payload = {
            "import_id": f"{import_id}:{index + 1}",
            "source_filename": path.name,
            "records": batch,
        }
        response = requests.post(
            worker_base_url() + "/api/industry-performance/import",
            headers=headers,
            json=payload,
            timeout=180,
        )
        if not response.ok:
            raise RuntimeError(f"Worker 업로드 실패({index + 1}/{batches}): {response.status_code} {response.text[:500]}")
        body = response.json()
        for key in result:
            result[key] += int(body.get(key, 0) or 0)
        print(
            f"[Worker] {index + 1}/{batches} 반영: "
            f"신규 {body.get('inserted', 0)}건 / 수정 {body.get('updated', 0)}건 / 동일 {body.get('skipped', 0)}건"
        )
    return result


def find_latest_workbook(directory: Path) -> Path:
    candidates = [
        path for path in directory.glob("*.xlsx")
        if not path.name.startswith("~$")
    ]
    if not candidates:
        raise FileNotFoundError(f"xlsx 파일을 찾을 수 없습니다: {directory}")
    return max(candidates, key=lambda path: path.stat().st_mtime)


def main() -> None:
    parser = argparse.ArgumentParser(description="약기회 실적 엑셀을 Insight Board에 반영합니다.")
    parser.add_argument("--file", type=Path, help="반영할 xlsx 파일 경로")
    parser.add_argument("--directory", type=Path, help="지정 폴더 안에서 가장 최근 xlsx 파일을 반영")
    parser.add_argument("--dry-run", action="store_true", help="전송하지 않고 추출 결과만 확인")
    args = parser.parse_args()

    path = args.file or find_latest_workbook(args.directory or Path(env_value("INDUSTRY_PERFORMANCE_SOURCE_DIR", ".")))
    records = collect_workbook(path)
    years = sorted({record["report_year"] for record in records})
    companies = sorted({record["company"] for record in records})
    print(f"[약기회 실적] {path.name}")
    print(f"[추출] {len(records)}건 / {len(companies)}개사 / {', '.join(map(str, years))}년")
    if args.dry_run:
        return
    result = upload_records(path, records)
    print(
        f"[완료] 수신 {result['received']}건 / 신규 {result['inserted']}건 / "
        f"수정 {result['updated']}건 / 동일 {result['skipped']}건"
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as error:
        print(f"[오류] {error}")
        raise SystemExit(1)
