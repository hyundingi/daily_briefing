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
        if path.name.startswith("_"):
            continue
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
    core_areas = profile.get("core_areas") or []
    if core_areas:
        parts.append("핵심영역: " + ", ".join(map(str, core_areas)))
    focus = profile.get("watch_points") or []
    if focus:
        parts.append("관찰포인트: " + ", ".join(map(str, focus)))
    high_priority = profile.get("high_priority_signals") or []
    if high_priority:
        parts.append("중요신호: " + ", ".join(map(str, high_priority)))
    low_priority = profile.get("low_priority_signals") or []
    if low_priority:
        parts.append("낮은우선순위: " + ", ".join(map(str, low_priority)))
    disclosure_focus = profile.get("disclosure_focus") or []
    if disclosure_focus:
        parts.append("공시확인: " + ", ".join(map(str, disclosure_focus)))
    history = profile.get("history") or []
    if history:
        brief_history = []
        for item in history[-3:]:
            brief_history.append(f"{item.get('date', '')} {item.get('event', '')}".strip())
        parts.append("최근 이력: " + " / ".join(brief_history))
    return " | ".join(parts)
