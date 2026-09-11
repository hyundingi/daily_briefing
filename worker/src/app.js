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
    ["finance", "⌁", "재무비교"],
    ["profit", "▦", "손익"],
    ["cash", "₩", "자금현황"],
    ["schedule", "◇", "일정"],
    ["disclosures", "□", "공시"],
    ["news", "◌", "뉴스"]
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

    function refreshGrants() {
      var password = window.prompt("관리자 비밀번호를 입력해주세요.");
      if (!password) return;
      fetch("/api/grants/refresh", { method: "POST", headers: { "Content-Type": "application/json", "X-Update-Password": password } })
        .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (result) {
          window.alert(result.ok ? "국책과제 수집 완료: 신규 " + (result.json.added || 0) + "건 / 수집 " + (result.json.total || 0) + "건" : (result.json.error || "국책과제 수집에 실패했습니다."));
          loadLatest();
        })
        .catch(function (err) { window.alert(err.message || String(err)); });
    }

    function refreshFinancials() {
      var password = window.prompt("관리자 비밀번호를 입력해주세요.");
      if (!password) return;
      fetch("/api/financials/refresh", { method: "POST", headers: { "Content-Type": "application/json", "X-Update-Password": password } })
        .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (result) {
          window.alert(result.ok ? "DART 재무정보 수집 완료: 신규 " + (result.json.added || 0) + "건 / 수집 " + (result.json.total || 0) + "건" : (result.json.error || "DART 재무정보 수집에 실패했습니다."));
          loadLatest();
        })
        .catch(function (err) { window.alert(err.message || String(err)); });
    }

    var disclosures = sortItems((data && data.disclosures) || []);
    var news = sortItems((data && data.news) || []);
    var grants = ((data && data.government_projects) || []).slice().sort(compareGrants);
    var financials = (data && data.financial_metrics) || [];
    var todayDisclosures = disclosures.filter(function (item) { return sameDay(item); });
    var todayNews = news.filter(function (item) { return sameDay(item); });
    var filteredDisclosures = filterItems(disclosures, company, query);
    var filteredNews = filterItems(news, company, query);

    return h("div", { className: "app-shell" },
      h(Sidebar, { active: active, setActive: setActive }),
      h("main", { className: "main" },
        h(Topbar, { data: data, setActive: setActive }),
        error ? h("div", { className: "empty" }, error) : null,
        loading ? h("div", { className: "empty" }, "데이터를 불러오는 중입니다.") : null,
        !loading && active === "dashboard" ? h(Dashboard, { data: data, disclosures: disclosures, news: news, grants: grants, financials: financials, todayDisclosures: todayDisclosures, todayNews: todayNews, setActive: setActive }) : null,
        !loading && active === "disclosures" ? h(DataPage, { title: "공시", subtitle: "저장된 공시를 시간순으로 확인합니다.", items: filteredDisclosures, type: "disclosure", company: company, setCompany: setCompany, query: query, setQuery: setQuery }) : null,
        !loading && active === "news" ? h(DataPage, { title: "뉴스", subtitle: "10개 경쟁사 관련 뉴스를 시간순으로 확인합니다.", items: filteredNews, type: "news", company: company, setCompany: setCompany, query: query, setQuery: setQuery }) : null,
        !loading && active === "archive" ? h(ArchivePage, { archives: archives, selectedArchive: selectedArchive, setSelectedArchive: setSelectedArchive }) : null,
        !loading && active === "finance" ? h(FinancePreview, { financials: financials, expanded: true }) : null,
        !loading && active === "profit" ? h(ProfitPanel, null) : null,
        !loading && active === "cash" ? h(ComingSoon, { title: "자금현황", text: "가용 현금, 월별 지출 계획, 주요 입출금 예정액을 정리할 영역입니다." }) : null,
        !loading && active === "schedule" ? h(SchedulePage, { grants: grants }) : null,
        h("div", { className: adminOpen ? "hidden-admin open" : "hidden-admin" },
          h("button", { className: "ghost-button", onClick: summarizeMissing }, "AI 요약 채우기"),
          h("button", { className: "ghost-button", onClick: refreshGrants }, "국책과제 수집"),
          h("button", { className: "ghost-button", onClick: refreshFinancials }, "DART 재무 수집"),
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
        h("div", null, h("p", { className: "brand-eyebrow" }, "MANAGEMENT PLANNING"), h("p", { className: "brand-title" }, "경영기획팀 Insight Board"))
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
      h("div", null, h("p", { className: "page-kicker" }, "Insight Board"), h("h1", { className: "page-title" }, "경영기획팀 Insight Board"), h("p", { className: "page-desc" }, "경쟁사 공시와 뉴스, 재무 지표, 실적 관리, 일정과 국책과제 정보를 한 화면에서 볼 수 있도록 확장하는 첫 화면입니다.")),
      h("div", { className: "topbar-actions" },
        h("div", { className: "updated-chip" }, "데이터 업데이트: " + formatDateTime(props.data && props.data.updated_at)),
        h("button", { className: "ghost-button", onClick: function () { props.setActive("archive"); } }, "뉴스레터 아카이브")
      )
    );
  }

  function Dashboard(props) {
    return h(React.Fragment, null,
      h("section", { className: "kpi-grid" },
        h(KpiCard, { label: "오늘 공시", value: props.todayDisclosures.length, unit: "건", foot: "DART 기준" }),
        h(KpiCard, { label: "오늘 뉴스", value: props.todayNews.length, unit: "건", foot: "네이버 뉴스 기준" }),
        h(KpiCard, { label: "모집중 국책과제", value: props.grants.filter(function (item) { return item.status !== "마감"; }).length, unit: "건", foot: "마감일 가까운 순" }),
        h(KpiCard, { label: "실적 마감", value: "D-5", unit: "", foot: "캘린더 연동 예정" })
      ),
      h("section", { className: "dashboard-grid" },
        h("div", { className: "stack" }, h(FinancePreview, { financials: props.financials }), h(ProfitPanel, null), h(CashPanel, null)),
        h("div", { className: "stack" }, h(SchedulePanel, { featured: true }), h(GrantPanel, { grants: props.grants, setActive: props.setActive }), h(IntelligencePanel, { disclosures: props.disclosures, news: props.news, setActive: props.setActive }))
      )
    );
  }

  function KpiCard(props) {
    return h("article", { className: "kpi-card" }, h("p", { className: "kpi-label" }, props.label), h("p", { className: "kpi-value" }, props.value, props.unit ? h("span", { className: "kpi-unit" }, props.unit) : null), h("p", { className: "kpi-foot" }, props.foot));
  }

  function FinancePreview(props) {
    var rows = financialRows(props && props.financials ? props.financials : []);
    var content = rows.length ? h("div", { className: "finance-table" },
      h("div", { className: "finance-row head" }, h("span", null, "회사"), h("span", null, "매출액"), h("span", null, "영업이익"), h("span", null, "기준")),
      rows.slice(0, props && props.expanded ? 20 : 6).map(function (row) {
        return h("div", { className: "finance-row", key: row.company }, h("span", { className: "profit-name" }, row.company), h("span", null, formatAmount(row.revenue)), h("span", null, formatAmount(row.operatingProfit)), h("span", null, row.year + " " + reportCodeLabel(row.reportCode)));
      })
    ) : h(FinancePlaceholderChart, null);
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" },
      h(PanelHead, { title: "상위사 실적비교", subtitle: "DART 단일회사 주요계정 API 기준으로 매출액과 영업이익을 비교합니다.", pill: rows.length ? rows.length + "개사" : "DART 재무 API" }),
      content
    ));
  }

  function FinancePlaceholderChart() {
    return h("div", { className: "chart-card" },
      h("div", { className: "chart-grid" }),
      h("div", { className: "chart-line" }),
      h("div", { className: "chart-line alt" }),
      h("div", { className: "chart-legend" }, h("span", null, h("i", { className: "legend-dot" }), "매출액"), h("span", null, h("i", { className: "legend-dot dark" }), "영업이익"))
    );
  }

  function financialRows(items) {
    var grouped = {};
    items.forEach(function (item) {
      var key = item.company + ":" + item.fiscal_year + ":" + item.report_code;
      if (!grouped[key]) grouped[key] = { company: item.company, year: item.fiscal_year, reportCode: item.report_code, revenue: null, operatingProfit: null };
      if (item.account_name === "매출액" || item.account_name === "영업수익") grouped[key].revenue = item.amount;
      if (item.account_name === "영업이익") grouped[key].operatingProfit = item.amount;
    });
    return Object.values(grouped).sort(function (a, b) { return (b.revenue || 0) - (a.revenue || 0); });
  }

  function formatAmount(value) {
    if (value === null || value === undefined || value === "") return "-";
    var billion = Math.round(Number(value) / 100000000);
    return billion.toLocaleString("ko-KR") + "억";
  }

  function reportCodeLabel(code) {
    return { "11013": "1분기", "11012": "반기", "11014": "3분기", "11011": "사업보고서" }[code] || code || "";
  }

  function DivisionPanel() {
    var rows = [["ETC", "86%", "종합병원영업 실적 현황"], ["글로벌", "74%", "해외 매출·파트너링"], ["DH", "61%", "디지털헬스케어 진행률"]];
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: "사업부문 실적 요약", subtitle: "엑셀 업로드 데이터와 연결할 자리입니다." }), h("div", { className: "division-grid" }, rows.map(function (row) { return h("article", { className: "division-card", key: row[0] }, h("p", { className: "division-name" }, row[0]), h("p", { className: "division-value" }, row[1]), h("p", { className: "division-note" }, row[2])); }))));
  }

  function ProfitPanel() {
    var rows = [
      ["전사", "9월 예상", "128.4억", "18.6억", "14.5%", "주요 품목 매출 반영 시 전월 대비 소폭 개선 가능성이 있습니다."],
      ["ETC", "누적", "72.1억", "12.8억", "17.8%", "기존 주력 품목 흐름이 유지되는지가 핵심입니다."],
      ["글로벌", "누적", "34.7억", "4.1억", "11.8%", "수출·파트너 매출 인식 시점에 따라 변동성이 큽니다."],
      ["DH", "누적", "21.6억", "1.7억", "7.9%", "초기 투자비 부담이 있어 매출 전환 속도를 봐야 합니다."]
    ];
    return h("section", { className: "panel" },
      h("div", { className: "panel-inner" },
        h(PanelHead, { title: "손익", subtitle: "전사 예상 실적과 사업부문별 누적 실적을 표로 확인합니다.", pill: "샘플 데이터" }),
        h("div", { className: "profit-table" },
          h("div", { className: "profit-row head" },
            h("span", null, "구분"),
            h("span", null, "기준"),
            h("span", null, "매출"),
            h("span", null, "영업이익"),
            h("span", null, "이익률")
          ),
          rows.map(function (row) {
            return h("div", { className: "profit-row", key: row[0] + row[1] },
              h("span", { className: "profit-name" }, row[0]),
              h("span", null, row[1]),
              h("span", null, row[2]),
              h("span", null, row[3]),
              h("span", null, row[4]),
              h("p", { className: "profit-comment" }, row[5])
            );
          })
        )
      )
    );
  }

  function CashPanel() {
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: "자금현황", subtitle: "가용 현금과 월별 주요 자금 흐름을 정리할 영역입니다.", pill: "연동 예정" }), h("div", { className: "cash-grid" }, h("article", null, h("span", null, "가용 현금"), h("strong", null, "245억")), h("article", null, h("span", null, "이번 달 예정 지출"), h("strong", null, "38억")), h("article", null, h("span", null, "확인 필요"), h("strong", null, "2건")))));
  }

  function SchedulePage(props) {
    return h("div", { className: "stack" }, h(SchedulePanel, { featured: true }), h(GrantPanel, { grants: props.grants, expanded: true }));
  }

  function IntelligencePanel(props) {
    var items = sortItems(props.disclosures.concat(props.news)).slice(0, 3);
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" },
      h(PanelHead, { title: "최신 공시·뉴스", subtitle: "최근 수집된 경쟁사 공시와 뉴스를 빠르게 확인합니다.", actions: [h("button", { className: "ghost-button", onClick: function () { props.setActive("disclosures"); } }, "공시 전체보기"), h("button", { className: "ghost-button", onClick: function () { props.setActive("news"); } }, "뉴스 전체보기")] }),
      h("div", { className: "intel-list" }, items.length ? items.map(function (item) { return h(ItemCard, { key: itemKey(item), item: item }); }) : h("div", { className: "empty" }, "아직 표시할 공시나 뉴스가 없습니다.")),
      null
    ));
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

  function GrantPanel(props) {
    var searchState = React.useState("");
    var search = searchState[0];
    var setSearch = searchState[1];
    var sourceState = React.useState("전체");
    var source = sourceState[0];
    var setSource = sourceState[1];
    var topicState = React.useState("전체");
    var topic = topicState[0];
    var setTopic = topicState[1];
    var closedState = React.useState(false);
    var includeClosed = closedState[0];
    var setIncludeClosed = closedState[1];
    var allGrants = props && props.grants ? props.grants : [];
    var sources = ["전체"].concat(uniqueGrantValues(allGrants, "source"));
    var topics = ["전체"].concat(uniqueGrantValues(allGrants, "category"));
    var filtered = filterGrants(allGrants, { query: search, source: source, topic: topic, includeClosed: includeClosed });
    var grants = props && props.expanded ? filtered : filtered.slice(0, 3);
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" },
      h(PanelHead, { title: "R&D 국책과제", subtitle: "기업마당·K-Startup·IRIS 공고를 마감일 가까운 순으로 봅니다. NTIS와 KHIDI는 연결 보류 상태입니다.", pill: props && props.expanded && filtered.length ? filtered.length + "건" : null, actions: props && !props.expanded && props.setActive ? [h("button", { className: "ghost-button", onClick: function () { props.setActive("schedule"); } }, "전체보기")] : null }),
      props && props.expanded ? h("div", { className: "grant-toolbar" },
        h("div", { className: "grant-filter-group" },
          h("select", { className: "field", value: source, onChange: function (event) { setSource(event.target.value); } }, sources.map(function (name) { return h("option", { key: name, value: name }, name === "전체" ? "전체 사이트" : name); })),
          h("select", { className: "field", value: topic, onChange: function (event) { setTopic(event.target.value); } }, topics.map(function (name) { return h("option", { key: name, value: name }, name === "전체" ? "전체 키워드" : name); })),
          h("label", { className: "check-field" }, h("input", { type: "checkbox", checked: includeClosed, onChange: function (event) { setIncludeClosed(event.target.checked); } }), h("span", null, "마감 공고 포함"))
        ),
        h("div", { className: "grant-search-group" },
          h("input", { className: "field grant-search", value: search, onChange: function (event) { setSearch(event.target.value); }, placeholder: "공고명, 기관 검색" }),
          h("span", { className: "result-count" }, "표시 " + filtered.length + "건")
        )
      ) : null,
      h("div", { className: props && props.expanded ? "grant-grid expanded" : "grant-grid" }, grants.length ? grants.map(function (item) { return h(GrantCard, { key: item.id || item.source + item.title, item: item, compact: !(props && props.expanded) }); }) : h("div", { className: "empty" }, includeClosed ? "조건에 맞는 국책과제 공고가 없습니다." : "진행 중인 국책과제 공고가 없습니다. 마감 공고 포함을 체크하면 지난 공고도 볼 수 있습니다.")),
      null
    ));
  }
  function GrantCard(props) {
    var item = props.item;
    return h("article", { className: props.compact ? "grant-card compact" : "grant-card" },
      h("div", { className: "grant-top" }, h("span", { className: "dday-badge" }, ddayText(item.deadline)), h("span", { className: "grant-source" }, item.source || "국책과제")),
      h(item.link ? "a" : "p", { className: "mini-title", href: item.link || undefined, target: item.link ? "_blank" : undefined, rel: item.link ? "noreferrer" : undefined }, item.title || "제목 없음"),
      h("p", { className: "mini-text" }, [item.agency, item.category, deadlineLabel(item.deadline)].filter(Boolean).join(" · ")),
      item.summary ? h("p", { className: "grant-summary" }, cleanSnippet(item.summary)) : null,
      item.budget || item.target ? h("p", { className: "mini-text" }, [item.budget ? "지원규모: " + item.budget : "", item.target ? "대상: " + item.target : ""].filter(Boolean).join(" / ")) : null
    );
  }

  function ComingSoon(props) {
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" }, h(PanelHead, { title: props.title, subtitle: props.text }), h("div", { className: "empty" }, "다음 단계에서 실제 데이터와 연결할 예정입니다.")));
  }

  function PanelHead(props) {
    return h("div", { className: "panel-head" }, h("div", null, h("h2", { className: "panel-title" }, props.title), props.subtitle ? h("p", { className: "panel-subtitle" }, props.subtitle) : null), h("div", { className: "panel-head-side" }, props.pill ? h("span", { className: "pill" }, props.pill) : null, props.actions || null));
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
    return h("div", { className: "ticker" }, h("div", { className: "ticker-track" }, items.concat(items).map(function (item, index) { var url = item.url || item.link || "#"; return h("a", { className: "ticker-item", key: index, href: url, target: "_blank", rel: "noreferrer" }, (item.company || "") + " · " + (item.title || "")); })));
  }

  function filterItems(items, company, query) {
    var needle = String(query || "").toLowerCase().trim();
    return items.filter(function (item) {
      var companyOk = company === "전체" || (item.company || item.company_name) === company;
      var text = [item.company, item.company_name, item.title, item.report_nm, item.description, item.ai_summary, item.summary].join(" ").toLowerCase();
      return companyOk && (!needle || text.indexOf(needle) >= 0);
    });
  }

  function filterGrants(items, options) {
    var query = typeof options === "string" ? options : (options && options.query) || "";
    var source = options && options.source ? options.source : "전체";
    var topic = options && options.topic ? options.topic : "전체";
    var includeClosed = !!(options && options.includeClosed);
    var needle = String(query || "").toLowerCase().trim();
    return items.filter(function (item) {
      var sourceOk = source === "전체" || (item.source || "") === source;
      var topicOk = topic === "전체" || (item.category || item.keywords || "") === topic;
      var openOk = includeClosed || isOpenGrant(item);
      var text = [item.source, item.title, item.agency, item.category, item.summary, item.budget, item.target, item.keywords, item.deadline].join(" ").toLowerCase();
      return sourceOk && topicOk && openOk && (!needle || text.indexOf(needle) >= 0);
    }).sort(compareGrants);
  }

  function uniqueGrantValues(items, field) {
    var seen = {};
    return items.map(function (item) { return item && item[field] ? String(item[field]).trim() : ""; }).filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    }).sort(function (a, b) { return a.localeCompare(b, "ko"); });
  }

  function isOpenGrant(item) {
    var status = String((item && item.status) || "");
    if (status.indexOf("마감") >= 0 || status.toLowerCase().indexOf("closed") >= 0) return false;
    var label = ddayText(item && item.deadline);
    return label !== "마감";
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

  function compareGrants(a, b) {
    var ad = sortableDeadline(a.deadline);
    var bd = sortableDeadline(b.deadline);
    return ad.localeCompare(bd);
  }

  function sortableDeadline(deadline) {
    var raw = String(deadline || "").slice(0, 10);
    return /^20\d{2}-\d{2}-\d{2}$/.test(raw) ? raw : "9999-12-31";
  }

  function deadlineLabel(deadline) {
    var raw = String(deadline || "").trim();
    if (!raw) return "마감일 확인 필요";
    if (!/^20\d{2}-\d{2}-\d{2}/.test(raw)) return "마감 일정 미정";
    return "마감 " + raw.slice(0, 10);
  }

  function ddayText(deadline) {
    if (!deadline) return "일정 미정";
    if (!/^20\d{2}-\d{2}-\d{2}/.test(String(deadline))) return "일정 미정";
    var today = new Date(TODAY + "T00:00:00+09:00");
    var end = new Date(String(deadline).slice(0, 10) + "T00:00:00+09:00");
    if (isNaN(end.getTime())) return "D-?";
    var diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return "마감";
    if (diff === 0) return "D-day";
    return "D-" + diff;
  }

  function itemKey(item) {
    return [item.type, item.id, item.rcp_no, item.url, item.title].filter(Boolean).join(":");
  }

  function cleanSnippet(value) {
    return String(value || "").replace(/<br\s*\/?>(\s*)/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
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

