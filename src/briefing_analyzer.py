# -*- coding: utf-8 -*-
"""회사 프로필과 공시/뉴스를 결합해 브리핑 문장을 만듭니다."""
from __future__ import annotations

import pandas as pd

from .company_profiles import get_profile_context


def disclosure_check_point(row: pd.Series, profiles: dict[str, dict]) -> str:
    company = str(row.get("회사", "")).strip()
    title = str(row.get("공시명", ""))
    profile_context = get_profile_context(company, profiles)
    if "정정" in title:
        base = "기존 공시 대비 변경된 항목이 무엇인지 원문과 이전 공시를 함께 확인해야 합니다."
    elif "중대재해" in title:
        base = "대상 사업장, 조업 영향, 후속 행정조치 여부를 우선 확인해야 합니다."
    elif "기술이전" in title or "계약" in title:
        base = "계약 상대방, 금액, 권리 범위, 조건부 수익 인식 여부를 확인해야 합니다."
    else:
        base = "재무수치, 사업 내용, 일정 등 실무 판단에 영향을 주는 변경 사항이 있는지 확인해야 합니다."
    if profile_context:
        return base + " 회사 프로필 기준으로 " + profile_context + "도 함께 보세요."
    return base
