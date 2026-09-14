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
    ["grants", "✦", "국책과제"],
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
    var disclosureCompanyState = React.useState("전체");
    var disclosureCompany = disclosureCompanyState[0];
    var setDisclosureCompany = disclosureCompanyState[1];
    var disclosureQueryState = React.useState("");
    var disclosureQuery = disclosureQueryState[0];
    var setDisclosureQuery = disclosureQueryState[1];
    var newsCompanyState = React.useState("전체");
    var newsCompany = newsCompanyState[0];
    var setNewsCompany = newsCompanyState[1];
    var newsQueryState = React.useState("");
    var newsQuery = newsQueryState[0];
    var setNewsQuery = newsQueryState[1];
    var newsSortState = React.useState("latest");
    var newsSort = newsSortState[0];
    var setNewsSort = newsSortState[1];
    var newsGroupState = React.useState(true);
    var newsGroup = newsGroupState[0];
    var setNewsGroup = newsGroupState[1];
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
    var calendarEvents = (data && data.calendar_events) || [];
    var calendarStatus = (data && data.calendar_status) || {};
    var todayDisclosures = disclosures.filter(function (item) { return sameDay(item); });
    var todayNews = news.filter(function (item) { return sameDay(item); });
    var filteredDisclosures = filterItems(disclosures, disclosureCompany, disclosureQuery);
    var filteredNews = prepareNewsItems(filterItems(news, newsCompany, newsQuery), { grouped: newsGroup, sort: newsSort });

    return h("div", { className: "app-shell" },
      h(Sidebar, { active: active, setActive: setActive }),
      h("main", { className: "main" },
        h(Topbar, { data: data, setActive: setActive }),
        error ? h("div", { className: "empty" }, error) : null,
        loading ? h("div", { className: "empty" }, "데이터를 불러오는 중입니다.") : null,
        !loading && active === "dashboard" ? h(Dashboard, { data: data, disclosures: disclosures, news: news, grants: grants, financials: financials, calendarEvents: calendarEvents, calendarStatus: calendarStatus, todayDisclosures: todayDisclosures, todayNews: todayNews, setActive: setActive }) : null,
        !loading && active === "disclosures" ? h(DataPage, { title: "공시", subtitle: "저장된 공시를 시간순으로 확인합니다.", items: filteredDisclosures, type: "disclosure", company: disclosureCompany, setCompany: setDisclosureCompany, query: disclosureQuery, setQuery: setDisclosureQuery }) : null,
        !loading && active === "news" ? h(DataPage, { title: "뉴스", subtitle: "대표 기사 중심으로 유사 뉴스를 묶어 한눈에 확인합니다.", items: filteredNews, rawItems: news, type: "news", company: newsCompany, setCompany: setNewsCompany, query: newsQuery, setQuery: setNewsQuery, sort: newsSort, setSort: setNewsSort, grouped: newsGroup, setGrouped: setNewsGroup }) : null,
        !loading && active === "archive" ? h(ArchivePage, { archives: archives, selectedArchive: selectedArchive, setSelectedArchive: setSelectedArchive }) : null,
        !loading && active === "finance" ? h(FinancePreview, { financials: financials, expanded: true }) : null,
        !loading && active === "profit" ? h(ProfitPanel, null) : null,
        !loading && active === "cash" ? h(ComingSoon, { title: "자금현황", text: "가용 현금, 월별 지출 계획, 주요 입출금 예정액을 정리할 영역입니다." }) : null,
        !loading && active === "schedule" ? h(SchedulePage, { calendarEvents: calendarEvents, calendarStatus: calendarStatus }) : null,
        !loading && active === "grants" ? h(GrantsPage, { grants: grants }) : null,
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
      h("div", null, h("p", { className: "page-kicker" }, "Insight Board"), h("h1", { className: "page-title" }, "경영기획팀 Insight Board"), h("p", { className: "page-desc" }, "경쟁사 공시와 뉴스, 재무 지표, 실적 관리, 일정, 국책과제와 R&D 동향을 한 화면에서 볼 수 있도록 확장하는 첫 화면입니다.")),
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
        h(KpiCard, { label: "오늘 일정", value: props.calendarEvents.length, unit: "건", foot: props.calendarStatus && props.calendarStatus.configured ? "Google Calendar" : "캘린더 설정 전" })
      ),
      h("section", { className: "dashboard-grid" },
        h("div", { className: "stack" }, h(FinancePreview, { financials: props.financials }), h(ProfitPanel, null), h(CashPanel, null)),
        h("div", { className: "stack" }, h(SchedulePanel, { featured: true, events: props.calendarEvents, status: props.calendarStatus }), h(GrantPanel, { grants: props.grants, setActive: props.setActive }), h(IntelligencePanel, { disclosures: props.disclosures, news: props.news, setActive: props.setActive }))
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
    return h("div", { className: "stack" }, h(SchedulePanel, { featured: true, events: props.calendarEvents, status: props.calendarStatus }));
  }

  function GrantsPage(props) {
    return h("div", { className: "stack" }, h(GrantPanel, { grants: props.grants, expanded: true }));
  }

  function RdTrendPage(props) {
    return h("div", { className: "stack" }, h(RdTrendPanel, { grants: props.grants, expanded: true }));
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
    var isNews = props.type === "news";
    var displayItems = isNews ? prepareNewsItems(filterItems(props.rawItems || props.items || [], props.company, props.query), { grouped: props.grouped, sort: props.sort }) : (props.items || []);
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" },
      h(PanelHead, { title: props.title, subtitle: props.subtitle, pill: displayItems.length + "건" }),
      h("div", { className: isNews ? "content-toolbar news-toolbar" : "content-toolbar" },
        h("select", { className: "field", value: props.company, onChange: function (event) { props.setCompany(event.target.value); } }, COMPANIES.map(function (name) { return h("option", { key: name, value: name }, name); })),
        isNews ? h("select", { className: "field", value: props.sort || "latest", onChange: function (event) { props.setSort(event.target.value); } }, [h("option", { value: "latest" }, "최신순"), h("option", { value: "company" }, "회사순")]) : null,
        h("input", { className: "field", value: props.query, onChange: function (event) { props.setQuery(event.target.value); }, placeholder: isNews ? "제목, 내용, AI 요약 검색" : "회사명, 제목, 내용 검색" }),
        isNews ? h("label", { className: "toggle-field" }, h("input", { type: "checkbox", checked: !!props.grouped, onChange: function (event) { props.setGrouped(event.target.checked); } }), h("span", null, "유사 뉴스 묶기")) : null
      ),
      isNews ? h("div", { className: "news-grid" }, displayItems.length ? displayItems.map(function (item) { return h(NewsCard, { key: itemKey(item), item: item }); }) : h("div", { className: "empty" }, "조건에 맞는 뉴스가 없습니다.")) :
        h("div", { className: "data-list" }, displayItems.length ? displayItems.map(function (item) { return h(ItemCard, { key: itemKey(item), item: item }); }) : h("div", { className: "empty" }, "조건에 맞는 항목이 없습니다."))
    ));
  }


  function NewsCard(props) {
    var item = props.item;
    var company = item.company || item.company_name || "기타";
    var url = item.url || item.link || "#";
    var relatedCount = Math.max(0, Number(item.related_count || 0));
    return h("article", { className: "news-card" },
      h("div", { className: "news-card-top" },
        h("span", { className: "company-chip", style: { backgroundColor: COMPANY_COLORS[company] || "#94403c" } }, company),
        item.category ? h("span", { className: "news-category" }, item.category) : null
      ),
      h("a", { className: "news-title", href: url, target: "_blank", rel: "noreferrer" }, item.title || "제목 없음"),
      h("div", { className: "item-meta" }, [item.media || item.source || "", formatDateOnly(item.published_at || item.date || item.pub_date || "")].filter(Boolean).join(" · ")),
      h("p", { className: "news-summary" }, cleanSnippet(item.ai_summary || item.summary || item.description || item.original_text || "주요 내용이 아직 정리되지 않았습니다.")),
      h("div", { className: "news-card-actions" },
        relatedCount ? h("span", { className: "related-chip" }, "관련 기사 " + relatedCount + "건") : h("span", { className: "related-chip muted" }, "대표 기사"),
        h("a", { className: "source-link", href: url, target: "_blank", rel: "noreferrer" }, "원문 보기")
      )
    );
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
    var events = (props && props.events ? props.events : []).slice().sort(compareCalendarEvents);
    var status = props && props.status ? props.status : {};
    var subtitle = status.configured ? "Google Calendar에서 오늘 일정을 가져옵니다." : "Google Calendar ID와 API KEY를 설정하면 오늘 일정이 표시됩니다.";
    return h("section", { className: props && props.featured ? "panel schedule-panel featured" : "panel schedule-panel" }, h("div", { className: "panel-inner" },
      h(PanelHead, { title: "오늘의 팀 타임라인", subtitle: subtitle, pill: events.length ? events.length + "건" : "오늘 일정" }),
      events.length ? events.map(function (event) { return h(CalendarEventItem, { key: event.id || event.title + event.start, event: event }); }) : h("div", { className: "empty compact" }, status.message || "오늘 등록된 일정이 없습니다.")
    ));
  }

  function CalendarEventItem(props) {
    var event = props.event || {};
    return h("div", { className: isCurrentCalendarEvent(event) ? "timeline-item active" : "timeline-item" },
      h("span", { className: "time-badge" }, calendarTimeLabel(event)),
      h("div", null,
        h(event.html_link ? "a" : "p", { className: "mini-title", href: event.html_link || undefined, target: event.html_link ? "_blank" : undefined, rel: event.html_link ? "noreferrer" : undefined }, event.title || "제목 없는 일정"),
        h("p", { className: "mini-text" }, [calendarRangeLabel(event), event.location].filter(Boolean).join(" · ")),
        event.description ? h("p", { className: "mini-text" }, cleanSnippet(event.description)) : null
      )
    );
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
    var pageState = React.useState(1);
    var page = pageState[0];
    var setPage = pageState[1];
    var allGrants = props && props.grants ? props.grants : [];
    var sources = ["전체"].concat(uniqueGrantValues(allGrants, "source"));
    var topics = ["전체"].concat(uniqueGrantValues(allGrants, "category"));
    var filtered = filterGrants(allGrants, { query: search, source: source, topic: topic, includeClosed: includeClosed });
    var pageSize = 16;
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    var safePage = Math.min(page, totalPages);
    if (safePage !== page) setTimeout(function () { setPage(safePage); }, 0);
    var pagedGrants = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    var grants = props && props.expanded ? pagedGrants : filtered.slice(0, 3);
    function resetPage(fn) {
      return function (event) {
        fn(event);
        setPage(1);
      };
    }
    return h("section", { className: "panel" }, h("div", { className: "panel-inner" },
      h(PanelHead, { title: "국책과제 공고", subtitle: "기업마당·K-Startup·IRIS·KHIDI 등 신청 가능한 공고를 마감일 가까운 순으로 봅니다.", pill: props && props.expanded && filtered.length ? filtered.length + "건" : null, actions: props && !props.expanded && props.setActive ? [h("button", { className: "ghost-button", onClick: function () { props.setActive("grants"); } }, "전체보기")] : null }),
      props && props.expanded ? h("div", { className: "grant-toolbar" },
        h("div", { className: "grant-filter-group" },
          h("select", { className: "field", value: source, onChange: resetPage(function (event) { setSource(event.target.value); }) }, sources.map(function (name) { return h("option", { key: name, value: name }, name === "전체" ? "전체 사이트" : name); })),
          h("select", { className: "field", value: topic, onChange: resetPage(function (event) { setTopic(event.target.value); }) }, topics.map(function (name) { return h("option", { key: name, value: name }, name === "전체" ? "전체 분류" : name); })),
          h("label", { className: "check-field" }, h("input", { type: "checkbox", checked: includeClosed, onChange: resetPage(function (event) { setIncludeClosed(event.target.checked); }) }), h("span", null, "마감 공고 포함"))
        ),
        h("div", { className: "grant-search-group" },
          h("input", { className: "field grant-search", value: search, onChange: resetPage(function (event) { setSearch(event.target.value); }), placeholder: "공고명, 기관 검색" }),
          h("span", { className: "result-count" }, "표시 " + filtered.length + "건")
        )
      ) : null,
      h("div", { className: props && props.expanded ? "grant-grid expanded" : "grant-grid" }, grants.length ? grants.map(function (item) { return h(GrantCard, { key: item.id || item.source + item.title, item: item, compact: !(props && props.expanded) }); }) : h("div", { className: "empty" }, includeClosed ? "조건에 맞는 국책과제 공고가 없습니다." : "진행 중인 국책과제 공고가 없습니다. 마감 공고 포함을 체크하면 지난 공고도 볼 수 있습니다.")),
      props && props.expanded && totalPages > 1 ? h("div", { className: "pagination" },
        h("button", { className: "page-button", disabled: safePage <= 1, onClick: function () { setPage(Math.max(1, safePage - 1)); } }, "이전"),
        paginationNumbers(safePage, totalPages).map(function (pageNo, index) { return pageNo === "..." ? h("span", { className: "page-ellipsis", key: "ellipsis-" + index }, "...") : h("button", { className: pageNo === safePage ? "page-button active" : "page-button", key: pageNo, onClick: function () { setPage(pageNo); } }, pageNo); }),
        h("button", { className: "page-button", disabled: safePage >= totalPages, onClick: function () { setPage(Math.min(totalPages, safePage + 1)); } }, "다음")
      ) : null,
      null
    ));
  }
  function GrantCard(props) {
    var item = props.item;
    return h("article", { className: props.compact ? "grant-card compact" : "grant-card" },
      h("div", { className: "grant-top" }, h("span", { className: "dday-badge" }, ddayText(item.deadline)), h("span", { className: "grant-source" }, item.source || "국책과제")),
      h(item.link ? "a" : "p", { className: "mini-title", href: item.link || undefined, target: item.link ? "_blank" : undefined, rel: item.link ? "noreferrer" : undefined }, item.title || "제목 없음"),
      h("p", { className: "mini-text" }, [item.agency, item.category, item.keywords && item.keywords !== item.category ? "검색어 " + item.keywords : "", deadlineLabel(item.deadline)].filter(Boolean).join(" · ")),
      item.summary ? h("p", { className: "grant-summary" }, cleanSnippet(item.summary)) : null,
      item.budget || item.target ? h("p", { className: "mini-text" }, [item.budget ? "지원규모: " + item.budget : "", item.target ? "대상: " + item.target : ""].filter(Boolean).join(" / ")) : null
    );
  }


  function RdTrendPanel(props) {
    var rdRemoteState = React.useState({ loading: false, items: [], error: "" });
    var rdRemote = rdRemoteState[0];
    var setRdRemote = rdRemoteState[1];
    React.useEffect(function () {
      var shouldLoadRd = !!(props && (props.expanded || props.setActive));
      if (!shouldLoadRd) return;
      setRdRemote(function (prev) { return prev.items.length ? prev : { loading: true, items: [], error: "" }; });
      fetch("/api/rd/projects?limit=" + (props && props.expanded ? "2000" : "300"))
        .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (result) { setRdRemote(result.ok ? { loading: false, items: result.json.items || [], error: "" } : { loading: false, items: [], error: result.json.error || "NTIS 데이터를 불러오지 못했습니다." }); })
        .catch(function (error) { setRdRemote({ loading: false, items: [], error: error.message || String(error) }); });
    }, [props && props.expanded, props && props.setActive]);
    var ntisItems = (rdRemote.items.length ? rdRemote.items : (props && props.grants ? props.grants : [])).filter(function (item) { return String(item.source || "").toUpperCase().indexOf("NTIS") >= 0; });
    var keywordState = React.useState("전체");
    var focusKeyword = keywordState[0];
    var setFocusKeyword = keywordState[1];
    var agencyState = React.useState("전체");
    var agencyFilter = agencyState[0];
    var setAgencyFilter = agencyState[1];
    var yearState = React.useState("전체");
    var yearFilter = yearState[0];
    var setYearFilter = yearState[1];
    var searchState = React.useState("");
    var search = searchState[0];
    var setSearch = searchState[1];
    var pageState = React.useState(1);
    var page = pageState[0];
    var setPage = pageState[1];
    var storedAiText = readStoredAiStrategy(focusKeyword, agencyFilter, yearFilter);
    var aiState = React.useState({ loading: false, text: storedAiText, error: "" });
    var aiStrategy = aiState[0];
    var setAiStrategy = aiState[1];
    var keywordOptions = ["전체"].concat(rdAvailableKeywords(ntisItems));
    var agencyOptions = ["전체"].concat(countRows(ntisItems, function (item) { return item.agency || "기관 미확인"; }).slice(0, 30).map(function (row) { return row.name; }));
    var yearOptions = ["전체"].concat(countRows(ntisItems, function (item) { return rdYear(item); }).map(function (row) { return row.name; }).filter(function (year) { return /^20\d{2}$/.test(year); }).sort().reverse());
    var filtered = filterRdItems(ntisItems, { keyword: focusKeyword, agency: agencyFilter, year: yearFilter, query: search });
    var stats = rdTrendStats(filtered);
    var years = yearFilter === "전체" ? recentYearLabels(ntisItems, 5) : [yearFilter];
    var trendRows = keywordYearTrend(ntisItems, focusKeyword, years).slice(0, props && props.expanded ? 8 : 5);
    var competitorRows = competitorSignals(filtered).slice(0, 8);
    var sortedProjects = filtered.slice().sort(function (a, b) { return String(b.announcement_date || b.first_seen_at || "").localeCompare(String(a.announcement_date || a.first_seen_at || "")); });
    var pageSize = props && props.expanded ? 12 : 6;
    var totalPages = Math.max(1, Math.ceil(sortedProjects.length / pageSize));
    var safePage = Math.min(page, totalPages);
    if (safePage !== page) setTimeout(function () { setPage(safePage); }, 0);
    var projectRows = sortedProjects.slice((safePage - 1) * pageSize, safePage * pageSize);
    var insights = strategicRdInsights({ total: ntisItems.length, filtered: filtered, stats: stats, keyword: focusKeyword, agency: agencyFilter, competitors: competitorRows, years: years, trendRows: trendRows });
    React.useEffect(function () {
      setAiStrategy({ loading: false, text: readStoredAiStrategy(focusKeyword, agencyFilter, yearFilter), error: "" });
    }, [focusKeyword, agencyFilter, yearFilter]);
    function resetPage(setter) {
      return function (event) { setter(event.target.value); setPage(1); };
    }
    function requestAiStrategy() {
      var password = window.prompt("관리자 비밀번호를 입력해주세요.");
      if (!password) return;
      setAiStrategy({ loading: true, text: "", error: "" });
      fetch("/api/rd/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Update-Password": password },
        body: JSON.stringify({
          keyword: focusKeyword,
          agency: agencyFilter,
          year: yearFilter,
          total_count: ntisItems.length,
          filtered_count: filtered.length,
          trends: trendRows.slice(0, 8),
          agencies: stats.agencies.slice(0, 8),
          competitors: competitorRows.slice(0, 8),
          funds: stats.funds.slice(0, 5),
          samples: sortedProjects.slice(0, 10).map(function (item) { return { title: item.title, agency: item.agency, category: item.category, year: rdYear(item), summary: cleanSnippet(item.summary || "").slice(0, 180) }; })
        })
      }).then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
        .then(function (result) {
          if (result.ok) {
            var text = result.json.analysis || "";
            saveStoredAiStrategy(focusKeyword, agencyFilter, yearFilter, text);
            setAiStrategy({ loading: false, text: text, error: "" });
          } else {
            setAiStrategy({ loading: false, text: "", error: result.json.error || "Gemini 분석에 실패했습니다." });
          }
        })
        .catch(function (error) { setAiStrategy({ loading: false, text: "", error: error.message || String(error) }); });
    }
    return h("section", { className: "panel rd-panel" }, h("div", { className: "panel-inner" },
      h(PanelHead, { title: "R&D 동향", subtitle: "NTIS 과제를 공고와 분리해 정부가 실제로 돈을 쓰는 연구 분야·기관·경쟁사 신호를 봅니다.", pill: ntisItems.length ? formatNumber(ntisItems.length) + "건" : "NTIS", actions: props && !props.expanded && props.setActive ? [h("button", { className: "ghost-button", onClick: function () { props.setActive("rd_trends"); } }, "분석 보기")] : null }),
      rdRemote.loading ? h("div", { className: "empty compact" }, "NTIS 데이터를 불러오는 중입니다.") : rdRemote.error ? h("div", { className: "empty compact" }, rdRemote.error) : ntisItems.length ? h(React.Fragment, null,
        props && props.expanded ? h("div", { className: "rd-filterbar" },
          h("select", { className: "field", value: focusKeyword, onChange: resetPage(setFocusKeyword) }, keywordOptions.map(function (name) { return h("option", { key: name, value: name }, name === "전체" ? "전체 관심분야" : name); })),
          h("select", { className: "field", value: agencyFilter, onChange: resetPage(setAgencyFilter) }, agencyOptions.map(function (name) { return h("option", { key: name, value: name }, name === "전체" ? "전체 기관" : name); })),
          h("select", { className: "field", value: yearFilter, onChange: resetPage(setYearFilter) }, yearOptions.map(function (name) { return h("option", { key: name, value: name }, name === "전체" ? "전체 연도" : name); })),
          h("input", { className: "field", value: search, onChange: function (event) { setSearch(event.target.value); setPage(1); }, placeholder: "과제명, 기관, 키워드 검색" }),
          h("span", { className: "result-count" }, "분석 대상 " + formatNumber(filtered.length) + "건")
        ) : null,
        h("div", { className: "trend-grid" },
          h(TrendBox, { label: "현재 분석 대상", value: formatNumber(filtered.length) + "건", note: focusKeyword === "전체" ? "전체 NTIS 과제" : focusKeyword + " 관련 과제" }),
          h(TrendBox, { label: "반복 등장 기관", value: stats.agencies.length ? stats.agencies[0].name : "분석 대기", note: stats.agencies.length ? formatNumber(stats.agencies[0].value) + "건 반복" : "기관 데이터 없음" }),
          h(TrendBox, { label: "경쟁사/협력사 신호", value: competitorRows.length ? competitorRows[0].name : "없음", note: competitorRows.length ? formatNumber(competitorRows[0].value) + "건 언급" : "현재 필터 기준 직접 언급 없음" })
        ),
        h("div", { className: "strategy-box impact" },
          h("div", { className: "strategy-head" }, h("p", { className: "strategy-title" }, "전략적으로 볼 점"), h("button", { className: "ghost-button", disabled: aiStrategy.loading, onClick: requestAiStrategy }, aiStrategy.loading ? "Gemini 분석 중…" : "Gemini로 분석")),
          aiStrategy.text ? h("div", { className: "ai-strategy" }, renderAiStrategy(aiStrategy.text)) : h("ul", null, insights.map(function (line, index) { return h("li", { key: index }, line); })),
          aiStrategy.error ? h("p", { className: "mini-text error-text" }, aiStrategy.error) : null
        ),
        h("div", { className: "rd-analysis-grid focused" },
          h(TrendMatrix, { title: yearFilter === "전체" ? "최근 5년 관심분야 흐름" : yearFilter + "년 관심분야 분포", rows: trendRows, years: years }),
          h(RankList, { title: "우선 모니터링 기관", rows: stats.agencies.slice(0, 8), unit: "건" }),
          h(RankList, { title: "경쟁사·협력사 과제 신호", rows: competitorRows, unit: "건" }),
          h(RankList, { title: "정부 R&D 투자 규모 상위", rows: stats.funds.slice(0, 6), unit: "원", money: true })
        ),
        h("div", { className: "project-explorer" },
          h("div", { className: "project-explorer-head" }, h("h3", null, "과제 탐색"), h("span", null, "전체 " + formatNumber(sortedProjects.length) + "건 중 " + (sortedProjects.length ? ((safePage - 1) * pageSize + 1) + "-" + Math.min(sortedProjects.length, safePage * pageSize) : "0") + "건 표시")),
          h("div", { className: props && props.expanded ? "trend-list expanded" : "trend-list" }, projectRows.map(function (item) { var projectUrl = projectLink(item); return h("article", { className: "trend-card", key: item.id || item.external_id || item.title },
            h(projectUrl ? "a" : "p", { className: "trend-title", href: projectUrl || undefined, target: projectUrl ? "_blank" : undefined, rel: projectUrl ? "noreferrer" : undefined }, item.title || "제목 없음"),
            h("p", { className: "mini-text" }, [item.agency, item.category, item.announcement_date, item.budget ? formatMoney(parseMoney(item.budget)) : ""].filter(Boolean).join(" · ")),
            item.summary ? h("p", { className: "grant-summary" }, cleanSnippet(item.summary)) : null
          ); })),
          props && props.expanded && totalPages > 1 ? h("div", { className: "pagination" },
            h("button", { className: "page-button", disabled: safePage <= 1, onClick: function () { setPage(Math.max(1, safePage - 1)); } }, "이전"),
            paginationNumbers(safePage, totalPages).map(function (pageNo, index) { return pageNo === "..." ? h("span", { className: "page-ellipsis", key: "rd-ellipsis-" + index }, "...") : h("button", { className: pageNo === safePage ? "page-button active" : "page-button", key: pageNo, onClick: function () { setPage(pageNo); } }, pageNo); }),
            h("button", { className: "page-button", disabled: safePage >= totalPages, onClick: function () { setPage(Math.min(totalPages, safePage + 1)); } }, "다음")
          ) : null
        )
      ) : h("div", { className: "empty compact" }, "아직 NTIS 과제 데이터가 없습니다. R&D 동향 탭에서 데이터를 다시 확인해주세요.")
    ));
  }


  function aiStorageKey(keyword, agency, year) {
    return "insight-board:rd-strategy:" + [keyword || "전체", agency || "전체", year || "전체"].join(":");
  }

  function readStoredAiStrategy(keyword, agency, year) {
    try { return window.localStorage.getItem(aiStorageKey(keyword, agency, year)) || ""; } catch (_) { return ""; }
  }

  function saveStoredAiStrategy(keyword, agency, year, text) {
    try { if (text) window.localStorage.setItem(aiStorageKey(keyword, agency, year), text); } catch (_) {}
  }

  function cleanMarkdownText(value) {
    return String(value || "")
      .replace(/\\\*/g, "*")
      .replace(/\*\*/g, "")
      .replace(new RegExp(String.fromCharCode(96), "g"), "")
      .replace(/^\s*[-*•]\s*/, "")
      .trim();
  }

  function renderAiStrategy(text) {
    var normalized = String(text || "").replace(/\r/g, "");
    normalized = normalized.replace(/\s*\*\s*\*\*/g, "\n**");
    var lines = normalized.split(new RegExp("\\n+")).map(cleanMarkdownText).filter(Boolean);
    return lines.map(function (line, index) {
      var match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (match) return h("article", { className: "ai-strategy-card", key: index }, h("strong", null, match[1]), match[2] ? h("p", null, match[2]) : null);
      if (index === 0 && line.indexOf("경영기획팀 R&D 전략 코멘트") >= 0) return h("p", { className: "ai-strategy-kicker", key: index }, line);
      return h("p", { key: index }, line);
    });
  }

function projectLink(item) {
    if (item && item.link) return item.link;
    if (item && String(item.source || "").toUpperCase().indexOf("NTIS") >= 0) {
      var match = String(item.id || item.external_id || "").match(/(?:NTIS:)?(\d{6,})/);
      if (match) return "https://www.ntis.go.kr/project/pjtInfo.do?pjtId=" + encodeURIComponent(match[1]);
      if (item.title) return "https://www.ntis.go.kr/ThSearchResult.do?searchWord=" + encodeURIComponent(item.title);
    }
    return "";
  }

  function TrendBox(props) {
    return h("article", { className: "trend-box" }, h("span", null, props.label), h("strong", null, props.value), h("p", null, props.note));
  }

  function TrendMatrix(props) {
    var rows = props.rows || [];
    var years = props.years || [];
    var max = rows.reduce(function (value, row) { return Math.max(value, Math.max.apply(null, years.map(function (year) { return row.years[year] || 0; }))); }, 0) || 1;
    return h("article", { className: "analysis-card matrix-card" },
      h("h3", null, props.title),
      rows.length ? h("div", { className: "matrix" },
        h("div", { className: "matrix-head" }, h("span", null, "분야"), years.map(function (year) { return h("span", { key: year }, year); }), h("span", null, "합계")),
        rows.map(function (row) { return h("div", { className: "matrix-row", key: row.name },
          h("span", { className: "matrix-name" }, row.name),
          years.map(function (year) { var value = row.years[year] || 0; return h("span", { key: year, className: "matrix-cell", style: { opacity: value ? 0.35 + Math.min(0.65, value / max) : 0.22 } }, value || "-"); }),
          h("strong", null, formatNumber(row.value))
        ); })
      ) : h("p", { className: "mini-text" }, "최근 5년 기준으로 표시할 데이터가 없습니다.")
    );
  }

  function RankList(props) {
    var rows = props.rows || [];
    return h("article", { className: "analysis-card" },
      h("h3", null, props.title),
      rows.length ? h("ol", { className: "rank-list compact" }, rows.map(function (row, index) { return h("li", { key: row.name },
        h("span", { className: "rank-no" }, index + 1),
        h("span", { className: "rank-name" }, row.name),
        h("strong", null, props.money ? formatMoney(row.value || 0) : formatNumber(row.value || 0) + (props.unit || ""))
      ); })) : h("p", { className: "mini-text" }, "분석할 데이터가 없습니다.")
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

  function compareCalendarEvents(a, b) {
    return calendarTimeValue(a.start) - calendarTimeValue(b.start);
  }

  function calendarTimeValue(value) {
    var date = new Date(value || "");
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function calendarTimeLabel(event) {
    if (event && event.all_day) return "종일";
    var start = calendarClock(event && event.start);
    return start || "시간 미정";
  }

  function calendarRangeLabel(event) {
    if (!event) return "";
    if (event.all_day) return "종일 일정";
    var start = calendarClock(event.start);
    var end = calendarClock(event.end);
    return [start, end].filter(Boolean).join(" - ");
  }

  function calendarClock(value) {
    if (!value) return "";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function isCurrentCalendarEvent(event) {
    if (!event || event.all_day) return false;
    var now = new Date();
    var start = new Date(event.start || "");
    var end = new Date(event.end || "");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    return start.getTime() <= now.getTime() && end.getTime() >= now.getTime();
  }

  function prepareNewsItems(items, options) {
    var rows = (items || []).slice();
    if (options && options.grouped) rows = representativeNews(rows);
    if (options && options.sort === "company") {
      rows.sort(function (a, b) { return companyIndex(a.company || a.company_name) - companyIndex(b.company || b.company_name) || dateValue(b) - dateValue(a); });
    } else {
      rows.sort(function (a, b) { return dateValue(b) - dateValue(a); });
    }
    return rows;
  }

  function representativeNews(items) {
    var groups = [];
    items.forEach(function (item) {
      var tokens = newsTokens(item.title || "");
      var matched = null;
      for (var i = 0; i < groups.length; i += 1) {
        if ((groups[i].company || "") === (item.company || item.company_name || "") && isSimilarNewsTokens(tokens, groups[i].tokens)) { matched = groups[i]; break; }
      }
      if (!matched) groups.push({ company: item.company || item.company_name || "", tokens: tokens, items: [item] });
      else matched.items.push(item);
    });
    return groups.map(function (group) {
      var sorted = group.items.slice().sort(function (a, b) { return sourcePriority(b) - sourcePriority(a) || dateValue(b) - dateValue(a); });
      var head = Object.assign({}, sorted[0]);
      head.related_count = group.items.length - 1;
      return head;
    });
  }

  function newsTokens(title) {
    var stop = new Set(["단독", "종합", "속보", "관련", "뉴스", "기자", "제약", "바이오", "헬스", "회사", "오늘", "이번", "통해", "위해", "대한", "으로", "에서", "한다", "개최", "진행", "대상"]);
    var text = String(title || "");
    COMPANIES.slice(1).forEach(function (name) { text = text.replace(new RegExp(name, "g"), " "); });
    return unique(text.replace(/[0-9]+(?:조|억|만|개|건|%)?/g, " ").replace(/[^0-9A-Za-z가-힣]/g, " ").split(/\s+/).map(function (word) { return word.trim(); }).filter(function (word) { return word.length >= 2 && !stop.has(word); })).slice(0, 8);
  }


  function unique(values) {
    return Array.from(new Set(values || []));
  }

  function isSimilarNewsTokens(a, b) {
    var overlap = tokenOverlap(a, b);
    if (overlap < 2) return false;
    var base = Math.max(1, Math.min((a || []).length, (b || []).length));
    return overlap / base >= 0.55 || overlap >= 3;
  }
  function tokenOverlap(a, b) {
    var set = new Set(b || []);
    return (a || []).filter(function (token) { return set.has(token); }).length;
  }

  function sourcePriority(item) {
    var media = String(item.media || item.source || "");
    var preferred = ["약업신문", "데일리팜", "의학신문", "메디파나", "히트뉴스", "바이오스펙테이터", "청년의사", "메디칼타임즈", "팜뉴스", "한국경제", "매일경제", "서울경제", "이데일리", "머니투데이", "연합뉴스"];
    for (var i = 0; i < preferred.length; i += 1) if (media.indexOf(preferred[i]) >= 0) return 100 - i;
    return 1;
  }


  function companyIndex(name) {
    var index = COMPANIES.indexOf(name || "");
    return index >= 0 ? index : 999;
  }
  function formatDateOnly(value) {
    return String(value || "").slice(0, 10);
  }
  function filterItems(items, company, query) {
    var needle = String(query || "").toLowerCase().trim();
    return items.filter(function (item) {
      var selectedCompany = String(company || "전체").trim();
      var itemCompany = String(item.company || item.company_name || "").trim();
      var companyOk = selectedCompany === "전체" || itemCompany === selectedCompany;
      var text = [item.company, item.company_name, item.title, item.report_nm, item.description, item.original_text, item.ai_summary, item.summary, item.ai_briefing, item.media, item.source].join(" ").toLowerCase();
      return companyOk && (!needle || text.indexOf(needle) >= 0);
    });
  }

  var RD_KEYWORDS = ["디지털헬스", "AI", "신약", "임상", "바이오", "의료", "제약", "데이터", "플랫폼", "치료제", "진단", "의료기기", "백신", "세포", "유전자", "마이크로바이옴"];

  function filterRdItems(items, options) {
    var keyword = options.keyword || "전체";
    var agency = options.agency || "전체";
    var needle = String(options.query || "").toLowerCase().trim();
    return items.filter(function (item) {
      var text = rdText(item);
      var keywordOk = keyword === "전체" || text.toLowerCase().indexOf(keyword.toLowerCase()) >= 0;
      var agencyOk = agency === "전체" || String(item.agency || "") === agency;
      var yearOk = !options.year || options.year === "전체" || rdYear(item) === options.year;
      var queryOk = !needle || text.toLowerCase().indexOf(needle) >= 0;
      return keywordOk && agencyOk && yearOk && queryOk;
    });
  }

  function rdTrendStats(items) {
    return {
      keywords: rdKeywordRows(items),
      agencies: countRows(items, function (item) { return item.agency || "기관 미확인"; }),
      funds: fundRows(items)
    };
  }


  function fundRows(items) {
    var byTitle = {};
    items.forEach(function (item) {
      var value = parseMoney(item.budget);
      if (value <= 0) return;
      var title = normalizeText(item.title || "제목 없음");
      if (!byTitle[title] || byTitle[title].value < value) byTitle[title] = { name: item.title || "제목 없음", value: value, item: item };
    });
    return Object.keys(byTitle).map(function (key) { return byTitle[key]; }).sort(function (a, b) { return b.value - a.value || a.name.localeCompare(b.name, "ko"); });
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function rdAvailableKeywords(items) {
    return RD_KEYWORDS.filter(function (keyword) { return items.some(function (item) { return rdText(item).toLowerCase().indexOf(keyword.toLowerCase()) >= 0; }); });
  }

  function keywordYearTrend(items, focusKeyword, years) {
    var keywords = focusKeyword === "전체" ? rdAvailableKeywords(items).slice(0, 8) : [focusKeyword];
    return keywords.map(function (keyword) {
      var yearMap = {};
      var total = 0;
      years.forEach(function (year) { yearMap[year] = 0; });
      items.forEach(function (item) {
        if (rdText(item).toLowerCase().indexOf(keyword.toLowerCase()) < 0) return;
        var year = rdYear(item);
        if (yearMap[year] === undefined) return;
        yearMap[year] += 1;
        total += 1;
      });
      return { name: keyword, years: yearMap, value: total };
    }).filter(function (row) { return row.value > 0; }).sort(function (a, b) { return b.value - a.value || a.name.localeCompare(b.name, "ko"); });
  }

  function recentYearLabels(items, count) {
    var years = countRows(items, function (item) { return rdYear(item); }).map(function (row) { return row.name; }).filter(function (year) { return /^20\d{2}$/.test(year); }).sort();
    if (!years.length) {
      var current = new Date().getFullYear();
      return Array.from({ length: count }, function (_, index) { return String(current - count + 1 + index); });
    }
    var last = Number(years[years.length - 1]);
    return Array.from({ length: count }, function (_, index) { return String(last - count + 1 + index); });
  }

  function competitorSignals(items) {
    return COMPANIES.filter(function (name) { return name !== "전체"; }).map(function (name) {
      var count = items.filter(function (item) { return rdText(item).indexOf(name) >= 0; }).length;
      return { name: name, value: count };
    }).filter(function (row) { return row.value > 0; }).sort(function (a, b) { return b.value - a.value || a.name.localeCompare(b.name, "ko"); });
  }

  function strategicRdInsights(args) {
    var insights = [];
    var total = args.total || 0;
    var filtered = args.filtered || [];
    var stats = args.stats || { agencies: [], funds: [] };
    var keyword = args.keyword || "전체";
    var topTrend = (args.trendRows || [])[0];
    if (keyword !== "전체") {
      insights.push(keyword + " 관련 과제는 전체 NTIS 수집분 중 " + formatNumber(filtered.length) + "건입니다. 단순 공고 수가 아니라 실제 수행 과제로 잡힌 규모라, 이 분야가 일회성인지 반복 투자 영역인지 보는 기준이 됩니다.");
    } else if (topTrend) {
      insights.push("최근 5년 기준 반복적으로 보이는 관심분야는 " + topTrend.name + "입니다. 국책과제 탭에서는 이 키워드의 신규 공고가 실제로 이어지는지 같이 확인해야 합니다.");
    } else {
      insights.push("관심분야 필터를 선택하면 해당 분야가 실제 수행 과제로 얼마나 쌓였는지 볼 수 있습니다.");
    }
    if (stats.agencies && stats.agencies.length) {
      insights.push(stats.agencies[0].name + "이/가 " + formatNumber(stats.agencies[0].value) + "건으로 가장 자주 등장합니다. 해당 기관의 공고·사업계획·보도자료를 우선 모니터링 후보로 두는 것이 좋습니다.");
    }
    if (args.competitors && args.competitors.length) {
      insights.push("경쟁사/협력사 신호는 " + args.competitors.slice(0, 3).map(function (row) { return row.name + " " + row.value + "건"; }).join(", ") + "입니다. 해당 과제의 수행기관·공동연구 구조를 확인하면 협력/경쟁 포인트를 찾을 수 있습니다.");
    } else {
      insights.push("현재 필터에서는 10개 경쟁사 직접 언급이 뚜렷하지 않습니다. 경쟁사명보다 병원·대학·전문기관 중심으로 협력 네트워크를 보는 편이 유효합니다.");
    }
    if (stats.funds && stats.funds.length) {
      insights.push("연구비 상위 과제는 금액 자체보다 정부가 크게 베팅한 기술축을 보여줍니다. 상위 과제명에서 반복되는 기술어를 내부 사업기회 후보로 따로 정리하는 것을 추천합니다.");
    }
    return insights.slice(0, 4);
  }

  function rdYear(item) {
    var raw = String(item.announcement_date || item.deadline || item.first_seen_at || "");
    var match = raw.match(/20\d{2}/);
    return match ? match[0] : "연도 미상";
  }

  function rdKeywordRows(items) {
    var rows = RD_KEYWORDS.map(function (keyword) {
      var needle = String(keyword || "").toLowerCase();
      var count = items.filter(function (item) { return rdText(item).toLowerCase().indexOf(needle) >= 0; }).length;
      return { name: keyword, value: count };
    }).filter(function (row) { return row.value > 0; });
    if (rows.length) return rows.sort(function (a, b) { return b.value - a.value || a.name.localeCompare(b.name); });
    return topGrantKeywords(items).map(function (name) { return { name: name, value: items.filter(function (item) { return rdText(item).indexOf(name) >= 0; }).length }; });
  }

  function rdText(item) {
    return [item.title, item.summary, item.category, item.keywords, item.agency, item.target].join(" ");
  }

  function countRows(items, pick) {
    var counts = {};
    items.forEach(function (item) {
      var name = String(pick(item) || "").trim();
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.keys(counts).map(function (name) { return { name: name, value: counts[name] }; }).sort(function (a, b) { return b.value - a.value || a.name.localeCompare(b.name, "ko"); });
  }

  function topGrantKeywords(items) {
    var words = {};
    items.forEach(function (item) {
      [item.title, item.summary, item.keywords, item.category].join(" ").split(/[\s,·/()\[\]{}<>]+/).forEach(function (word) {
        var value = String(word || "").trim();
        if (value.length < 2) return;
        if (/^(사업|과제|지원|개발|연구|기반|기술|및|위한|통한|활용|정보|시스템|서비스)$/.test(value)) return;
        words[value] = (words[value] || 0) + 1;
      });
    });
    return Object.keys(words).sort(function (a, b) { return words[b] - words[a] || a.localeCompare(b); }).slice(0, 8);
  }

  function parseMoney(value) {
    var text = String(value || "").replace(/,/g, "").trim();
    if (!text || /기관|연도|기간|명$/.test(text)) return 0;
    var match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return 0;
    var amount = Number(match[0]);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    if (/억/.test(text)) amount *= 100000000;
    else if (/만/.test(text)) amount *= 10000;
    if (amount < 1000000) return 0;
    return amount;
  }

  function formatMoney(value) {
    var amount = Number(value || 0);
    if (!amount) return "-";
    if (amount >= 100000000) return Math.round(amount / 100000000).toLocaleString("ko-KR") + "억";
    if (amount >= 10000) return Math.round(amount / 10000).toLocaleString("ko-KR") + "만";
    return Math.round(amount).toLocaleString("ko-KR");
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("ko-KR");
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

  function paginationNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, function (_, index) { return index + 1; });
    var numbers = [1];
    var start = Math.max(2, current - 1);
    var end = Math.min(total - 1, current + 1);
    if (start > 2) numbers.push("...");
    for (var i = start; i <= end; i += 1) numbers.push(i);
    if (end < total - 1) numbers.push("...");
    numbers.push(total);
    return numbers;
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
























