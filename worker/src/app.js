export const APP_JS = String.raw`
(function () {
  var h = React.createElement;
  var TODAY = new Date().toISOString().slice(0, 10);
  var COMPANIES = ["전체", "동아에스티", "한미약품", "종근당", "유한양행", "녹십자", "제일약품", "대웅제약", "보령", "JW중외제약", "일동제약"];
  var COMPANY_COLORS = {
    "동아에스티": "#2f6fb3",
    "한미약품": "#c45636",
    "종근당": "#7457a8",
    "유한양행": "#16805d",
    "녹십자": "#2f8f3a",
    "제일약품": "#b27322",
    "대웅제약": "#365c9f",
    "보령": "#b23b62",
    "JW중외제약": "#54606f",
    "일동제약": "#8b5f2a"
  };
  var NAV_ITEMS = [
    ["dashboard", "⌂", "대시보드"],
    ["disclosures", "□", "공시"],
    ["news", "◌", "뉴스"],
    ["archive", "▤", "아카이브"],
    ["finance", "⌁", "재무 비교"],
    ["simulator", "⇄", "손익 시뮬레이터"],
    ["schedule", "◇", "일정 · 국책과제"]
  ];

  function App() {
    var state = React.useState("dashboard");
    var active = state[0];
    var setActive = state[1];
    var dataState = React.useState(null);
    var data = dataState[0];
    var setData = dataState[1];
    var loadingState = React.useState(true);
    var loading = loadingState[0];
    var setLoading = loadingState[1];
    var errorState = React.useState("");
    var error = errorState[0];
    var setError = errorState[1];
    var companyState = React.useState("전체");
    var company = companyState[0];
    var setCompany = companyState[1];
    var queryState = React.useState("");
    var query = queryState[0];
    var setQuery = queryState[1];
    var archiveState = React.useState([]);
    var archives = archiveState[0];
    var setArchives = archiveState[1];
    var selectedArchiveState = React.useState(null);
    var selectedArchive = selectedArchiveState[0];
    var setSelectedArchive = selectedArchiveState[1];
    var adminOpenState = React.useState(false);
    var adminOpen = adminOpenState[0];
    var setAdminOpen = adminOpenState[1];

    React.useEffect(function () {
      loadLatest();
      loadArchives();
    }, []);

    React.useEffect(function () {
      function onKeydown(event) {
        if (event.ctrlKey && event.altKey && String(event.key).toLowerCase() === "a") setAdminOpen(function (value) { return !value; });
      }
      window.addEventListener("keydown", onKeydown);
      return function () { window.removeEventListener("keydown", onKeydown); };
    }, []);

    function loadLatest() {
      setLoading(true);
      setError("");
      fetch("/api/latest", { cache: "no-store" })
        .then(function (res) { if (!res.ok) throw new Error("최신 데이터를 불러오지 못했습니다."); return res.json(); })
        .then(function (json) { setData(json); })
        .catch(function (err) { setError(err.message || String(err)); })
        .finally(function () { setLoading(false); });
    }

    function loadArchives() {
      fetch("/api/archive", { cache: "no-store" })
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (json) { setArchives(Array.isArray(json) ? json : (json.items || [])); })
        .catch(function () { setArchives([]); });
    }

    function summarizeMissing() {
      var password = window.prompt("관리자 비밀번호를 입력해주세요.");
      if (!password) return;
      fetch("/api/summarize-missing", { method: "POST", headers: { "Content-Type": "application/json", "X-Update-Password": password }, body: JSON.stringify({ limit: 10 }) })
        .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (result) {
          window.alert(result.ok ? "AI 요약 저장 " + (result.json.saved || 0) + "건입니다." : (result.json.error || "AI 요약에 실패했습니다."));
          loadLatest();
        })
        .catch(function (err) { window.alert(err.message || String(err)); });
    }

    var disclosures = sortItems((data && data.disclosures) || []);
    var news = sortItems((data && data.news) || []);
    var todayDisclosures = disclosures.filter(function (item) { return sameDay(item); });
    var todayNews = news.filter(function (item) { return sameDay(item); });
    var filteredDisclosures = filterItems(disclosures, company, query);
    var filteredNews = filterItems(news, company, query);

    return h("div", { className: "app-shell" },
      h(Sidebar, { active: active, setActive: setActive }),
      h("main", { className: "main" },
        h(Topbar, { data: data }),
        error ? h("div", { className: "empty" }, error) : null,
        loading ? h("div", { className: "empty" }, "데이터를 불러오는 중입니다.") : null,
        !loading && active === "dashboard" ? h(Dashboard, { data: data, disclosures: disclosures, news: news, todayDisclosures: todayDisclosures, todayNews: todayNews }) : null,
        !loading && active === "disclosures" ? h(DataPage, { title: "공시", subtitle: "저장된 공시를 시간순으로 확인합니다.", items: filteredDisclosures, type: "disclosure", company: company, setCompany: setCompany, query: query, setQuery: setQuery }) : null,
        !loading && active === "news" ? h(DataPage, { title: "뉴스", subtitle: "10개 경쟁사 관련 뉴스를 시간순으로 확인합니다.", items: filteredNews, type: "news", company: company, setCompany: setCompany, query: query, setQuery: setQuery }) : null,
        !loading && active === "archive" ? h(ArchivePage, { archives: archives, selectedArchive: selectedArchive, setSelectedArchive: setSelectedArchive }) : null,
        !loading && active === "finance" ? h(ComingSoon, { title: "재무 비교", text: "DART 재무정보 API를 붙여 매출액, 영업이익, 부채비율을 회사별 차트로 비교하는 영역입니다." }) : null,
        !loading && active === "simulator" ? h(SimulatorPanel, null) : null,
        !loading && active === "schedule" ? h(SchedulePanel, null) : null,
        h("div", { className: adminOpen ? "hidden-admin open" : "hidden-admin" },
          h("button", { className: "ghost-button", onClick: summarizeMissing }, "AI 요약 채우기"),
          h("button", { className: "ghost-button", onClick: function () { setAdminOpen(false); } }, "닫기")
        )
      ),
      h(Ticker, { news: news })
    );
  }

  function Sidebar(props) {
    return h("aside", { className: "sidebar" },
      h("div", { className: "brand" },
        h("div", { className: "brand-mark" }, "MP"),
        h("div", null, h("p", { className: "brand-eyebrow" }, "MANAGEMENT PLANNING"), h("p", { className: "brand-title" }, "경영기획팀 Dashboard"))
      ),
      h("nav", { className: "nav-group" }, NAV_ITEMS.map(function (item) {
        return h("button", { key: item[0], className: props.active === item[0] ? "nav-button active" : "nav-button", onClick: function () { props.setActive(item[0]); } },
          h("span", { className: "nav-icon" }, item[1]), h("span", { className: "nav-label" }, item[2])
        );
      })),
      h("div", { className: "side-note" }, h("p", { className: "side-note-title" }, "운영 메모"), h("p", { className: "side-note-text" }, "내부 실적·일정·엑셀 업로드는 로그인/접근제어를 먼저 켠 뒤 연결하는 것을 권장합니다."))
    );
  }

  function Topbar(props) {
    return h("header", { className: "topbar" },
      h("div", null, h("p", { className: "page-kicker" }, "Daily Business Intelligence"), h("h1", { className: "page-title" }, "경영기획팀 의사결정 허브"), h("p", { className: "page-desc" }, "경쟁사 공시와 뉴스, 재무 지표, 실적 관리, 일정과 국책과제 정보를 한 화면에서 볼 수 있도록 확장하는 첫 화면입니다.")),
      h("div", { className: "updated-chip" }, "데이터 업데이트: " + formatDateTime(props.data && props.data.updated_at))
    );
  }

  function Dashboard(props) {
    return h(React.Fragment, null,
      h("section", { className: "kpi-grid" },
        h(KpiCard, { label: "오늘 공시", value: props.todayDisclosures.length, unit: "건", foot: "DART 기준" }),
        h(KpiCard, { label: "오늘 뉴스", value: props.todayNews.length, unit: "건", foot: "네이버 뉴스 기준" }),
        h(KpiCard, { label: "당월 매출 달성률", value: "92", unit: "%", foot: "샘플 · 엑셀 업로드 연동 예정" }),
        h(KpiCard, { label: "실적 마감", value: "D-5", unit: "", foot: "캘린더 연동 예정" })
      ),
      h("section", { className: "dashboard-grid" },
        h("div", { className: "stack" }, h(FinancePreview, null), h(DivisionPanel, null), h(SimulatorPanel, null)),
        h("div", { className: "stack" }, h(SchedulePanel, { featured: true }), h(GrantPanel, null), h(IntelligencePanel, { disclosures: props.disclosures, news: props.news }))
      )
    );
  }

  function KpiCard(props) {
    return h("article", { className: "kpi-card" }, h("p", { className: "kpi-label" }, props.label), h("p", { className: "kpi-value" }, props.value, props.unit ? h("span", { className: "kpi-unit" }, props.unit) : null), h("p", { className: "kpi-foot" }, props.foot));
  }

  function FinancePreview() {
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: "경쟁사 재무 실적 비교", subtitle: "매출액 및 영업이익 추이를 한 화면에서 비교할 예정입니다.", pill: "DART 재무 API 예정" }), h("div", { className: "chart-card" }, h("div", { className: "chart-grid" }), h("div", { className: "chart-line" }), h("div", { className: "chart-line alt" }), h("div", { className: "chart-legend" }, h("span", null, h("i", { className: "legend-dot" }), "매출액"), h("span", null, h("i", { className: "legend-dot dark" }), "영업이익")))));
  }

  function DivisionPanel() {
    var rows = [["ETC", "86%", "종합병원영업 실적 현황"], ["글로벌", "74%", "해외 매출·파트너링"], ["DH", "61%", "디지털헬스케어 진행률"]];
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: "사업부문 실적 요약", subtitle: "엑셀 업로드 데이터와 연결할 자리입니다." }), h("div", { className: "division-grid" }, rows.map(function (row) { return h("article", { className: "division-card", key: row[0] }, h("p", { className: "division-name" }, row[0]), h("p", { className: "division-value" }, row[1]), h("p", { className: "division-note" }, row[2])); }))));
  }

  function SimulatorPanel() {
    var salesState = React.useState(100);
    var sales = salesState[0];
    var setSales = salesState[1];
    var marketingState = React.useState(18);
    var marketing = marketingState[0];
    var setMarketing = marketingState[1];
    var profitRate = Math.max(0, Math.round((sales * 0.28 - marketing) / sales * 100));
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: "손익 시뮬레이터", subtitle: "슬라이더를 움직이면 예상 영업이익률이 즉시 바뀝니다." }), h("div", { className: "sim-grid" }, h("div", null, h(SliderRow, { label: "매출 목표", value: sales, suffix: "억원", min: 50, max: 180, onChange: setSales }), h(SliderRow, { label: "마케팅 예산", value: marketing, suffix: "억원", min: 5, max: 45, onChange: setMarketing })), h("div", { className: "sim-result" }, h("p", null, "예상 영업이익률"), h("p", { className: "big" }, profitRate + "%")))));
  }

  function SliderRow(props) {
    return h("div", { className: "slider-row" }, h("div", { className: "slider-label" }, h("span", null, props.label), h("strong", null, props.value + props.suffix)), h("input", { type: "range", min: props.min, max: props.max, value: props.value, onChange: function (event) { props.onChange(Number(event.target.value)); } }));
  }

  function IntelligencePanel(props) {
    var items = sortItems(props.disclosures.concat(props.news)).slice(0, 5);
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: "오늘의 경쟁사 브리핑", subtitle: "공시와 뉴스 탭에 쌓인 항목 중 최근 흐름만 대시보드에서 빠르게 봅니다.", pill: "요약 보기" }), h("div", { className: "intel-list" }, items.length ? items.map(function (item) { return h(ItemCard, { key: itemKey(item), item: item }); }) : h("div", { className: "empty" }, "아직 표시할 공시나 뉴스가 없습니다."))));
  }

  function DataPage(props) {
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: props.title, subtitle: props.subtitle, pill: props.items.length + "건" }), h("div", { className: "content-toolbar" }, h("select", { className: "field", value: props.company, onChange: function (event) { props.setCompany(event.target.value); } }, COMPANIES.map(function (name) { return h("option", { key: name, value: name }, name); })), h("input", { className: "field", value: props.query, onChange: function (event) { props.setQuery(event.target.value); }, placeholder: "회사명, 제목, 내용 검색" })), h("div", { className: "data-list" }, props.items.length ? props.items.map(function (item) { return h(ItemCard, { key: itemKey(item), item: item }); }) : h("div", { className: "empty" }, "조건에 맞는 항목이 없습니다."))));
  }

  function ArchivePage(props) {
    function openArchive(date) {
      fetch("/api/archive/" + encodeURIComponent(date), { cache: "no-store" })
        .then(function (res) { return res.json(); })
        .then(function (json) { props.setSelectedArchive(json); });
    }
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: "뉴스레터 아카이브", subtitle: "실제로 발송했던 뉴스레터 전문을 다시 확인합니다." }), h("div", { className: "archive-list" }, props.archives.length ? props.archives.map(function (row) { var date = row.date || row.run_date || row.id; return h("div", { className: "archive-row", key: date }, h("div", null, h("strong", null, date), h("p", { className: "mini-text" }, "공시 " + (row.disclosure_count || 0) + "건 · 뉴스 " + (row.news_count || 0) + "건")), h("button", { className: "ghost-button", onClick: function () { openArchive(date); } }, "보기")); }) : h("div", { className: "empty" }, "저장된 뉴스레터가 없습니다.")), props.selectedArchive ? h("iframe", { className: "archive-frame", title: "newsletter archive", srcDoc: props.selectedArchive.html || "" }) : null));
  }

  function SchedulePanel(props) {
    return h("section", { className: props && props.featured ? "panel schedule-panel featured" : "panel schedule-panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: "오늘의 팀 타임라인", subtitle: "가장 먼저 확인해야 하는 일정 영역입니다. Google Calendar 연동 예정입니다.", pill: "오늘 일정" }), h("div", { className: "timeline-item active" }, h("span", { className: "time-badge" }, "09:30"), h("div", null, h("p", { className: "mini-title" }, "월간 실적 점검"), h("p", { className: "mini-text" }, "진행 중 일정은 배너로 강조할 예정입니다."))), h("div", { className: "timeline-item" }, h("span", { className: "time-badge" }, "14:00"), h("div", null, h("p", { className: "mini-title" }, "예산 조정 회의"), h("p", { className: "mini-text" }, "캘린더 권한 연결 후 실제 일정으로 대체됩니다."))), h("div", { className: "timeline-item" }, h("span", { className: "time-badge" }, "17:00"), h("div", null, h("p", { className: "mini-title" }, "마감 자료 취합"), h("p", { className: "mini-text" }, "보고 일정과 D-Day를 연결할 예정입니다.")))));
  }

  function GrantPanel() {
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: "R&D 국책과제", subtitle: "기업마당·NTIS·K-Startup·IRIS/KHIDI 연동 예정입니다." }), h("div", { className: "grant-item" }, h("span", { className: "dday-badge" }, "D-12"), h("div", null, h("p", { className: "mini-title" }, "바이오헬스 R&D 지원사업"), h("p", { className: "mini-text" }, "지원규모, 대상, 마감일 중심으로 카드화할 예정입니다.")))));
  }

  function ComingSoon(props) {
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: props.title, subtitle: props.text }), h("div", { className: "empty" }, "다음 단계에서 실제 데이터와 연결할 예정입니다.")));
  }

  function PanelHead(props) {
    return h("div", { className: "panel-head" }, h("div", null, h("h2", { className: "panel-title" }, props.title), props.subtitle ? h("p", { className: "panel-subtitle" }, props.subtitle) : null), props.pill ? h("span", { className: "pill" }, props.pill) : null);
  }

  function ItemCard(props) {
    var item = props.item;
    var company = item.company || item.company_name || "기타";
    var url = item.url || item.link || item.dart_url || item.viewer_url || "#";
    return h("article", { className: "data-card" },
      h("span", { className: "company-chip", style: { backgroundColor: COMPANY_COLORS[company] || "#94403c" } }, company),
      h("a", { className: "item-title", href: url, target: "_blank", rel: "noreferrer" }, item.title || item.report_nm || "제목 없음"),
      h("div", { className: "item-meta" }, [item.date || item.pub_date || item.rcept_dt || "", item.category || item.source || ""].filter(Boolean).join(" · ")),
      renderAiSummary(item),
      item.description || item.original_text ? h("div", { className: "source-text" }, cleanSnippet(item.description || item.original_text)) : null
    );
  }

  function renderAiSummary(item) {
    var text = item.ai_summary || item.summary || item.ai_briefing || "";
    if (!text) return null;
    var lines = String(text).replace(/<br\s*\/?>(\s*)/gi, "\n").split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
    return h("div", { className: "ai-box" }, lines.map(function (line, index) { return h("p", { key: index }, line); }));
  }

  function Ticker(props) {
    var items = (props.news || []).slice(0, 18);
    if (!items.length) return null;
    return h("div", { className: "ticker" }, h("div", { className: "ticker-track" }, items.concat(items).map(function (item, index) { return h("span", { className: "ticker-item", key: index }, (item.company || "") + " · " + (item.title || "")); })));
  }

  function filterItems(items, company, query) {
    var needle = String(query || "").toLowerCase().trim();
    return items.filter(function (item) {
      var companyOk = company === "전체" || (item.company || item.company_name) === company;
      var text = [item.company, item.company_name, item.title, item.report_nm, item.description, item.ai_summary, item.summary].join(" ").toLowerCase();
      return companyOk && (!needle || text.indexOf(needle) >= 0);
    });
  }

  function sortItems(items) {
    return items.slice().sort(function (a, b) { return dateValue(b) - dateValue(a); });
  }

  function dateValue(item) {
    var raw = item.date || item.pub_date || item.rcept_dt || item.created_at || "";
    if (/^\d{8}$/.test(raw)) raw = raw.slice(0, 4) + "-" + raw.slice(4, 6) + "-" + raw.slice(6, 8);
    var value = new Date(raw).getTime();
    return isNaN(value) ? 0 : value;
  }

  function sameDay(item) {
    var raw = item.date || item.pub_date || item.rcept_dt || "";
    if (/^\d{8}$/.test(raw)) raw = raw.slice(0, 4) + "-" + raw.slice(4, 6) + "-" + raw.slice(6, 8);
    return String(raw).slice(0, 10) === TODAY;
  }

  function itemKey(item) {
    return [item.type, item.id, item.rcp_no, item.url, item.title].filter(Boolean).join(":");
  }

  function cleanSnippet(value) {
    return String(value || "").replace(/<br\s*\/?>(\s*)/gi, " ").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  }

  function formatDateTime(value) {
    if (!value) return "아직 없음";
    var date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  ReactDOM.createRoot(document.getElementById("root")).render(h(App));
})();
`;
