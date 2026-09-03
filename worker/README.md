# Cloudflare Worker version

이 폴더는 GitHub Pages 대신 Cloudflare Worker + KV로 브리핑 웹페이지를 운영하기 위한 1차 구현입니다.

## 역할

- `/` : 웹페이지 표시
- `/api/latest` : KV에 저장된 최신 브리핑 조회
- `/api/refresh` : DART/뉴스/Gemini를 다시 호출하고 KV에 저장
- `/api/archive` : 날짜별 아카이브 목록 조회
- `/api/archive/YYYY-MM-DD` : 특정 날짜 브리핑 조회

## 저장 키

- `briefing:latest`
- `briefing:YYYY-MM-DD`
- `archive:index`
- `company:회사명:timeline`
- `lock:refresh`

## 초기 설정

1. `worker/wrangler.toml.example`을 `worker/wrangler.toml`로 복사합니다.
2. Cloudflare KV namespace를 만들고 `id`를 넣습니다.
3. 아래 secrets를 설정합니다.

```bash
wrangler secret put DART_API_KEY
wrangler secret put NAVER_API_HUB_CLIENT_ID
wrangler secret put NAVER_API_HUB_CLIENT_SECRET
wrangler secret put GEMINI_API_KEY
wrangler secret put UPDATE_PASSWORD
```

`UPDATE_PASSWORD`는 업데이트 버튼 남용 방지용입니다. 설정하지 않으면 누구나 업데이트를 실행할 수 있습니다.

## 배포

```bash
cd worker
npm install
npm run deploy
```

현재 Python/GitHub Actions 구조는 그대로 유지합니다. Worker가 안정화되면 메일 발송도 API 방식으로 옮길 수 있습니다.
