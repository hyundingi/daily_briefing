# -*- coding: utf-8 -*-
"""Cloudflare Worker가 생성한 뉴스레터 HTML을 메일로 발송합니다."""
from __future__ import annotations

import os
from datetime import datetime

import requests
from dotenv import load_dotenv

from . import email_sender


load_dotenv()


def env_value(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def worker_base_url() -> str:
    return env_value("WORKER_BASE_URL", "https://competitor-newsletter.hyundingi.workers.dev").rstrip("/")


def worker_password() -> str:
    value = env_value("WORKER_UPDATE_PASSWORD") or env_value("UPDATE_PASSWORD")
    if not value:
        raise RuntimeError("WORKER_UPDATE_PASSWORD 또는 UPDATE_PASSWORD 환경변수가 필요합니다.")
    return value


def worker_request(method: str, path: str, **kwargs) -> requests.Response:
    headers = kwargs.pop("headers", {})
    headers["x-update-password"] = worker_password()
    response = requests.request(method, worker_base_url() + path, headers=headers, timeout=180, **kwargs)
    if not response.ok:
        raise RuntimeError(f"Worker 요청 실패: {method} {path} {response.status_code} {response.text[:500]}")
    return response


def refresh_worker() -> None:
    response = worker_request("POST", "/api/refresh")
    data = response.json()
    added = data.get("added") or {}
    print(f"[Worker] 업데이트 완료: 새 공시 {added.get('disclosures', 0)}건, 새 뉴스 {added.get('news', 0)}건")


def generate_newsletter() -> dict:
    response = worker_request("POST", "/api/newsletter/generate")
    data = response.json()
    if not data.get("created") and data.get("reason") == "no_new_items":
        print("[뉴스레터] 새로 발송할 항목이 없습니다.")
        return {}
    print(f"[뉴스레터] 생성/조회 완료: {data.get('id')} / 공시 {data.get('disclosure_count', 0)}건, 뉴스 {data.get('news_count', 0)}건")
    return data


def mark_sent(run_id: str) -> None:
    sent_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    worker_request("POST", "/api/newsletter/mark-sent", json={"id": run_id, "sent_at": sent_at})
    print(f"[뉴스레터] 발송 완료 기록: {run_id} / {sent_at}")


def main() -> None:
    refresh_worker()
    newsletter = generate_newsletter()
    if not newsletter:
        return
    html = newsletter.get("html") or ""
    subject = newsletter.get("subject") or "[경쟁사 브리핑]"
    run_id = newsletter.get("id") or ""
    if not html or not run_id:
        raise RuntimeError("Worker 뉴스레터 응답에 html 또는 id가 없습니다.")
    sent = email_sender.send_newsletter_html(html, subject)
    if sent:
        mark_sent(run_id)
    else:
        print("[뉴스레터] 실제 메일 발송이 되지 않아 sent_at을 기록하지 않았습니다.")


if __name__ == "__main__":
    main()
