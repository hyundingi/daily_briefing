export const APP_CSS = `
:root {
  --primary-50: #f8e8e7;
  --primary-100: #f4d8d6;
  --primary-200: #edc3c0;
  --primary-300: #e6adaa;
  --primary-500: #dd7f78;
  --primary-800: #94403c;
  --primary-900: #6f302d;
  --ink: #242020;
  --muted: #756f6f;
  --soft: #faf7f6;
  --line: #eadfdd;
  --card: rgba(255, 255, 255, 0.86);
  --shadow: 0 18px 50px rgba(111, 48, 45, 0.11);
  --radius-lg: 28px;
  --radius-md: 20px;
  --radius-sm: 14px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  background:
    radial-gradient(circle at 10% 6%, rgba(230, 173, 170, 0.24), transparent 30%),
    radial-gradient(circle at 88% 12%, rgba(244, 216, 214, 0.34), transparent 28%),
    linear-gradient(135deg, #ffffff 0%, #fffdfc 46%, #faf7f6 100%);
}

a { color: inherit; text-decoration: none; }
button, input, select { font: inherit; }
button { border: 0; cursor: pointer; }

.boot-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  color: var(--primary-900);
}
.boot-mark, .brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 900;
  letter-spacing: -0.04em;
  background: linear-gradient(145deg, var(--primary-500), var(--primary-900));
  box-shadow: 0 14px 26px rgba(148, 64, 60, 0.23);
}
.boot-title { margin: 0; font-weight: 900; font-size: 18px; }
.boot-subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 26px 18px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24px);
  border-right: 1px solid rgba(234, 223, 221, 0.85);
}
.brand { display: flex; gap: 12px; align-items: center; margin-bottom: 28px; }
.brand-eyebrow { margin: 0; color: var(--primary-800); font-size: 12px; font-weight: 800; letter-spacing: 0.02em; }
.brand-title { margin: 2px 0 0; font-size: 17px; font-weight: 900; letter-spacing: -0.04em; }

.nav-group { display: grid; gap: 8px; }
.nav-button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 13px;
  border-radius: 16px;
  color: #5f5655;
  background: transparent;
  text-align: left;
  transition: 0.18s ease;
}
.nav-button:hover { background: rgba(244, 216, 214, 0.55); color: var(--primary-900); transform: translateX(2px); }
.nav-button.active {
  background: linear-gradient(135deg, var(--primary-300), var(--primary-100));
  color: var(--primary-900);
  box-shadow: 0 12px 26px rgba(148, 64, 60, 0.12);
}
.nav-icon { width: 26px; height: 26px; border-radius: 10px; display: grid; place-items: center; background: rgba(255,255,255,0.58); }
.nav-label { font-size: 14px; font-weight: 800; }

.side-note {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 20px;
  padding: 16px;
  border-radius: 22px;
  background: rgba(255,255,255,0.64);
  border: 1px solid rgba(230, 173, 170, 0.5);
}
.side-note-title { margin: 0 0 6px; font-size: 13px; font-weight: 900; color: var(--primary-900); }
.side-note-text { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.55; }

.main { min-width: 0; padding: 28px 34px 72px; }
.topbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 22px; }
.page-kicker { margin: 0 0 6px; color: var(--primary-800); font-size: 13px; font-weight: 900; }
.page-title { margin: 0; font-size: clamp(28px, 3vw, 42px); letter-spacing: -0.055em; line-height: 1.08; }
.page-desc { margin: 10px 0 0; color: var(--muted); font-size: 14px; line-height: 1.65; max-width: 700px; }
.updated-chip { white-space: nowrap; padding: 11px 15px; border-radius: 999px; background: rgba(255,255,255,0.68); border: 1px solid rgba(230,173,170,0.55); color: var(--primary-900); font-size: 13px; font-weight: 800; }
.topbar-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }

.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.kpi-card {
  padding: 18px;
  border-radius: var(--radius-md);
  background: var(--card);
  border: 1px solid rgba(255,255,255,0.9);
  box-shadow: var(--shadow);
}
.kpi-label { margin: 0 0 10px; color: var(--muted); font-size: 13px; font-weight: 800; }
.kpi-value { display: flex; align-items: baseline; gap: 6px; margin: 0; color: var(--primary-900); font-size: 28px; font-weight: 950; letter-spacing: -0.05em; }
.kpi-unit { font-size: 13px; color: var(--muted); font-weight: 800; }
.kpi-foot { margin: 8px 0 0; color: #8d8584; font-size: 12px; }

.dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.48fr) minmax(360px, 0.92fr); gap: 18px; align-items: start; }
.stack { display: grid; gap: 18px; }
.panel {
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--card);
  border: 1px solid rgba(255,255,255,0.9);
  box-shadow: var(--shadow);
}
.schedule-panel.featured {
  background: linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,232,231,0.74));
  border-color: rgba(230, 173, 170, 0.52);
}
.schedule-panel.featured .panel-inner { padding: 24px; }
.schedule-panel.featured .panel-title { font-size: 21px; }
.panel-inner { padding: 22px; }
.panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.panel-head-side { display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.panel-title { margin: 0; font-size: 19px; font-weight: 950; letter-spacing: -0.04em; }
.panel-subtitle { margin: 5px 0 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; background: var(--primary-50); color: var(--primary-900); font-size: 12px; font-weight: 900; }

.chart-card { height: 260px; padding: 18px; border-radius: 24px; background: linear-gradient(180deg, rgba(255,255,255,0.7), rgba(248,232,231,0.5)); position: relative; }
.chart-grid { position: absolute; inset: 22px 22px 42px 52px; background: repeating-linear-gradient(to bottom, transparent 0 45px, rgba(117,111,111,0.12) 46px); border-left: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.chart-line { position: absolute; left: 58px; right: 30px; top: 66px; height: 106px; border-radius: 999px; border-top: 5px solid var(--primary-500); transform: skewY(-9deg); box-shadow: 0 12px 22px rgba(221,127,120,0.22); }
.chart-line.alt { top: 118px; border-color: #94403c; opacity: 0.75; transform: skewY(6deg); }
.chart-legend { position: absolute; left: 22px; bottom: 14px; display: flex; gap: 12px; color: var(--muted); font-size: 12px; font-weight: 800; }
.legend-dot { display: inline-block; width: 9px; height: 9px; margin-right: 5px; border-radius: 50%; background: var(--primary-500); }
.legend-dot.dark { background: var(--primary-800); }

.division-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.division-card { padding: 16px; border-radius: 22px; background: rgba(248,232,231,0.54); }
.division-name { margin: 0 0 8px; font-weight: 950; color: var(--primary-900); }
.division-value { margin: 0; font-size: 24px; font-weight: 950; letter-spacing: -0.04em; }
.division-note { margin: 8px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }

.profit-table { display: grid; gap: 8px; }
.finance-table { display: grid; gap: 8px; }
.finance-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(3, minmax(90px, 1fr));
  gap: 10px;
  align-items: center;
  padding: 13px 14px;
  border-radius: 18px;
  background: rgba(255,255,255,0.72);
  border: 1px solid var(--line);
}
.finance-row.head { background: var(--primary-50); color: var(--primary-900); font-size: 12px; font-weight: 950; }
.finance-row:not(.head) span { font-size: 13px; font-weight: 800; }
.profit-row {
  display: grid;
  grid-template-columns: 86px 82px repeat(3, minmax(74px, 1fr));
  gap: 10px;
  align-items: center;
  padding: 13px 14px;
  border-radius: 18px;
  background: rgba(255,255,255,0.72);
  border: 1px solid var(--line);
}
.profit-row.head { background: var(--primary-50); color: var(--primary-900); font-size: 12px; font-weight: 950; }
.profit-row:not(.head) span { font-size: 13px; font-weight: 800; }
.profit-name { color: var(--primary-900); font-weight: 950 !important; }
.profit-comment { grid-column: 1 / -1; margin: 2px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.cash-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.cash-grid article { padding: 15px; border-radius: 18px; background: rgba(248,232,231,0.52); }
.cash-grid span { display: block; margin-bottom: 8px; color: var(--muted); font-size: 12px; font-weight: 850; }
.cash-grid strong { color: var(--primary-900); font-size: 24px; letter-spacing: -0.04em; }

.intel-list, .data-list { display: grid; gap: 12px; }
.intel-card, .data-card {
  padding: 16px;
  border-radius: 22px;
  background: rgba(255,255,255,0.72);
  border: 1px solid rgba(234,223,221,0.78);
}
.company-chip { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; color: #fff; font-size: 12px; font-weight: 900; }
.item-title { display: block; margin: 10px 0 8px; font-size: 15px; line-height: 1.45; font-weight: 950; letter-spacing: -0.025em; }
.item-meta { color: var(--muted); font-size: 12px; }
.ai-box { margin-top: 10px; padding: 12px; border-radius: 16px; background: var(--primary-50); color: #4b4646; font-size: 13px; line-height: 1.62; }
.ai-box p { margin: 0 0 5px; }
.ai-box p:last-child { margin-bottom: 0; }
.source-text { margin-top: 10px; color: #5f5655; font-size: 13px; line-height: 1.6; }

.timeline-item, .grant-item { display: flex; gap: 12px; padding: 13px 0; border-top: 1px solid var(--line); }
.timeline-item.active {
  margin: 4px 0;
  padding: 15px;
  border: 1px solid rgba(230, 173, 170, 0.64);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
}
.time-badge, .dday-badge { flex: 0 0 auto; min-width: 60px; height: 34px; display: grid; place-items: center; border-radius: 999px; background: var(--primary-100); color: var(--primary-900); font-size: 12px; font-weight: 950; }
.mini-title { margin: 0; font-size: 14px; font-weight: 900; }
.mini-text { margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.panel-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.grant-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.grant-filter-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.grant-filter-group .field { width: 150px; }
.grant-search-group { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; }
.grant-search { width: 240px; }
.check-field { display: inline-flex; align-items: center; gap: 7px; height: 42px; padding: 0 12px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,0.72); color: var(--muted); font-size: 12px; font-weight: 900; white-space: nowrap; }
.check-field input { accent-color: var(--primary-800); }
.result-count { color: var(--muted); font-size: 12px; font-weight: 900; white-space: nowrap; }
.grant-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
.grant-grid.expanded { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.grant-card { padding: 14px; border-radius: 20px; background: rgba(255,255,255,0.72); border: 1px solid var(--line); }
.pagination { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 18px; flex-wrap: wrap; }
.page-button { min-width: 34px; height: 34px; padding: 0 10px; border: 1px solid var(--line); border-radius: 999px; background: rgba(255,255,255,0.84); color: var(--ink); font-size: 12px; font-weight: 900; cursor: pointer; }
.page-button.active { background: var(--primary-800); border-color: var(--primary-800); color: #fff; }
.page-button:disabled { opacity: 0.42; cursor: default; }
.page-ellipsis { color: var(--muted); font-size: 12px; font-weight: 900; padding: 0 2px; }
.grant-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.grant-source { color: var(--primary-900); font-size: 12px; font-weight: 950; }
.grant-summary { margin: 9px 0 0; color: #5f5655; font-size: 13px; line-height: 1.58; }
.rd-filterbar { display: grid; grid-template-columns: 150px 200px 130px minmax(220px, 1fr) auto; gap: 10px; align-items: center; margin-bottom: 14px; }
.trend-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.trend-box { padding: 14px; border-radius: 18px; background: linear-gradient(145deg, rgba(248,232,231,0.72), rgba(255,255,255,0.8)); border: 1px solid var(--line); }
.trend-box span { display: block; margin-bottom: 6px; color: var(--muted); font-size: 12px; font-weight: 900; }
.trend-box strong { display: block; color: var(--primary-900); font-size: 15px; line-height: 1.45; letter-spacing: -0.03em; }
.trend-box p { margin: 7px 0 0; color: #8d8584; font-size: 12px; line-height: 1.45; }
.rd-analysis-grid { display: grid; grid-template-columns: 1.25fr 0.85fr; gap: 12px; margin: 14px 0; }
.rd-analysis-grid.focused .matrix-card { grid-row: span 2; }
.analysis-card { padding: 14px; border-radius: 18px; background: rgba(255,255,255,0.72); border: 1px solid var(--line); }
.analysis-card h3 { margin: 0 0 11px; color: var(--primary-900); font-size: 14px; font-weight: 950; letter-spacing: -0.03em; }
.matrix { display: grid; gap: 7px; }
.matrix-head, .matrix-row { display: grid; grid-template-columns: minmax(90px, 1.1fr) repeat(5, minmax(42px, 0.55fr)) minmax(44px, 0.55fr); gap: 6px; align-items: center; }
.matrix-head span { color: var(--muted); font-size: 11px; font-weight: 950; text-align: center; }
.matrix-head span:first-child, .matrix-name { text-align: left; }
.matrix-row { padding: 2px 0; }
.matrix-name { color: #4f4948; font-size: 12px; font-weight: 950; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.matrix-cell { min-height: 28px; display: grid; place-items: center; border-radius: 10px; background: rgba(148,64,60,0.18); color: var(--primary-950); font-size: 12px; font-weight: 950; }
.matrix-row strong { color: var(--primary-900); font-size: 12px; font-weight: 950; text-align: right; }
.rank-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.rank-list li { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; gap: 7px; align-items: center; padding: 8px 9px; border-radius: 13px; background: rgba(248,232,231,0.48); }
.rank-list.compact li:nth-child(n+7) { display: none; }
.rank-no { display: grid; place-items: center; width: 21px; height: 21px; border-radius: 999px; background: var(--primary-100); color: var(--primary-900); font-size: 11px; font-weight: 950; }
.rank-name { color: #4f4948; font-size: 12px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-list strong { color: var(--primary-900); font-size: 12px; font-weight: 950; white-space: nowrap; }
.strategy-box { margin: 12px 0; padding: 16px 18px; border-radius: 20px; background: linear-gradient(145deg, rgba(111,48,45,0.07), rgba(248,232,231,0.62)); border: 1px solid rgba(230,173,170,0.5); }
.strategy-box.impact { border-left: 5px solid var(--primary-800); }
.strategy-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 9px; }
.strategy-title { margin: 0; color: var(--primary-900); font-size: 15px; font-weight: 950; }
.ai-strategy { display: grid; gap: 7px; color: #4f4948; font-size: 13px; line-height: 1.65; }
.ai-strategy p { margin: 0; padding-left: 12px; border-left: 3px solid rgba(148,64,60,0.28); }
.error-text { color: #a33; }
.strategy-box ul { margin: 0; padding-left: 18px; color: #4f4948; font-size: 13px; line-height: 1.65; }
.strategy-box li + li { margin-top: 4px; }
.project-explorer { margin-top: 14px; }
.project-explorer-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.project-explorer-head h3 { margin: 0; color: var(--primary-900); font-size: 15px; font-weight: 950; }
.project-explorer-head span { color: var(--muted); font-size: 12px; font-weight: 900; }
.trend-list { display: grid; gap: 10px; }
.trend-list.expanded { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.trend-card { padding: 14px; border-radius: 18px; background: rgba(255,255,255,0.72); border: 1px solid var(--line); }
.trend-title { margin: 0; color: var(--ink); font-size: 14px; line-height: 1.45; font-weight: 950; letter-spacing: -0.025em; }
.trend-list.expanded .trend-title,
.trend-list.expanded .grant-summary { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.grant-card.compact .mini-title,
.grant-card.compact .mini-text,
.grant-card.compact .grant-summary,
.grant-grid.expanded .mini-title,
.grant-grid.expanded .mini-text,
.grant-grid.expanded .grant-summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.content-toolbar { display: grid; grid-template-columns: 180px minmax(220px, 1fr); gap: 10px; margin-bottom: 16px; }
.field { width: 100%; height: 42px; padding: 0 14px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,0.78); color: var(--ink); outline: none; }
.field:focus { border-color: var(--primary-500); box-shadow: 0 0 0 4px rgba(230,173,170,0.3); }
.page-section { display: none; }
.page-section.active { display: block; }

.archive-list { display: grid; gap: 10px; }
.archive-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-radius: 18px; background: rgba(255,255,255,0.72); border: 1px solid var(--line); }
.ghost-button { padding: 9px 12px; border-radius: 999px; background: var(--primary-50); color: var(--primary-900); font-size: 12px; font-weight: 900; }
.archive-frame { width: 100%; min-height: 720px; border: 0; border-radius: 22px; background: #fff; margin-top: 14px; }

.ticker {
  position: fixed;
  left: 260px;
  right: 0;
  bottom: 0;
  height: 42px;
  overflow: hidden;
  background: rgba(111,48,45,0.94);
  color: #fff;
  display: flex;
  align-items: center;
  z-index: 10;
}
.ticker-track { display: inline-flex; gap: 34px; white-space: nowrap; animation: ticker 200s linear infinite; padding-left: 100%; }
.ticker-item { color: #fff; font-size: 13px; font-weight: 800; opacity: 0.95; text-decoration: none; }
.ticker-item:hover { text-decoration: underline; }
@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-100%); } }

.empty { padding: 36px; text-align: center; color: var(--muted); border-radius: 22px; background: rgba(255,255,255,0.54); }
.empty.compact { padding: 18px; font-size: 13px; }
.hidden-admin { position: fixed; right: 18px; bottom: 56px; z-index: 20; display: none; gap: 8px; padding: 10px; border-radius: 18px; background: rgba(255,255,255,0.92); box-shadow: var(--shadow); }
.hidden-admin.open { display: flex; }

@media (max-width: 1180px) {
  .app-shell { grid-template-columns: 1fr; }
  .sidebar { position: relative; height: auto; display: block; padding: 18px; }
  .side-note { position: static; margin-top: 14px; }
  .nav-group { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .main { padding: 22px 18px 72px; }
  .dashboard-grid, .kpi-grid { grid-template-columns: 1fr 1fr; }
  .ticker { left: 0; }
}

@media (max-width: 760px) {
  .topbar, .panel-head { display: block; }
  .topbar-actions { justify-content: flex-start; margin-top: 12px; }
  .updated-chip { display: inline-flex; margin-top: 12px; }
  .nav-group, .dashboard-grid, .kpi-grid, .division-grid, .content-toolbar, .cash-grid { grid-template-columns: 1fr; }
  .grant-toolbar { align-items: stretch; }
  .grant-filter-group, .grant-search-group { width: 100%; justify-content: flex-start; margin-left: 0; }
  .grant-grid.expanded, .trend-list.expanded, .trend-grid, .rd-analysis-grid, .rd-filterbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grant-filter-group .field, .grant-search { width: 100%; }
  .profit-row { grid-template-columns: 1fr 1fr; }
  .finance-row { grid-template-columns: 1fr 1fr; }
}
`;







