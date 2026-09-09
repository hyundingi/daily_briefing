export function renderPage() {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>경영기획팀 Dashboard</title>
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <div id="root">
    <div class="boot-screen">
      <div class="boot-mark">MP</div>
      <div>
        <p class="boot-title">경영기획팀 Dashboard</p>
        <p class="boot-subtitle">데이터를 불러오는 중입니다.</p>
      </div>
    </div>
  </div>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="/assets/app.js"></script>
</body>
</html>`;
}
