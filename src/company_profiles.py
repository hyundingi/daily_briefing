# -*- coding: utf-8 -*-
"""회사별 프로필 로더."""
from __future__ import annotations

import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROFILE_DIR = PROJECT_ROOT / "company_profiles"


def load_company_profiles() -> dict[str, dict]:
    profiles: dict[str, dict] = {}
    if not PROFILE_DIR.exists():
        return profiles
    for path in PROFILE_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        name = str(data.get("name") or path.stem).strip()
        if name:
            profiles[name] = data
    return profiles


def get_profile_context(company: str, profiles: dict[str, dict]) -> str:
    profile = profiles.get(company, {})
    if not profile:
        return ""
    parts: list[str] = []
    if profile.get("business_summary"):
        parts.append(f"사업: {profile['business_summary']}")
    focus = profile.get("watch_points") or []
    if focus:
        parts.append("관찰포인트: " + ", ".join(map(str, focus)))
    history = profile.get("history") or []
    if history:
        brief_history = []
        for item in history[-3:]:
            brief_history.append(f"{item.get('date', '')} {item.get('event', '')}".strip())
        parts.append("최근 이력: " + " / ".join(brief_history))
    return " | ".join(parts)
