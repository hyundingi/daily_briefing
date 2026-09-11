# 경영기획팀 Insight Board

경쟁사 10개사의 DART 공시와 최신 뉴스를 수집해 웹페이지와 뉴스레터로 확인하고, 경영기획팀 업무 지표를 한 화면에 모으는 대시보드 프로젝트입니다.

현재 운영 중심은 Cloudflare Worker + D1입니다. Worker가 웹페이지, 데이터 수집, 뉴스레터 HTML 생성을 담당하고, GitHub Actions는 아침 메일 발송만 담당합니다.

## 현재 운영 구조

### 1. 웹페이지

- 주소: https://competitor-newsletter.hyundingi.workers.dev
- Cloudflare Worker가 React 기반 대시보드를 제공합니다.
- D1 DB에 저장된 최근 30일 공시와 뉴스를 보여줍니다.
- 좌측 navbar에서 대시보드, 재무비교, 손익, 자금현황, 일정, 공시, 뉴스 영역을 전환합니다.
- 공시 / 뉴스 탭에서는 기업명 선택과 검색어로 필터링할 수 있습니다.
- Cloudflare Worker cron이 30분마다 새 공시/뉴스를 수집해 D1에 누적 저장합니다.
- 국책과제 공고는 기업마당, K-Startup, IRIS, KHIDI처럼 Worker에서 접근 가능한 API를 D1에 저장합니다.
- NTIS처럼 접근 허용 IP가 필요한 API는 고정 공인 IP가 있는 회사 PC/서버/VPS에서 외부 수집기를 실행한 뒤 Worker로 업로드합니다.
- DART 재무정보는 숨김 관리자 메뉴의 `DART 재무 수집`으로 단일회사 주요계정 API를 호출해 저장합니다.
- 화면 상단에는 마지막 데이터 업데이트 시간이 표시됩니다.
- 새로 추가된 공시/뉴스가 있을 때만 Gemini 요약을 생성합니다.
- 관리자 숨김 메뉴에서 AI 요약 채우기를 실행하면 이미 저장된 항목 중 요약이 없는 최신 10건만 Gemini로 보강합니다.
- Gemini 요약이 있으면 페이지 카드에도 표시합니다.
- 현재 대시보드의 재무 비교, 실적 관리, 일정, 국책과제 영역은 UI 자리만 먼저 만든 상태이며, 실제 내부 데이터 연동 전에는 접근제어를 먼저 적용하는 것을 권장합니다.

### 2. 뉴스레터

- GitHub Actions가 평일 아침에 실행합니다.
- 예약 시간은 한국시간 기준 평일 오전 8시 10분이며, 지연/실패 보완용으로 8시 25분에도 한 번 더 실행합니다.
- Worker가 마지막 발송 시각 이후 새로 들어온 공시/뉴스를 기준으로 뉴스레터 HTML을 생성합니다.
- GitHub Actions는 Worker에서 생성된 미발송 HTML을 받아 SMTP 메일만 발송합니다.
- 발송 성공 후 GitHub Actions가 Worker에 발송 완료를 알려 D1의 `newsletter_runs.sent_at`을 기록합니다.
- 새 공시 또는 새 뉴스가 없으면 뉴스레터를 생성하거나 발송하지 않습니다.
- 뉴스레터 아카이브는 별도 주 메뉴가 아니라 상단 버튼으로 접근하며, “날짜별 전체 데이터”가 아니라 “발송된 뉴스레터 보관함”으로 사용합니다.

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
- `ntis_collector.py`: NTIS API를 고정 IP 환경에서 직접 호출한 뒤 Worker `/api/grants/import`로 업로드
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
- `/api/financials`: 저장된 DART 재무지표 조회
- `/api/financials/refresh`: DART 단일회사 주요계정 수동 수집
- `/api/grants`: 최근 30일 국책과제/지원사업 공고 조회
- `/api/grants/refresh`: 국책과제/지원사업 공고 수동 수집
- `/api/grants/import`: 외부 수집기가 가져온 NTIS 등 국책과제 데이터를 D1에 업로드
- `/api/archive`: 발송된 뉴스레터 아카이브 목록 조회
- `/api/archive/YYYY-MM-DD`: 해당 날짜 뉴스레터 전문 조회
- `/api/refresh`: 새 공시/뉴스 수집 및 D1 저장
- `/api/summarize-missing`: 기존 항목 중 AI 요약이 없는 최신 항목 일부를 요약
- `/api/newsletter/generate`: 마지막 발송 이후 신규 항목으로 뉴스레터 HTML 생성
- `/api/newsletter/latest-unsent`: 아직 발송되지 않은 뉴스레터 HTML 조회
- `/api/newsletter/mark-sent`: 메일 발송 성공 후 발송 완료 기록
- `/api/newsletter/import-archive`: 기존 HTML 아카이브를 D1에 수동 적재

### `worker/src/page.js`

React 앱을 띄우는 HTML shell입니다.

- `<div id="root">`를 제공합니다.
- React와 ReactDOM을 CDN에서 불러옵니다.
- 화면 스크립트(`/assets/app.js`)와 스타일(`/assets/styles.css`)을 연결합니다.

### `worker/src/app.js`

React 프론트엔드 화면 코드입니다.

- 좌측 navbar
- 메인 대시보드 KPI 카드
- 오늘의 경쟁사 브리핑 카드
- 공시/뉴스 탭, 기업 필터, 검색창
- 상단 뉴스레터 아카이브 버튼
- 손익 표 UI
- 자금현황 카드
- 일정·국책과제 placeholder
- 관리자 숨김 메뉴의 AI 요약 채우기

현재는 별도 빌드 과정 없이 Worker가 `/assets/app.js`로 내려주는 React 코드입니다. 화면 규모가 더 커지면 Vite 기반 정식 React 프로젝트로 분리할 수 있습니다.

### `worker/src/styles.js`

대시보드 CSS입니다.

- 회사 메인 컬러 계열을 사용합니다.
- 넓은 배경은 밝은 `#E6ADAA`, `#F4D8D6`, `#F8E8E7` 계열을 사용하고, 진한 `#94403C`는 포인트 색으로 사용합니다.
- 유지보수를 위해 레이아웃, 카드, navbar, 탭, 검색, 뉴스 티커 스타일을 한 파일에 모아두었습니다.

### `worker/migrations/0001_init.sql`

D1 DB 테이블 생성 파일입니다.

생성되는 주요 테이블:

- `disclosures`: 공시 누적 저장
- `news_articles`: 뉴스 기사 누적 저장
- `ai_briefings`: Gemini 요약 저장
- `item_ai_summaries`: 개별 공시/기사별 Gemini 요약 저장
- `disclosure_documents`: DART 원문 ZIP에서 추출한 공시 본문 텍스트 캐시
- `government_projects`: 국책과제/지원사업 공고 누적 저장
- `financial_metrics`: DART 단일회사 주요계정 재무지표 저장
- `newsletter_runs`: 뉴스레터 발송 단위 저장
- `newsletter_items`: 뉴스레터에 포함된 공시/뉴스 저장
- `refresh_runs`: 업데이트 실행 로그 저장

### `worker/migrations/0004_government_projects.sql`

국책과제/지원사업 공고 저장 테이블입니다.

저장 필드:

- 출처: 기업마당, NTIS, K-Startup, IRIS, KHIDI 등
- 제목, 기관, 카테고리
- 요약/지원내용, 원문 링크
- 공고일, 마감일, 모집 상태
- 지원규모, 지원대상, 검색 키워드

기업마당은 공식 지원사업정보 API URL을 코드에 고정해두었으므로 `BIZINFO_API_KEY`만 있으면 Worker에서 수집할 수 있습니다. K-Startup, IRIS, KHIDI는 신청한 API 서비스별 요청 URL이 달라질 수 있어 URL 설정값을 사용합니다. URL 설정값은 공식 기관 도메인 allowlist에 있는 주소만 호출합니다.

NTIS는 API 응답에서 `접근 허용 IP가 아닙니다`가 반환될 수 있으므로, Cloudflare Worker 직접 수집보다는 고정 공인 IP가 있는 실행 환경에서 `src/ntis_collector.py`를 실행하는 방식을 권장합니다.

### `worker/migrations/0005_financial_metrics.sql`

DART 단일회사 주요계정 API에서 받은 재무지표 저장 테이블입니다.

현재 주요 저장 계정:

- 매출액 / 영업수익
- 영업이익
- 당기순이익
- 자산총계
- 부채총계
- 자본총계

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
- `DART_FINANCIAL_YEAR`: DART 재무정보 수집 사업연도입니다. 비워두면 전년도 기준입니다.
- `DART_FINANCIAL_REPORT_CODE`: DART 보고서 코드입니다. 기본값은 `11011` 사업보고서입니다. `11013` 1분기, `11012` 반기, `11014` 3분기도 사용할 수 있습니다.
- `NAVER_API_HUB_CLIENT_ID`
- `NAVER_API_HUB_CLIENT_SECRET`
- `GEMINI_API_KEY`
- `UPDATE_PASSWORD`

국책과제 API 선택값:

- `GOV_PROJECT_KEYWORDS`: 국책과제 검색 키워드입니다. 기본값은 `바이오,헬스,제약,의료,디지털헬스,임상,R&D,연구개발`입니다.
- `BIZINFO_API_KEY`: 기업마당 API 인증키입니다. URL은 코드에 고정되어 있습니다.
- `NTIS_API_URL`, `NTIS_API_KEY`: NTIS 외부 수집기에서 사용하는 API URL/키입니다. Worker에 넣어도 IP 제한 때문에 실패할 수 있습니다.
- `NTIS_MAX_PAGES`: NTIS 키워드별 최대 조회 페이지 수입니다. 기본값은 `3`입니다.
- `NTIS_PAGE_LIMIT`: NTIS 1회 요청당 조회 건수입니다. 기본값은 `100`입니다.
- `KSTARTUP_API_URL`, `KSTARTUP_API_KEY`: K-Startup API URL/키입니다.
- `IRIS_API_URL`, `IRIS_API_KEY`: IRIS API URL/키입니다.
- `KHIDI_API_URL`, `KHIDI_API_KEY`: KHIDI API URL/키입니다.

NTIS, K-Startup, IRIS, KHIDI API URL에는 `{keyword}`를 검색어 위치에 넣고, 인증키가 필요한 API는 `{key}` 또는 `{serviceKey}`를 키 위치에 넣습니다. 실제 값은 발급받은 공식 API 문서의 요청 URL을 기준으로 작성합니다.

## NTIS 고정 IP 수집기 실행

NTIS는 신청 시 등록한 서버 IP에서만 API 호출을 허용할 수 있습니다. Cloudflare Worker는 고정 발신 IP를 안정적으로 등록하기 어렵기 때문에, NTIS는 별도 수집기를 고정 공인 IP 환경에서 실행합니다.

필요 환경변수:

```text
NTIS_API_KEY=발급받은_NTIS_승인키
NTIS_API_URL=https://www.ntis.go.kr/rndopen/openApi/public_project?apprvKey={key}&collection=project&SRWR={keyword}&searchFd=BI&startPosition={page}&displayCnt={limit}
GOV_PROJECT_KEYWORDS=바이오,헬스,제약,의료,디지털헬스,R&D
WORKER_BASE_URL=https://competitor-newsletter.hyundingi.workers.dev
WORKER_UPDATE_PASSWORD=Worker_UPDATE_PASSWORD와_같은_값
CF_ACCESS_CLIENT_ID=Cloudflare_Access_Service_Token_ID_선택
CF_ACCESS_CLIENT_SECRET=Cloudflare_Access_Service_Token_SECRET_선택
NTIS_MAX_PAGES=3
NTIS_PAGE_LIMIT=100
```

실행:

```powershell
python -m src.ntis_collector
```

동작 흐름:

```text
고정 IP 환경의 수집기 → NTIS API 호출 → Worker /api/grants/import → D1 government_projects 저장 → 웹페이지 표시
```

회사 PC에서 테스트할 경우 NTIS에 회사 공인 IP가 등록되어 있어야 합니다. Cloudflare Access로 Worker를 보호한 상태라면 `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`도 함께 설정합니다.

선택값:

- `GEMINI_MODEL`: 비워두면 `gemini-3.6-flash`를 우선 사용합니다.

## GitHub Actions Secrets

GitHub 뉴스레터 발송에는 아래 secrets가 필요합니다.

- `WORKER_UPDATE_PASSWORD`: Worker의 `UPDATE_PASSWORD`와 같은 값. 이미 `UPDATE_PASSWORD`라는 이름으로 GitHub Secret을 넣었다면 그것도 fallback으로 사용합니다.
- `CF_ACCESS_CLIENT_ID`: Cloudflare Access로 Worker를 보호한 뒤 GitHub Actions가 Worker API를 호출하기 위한 Service Token ID입니다.
- `CF_ACCESS_CLIENT_SECRET`: 위 Service Token의 Secret입니다.
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
