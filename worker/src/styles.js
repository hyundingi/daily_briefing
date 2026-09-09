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
    radial-gradient(circle at 12% 8%, rgba(230, 173, 170, 0.48), transparent 32%),
    linear-gradient(135deg, #fffaf9 0%, #f8e8e7 38%, #f6f3f2 100%);
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
  background: rgba(255, 255, 255, 0.58);
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
.panel-inner { padding: 22px; }
.panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
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

.sim-grid { display: grid; grid-template-columns: minmax(0, 1fr) 190px; gap: 18px; align-items: center; }
.slider-row { margin-bottom: 16px; }
.slider-label { display: flex; justify-content: space-between; margin-bottom: 8px; color: var(--muted); font-size: 13px; font-weight: 800; }
input[type="range"] { width: 100%; accent-color: var(--primary-800); }
.sim-result { padding: 18px; border-radius: 24px; background: var(--primary-900); color: #fff; }
.sim-result p { margin: 0; }
.sim-result .big { margin-top: 8px; font-size: 30px; font-weight: 950; letter-spacing: -0.04em; }

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
.time-badge, .dday-badge { flex: 0 0 auto; min-width: 60px; height: 34px; display: grid; place-items: center; border-radius: 999px; background: var(--primary-100); color: var(--primary-900); font-size: 12px; font-weight: 950; }
.mini-title { margin: 0; font-size: 14px; font-weight: 900; }
.mini-text { margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.5; }

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
.ticker-track { display: inline-flex; gap: 34px; white-space: nowrap; animation: ticker 55s linear infinite; padding-left: 100%; }
.ticker-item { font-size: 13px; font-weight: 800; opacity: 0.95; }
@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-100%); } }

.empty { padding: 36px; text-align: center; color: var(--muted); border-radius: 22px; background: rgba(255,255,255,0.54); }
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
  .updated-chip { display: inline-flex; margin-top: 12px; }
  .nav-group, .dashboard-grid, .kpi-grid, .division-grid, .sim-grid, .content-toolbar { grid-template-columns: 1fr; }
}
`;
