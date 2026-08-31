# 데이터 정돈 기준

이 프로젝트는 GitHub 저장소 안의 JSON 파일을 작은 문서형 데이터베이스처럼 사용합니다.

## Gemini가 참고하는 데이터

- `company_profiles/*.json`: 회사별 기본 맥락, 관찰 포인트, 중요/낮은 우선순위 신호
- `state/daily_briefings/YYYY-MM-DD.json`: 매일 생성된 회사별 분석 결과
- `state/company_timelines/회사명.json`: 회사별 최근 흐름을 빠르게 읽기 위한 압축 타임라인
- `state/issue_history.json`: 회사별 주요 토픽과 판단 근거 누적 이력
- 당일 수집 공시/뉴스 CSV: Gemini 입력으로 전달되는 원자료

## 회사 프로필 핵심 필드

- `business_summary`: 회사가 어떤 관점에서 봐야 하는 회사인지 1문장으로 설명합니다.
- `core_areas`: 회사별 주요 사업/제품군/관심 영역입니다.
- `watch_points`: 매일 브리핑에서 반복적으로 확인할 항목입니다.
- `high_priority_signals`: Gemini가 중요도를 높게 볼 수 있는 신호입니다.
- `low_priority_signals`: 수상, 캠페인, 사회공헌처럼 중요도를 낮게 볼 수 있는 신호입니다.
- `disclosure_focus`: 공시 원문에서 확인해야 할 항목입니다.
- `news_focus`: 뉴스가 실제 사업 이슈인지 홍보성인지 구분할 때 보는 항목입니다.
- `history`: 사람이 직접 남기는 회사별 과거 주요 이력입니다.

## 운영 원칙

- Gemini는 제공된 데이터 안에서만 판단해야 합니다.
- 중요하지 않은 뉴스는 중요하지 않다고 쓰게 합니다.
- 공시/뉴스 원문에 없는 금액, 계약 상대방, 임상 결과는 추정하지 않습니다.
- push 배포 테스트에서는 Gemini를 호출하지 않고, 스케줄/수동 실행에서만 호출합니다.

## 회사별 타임라인

`state/company_timelines/회사명.json`은 매일 분석 결과 중 Gemini가 다음 분석 때 다시 참고할 만큼만 압축해 저장합니다.

저장되는 항목은 다음과 같습니다.

- `date`: 브리핑 날짜
- `issue_type`: 계약/R&D/허가/홍보/참고 등 이슈 유형
- `priority`: high, medium, low, reference
- `summary`: 그날 회사별 요약
- `watch_reason`: 왜 봐야 하는지
- `previous_context`: 이전 흐름과의 비교
- `check_points`: 확인할 점
- `topics`: 의미 단위 토픽
- `confidence`: 판단 확신도
- `evidence`: 근거 요약

Gemini 입력에는 회사별 타임라인 전체가 아니라 최근 5개 이벤트만 전달합니다. 파일은 길게 보관하되, LLM이 읽는 양은 작게 유지하기 위한 구조입니다.
