# -*- coding: utf-8 -*-
"""
DART 경쟁사 공시 목록 수집기 v3

역할
- OpenDART 고유번호 파일에서 대상 회사의 corp_code를 찾고 캐시
- 회사별 최근 LOOKBACK_DAYS일 공시목록 조회
- 서버가 읽는 dart_disclosure_view.csv 생성

DART_API_KEY는 환경변수로 설정하는 것을 권장합니다.
"""
from __future__ import annotations

import io
import os
import re
import time
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree

import pandas as pd
import requests
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "state"
DATA_DIR.mkdir(exist_ok=True)
load_dotenv(PROJECT_ROOT / ".env")
VIEW_CSV = DATA_DIR / "dart_disclosure_view.csv"
CORP_CACHE_CSV = DATA_DIR / "dart_corp_codes.csv"

DART_API_KEY = os.getenv("DART_API_KEY", "").strip()
LOOKBACK_DAYS = 30
REQUEST_TIMEOUT = 30
REQUEST_GAP_SECONDS = 0.15
MAX_RETRIES = 3

CORP_CODE_URL = "https://opendart.fss.or.kr/api/corpCode.xml"
DISCLOSURE_LIST_URL = "https://opendart.fss.or.kr/api/list.json"
DART_VIEWER_URL = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo="

# 왼쪽은 대시보드에 표시할 이름, 오른쪽은 DART 정식 회사명 후보입니다.
TARGET_COMPANIES = {
    "동아에스티": ["동아에스티"],
    "한미약품": ["한미약품"],
    "종근당": ["종근당"],
    "유한양행": ["유한양행"],
    "녹십자": ["녹십자", "GC녹십자"],
    "제일약품": ["제일약품"],
    "대웅제약": ["대웅제약"],
    "보령": ["보령", "보령제약"],
    "JW중외제약": ["JW중외제약", "제이더블유중외제약"],
    "일동제약": ["일동제약"],
}

OUTPUT_COLUMNS = [
    "공시일",
    "회사",
    "카테고리",
    "공시명",
    "접수번호",
    "정정여부",
    "비고",
    "DART링크",
    "수집일시",
]

REMARK_LABELS = {
    "유": "유가증권시장",
    "코": "코스닥시장",
    "넥": "코넥스시장",
    "채": "채권상장법인",
    "공": "공정거래위원회",
    "연": "연결대상 종속회사",
    "정": "정정공시",
    "철": "철회",
}


def require_api_key() -> None:
    if not DART_API_KEY or "여기에" in DART_API_KEY:
        raise RuntimeError(
            "DART_API_KEY가 없습니다. 실행 전에 환경변수 DART_API_KEY를 설정하세요."
        )


def normalize_company_name(value: str) -> str:
    value = str(value or "").upper()
    value = value.replace("주식회사", "").replace("(주)", "").replace("㈜", "")
    return re.sub(r"[^0-9A-Z가-힣]", "", value)


def request_with_retry(url: str, **kwargs) -> requests.Response:
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT, **kwargs)
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                time.sleep(1.5 * attempt)
    raise RuntimeError(f"DART 요청 실패: {last_error}") from last_error


def dart_error_message(content: bytes) -> str:
    text = content.decode("utf-8", errors="ignore")
    try:
        root = ElementTree.fromstring(text)
        status = root.findtext(".//status", default="")
        message = root.findtext(".//message", default="")
        return f"{status} {message}".strip()
    except ElementTree.ParseError:
        return text[:200].strip() or "알 수 없는 DART 오류"


def download_corp_codes() -> pd.DataFrame:
    response = request_with_retry(
        CORP_CODE_URL,
        params={"crtfc_key": DART_API_KEY},
    )
    content = response.content
    if not zipfile.is_zipfile(io.BytesIO(content)):
        raise RuntimeError(f"고유번호 파일 다운로드 실패: {dart_error_message(content)}")

    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        xml_names = [name for name in archive.namelist() if name.lower().endswith(".xml")]
        if not xml_names:
            raise RuntimeError("고유번호 ZIP에 XML 파일이 없습니다.")
        root = ElementTree.fromstring(archive.read(xml_names[0]))

    rows = []
    for item in root.findall(".//list"):
        rows.append(
            {
                "corp_code": (item.findtext("corp_code") or "").strip(),
                "corp_name": (item.findtext("corp_name") or "").strip(),
                "stock_code": (item.findtext("stock_code") or "").strip(),
                "modify_date": (item.findtext("modify_date") or "").strip(),
            }
        )

    result = pd.DataFrame(rows)
    if result.empty:
        raise RuntimeError("DART 고유번호 목록이 비어 있습니다.")
    save_csv_atomic(result, CORP_CACHE_CSV)
    return result


def load_corp_codes() -> pd.DataFrame:
    if CORP_CACHE_CSV.exists():
        age = datetime.now() - datetime.fromtimestamp(CORP_CACHE_CSV.stat().st_mtime)
        if age.days < 30:
            try:
                cached = pd.read_csv(
                    CORP_CACHE_CSV,
                    encoding="utf-8-sig",
                    dtype=str,
                ).fillna("")
                if {"corp_code", "corp_name"}.issubset(cached.columns):
                    return cached
            except Exception:
                pass
    return download_corp_codes()


def resolve_target_corp_codes(corp_codes: pd.DataFrame) -> dict[str, str]:
    corp_codes = corp_codes.copy()
    corp_codes["_normalized"] = corp_codes["corp_name"].map(normalize_company_name)

    resolved: dict[str, str] = {}
    missing: list[str] = []

    for display_name, aliases in TARGET_COMPANIES.items():
        alias_keys = {normalize_company_name(alias) for alias in aliases}
        candidates = corp_codes[corp_codes["_normalized"].isin(alias_keys)].copy()
        if candidates.empty:
            missing.append(display_name)
            continue

        # 같은 이름이 여럿이면 상장회사(stock_code 존재)를 우선합니다.
        if "stock_code" in candidates.columns:
            candidates["_listed"] = candidates["stock_code"].astype(str).str.strip().ne("")
            candidates = candidates.sort_values("_listed", ascending=False)
        resolved[display_name] = str(candidates.iloc[0]["corp_code"]).strip()

    if missing:
        raise RuntimeError(
            "DART 고유번호를 찾지 못한 회사: "
            + ", ".join(missing)
            + " (TARGET_COMPANIES의 별칭을 확인하세요.)"
        )
    return resolved


def classify_disclosure(report_name: str) -> str:
    name = str(report_name or "")
    compact = re.sub(r"\s+", "", name)

    if any(word in compact for word in ["사업보고서", "반기보고서", "분기보고서"]):
        return "정기공시"
    if any(
        word in compact
        for word in [
            "주식등의대량보유",
            "임원ㆍ주요주주",
            "임원·주요주주",
            "최대주주",
            "소유주식",
            "지분변동",
        ]
    ):
        return "지분/주주"
    if any(
        word in compact
        for word in [
            "유상증자",
            "무상증자",
            "감자",
            "전환사채",
            "신주인수권부사채",
            "교환사채",
            "사채권",
            "자금조달",
        ]
    ):
        return "자금조달"
    if any(
        word in compact
        for word in [
            "합병",
            "분할",
            "주식교환",
            "주식이전",
            "영업양수",
            "영업양도",
            "타법인주식",
            "유형자산양수",
            "유형자산양도",
            "취득결정",
            "처분결정",
        ]
    ):
        return "투자/M&A"
    if any(
        word in compact
        for word in [
            "공급계약",
            "판매계약",
            "단일판매",
            "기술이전",
            "라이선스",
            "임상시험",
            "품목허가",
            "특허",
            "계약체결",
            "계약해지",
        ]
    ):
        return "사업/계약"
    return "경영/기타"


def format_remarks(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    labels = [label for code, label in REMARK_LABELS.items() if code in raw]
    return ", ".join(labels) if labels else raw


def fetch_company_disclosures(
    display_name: str,
    corp_code: str,
    begin_date: str,
    end_date: str,
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    page_no = 1

    while True:
        response = request_with_retry(
            DISCLOSURE_LIST_URL,
            params={
                "crtfc_key": DART_API_KEY,
                "corp_code": corp_code,
                "bgn_de": begin_date,
                "end_de": end_date,
                "page_no": page_no,
                "page_count": 100,
                "sort": "date",
                "sort_mth": "desc",
            },
        )
        payload = response.json()
        status = str(payload.get("status", ""))

        if status == "013":
            break
        if status != "000":
            raise RuntimeError(
                f"{display_name} 공시목록 오류 {status}: {payload.get('message', '')}"
            )

        for item in payload.get("list", []):
            report_name = str(item.get("report_nm", "")).strip()
            rcept_no = str(item.get("rcept_no", "")).strip()
            remark_raw = str(item.get("rm", "")).strip()
            rows.append(
                {
                    "공시일": str(item.get("rcept_dt", "")).strip(),
                    "회사": display_name,
                    "카테고리": classify_disclosure(report_name),
                    "공시명": report_name,
                    "접수번호": rcept_no,
                    "정정여부": "Y" if ("정정" in report_name or "정" in remark_raw) else "N",
                    "비고": format_remarks(remark_raw),
                    "DART링크": DART_VIEWER_URL + rcept_no if rcept_no else "",
                    "수집일시": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                }
            )

        total_page = int(payload.get("total_page", 1) or 1)
        if page_no >= total_page:
            break
        page_no += 1
        time.sleep(REQUEST_GAP_SECONDS)

    return rows


def save_csv_atomic(frame: pd.DataFrame, destination: Path) -> None:
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    frame.to_csv(temporary, index=False, encoding="utf-8-sig")
    os.replace(temporary, destination)


def main() -> pd.DataFrame:
    require_api_key()

    end_day = date.today()
    begin_day = end_day - timedelta(days=max(1, int(LOOKBACK_DAYS)))
    begin_date = begin_day.strftime("%Y%m%d")
    end_date = end_day.strftime("%Y%m%d")

    print(f"[목록수집] 기간 {begin_date} ~ {end_date}")
    corp_codes = load_corp_codes()
    targets = resolve_target_corp_codes(corp_codes)

    all_rows: list[dict[str, str]] = []
    for index, (company, corp_code) in enumerate(targets.items(), start=1):
        rows = fetch_company_disclosures(
            company,
            corp_code,
            begin_date,
            end_date,
        )
        all_rows.extend(rows)
        print(f"[목록수집] {index}/{len(targets)} {company}: {len(rows)}건")
        time.sleep(REQUEST_GAP_SECONDS)

    frame = pd.DataFrame(all_rows, columns=OUTPUT_COLUMNS)
    if not frame.empty:
        frame = frame.drop_duplicates(subset=["접수번호"], keep="first")
        frame = frame.sort_values(
            ["공시일", "회사", "공시명"],
            ascending=[False, True, True],
        )
    save_csv_atomic(frame, VIEW_CSV)
    print(f"[목록수집] 저장 완료: {VIEW_CSV} ({len(frame)}건)")
    return frame


if __name__ == "__main__":
    main()
