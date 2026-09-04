# Cloudflare Worker

Cloudflare Worker + D1로 운영되는 경쟁사 브리핑 웹앱입니다.

## 역할

- `/`: 브리핑 웹페이지 표시
- `/api/latest`: 최근 30일 공시/뉴스와 최신 AI 요약 조회
- `/api/refresh`: 새 공시/뉴스 수집, D1 저장, 신규 항목이 있을 때만 Gemini 요약 생성
- `/api/summarize-missing`: 기존 저장 항목 중 AI 요약이 없는 최신 항목을 10건씩 보강
- `/api/newsletter/generate`: 마지막 발송 이후 신규 항목으로 뉴스레터 HTML 생성
- `/api/newsletter/latest-unsent`: 아직 발송되지 않은 뉴스레터 HTML 조회
- `/api/newsletter/mark-sent`: 메일 발송 성공 후 발송 완료 기록
- `/api/newsletter/import-archive`: 기존 HTML 아카이브 수동 적재
- `/api/archive`: 발송된 뉴스레터 아카이브 목록 조회
- `/api/archive/YYYY-MM-DD`: 해당 날짜 뉴스레터 HTML 전문 조회

## 저장소

### D1

핵심 데이터 저장소입니다.

- `disclosures`: 공시 데이터
- `news_articles`: 뉴스 기사 데이터
- `ai_briefings`: Gemini 요약/판단 결과
- `item_ai_summaries`: 페이지 카드에 붙는 개별 공시/기사 Gemini 요약
- `disclosure_documents`: DART 원문 ZIP에서 추출한 공시 본문 텍스트 캐시
- `newsletter_runs`: 뉴스레터 발송 기록과 HTML 전문
- `newsletter_items`: 뉴스레터에 포함된 공시/뉴스 목록
- `refresh_runs`: 업데이트 실행 로그

### KV

현재는 업데이트 중복 실행 방지용 lock과 기존 버전 호환용으로 사용합니다.

- `lock:refresh`
- `briefing:latest` 등 과거 KV 구조는 fallback 용도입니다.

## Cloudflare 바인딩

`wrangler.toml`에 아래 바인딩이 필요합니다.

```toml
[[kv_namespaces]]
binding = "BRIEFING_KV"
id = "YOUR_KV_NAMESPACE_ID"

[[d1_databases]]
binding = "DB"
database_name = "competitor-newsletter-db"
database_id = "YOUR_D1_DATABASE_ID"
```

현재 운영 DB 이름은 `competitor-newsletter-db`입니다.

## Secrets

Cloudflare Worker에 아래 secrets를 설정합니다.

```powershell
wrangler secret put DART_API_KEY
wrangler secret put NAVER_API_HUB_CLIENT_ID
wrangler secret put NAVER_API_HUB_CLIENT_SECRET
wrangler secret put GEMINI_API_KEY
wrangler secret put UPDATE_PASSWORD
```

선택값:

```powershell
wrangler secret put GEMINI_MODEL
```

`UPDATE_PASSWORD`는 웹페이지의 업데이트 버튼과 AI 요약 채우기 버튼 보호용입니다.
GitHub Actions가 뉴스레터 생성/조회/발송 완료 기록 API를 호출할 때도 같은 값을 사용합니다.

## D1 마이그레이션

```powershell
cd worker
wrangler d1 migrations apply competitor-newsletter-db --remote
```

## 배포

```powershell
cd worker
pnpm install
pnpm deploy
```

## 수동 업데이트 동작

1. 사용자가 웹페이지에서 업데이트 버튼 클릭
2. `UPDATE_PASSWORD` 입력
3. Worker가 DART 공시와 NAVER API HUB 뉴스를 수집
4. D1에 이미 있는 항목은 건너뜀
5. 새 공시가 있으면 DART `document.xml` 원문 ZIP을 받아 본문 텍스트 추출
6. 새 항목이 있으면 Gemini가 개별 공시/기사 요약 생성
7. Gemini 결과가 성공이면 `item_ai_summaries`에 저장
8. 페이지는 최신 D1 데이터를 다시 불러옴

새 항목이 없으면 Gemini를 호출하지 않습니다.

## AI 요약 채우기 동작

1. 사용자가 웹페이지에서 AI 요약 채우기 버튼 클릭
2. `UPDATE_PASSWORD` 입력
3. D1에 저장된 공시/뉴스 중 아직 `item_ai_summaries`가 없는 최신 항목 10건 조회
4. 공시는 DART 원문 텍스트, 뉴스는 기사 제목/요약문 기준으로 개별 요약 생성
5. 성공한 요약만 `item_ai_summaries`에 저장
6. 페이지는 최신 D1 데이터를 다시 불러옴

요약할 항목이 없으면 Gemini를 호출하지 않습니다. 무료 한도와 응답 속도를 위해 한 번에 처리하는 기본 수량은 10건입니다.

공시 원문을 가져오지 못한 항목은 제목만으로 요약하지 않습니다. 이 경우 Gemini 요약 저장 대상에서 제외됩니다.

## 뉴스레터 생성/발송 동작

1. GitHub Actions가 평일 오전 8시 10분, 8시 25분 KST에 실행
2. `src.worker_newsletter_sender`가 Worker의 `/api/refresh` 호출
3. Worker가 D1에 새 공시/뉴스를 누적 저장
4. `src.worker_newsletter_sender`가 `/api/newsletter/generate` 호출
5. Worker가 마지막 발송 시각 이후 새 항목만 골라 뉴스레터 HTML 생성
6. 생성된 HTML은 D1 `newsletter_runs`에 `sent_at = NULL` 상태로 저장
7. GitHub Actions가 HTML을 SMTP로 발송
8. 발송 성공 시 `/api/newsletter/mark-sent`를 호출해 `sent_at` 기록

새 항목이 없으면 Worker는 뉴스레터를 생성하지 않고, GitHub Actions도 메일을 보내지 않습니다.

## 아카이브

아카이브는 “날짜별 전체 공시/뉴스”가 아니라 “실제로 발송된 뉴스레터 보관함”입니다.

`newsletter_runs.html`에 저장된 HTML 전문을 iframe으로 보여줍니다.

## 보관 정책

무료 범위 유지를 위해 업데이트 시 30일 지난 데이터는 삭제합니다.

- 공시
- 뉴스
- AI 브리핑
- 개별 AI 요약
- 공시 원문 캐시
- 뉴스레터 기록
- 업데이트 로그

뉴스레터 아카이브를 더 오래 유지하려면 `cleanupOldData`에서 `newsletter_runs`, `newsletter_items` 삭제 조건을 별도로 조정하면 됩니다.
