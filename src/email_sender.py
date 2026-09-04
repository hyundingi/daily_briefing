# -*- coding: utf-8 -*-
"""SMTP 기반 뉴스레터 메일 발송."""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")


def split_addresses(value: str) -> list[str]:
    return [item.strip() for item in value.replace(";", ",").split(",") if item.strip()]


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} 환경변수가 필요합니다.")
    return value


def email_configured() -> bool:
    return bool(
        os.getenv("SMTP_HOST", "").strip()
        and os.getenv("SMTP_USERNAME", "").strip()
        and os.getenv("SMTP_PASSWORD", "").strip()
        and os.getenv("MAIL_FROM", "").strip()
        and os.getenv("MAIL_TO", "").strip()
    )


def send_newsletter_html(html_body: str, subject: str) -> bool:
    if not email_configured():
        if os.getenv("EMAIL_REQUIRED", "").strip().lower() in {"1", "true", "yes", "y"}:
            raise RuntimeError("메일 발송 환경변수가 부족합니다.")
        print("[메일발송] SMTP 설정이 없어 발송을 건너뜁니다.")
        return False

    host = required("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587") or "587")
    username = required("SMTP_USERNAME")
    password = required("SMTP_PASSWORD")
    mail_from = required("MAIL_FROM")
    recipients = split_addresses(required("MAIL_TO"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").strip().lower() not in {"0", "false", "no", "n"}

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = mail_from
    message["To"] = ", ".join(recipients)
    message.set_content("HTML 뉴스레터를 볼 수 없는 환경입니다. 브리핑 웹페이지의 아카이브를 확인해 주세요.")
    message.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        if use_tls:
            smtp.starttls()
        smtp.login(username, password)
        smtp.send_message(message)
    print(f"[메일발송] 완료: {len(recipients)}명")
    return True


def send_newsletter(html_path: Path, subject: str) -> bool:
    html_body = html_path.read_text(encoding="utf-8")
    return send_newsletter_html(html_body, subject)
