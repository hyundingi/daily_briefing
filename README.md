# Competitor Newsletter

경쟁사 10개사의 DART 공시와 최신 뉴스를 수집해 웹페이지와 뉴스레터로 확인하는 프로젝트입니다.

현재 운영 중심은 Cloudflare Worker + D1입니다. Worker가 웹페이지, 데이터 수집, 뉴스레터 HTML 생성을 담당하고, GitHub Actions는 아침 메일 발송만 담당합니다.

## 현재 운영 구조

### 1. 웹페이지

- 주소: https://competitor-newsletter.hyundingi.workers.dev
- Cloudflare Worker가 페이지를 렌더링합니다.
- D1 DB에 저장된 최근 30일 공시와 뉴스를 보여줍니다.
- 공시 / 뉴스 / 아카이브 탭이 분리되어 있습니다.
- 기업명, 카테고리, 검색어로 필터링할 수 있습니다.
- Cloudflare Worker cron이 30분마다 새 공시/뉴스를 수집해 D1에 누적 저장합니다.
- 화면 상단에는 마지막 데이터 업데이트 시간이 표시됩니다.
- 새로 추가된 공시/뉴스가 있을 때만 Gemini 요약을 생성합니다.
- 관리자 숨김 메뉴에서 AI 요약 채우기를 실행하면 이미 저장된 항목 중 요약이 없는 최신 10건만 Gemini로 보강합니다.
- Gemini 요약이 있으면 페이지 카드에도 `AI 요약`으로 표시합니다.

### 2. 뉴스레터

- GitHub Actions가 평일 아침에 실행합니다.
- 예약 시간은 한국시간 기준 평일 오전 8시 10분이며, 지연/실패 보완용으로 8시 25분에도 한 번 더 실행합니다.
- Worker가 마지막 발송 시각 이후 새로 들어온 공시/뉴스를 기준으로 뉴스레터 HTML을 생성합니다.
- GitHub Actions는 Worker에서 생성된 미발송 HTML을 받아 SMTP 메일만 발송합니다.
- 발송 성공 후 GitHub Actions가 Worker에 발송 완료를 알려 D1의 `newsletter_runs.sent_at`을 기록합니다.
- 새 공시 또는 새 뉴스가 없으면 뉴스레터를 생성하거나 발송하지 않습니다.
- 아카이브 탭은 “날짜별 전체 데이터”가 아니라 “발송된 뉴스레터 보관함”으로 사용합니다.

### 3. AI 요약

- Gemini는 페이지 업데이트 때 항상 돌지 않습니다.
- 새로 추가된 공시/뉴스가 있을 때만 해당 신규 항목을 요약합니다.
- 기존에 저장되어 있지만 아직 AI 요약이 없는 항목은 관리자 숨김 메뉴의 AI 요약 채우기로 10건씩 보강합니다.
- 공시는 DART `document.xml` 원문 ZIP을 받아 본문 텍스트를 추출한 뒤 요약합니다. 원문을 가져오지 못하면 제목만으로 공시 요약을 만들지 않습니다.
- 개별 공시/기사 요약은 D1의 `item_ai_summaries`에 저장합니다.
- 회사별/뉴스레터용 종합 브리핑은 D1의 `ai_briefings`에 저장합니다.
- 뉴스레터 생성 시 이미 저장된 AI 요약이 있으면 재사용하고, 없으면 그때 추가 생성하는 방향입니다.
- 페이지에서는 AI 요약이 저장되어 있을 때만 보여줍니다.

## 주요 폴더 구조

```text
competitor-newsletter/
├─ .github/
│  └─ workflows/
│     └─ daily-newsletter.yml
├─ company_profiles/
├─ src/
├─ worker/
│  ├─ migrations/
│  └─ src/
├─ daily_briefing.py
├─ requirements.txt
└─ README.md
```

## 폴더와 파일별 역할

### `.github/workflows/daily-newsletter.yml`

GitHub Actions 자동 실행 파일입니다.

- 평일 아침 뉴스레터 자동 실행
- Python 의존성 설치
- 메일 발송
- 발송 성공 시 Worker에 발송 완료 기록

공시/뉴스 수집과 뉴스레터 HTML 생성은 Worker가 담당합니다.

### `company_profiles/`

회사별 기본 정보와 관찰 포인트를 저장하는 폴더입니다.

예시:

- `동아에스티.json`
- `한미약품.json`
- `종근당.json`
- `_profile_schema.json`

Gemini가 “왜 봐야 하는지”, “이전 흐름과 무엇이 다른지”를 판단할 때 회사 맥락으로 사용합니다.

### `src/`

Python 기반 뉴스레터 생성 파이프라인입니다.

- `dart_collector.py`: DART 공시 수집
- `news_collector.py`: NAVER API HUB 뉴스 수집
- `issue_clusterer.py`: 유사 뉴스 묶음 처리
- `briefing_analyzer.py`: 회사 프로필과 과거 이력을 참고해 브리핑 분석 생성
- `newsletter_renderer.py`: 메일용 HTML 뉴스레터 생성
- `email_sender.py`: SMTP 메일 발송
- `worker_newsletter_sender.py`: Worker가 생성한 미발송 뉴스레터 HTML을 가져와 메일 발송
- `company_profiles.py`: 회사 프로필 로딩

### `worker/`

Cloudflare Worker 웹앱입니다.

- 실제 웹페이지를 제공합니다.
- 30분마다 자동 업데이트를 실행합니다.
- 관리자/자동화용 수동 업데이트 API를 제공합니다.
- DART/NAVER API HUB에서 새 공시/뉴스를 수집합니다.
- D1에 최근 30일 데이터를 누적 저장합니다.
- 요약이 없는 기존 항목을 최신순으로 10건씩 Gemini 요약으로 보강합니다.
- 공시 원문 추출 텍스트는 D1의 `disclosure_documents`에 캐시합니다.
- 뉴스레터 HTML을 생성하고 미발송/발송완료 상태를 관리합니다.
- 발송된 뉴스레터 아카이브를 보여줍니다.

자세한 설정은 `worker/README.md`를 참고합니다.

### `worker/src/index.js`

Cloudflare Worker의 핵심 코드입니다.

주요 역할:

- `/`: 웹페이지 렌더링
- `/api/latest`: 최근 30일 공시/뉴스 조회
- `/api/archive`: 발송된 뉴스레터 아카이브 목록 조회
- `/api/archive/YYYY-MM-DD`: 해당 날짜 뉴스레터 전문 조회
- `/api/refresh`: 새 공시/뉴스 수집 및 D1 저장
- `/api/summarize-missing`: 기존 항목 중 AI 요약이 없는 최신 항목 일부를 요약
- `/api/newsletter/generate`: 마지막 발송 이후 신규 항목으로 뉴스레터 HTML 생성
- `/api/newsletter/latest-unsent`: 아직 발송되지 않은 뉴스레터 HTML 조회
- `/api/newsletter/mark-sent`: 메일 발송 성공 후 발송 완료 기록
- `/api/newsletter/import-archive`: 기존 HTML 아카이브를 D1에 수동 적재

### `worker/migrations/0001_init.sql`

D1 DB 테이블 생성 파일입니다.

생성되는 주요 테이블:

- `disclosures`: 공시 누적 저장
- `news_articles`: 뉴스 기사 누적 저장
- `ai_briefings`: Gemini 요약 저장
- `item_ai_summaries`: 개별 공시/기사별 Gemini 요약 저장
- `disclosure_documents`: DART 원문 ZIP에서 추출한 공시 본문 텍스트 캐시
- `newsletter_runs`: 뉴스레터 발송 단위 저장
- `newsletter_items`: 뉴스레터에 포함된 공시/뉴스 저장
- `refresh_runs`: 업데이트 실행 로그 저장

### `daily_briefing.py`

Python 뉴스레터 파이프라인의 실행 진입점입니다.

기존 Python 뉴스레터 파이프라인의 실행 진입점입니다. 현재 운영 뉴스레터 발송은 `src/worker_newsletter_sender.py`를 사용합니다.

### `requirements.txt`

Python 실행에 필요한 패키지 목록입니다.

## Cloudflare 설정값

### Worker D1 binding

```toml
[[d1_databases]]
binding = "DB"
database_name = "competitor-newsletter-db"
database_id = "0252ccba-76f1-4162-a21a-41dff7af55ac"
```

### Worker KV binding

```toml
[[kv_namespaces]]
binding = "BRIEFING_KV"
```

KV는 현재 업데이트 중복 실행 방지용 lock과 기존 호환용으로 남아 있습니다. 장기적으로 핵심 데이터는 D1에 저장합니다.

### Worker Secrets

Cloudflare Worker에 아래 secrets가 필요합니다.

- `DART_API_KEY`
- `NAVER_API_HUB_CLIENT_ID`
- `NAVER_API_HUB_CLIENT_SECRET`
- `GEMINI_API_KEY`
- `UPDATE_PASSWORD`

선택값:

- `GEMINI_MODEL`: 비워두면 `gemini-3.6-flash`를 우선 사용합니다.

## GitHub Actions Secrets

GitHub 뉴스레터 발송에는 아래 secrets가 필요합니다.

- `WORKER_UPDATE_PASSWORD`: Worker의 `UPDATE_PASSWORD`와 같은 값. 이미 `UPDATE_PASSWORD`라는 이름으로 GitHub Secret을 넣었다면 그것도 fallback으로 사용합니다.
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_USE_TLS`
- `MAIL_FROM`
- `MAIL_TO`

선택값:

- Repository variable `WORKER_BASE_URL`: 없으면 `https://competitor-newsletter.hyundingi.workers.dev` 사용

## 데이터 보관 정책

무료 범위 안에서 운영하기 위해 Worker 업데이트 시 30일 지난 데이터는 정리합니다.

- 30일 지난 공시 삭제
- 30일 지난 뉴스 삭제
- 30일 지난 AI 브리핑 삭제
- 30일 지난 개별 AI 요약 삭제
- 30일 지난 뉴스레터 기록 삭제
- 30일 지난 업데이트 실행 로그 삭제

뉴스레터 아카이브를 더 오래 보관하고 싶다면 `newsletter_runs`만 보관 기간을 별도로 늘리면 됩니다.

## 현재 남아 있는 TODO

- Worker 뉴스레터 HTML 디자인 고도화
- 뉴스레터용 중요도 선별 프롬프트/규칙 개선
- GitHub Actions 실제 예약 실행 로그 모니터링

## 로컬 실행

Python 뉴스레터 파이프라인:

```powershell
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
.\.venv\Scripts\python.exe daily_briefing.py
```

Worker 배포:

```powershell
cd worker
pnpm install
pnpm deploy
```
