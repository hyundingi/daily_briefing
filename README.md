# Competitor Newsletter

경쟁사 DART 공시와 NAVER API HUB 뉴스를 수집해 매일 아침 두 가지 결과물을 만듭니다.

- GitHub Pages: 날짜별 브리핑을 계속 쌓아 두는 아카이브 페이지
- Email: 그날 새로 확인해야 할 중요 공시가 있을 때만 보내는 알림용 HTML

## Local run

```powershell
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe daily_briefing.py
```

메일용 결과 파일은 `newsletter_preview.html`, 페이지용 결과 파일은 `public/index.html`과 `public/archive/YYYY-MM-DD.html`로 생성됩니다. 메일을 보내지 않는 날에도 Pages 아카이브는 갱신됩니다.

## Required secrets

GitHub repository secrets에 아래 값을 등록합니다.

- `DART_API_KEY`
- `NAVER_API_HUB_CLIENT_ID`
- `NAVER_API_HUB_CLIENT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_USE_TLS`
- `MAIL_FROM`
- `MAIL_TO`
- `EMAIL_REQUIRED` 선택값입니다. `true`로 두면 SMTP 설정이 빠졌을 때 workflow를 실패시킵니다.

## GitHub Pages

Repository Settings에서 Pages source를 `GitHub Actions`로 설정하면, workflow가 매일 `public/index.html`과 날짜별 아카이브 페이지를 배포합니다. `public/` 폴더는 과거 브리핑을 보존하기 위해 workflow가 repo에 다시 커밋합니다.

## Email

메일은 새 중요 공시가 있을 때만 발송합니다. 실제 메일 발송에 성공한 공시 접수번호만 `state/newsletter_state.json`에 저장해 중복 발송을 막습니다.

## Company profiles

`company_profiles/*.json`에 회사별 사업 설명, 관찰 포인트, 과거 이력을 누적하면 이후 요약/판단 로직에 반영할 수 있습니다.
