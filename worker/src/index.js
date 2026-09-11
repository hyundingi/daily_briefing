import { strFromU8, unzipSync } from "fflate";
import { APP_JS } from "./app.js";
import { renderPage as renderReactPage } from "./page.js";
import { APP_CSS } from "./styles.js";

const DART_VIEWER_URL = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=";
const DART_LIST_URL = "https://opendart.fss.or.kr/api/list.json";
const DART_DOCUMENT_URL = "https://opendart.fss.or.kr/api/document.xml";
const DART_FINANCIAL_URL = "https://opendart.fss.or.kr/api/fnlttSinglAcnt.json";
const NAVER_NEWS_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
const BIZINFO_API_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do";
const KSTARTUP_API_URL = "https://nidview.k-startup.go.kr/view/public/call/kisedKstartupService/announcementInformation";
const KHIDI_LIST_URL = "https://www.khidi.or.kr/board?menuId=MENU00101";
const IRIS_MAIN_URL = "https://iris.go.kr/main.do";

const TARGET_COMPANIES = [
  { name: "동아에스티", corpCode: "00956930", aliases: ["동아에스티"] },
  { name: "한미약품", corpCode: "00828497", aliases: ["한미약품", "한미"] },
  { name: "종근당", corpCode: "00992871", aliases: ["종근당"] },
  { name: "유한양행", corpCode: "00145109", aliases: ["유한양행"] },
  { name: "녹십자", corpCode: "00129679", aliases: ["녹십자", "GC녹십자"] },
  { name: "제일약품", corpCode: "01236897", aliases: ["제일약품"] },
  { name: "대웅제약", corpCode: "00427483", aliases: ["대웅제약"] },
  { name: "보령", corpCode: "00123143", aliases: ["보령", "보령제약"] },
  { name: "JW중외제약", corpCode: "00149947", aliases: ["JW중외제약", "제이더블유중외제약"] },
  { name: "일동제약", corpCode: "01168383", aliases: ["일동제약"] },
];

const COMPANY_COLORS = {
  "동아에스티": "#2f6fb3",
  "한미약품": "#c45636",
  "종근당": "#7457a8",
  "유한양행": "#16805d",
  "녹십자": "#2f8f3a",
  "제일약품": "#b27322",
  "대웅제약": "#365c9f",
  "보령": "#b23b62",
  "JW중외제약": "#54606f",
  "일동제약": "#8b5f2a",
};

const COMPANY_PROFILES = {
  "동아에스티": { watch_points: ["R&D 파이프라인", "기술이전", "품목허가", "실적 영향"] },
  "한미약품": { watch_points: ["기술이전", "임상 단계 변화", "품목허가", "마일스톤"] },
  "종근당": { watch_points: ["지배구조", "R&D 협력", "품목허가", "주가 변동성"] },
  "유한양행": { watch_points: ["렉라자", "글로벌 파트너링", "신약 R&D", "실적 기여"] },
  "녹십자": { watch_points: ["혈액제제", "글로벌 허가", "공급계약", "백신"] },
  "제일약품": { watch_points: ["자체 제품", "도입 의약품", "R&D", "계약"] },
  "대웅제약": { watch_points: ["나보타", "소송/규제", "해외 매출", "신약 파이프라인"] },
  "보령": { watch_points: ["카나브", "항암 포트폴리오", "투자", "우주헬스케어"] },
  "JW중외제약": { watch_points: ["수액", "전문의약품", "신약 파이프라인", "품목허가"] },
  "일동제약": { watch_points: ["R&D", "코로나/감염병", "재무구조", "품목허가"] },
};

const IMPORTANT_KEYWORDS = ["기술이전", "라이선스", "임상", "품목허가", "계약", "중대재해", "투자판단", "합병", "분할", "취득", "처분", "유상증자", "전환사채"];
const IMPORTANT_CATEGORIES = new Set(["사업/계약", "투자/M&A", "자금조달"]);
const MAX_STORED_ITEMS = 500;
const RETENTION_DAYS = 30;
const MAX_DISCLOSURE_TEXT_CHARS = 9000;
const GOV_PROJECT_SOURCES = [
  { key: "bizinfo", name: "기업마당", urlEnv: "BIZINFO_API_URL", defaultUrl: BIZINFO_API_URL, keyEnv: "BIZINFO_API_KEY" },
  { key: "ntis", name: "NTIS", urlEnv: "NTIS_API_URL", keyEnv: "NTIS_API_KEY" },
  { key: "kstartup", name: "K-Startup", urlEnv: "KSTARTUP_API_URL", defaultUrl: KSTARTUP_API_URL },
  { key: "iris", name: "IRIS", urlEnv: "IRIS_API_URL", defaultUrl: IRIS_MAIN_URL, keywordless: true },
  { key: "khidi", name: "KHIDI", urlEnv: "KHIDI_API_URL", defaultUrl: KHIDI_LIST_URL, keywordless: true },
];
const GOV_PROJECT_ALLOWED_HOSTS = new Set([
  "www.bizinfo.go.kr",
  "bizinfo.go.kr",
  "www.ntis.go.kr",
  "ntis.go.kr",
  "nidview.k-startup.go.kr",
  "www.k-startup.go.kr",
  "k-startup.go.kr",
  "www.iris.go.kr",
  "iris.go.kr",
  "www.khidi.or.kr",
  "khidi.or.kr",
  "bioagora.khidi.or.kr",
]);
const GOV_PROJECT_KEYWORDS = ["바이오", "헬스", "제약", "의료", "디지털헬스", "임상", "R&D", "연구개발"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/") return htmlResponse(renderReactPage());
      if (request.method === "GET" && url.pathname === "/assets/app.js") return javascriptResponse(APP_JS);
      if (request.method === "GET" && url.pathname === "/assets/styles.css") return cssResponse(APP_CSS);
      if (request.method === "GET" && url.pathname === "/api/latest") return jsonResponse(await latestBriefing(env));
      if (request.method === "GET" && url.pathname === "/api/financials") return jsonResponse(await financialMetricsFromD1(env));
      if (request.method === "GET" && url.pathname === "/api/grants") return jsonResponse(await governmentProjectsFromD1(env));
      if (request.method === "GET" && url.pathname === "/api/archive") return jsonResponse(await archiveIndex(env));
      if (request.method === "GET" && url.pathname.startsWith("/api/archive/")) {
        const date = url.pathname.split("/").pop();
        return jsonResponse(await archiveBriefing(env, date));
      }
      if (request.method === "POST" && url.pathname === "/api/refresh") return await refresh(request, env);
      if (request.method === "POST" && url.pathname === "/api/financials/refresh") return await refreshFinancialMetrics(request, env);
      if (request.method === "POST" && url.pathname === "/api/grants/refresh") return await refreshGovernmentProjects(request, env);
      if (request.method === "POST" && url.pathname === "/api/grants/import") return await importGovernmentProjects(request, env);
      if (request.method === "POST" && url.pathname === "/api/summarize-missing") return await summarizeMissing(request, env);
      if (request.method === "POST" && url.pathname === "/api/newsletter/import-archive") return await importNewsletterArchive(request, env);
      if (request.method === "POST" && url.pathname === "/api/newsletter/generate") return await generateNewsletter(request, env);
      if (request.method === "GET" && url.pathname === "/api/newsletter/latest-unsent") return await latestUnsentNewsletter(request, env);
      if (request.method === "POST" && url.pathname === "/api/newsletter/mark-sent") return await markNewsletterSent(request, env);
      return new Response("Not found", { status: 404 });
    } catch (error) {
      const status = error && error.status ? error.status : 500;
      return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) }, status);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduledRefresh(env, event));
  },
};

async function scheduledRefresh(env, event) {
  const locked = await env.BRIEFING_KV.get("lock:refresh");
  if (locked) {
    console.log("scheduled_refresh_skipped", JSON.stringify({ reason: "locked", cron: event && event.cron }));
    return;
  }
  await env.BRIEFING_KV.put("lock:refresh", JSON.stringify({ started_at: new Date().toISOString(), source: "scheduled" }), { expirationTtl: 300 });
  try {
    if (!env.DB) {
      console.log("scheduled_refresh_skipped", JSON.stringify({ reason: "missing_db", cron: event && event.cron }));
      return;
    }
    const response = await refreshWithD1(env);
    const result = await response.json().catch(() => ({}));
    console.log("scheduled_refresh_done", JSON.stringify({ cron: event && event.cron, added: result.added || {}, updated_at: result.briefing && result.briefing.updated_at }));
  } catch (error) {
    console.log("scheduled_refresh_failed", JSON.stringify({ cron: event && event.cron, reason: safeError(error) }));
  } finally {
    await env.BRIEFING_KV.delete("lock:refresh");
  }
}

async function refresh(request, env) {
  await requireUpdatePassword(request, env);
  const locked = await env.BRIEFING_KV.get("lock:refresh");
  if (locked) return jsonResponse({ ok: false, locked: true, message: "이미 업데이트가 진행 중입니다." }, 409);

  await env.BRIEFING_KV.put("lock:refresh", JSON.stringify({ started_at: new Date().toISOString() }), { expirationTtl: 300 });
  try {
    if (env.DB) return await refreshWithD1(env);
    const previous = await latestBriefing(env);
    const diagnostics = [];
    const collectedDisclosures = await collectDisclosures(env, diagnostics);
    const collectedNews = await collectNews(env, diagnostics);
    const analysis = await analyze(env, collectedDisclosures, collectedNews, diagnostics);
    ensureUsableRefresh(collectedDisclosures, collectedNews, diagnostics);
    const added = {
      disclosures: countNewRows(collectedDisclosures, previous.disclosures || [], disclosureKey),
      news: countNewRows(collectedNews, previous.news || [], newsKey),
    };
    const disclosures = mergeDisclosures(collectedDisclosures, previous.disclosures || []);
    const news = mergeNews(collectedNews, previous.news || []);
    const now = new Date();
    const briefing = {
      ok: true,
      date: kstDateKey(now),
      updated_at: kstTimestamp(now),
      disclosures,
      news,
      analysis: { ...(previous.analysis || {}), ...analysis },
      diagnostics,
      summary: {
        disclosure_count: disclosures.length,
        news_count: news.length,
        important_disclosure_count: disclosures.filter((item) => item.important).length,
        important_news_count: news.filter((item) => item.important).length,
      },
    };
    await saveBriefing(env, briefing);
    return jsonResponse({ ok: true, briefing, added });
  } finally {
    await env.BRIEFING_KV.delete("lock:refresh");
  }
}

async function requireUpdatePassword(request, env) {
  if (!env.UPDATE_PASSWORD) {
    const error = new Error("UPDATE_PASSWORD secret이 설정되지 않아 업데이트를 실행할 수 없습니다.");
    error.status = 503;
    throw error;
  }
  const password = request.headers.get("x-update-password") || "";
  if (password !== env.UPDATE_PASSWORD) {
    const error = new Error("업데이트 비밀번호가 필요합니다.");
    error.status = 401;
    throw error;
  }
}

async function latestBriefing(env) {
  if (env.DB) return await latestBriefingFromD1(env);
  return await readJson(env, "briefing:latest", emptyBriefing());
}

async function archiveIndex(env) {
  if (env.DB) return await archiveIndexFromD1(env);
  return await readJson(env, "archive:index", []);
}

async function archiveBriefing(env, date) {
  if (env.DB) return await archiveBriefingFromD1(env, date);
  return await readJson(env, `briefing:${date}`, emptyBriefing());
}

async function refreshWithD1(env) {
  const startedAt = new Date();
  const diagnostics = [];
  const collectedDisclosures = await collectDisclosures(env, diagnostics);
  const collectedNews = await collectNews(env, diagnostics);
  const collectedGovernmentProjects = await collectGovernmentProjects(env, diagnostics);
  await reuseExistingGovernmentProjectIds(env.DB, collectedGovernmentProjects);
  ensureUsableRefresh(collectedDisclosures, collectedNews, diagnostics);

  const now = new Date();
  const nowText = kstTimestamp(now);
  const runId = `refresh:${now.toISOString()}`;
  await cleanupOldData(env, now);

  const newDisclosures = await filterNewRows(env.DB, "disclosures", collectedDisclosures, disclosureKey);
  const newNews = await filterNewRows(env.DB, "news_articles", collectedNews, newsKey);
  const newGovernmentProjects = await filterNewRows(env.DB, "government_projects", collectedGovernmentProjects, governmentProjectKey);
  const added = { disclosures: newDisclosures.length, news: newNews.length, government_projects: newGovernmentProjects.length };
  const itemSummaries = added.disclosures || added.news ? await analyzeItems(env, newDisclosures, newNews, diagnostics) : [];

  const statements = [];
  for (const item of collectedDisclosures) {
    statements.push(env.DB.prepare(`INSERT INTO disclosures (id, company, category, title, receipt_no, disclosure_date, is_revision, note, link, score, important, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET category=excluded.category, title=excluded.title, note=excluded.note, link=excluded.link, score=excluded.score, important=excluded.important, last_seen_at=excluded.last_seen_at`)
      .bind(disclosureKey(item), item.company, item.category, item.title, item.receipt_no, item.date, item.is_revision ? 1 : 0, item.note, item.link, item.score || 0, item.important ? 1 : 0, nowText, nowText));
  }
  for (const item of collectedNews) {
    statements.push(env.DB.prepare(`INSERT INTO news_articles (id, company, category, title, summary, link, media, published_at, important, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET category=excluded.category, title=excluded.title, summary=excluded.summary, link=excluded.link, media=excluded.media, published_at=excluded.published_at, important=excluded.important, last_seen_at=excluded.last_seen_at`)
      .bind(newsKey(item), item.company, item.category, item.title, item.summary, item.link, item.media, item.published_at, item.important ? 1 : 0, nowText, nowText));
  }
  for (const item of collectedGovernmentProjects) {
    statements.push(governmentProjectStatement(env, item, nowText));
  }
  statements.push(...itemSummaryStatements(env, itemSummaries, nowText));
  statements.push(env.DB.prepare("INSERT INTO refresh_runs (id, started_at, finished_at, disclosure_count, news_count, new_disclosure_count, new_news_count, diagnostics_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(runId, kstTimestamp(startedAt), nowText, collectedDisclosures.length, collectedNews.length, added.disclosures, added.news, JSON.stringify(diagnostics)));
  if (statements.length) await env.DB.batch(statements);

  const briefing = await latestBriefingFromD1(env, nowText, diagnostics);
  return jsonResponse({ ok: true, briefing, added });
}

async function refreshGovernmentProjects(request, env) {
  await requireUpdatePassword(request, env);
  if (!env.DB) return jsonResponse({ ok: false, error: "D1 DB가 연결되어 있지 않습니다." }, 503);
  const diagnostics = [];
  const now = new Date();
  const nowText = kstTimestamp(now);
  const collected = await collectGovernmentProjects(env, diagnostics);
  await reuseExistingGovernmentProjectIds(env.DB, collected);
  const fresh = await filterNewRows(env.DB, "government_projects", collected, governmentProjectKey);
  const statements = collected.map((item) => governmentProjectStatement(env, item, nowText));
  if (statements.length) await env.DB.batch(statements);
  return jsonResponse({ ok: true, added: fresh.length, total: collected.length, projects: await governmentProjectsFromD1(env), diagnostics });
}

async function importGovernmentProjects(request, env) {
  await requireUpdatePassword(request, env);
  if (!env.DB) return jsonResponse({ ok: false, error: "D1 DB가 연결되어 있지 않습니다." }, 503);
  const body = await request.json().catch(() => ({}));
  const source = clean(body.source || "외부수집");
  const importedAt = clean(body.imported_at) || kstTimestamp(new Date());
  const rawProjects = Array.isArray(body.projects) ? body.projects : [];
  const projects = rawProjects.map((item) => normalizeImportedGovernmentProject(item, source)).filter((item) => item.title);
  await reuseExistingGovernmentProjectIds(env.DB, projects);
  const fresh = await filterNewRows(env.DB, "government_projects", projects, governmentProjectKey);
  const statements = projects.map((item) => governmentProjectStatement(env, item, importedAt));
  if (statements.length) await env.DB.batch(statements);
  return jsonResponse({ ok: true, source, received: rawProjects.length, saved: projects.length, added: fresh.length, projects: await governmentProjectsFromD1(env) });
}

function normalizeImportedGovernmentProject(item, fallbackSource) {
  const row = item && typeof item === "object" ? item : {};
  const title = clean(row.title || row.name || row.project_title || firstField(row, ["ProjectTitle_Korean", "ProjectTitle", "Korean"]));
  return {
    source: clean(row.source) || fallbackSource,
    external_id: clean(row.external_id || row.project_number || row.project_id || row.id),
    title,
    agency: clean(row.agency || row.ministry || row.order_agency || row.research_agency),
    category: clean(row.category || row.field || row.keywords) || fallbackSource,
    summary: clean(row.summary || row.goal || row.abstract || row.description),
    link: clean(row.link || row.url),
    announcement_date: normalizeGovernmentDate(row.announcement_date || row.start_date || row.project_year),
    deadline: normalizeGovernmentDate(row.deadline || row.end_date),
    status: clean(row.status) || statusFromDeadline(row.deadline || row.end_date),
    budget: clean(row.budget || row.total_funds || row.government_funds),
    target: clean(row.target || row.organization || row.manager),
    keywords: clean(row.keywords || row.keyword),
    raw_json: JSON.stringify(row).slice(0, 5000),
  };
}

async function refreshFinancialMetrics(request, env) {
  await requireUpdatePassword(request, env);
  if (!env.DB) return jsonResponse({ ok: false, error: "D1 DB가 연결되어 있지 않습니다." }, 503);
  const diagnostics = [];
  const nowText = kstTimestamp(new Date());
  const collected = await collectFinancialMetrics(env, diagnostics);
  const fresh = await filterNewRows(env.DB, "financial_metrics", collected, financialMetricKey);
  const statements = collected.map((item) => financialMetricStatement(env, item, nowText));
  if (statements.length) await env.DB.batch(statements);
  return jsonResponse({ ok: true, added: fresh.length, total: collected.length, financials: await financialMetricsFromD1(env), diagnostics });
}

async function summarizeMissing(request, env) {
  await requireUpdatePassword(request, env);
  if (!env.DB) return jsonResponse({ ok: false, error: "D1 DB가 연결되어 있지 않습니다." }, 503);
  const locked = await env.BRIEFING_KV.get("lock:summarize");
  if (locked) return jsonResponse({ ok: false, locked: true, message: "AI 요약 생성이 이미 진행 중입니다." }, 409);

  await env.BRIEFING_KV.put("lock:summarize", JSON.stringify({ started_at: new Date().toISOString() }), { expirationTtl: 300 });
  try {
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") || "10");
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1), 15);
    const diagnostics = [];
    const { disclosures, news } = await missingSummaryItems(env, limit);
    const attempted = disclosures.length + news.length;
    if (!attempted) {
      return jsonResponse({ ok: true, attempted: 0, saved: 0, remaining: 0, diagnostics });
    }

    const summaries = await analyzeItems(env, disclosures, news, diagnostics);
    const nowText = kstTimestamp(new Date());
    const statements = itemSummaryStatements(env, summaries, nowText);
    if (statements.length) await env.DB.batch(statements);
    const remaining = await countMissingItemSummaries(env);
    console.log("summarize_missing_result", JSON.stringify({ attempted, saved: statements.length, remaining, diagnostics }));
    return jsonResponse({ ok: true, attempted, saved: statements.length, remaining, diagnostics });
  } finally {
    await env.BRIEFING_KV.delete("lock:summarize");
  }
}

async function missingSummaryItems(env, limit) {
  const rows = await env.DB.prepare(`SELECT * FROM (
      SELECT 'disclosure' AS item_type, id, company, category, title, COALESCE(note, '') AS body, link, NULL AS media, NULL AS published_at, receipt_no, disclosure_date, is_revision, score, important, COALESCE(first_seen_at, disclosure_date) AS sort_at
      FROM disclosures d
      WHERE NOT EXISTS (SELECT 1 FROM item_ai_summaries s WHERE s.item_type = 'disclosure' AND s.item_id = d.id)
      UNION ALL
      SELECT 'news' AS item_type, id, company, category, title, COALESCE(summary, '') AS body, link, media, published_at, NULL AS receipt_no, NULL AS disclosure_date, 0 AS is_revision, 0 AS score, important, COALESCE(published_at, first_seen_at) AS sort_at
      FROM news_articles n
      WHERE NOT EXISTS (SELECT 1 FROM item_ai_summaries s WHERE s.item_type = 'news' AND s.item_id = n.id)
    )
    ORDER BY sort_at DESC, company ASC, title ASC
    LIMIT ?`).bind(limit).all();

  const disclosures = [];
  const news = [];
  for (const row of rows.results || []) {
    if (row.item_type === "disclosure") {
      disclosures.push({ type: "disclosure", company: row.company, category: row.category, title: row.title, receipt_no: row.receipt_no, date: row.disclosure_date, is_revision: !!row.is_revision, note: row.body, link: row.link, score: row.score || 0, important: !!row.important });
    } else {
      news.push({ type: "news", company: row.company, category: row.category, title: row.title, summary: row.body, link: row.link, media: row.media, published_at: row.published_at, important: !!row.important });
    }
  }
  return { disclosures, news };
}

async function countMissingItemSummaries(env) {
  const row = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM disclosures d WHERE NOT EXISTS (SELECT 1 FROM item_ai_summaries s WHERE s.item_type = 'disclosure' AND s.item_id = d.id)) +
      (SELECT COUNT(*) FROM news_articles n WHERE NOT EXISTS (SELECT 1 FROM item_ai_summaries s WHERE s.item_type = 'news' AND s.item_id = n.id)) AS count`).first();
  return row ? Number(row.count || 0) : 0;
}

function itemSummaryStatements(env, summaries, nowText) {
  return summaries.filter((row) => row.generated_by === "gemini").map((item) => env.DB.prepare(`INSERT INTO item_ai_summaries (item_type, item_id, company, title, summary, key_points, caution, generated_by, model, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_type, item_id) DO UPDATE SET summary=excluded.summary, key_points=excluded.key_points, caution=excluded.caution, generated_by=excluded.generated_by, model=excluded.model, created_at=excluded.created_at`)
    .bind(item.item_type, item.item_id, item.company, item.title, item.summary, item.key_points, item.caution, item.generated_by, item.model || "", nowText));
}

async function importNewsletterArchive(request, env) {
  await requireUpdatePassword(request, env);
  if (!env.DB) return jsonResponse({ ok: false, error: "D1 DB가 연결되어 있지 않습니다." }, 503);
  const body = await request.json().catch(() => ({}));
  const date = clean(body.date);
  const html = String(body.html || "");
  if (!date || !html) return jsonResponse({ ok: false, error: "date와 html이 필요합니다." }, 400);
  const subject = clean(body.subject) || `${date} 경쟁사 모닝 브리핑`;
  const sentAt = clean(body.sent_at) || `${date} 08:10:00`;
  const summary = {
    disclosure_count: Number(body.disclosure_count || 0),
    news_count: Number(body.news_count || 0),
    imported: true,
  };
  const id = `archive:${date}`;
  await env.DB.prepare(`INSERT INTO newsletter_runs (id, newsletter_date, created_at, sent_at, subject, html, summary_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET sent_at=excluded.sent_at, subject=excluded.subject, html=excluded.html, summary_json=excluded.summary_json`)
    .bind(id, date, sentAt, sentAt, subject, html, JSON.stringify(summary)).run();
  return jsonResponse({ ok: true, id, date, sent_at: sentAt, subject });
}

async function generateNewsletter(request, env) {
  await requireUpdatePassword(request, env);
  if (!env.DB) return jsonResponse({ ok: false, error: "D1 DB가 연결되어 있지 않습니다." }, 503);

  const existing = await env.DB.prepare("SELECT * FROM newsletter_runs WHERE sent_at IS NULL ORDER BY created_at DESC LIMIT 1").first();
  if (existing) return jsonResponse(newsletterRunPayload(existing, { reused: true }));

  const createdAt = kstTimestamp(new Date());
  const date = kstDateKey(new Date());
  const since = await latestSentAt(env);
  const disclosures = await newsletterDisclosureItems(env, since);
  const news = await newsletterNewsItems(env, since, disclosures.length);
  if (!disclosures.length && !news.length) {
    return jsonResponse({ ok: true, created: false, reason: "no_new_items", since, disclosure_count: 0, news_count: 0 });
  }

  const subject = makeNewsletterSubject(date, disclosures.length, news.length);
  const html = renderNewsletterHtml({ date, createdAt, since, disclosures, news });
  const id = `newsletter:${date}:${Date.now()}`;
  const summary = { since, disclosure_count: disclosures.length, news_count: news.length, generated_by: "worker" };
  const statements = [
    env.DB.prepare("INSERT INTO newsletter_runs (id, newsletter_date, created_at, sent_at, subject, html, summary_json) VALUES (?, ?, ?, NULL, ?, ?, ?)")
      .bind(id, date, createdAt, subject, html, JSON.stringify(summary)),
  ];
  for (const item of [...disclosures, ...news]) {
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO newsletter_items (run_id, item_type, item_id, company, title) VALUES (?, ?, ?, ?, ?)")
      .bind(id, item.type, item.id, item.company, item.title));
  }
  await env.DB.batch(statements);
  return jsonResponse({ ok: true, created: true, id, date, subject, html, disclosure_count: disclosures.length, news_count: news.length, since });
}

async function latestUnsentNewsletter(request, env) {
  await requireUpdatePassword(request, env);
  if (!env.DB) return jsonResponse({ ok: false, error: "D1 DB가 연결되어 있지 않습니다." }, 503);
  const run = await env.DB.prepare("SELECT * FROM newsletter_runs WHERE sent_at IS NULL ORDER BY created_at DESC LIMIT 1").first();
  if (!run) return jsonResponse({ ok: true, found: false });
  return jsonResponse(newsletterRunPayload(run, { found: true }));
}

async function markNewsletterSent(request, env) {
  await requireUpdatePassword(request, env);
  if (!env.DB) return jsonResponse({ ok: false, error: "D1 DB가 연결되어 있지 않습니다." }, 503);
  const body = await request.json().catch(() => ({}));
  const id = clean(body.id);
  if (!id) return jsonResponse({ ok: false, error: "id가 필요합니다." }, 400);
  const sentAt = clean(body.sent_at) || kstTimestamp(new Date());
  await env.DB.prepare("UPDATE newsletter_runs SET sent_at = ? WHERE id = ?").bind(sentAt, id).run();
  return jsonResponse({ ok: true, id, sent_at: sentAt });
}

async function latestSentAt(env) {
  const row = await env.DB.prepare("SELECT MAX(sent_at) AS sent_at FROM newsletter_runs WHERE sent_at IS NOT NULL").first();
  return row && row.sent_at ? row.sent_at : "1970-01-01 00:00:00";
}

async function newsletterDisclosureItems(env, since) {
  const rows = await env.DB.prepare(`SELECT d.*, s.summary AS ai_summary, s.key_points, s.caution
    FROM disclosures d
    LEFT JOIN item_ai_summaries s ON s.item_type = 'disclosure' AND s.item_id = d.id
    WHERE d.first_seen_at > ?
    ORDER BY d.important DESC, d.disclosure_date DESC, d.company ASC
    LIMIT 20`).bind(since).all();
  return (rows.results || []).map((row) => ({
    type: "disclosure",
    id: row.id,
    company: row.company,
    category: row.category || "공시",
    title: row.title,
    link: row.link,
    date: row.disclosure_date,
    important: !!row.important,
    ai_summary: row.ai_summary || "",
    key_points: row.key_points || "",
    caution: row.caution || "",
  }));
}

async function newsletterNewsItems(env, since, disclosureCount) {
  const rows = await env.DB.prepare(`SELECT n.*, s.summary AS ai_summary, s.key_points, s.caution
    FROM news_articles n
    LEFT JOIN item_ai_summaries s ON s.item_type = 'news' AND s.item_id = n.id
    WHERE n.first_seen_at > ?
    ORDER BY n.important DESC, n.published_at DESC, n.company ASC
    LIMIT ?`).bind(since, disclosureCount ? 12 : 16).all();
  const all = (rows.results || []).map((row) => ({
    type: "news",
    id: row.id,
    company: row.company,
    category: row.category || "뉴스",
    title: row.title,
    link: row.link,
    date: row.published_at,
    media: row.media || "",
    important: !!row.important,
    ai_summary: row.ai_summary || "",
    key_points: row.key_points || "",
    caution: row.caution || "",
    excerpt: row.summary || "",
  }));
  const important = all.filter((item) => item.important);
  return important.length ? important : all.slice(0, Math.min(5, all.length));
}

function newsletterRunPayload(run, extra = {}) {
  const summary = parseJson(run.summary_json, {});
  return { ok: true, ...extra, id: run.id, date: run.newsletter_date, created_at: run.created_at, sent_at: run.sent_at || "", subject: run.subject || "", html: run.html || "", summary, disclosure_count: summary.disclosure_count || 0, news_count: summary.news_count || 0 };
}

function makeNewsletterSubject(date, disclosureCount, newsCount) {
  const parts = [];
  if (disclosureCount) parts.push(`신규 공시 ${disclosureCount}건`);
  if (newsCount) parts.push(`최신 뉴스 ${newsCount}건`);
  return `[경쟁사 브리핑] ${date.replaceAll("-", ".")} ${parts.join(" · ")}`;
}

function renderNewsletterHtml({ date, createdAt, since, disclosures, news }) {
  const companySections = groupByCompany([...disclosures, ...news]).map(([company, items]) => renderNewsletterCompany(company, items)).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(makeNewsletterSubject(date, disclosures.length, news.length))}</title></head>
<body style="margin:0;background:#f6f1e9;color:#26221d;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="max-width:760px;margin:0 auto;padding:28px 18px 36px;">
    <div style="background:#fffaf3;border-radius:26px;padding:28px 30px;box-shadow:0 10px 28px rgba(62,49,32,.08);">
      <p style="margin:0 0 8px;color:#8b7a66;font-size:14px;font-weight:700;">${escapeHtml(createdAt)} 생성 · 기준 ${escapeHtml(since)}</p>
      <h1 style="margin:0;color:#241f1a;font-size:30px;letter-spacing:-.03em;">${escapeHtml(date.replaceAll("-", "."))} 경쟁사 브리핑</h1>
      <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">
        <span style="display:inline-block;padding:9px 13px;border-radius:999px;background:#f0e8dc;color:#5f5142;font-weight:800;">신규 공시 ${disclosures.length}건</span>
        <span style="display:inline-block;padding:9px 13px;border-radius:999px;background:#f0e8dc;color:#5f5142;font-weight:800;">최신 뉴스 ${news.length}건</span>
      </div>
    </div>
    ${companySections || '<div style="margin-top:18px;background:#fffaf3;border-radius:22px;padding:22px;color:#8b7a66;">새로 발송할 항목이 없습니다.</div>'}
  </div>
</body></html>`;
}

function renderNewsletterCompany(company, items) {
  const disclosures = items.filter((item) => item.type === "disclosure");
  const news = items.filter((item) => item.type === "news");
  return `<section style="margin-top:18px;background:#fffaf3;border-radius:24px;padding:24px 26px;box-shadow:0 8px 22px rgba(62,49,32,.06);">
    <h2 style="margin:0 0 16px;font-size:22px;color:${escapeHtml(COMPANY_COLORS[company] || "#42546a")};">${escapeHtml(company)}</h2>
    ${disclosures.length ? '<h3 style="margin:18px 0 10px;font-size:16px;color:#5f5142;">공시</h3>' + disclosures.map(renderNewsletterItem).join("") : ""}
    ${news.length ? '<h3 style="margin:18px 0 10px;font-size:16px;color:#5f5142;">최신 뉴스</h3>' + news.map(renderNewsletterItem).join("") : ""}
  </section>`;
}

function renderNewsletterItem(item) {
  const ai = [item.ai_summary, item.key_points, item.caution].flatMap((value) => String(value || "").replace(/<br\s*\/?>/gi, "\n").split(/\n+/)).map(clean).filter(Boolean).slice(0, 3);
  const fallback = item.type === "news" ? clean(item.excerpt) : "";
  const body = ai.length ? ai.join("<br>") : fallback;
  return `<article style="border-top:1px solid #eee3d4;padding:14px 0 12px;">
    <div style="margin-bottom:8px;"><span style="display:inline-block;padding:5px 9px;border-radius:999px;background:#f3efe7;color:#665f57;font-size:12px;font-weight:800;">${escapeHtml(item.category)}</span>${item.important ? ' <span style="display:inline-block;padding:5px 9px;border-radius:999px;background:#fff3d5;color:#8a5b00;font-size:12px;font-weight:800;">중요</span>' : ""}</div>
    <a href="${escapeHtml(item.link)}" style="color:#241f1a;text-decoration:none;font-size:17px;font-weight:800;line-height:1.45;">${escapeHtml(item.title)}</a>
    ${body ? `<p style="margin:10px 0 0;color:#51483e;font-size:14px;line-height:1.75;">${escapeHtml(body).replaceAll("&lt;br&gt;", "<br>")}</p>` : ""}
    <p style="margin:8px 0 0;color:#9a8c7a;font-size:12px;">${escapeHtml(item.date || "")}</p>
  </article>`;
}

function groupByCompany(items) {
  const map = new Map();
  for (const company of TARGET_COMPANIES.map((item) => item.name)) map.set(company, []);
  for (const item of items) {
    if (!map.has(item.company)) map.set(item.company, []);
    map.get(item.company).push(item);
  }
  return [...map.entries()].filter(([, rows]) => rows.length);
}

async function latestBriefingFromD1(env, updatedAt = "", diagnostics = []) {
  const cutoff = kstTimestamp(addDays(new Date(), -RETENTION_DAYS));
  const disclosureRows = await env.DB.prepare("SELECT * FROM disclosures WHERE first_seen_at >= ? ORDER BY disclosure_date DESC, company ASC").bind(cutoff).all();
  const newsRows = await env.DB.prepare("SELECT * FROM news_articles WHERE first_seen_at >= ? ORDER BY published_at DESC, company ASC").bind(cutoff).all();
  const governmentProjects = await governmentProjectsFromD1(env, cutoff);
  const financialMetrics = await financialMetricsFromD1(env);
  const disclosures = (disclosureRows.results || []).map(disclosureFromDb);
  const news = (newsRows.results || []).map(newsFromDb);
  const itemSummaries = await itemSummariesFromD1(env);
  return {
    ok: true,
    date: kstDateKey(new Date()),
    updated_at: updatedAt || (await latestRefreshTime(env)) || "",
    disclosures,
    news,
    government_projects: governmentProjects,
    financial_metrics: financialMetrics,
    analysis: {},
    item_summaries: itemSummaries,
    diagnostics,
    summary: {
      disclosure_count: disclosures.length,
      news_count: news.length,
      government_project_count: governmentProjects.length,
      financial_metric_count: financialMetrics.length,
      important_disclosure_count: disclosures.filter((item) => item.important).length,
      important_news_count: news.filter((item) => item.important).length,
    },
  };
}

async function latestRefreshTime(env) {
  const row = await env.DB.prepare("SELECT finished_at FROM refresh_runs WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1").first();
  if (row) return row.finished_at;
  const seeded = await env.DB.prepare("SELECT MAX(last_seen_at) AS updated_at FROM (SELECT last_seen_at FROM disclosures UNION ALL SELECT last_seen_at FROM news_articles)").first();
  return seeded ? seeded.updated_at || "" : "";
}

async function itemSummariesFromD1(env) {
  try {
    const rows = await env.DB.prepare("SELECT * FROM item_ai_summaries ORDER BY created_at DESC").all();
    const result = {};
    for (const row of rows.results || []) {
      result[`${row.item_type}:${row.item_id}`] = {
        item_type: row.item_type,
        item_id: row.item_id,
        company: row.company,
        title: row.title,
        summary: row.summary || "",
        key_points: row.key_points || "",
        caution: row.caution || "",
        generated_by: row.generated_by,
        model: row.model || "",
        created_at: row.created_at,
      };
    }
    return result;
  } catch (_) {
    return {};
  }
}

async function archiveIndexFromD1(env) {
  const rows = await env.DB.prepare(`SELECT r.newsletter_date AS date, r.sent_at AS updated_at, r.subject, r.summary_json, SUM(CASE WHEN i.item_type = 'disclosure' THEN 1 ELSE 0 END) AS disclosure_count, SUM(CASE WHEN i.item_type = 'news' THEN 1 ELSE 0 END) AS news_count
    FROM newsletter_runs r LEFT JOIN newsletter_items i ON r.id = i.run_id
    WHERE r.sent_at IS NOT NULL
    GROUP BY r.id
    ORDER BY r.sent_at DESC
    LIMIT 120`).all();
  return (rows.results || []).map((row) => {
    const summary = parseJson(row.summary_json, {});
    return { date: row.date, updated_at: row.updated_at, subject: row.subject || `${row.date} 뉴스레터`, disclosure_count: row.disclosure_count || summary.disclosure_count || 0, news_count: row.news_count || summary.news_count || 0 };
  });
}

async function archiveBriefingFromD1(env, date) {
  const run = await env.DB.prepare("SELECT * FROM newsletter_runs WHERE newsletter_date = ? AND sent_at IS NOT NULL ORDER BY sent_at DESC LIMIT 1").bind(date).first();
  if (!run) return emptyBriefing();
  const items = await env.DB.prepare("SELECT * FROM newsletter_items WHERE run_id = ? ORDER BY company ASC, title ASC").bind(run.id).all();
  return { ok: true, date, updated_at: run.sent_at, newsletter: { subject: run.subject, html: run.html, summary: parseJson(run.summary_json, {}) }, items: items.results || [], disclosures: [], news: [], analysis: parseJson(run.summary_json, {}), summary: { disclosure_count: 0, news_count: 0, important_disclosure_count: 0, important_news_count: 0 } };
}

async function cleanupOldData(env, now) {
  const cutoff = kstTimestamp(addDays(now, -RETENTION_DAYS));
  await env.DB.batch([
    env.DB.prepare("DELETE FROM disclosures WHERE first_seen_at < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM news_articles WHERE first_seen_at < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM ai_briefings WHERE created_at < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM item_ai_summaries WHERE created_at < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM disclosure_documents WHERE fetched_at < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM government_projects WHERE first_seen_at < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM financial_metrics WHERE first_seen_at < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM newsletter_items WHERE run_id IN (SELECT id FROM newsletter_runs WHERE created_at < ?)").bind(cutoff),
    env.DB.prepare("DELETE FROM newsletter_runs WHERE created_at < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM refresh_runs WHERE started_at < ?").bind(cutoff),
  ]);
}

async function filterNewRows(db, table, rows, keyFn) {
  const uniqueRows = dedupe(rows || [], keyFn);
  const result = [];
  for (const row of uniqueRows) {
    const id = keyFn(row);
    if (!id) continue;
    const existing = await db.prepare(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`).bind(id).first();
    if (!existing) result.push(row);
  }
  return result;
}

function disclosureFromDb(row) {
  return { type: "disclosure", company: row.company, category: row.category, title: row.title, receipt_no: row.receipt_no, date: row.disclosure_date, is_revision: !!row.is_revision, note: row.note, link: row.link, score: row.score || 0, important: !!row.important };
}

function newsFromDb(row) {
  return { type: "news", company: row.company, category: row.category, title: row.title, summary: row.summary, link: row.link, media: row.media, published_at: row.published_at, important: !!row.important };
}

async function reuseExistingGovernmentProjectIds(db, rows) {
  if (!db || !rows || !rows.length) return;
  const existing = await db.prepare("SELECT id, source, title, raw_json FROM government_projects").all();
  const byExternalId = new Map();
  const byTitle = new Map();
  for (const row of existing.results || []) {
    const raw = parseJson(row.raw_json, {});
    const externalId = firstField(raw, ["pblancId", "pbancSn", "bizPbancSn", "pbanc_sn", "biz_pbanc_sn", "ProjectNumber", "projectNumber", "과제고유번호", "공고번호", "id"]);
    if (externalId) byExternalId.set(`${row.source}:${clean(externalId)}`, row.id);
    if (row.title) byTitle.set(`${row.source}:${normalize(row.title)}`, row.id);
  }
  for (const item of rows) {
    const idKey = item.external_id ? `${item.source}:${clean(item.external_id)}` : "";
    item.existing_id = (idKey && byExternalId.get(idKey)) || byTitle.get(`${item.source}:${normalize(item.title)}`) || "";
  }
}

async function governmentProjectsFromD1(env, cutoff = "") {
  if (!env.DB) return [];
  const since = cutoff || kstTimestamp(addDays(new Date(), -RETENTION_DAYS));
  const rows = await env.DB.prepare(`SELECT * FROM government_projects WHERE first_seen_at >= ? ORDER BY CASE WHEN deadline IS NULL OR deadline = '' THEN 1 ELSE 0 END, deadline ASC, announcement_date DESC`).bind(since).all();
  return (rows.results || []).map(governmentProjectFromDb);
}

function governmentProjectFromDb(row) {
  return {
    type: "government_project",
    id: row.id,
    source: row.source,
    title: row.title,
    agency: row.agency,
    category: row.category,
    summary: row.summary,
    link: row.link,
    announcement_date: row.announcement_date,
    deadline: row.deadline,
    status: row.status,
    budget: row.budget,
    target: row.target,
    keywords: row.keywords,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
  };
}

function governmentProjectStatement(env, item, nowText) {
  return env.DB.prepare(`INSERT INTO government_projects (id, source, title, agency, category, summary, link, announcement_date, deadline, status, budget, target, keywords, raw_json, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET agency=excluded.agency, category=excluded.category, summary=excluded.summary, link=excluded.link, announcement_date=excluded.announcement_date, deadline=excluded.deadline, status=excluded.status, budget=excluded.budget, target=excluded.target, keywords=excluded.keywords, raw_json=excluded.raw_json, last_seen_at=excluded.last_seen_at`)
    .bind(governmentProjectKey(item), item.source, item.title, item.agency, item.category, item.summary, item.link, item.announcement_date, item.deadline, item.status, item.budget, item.target, item.keywords, item.raw_json, nowText, nowText);
}

function governmentProjectKey(item) {
  if (item.existing_id) return item.existing_id;
  const externalId = item.external_id || firstField(parseJson(item.raw_json, {}), ["pblancId", "pbancSn", "bizPbancSn", "pbanc_sn", "biz_pbanc_sn", "ProjectNumber", "projectNumber", "과제고유번호", "공고번호", "id"]);
  if (externalId) return `${item.source}:${clean(externalId)}`;
  return `${item.source}:${normalize(item.title)}`;
}

async function financialMetricsFromD1(env) {
  if (!env.DB) return [];
  const rows = await env.DB.prepare("SELECT * FROM financial_metrics ORDER BY fiscal_year DESC, report_code DESC, company ASC, account_name ASC LIMIT 300").all();
  return (rows.results || []).map(financialMetricFromDb);
}

function financialMetricFromDb(row) {
  return {
    type: "financial_metric",
    id: row.id,
    company: row.company,
    fiscal_year: row.fiscal_year,
    report_code: row.report_code,
    account_name: row.account_name,
    account_detail: row.account_detail,
    amount: row.amount,
    currency: row.currency,
    statement_name: row.statement_name,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
  };
}

function financialMetricStatement(env, item, nowText) {
  return env.DB.prepare(`INSERT INTO financial_metrics (id, company, fiscal_year, report_code, account_name, account_detail, amount, currency, statement_name, raw_json, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET account_detail=excluded.account_detail, amount=excluded.amount, currency=excluded.currency, statement_name=excluded.statement_name, raw_json=excluded.raw_json, last_seen_at=excluded.last_seen_at`)
    .bind(financialMetricKey(item), item.company, item.fiscal_year, item.report_code, item.account_name, item.account_detail, item.amount, item.currency, item.statement_name, item.raw_json, nowText, nowText);
}

function financialMetricKey(item) {
  return `${item.company}:${item.fiscal_year}:${item.report_code}:${normalize(item.account_name)}:${normalize(item.statement_name)}`;
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || ""); } catch (_) { return fallback; }
}

async function saveBriefing(env, briefing) {
  await env.BRIEFING_KV.put("briefing:latest", JSON.stringify(briefing));
  await env.BRIEFING_KV.put(`briefing:${briefing.date}`, JSON.stringify(briefing));

  const archive = await readJson(env, "archive:index", []);
  const nextArchive = [
    { date: briefing.date, updated_at: briefing.updated_at, disclosure_count: briefing.disclosures.length, news_count: briefing.news.length },
    ...archive.filter((item) => item.date !== briefing.date),
  ].slice(0, 120);
  await env.BRIEFING_KV.put("archive:index", JSON.stringify(nextArchive));

  for (const company of TARGET_COMPANIES.map((item) => item.name)) {
    const item = briefing.analysis[company];
    if (!item) continue;
    const key = `company:${company}:timeline`;
    const timeline = await readJson(env, key, { company, events: [] });
    const events = Array.isArray(timeline.events) ? timeline.events.filter((event) => event.date !== briefing.date) : [];
    events.push({
      date: briefing.date,
      summary: item.today_summary || "",
      news_summary: item.news_summary || "",
      important_point: item.important_point || "",
      issue_type: item.issue_type || "",
      topics: item.topics || [],
    });
    await env.BRIEFING_KV.put(key, JSON.stringify({ company, updated_at: briefing.date, events: events.slice(-120) }));
  }
}

async function collectDisclosures(env, diagnostics) {
  if (!env.DART_API_KEY) {
    diagnostics.push({ step: "dart", status: "missing_secret" });
    return [];
  }
  const end = yyyymmdd(new Date());
  const begin = yyyymmdd(addDays(new Date(), -30));
  const rows = [];

  for (const company of TARGET_COMPANIES) {
    const url = new URL(DART_LIST_URL);
    url.searchParams.set("crtfc_key", env.DART_API_KEY);
    url.searchParams.set("corp_code", company.corpCode);
    url.searchParams.set("bgn_de", begin);
    url.searchParams.set("end_de", end);
    url.searchParams.set("page_count", "100");
    url.searchParams.set("sort", "date");
    url.searchParams.set("sort_mth", "desc");

    let payload;
    try {
      payload = await fetchJson(url.toString(), {
        redirect: "manual",
        headers: {
          "Accept": "application/json,text/plain,*/*",
          "User-Agent": "Mozilla/5.0 competitor-newsletter/1.0",
        },
      });
    } catch (_) {
      diagnostics.push({ step: "dart", company: company.name, status: "request_error", reason: safeError(_) });
      continue;
    }
    diagnostics.push({ step: "dart", company: company.name, status: payload.status || "unknown", count: Array.isArray(payload.list) ? payload.list.length : 0 });
    if (payload.status === "013") continue;
    if (payload.status !== "000") continue;

    for (const item of payload.list || []) {
      const title = clean(item.report_nm);
      const receiptNo = clean(item.rcept_no);
      const category = classifyDisclosure(title);
      const score = scoreDisclosure(title, category, clean(item.rm));
      rows.push({
        type: "disclosure",
        company: company.name,
        category,
        title,
        receipt_no: receiptNo,
        date: isoDate(clean(item.rcept_dt)),
        is_revision: title.includes("정정") || clean(item.rm).includes("정"),
        note: clean(item.rm),
        link: receiptNo ? DART_VIEWER_URL + receiptNo : "",
        score,
        important: score > 0,
      });
    }
  }

  return dedupe(rows, (item) => item.receipt_no).sort((a, b) => String(b.date).localeCompare(String(a.date)) || companyIndex(a.company) - companyIndex(b.company));
}

async function collectNews(env, diagnostics) {
  if (!env.NAVER_API_HUB_CLIENT_ID || !env.NAVER_API_HUB_CLIENT_SECRET) {
    diagnostics.push({ step: "news", status: "missing_secret" });
    return [];
  }
  const since = addDays(new Date(), -2).getTime();
  const rows = [];

  for (const company of TARGET_COMPANIES) {
    const url = new URL(NAVER_NEWS_URL);
    url.searchParams.set("query", `"${company.name}" 제약`);
    url.searchParams.set("display", "10");
    url.searchParams.set("start", "1");
    url.searchParams.set("sort", "date");
    url.searchParams.set("format", "json");

    let payload;
    try {
      payload = await fetchJson(url.toString(), {
        headers: {
          "X-NCP-APIGW-API-KEY-ID": env.NAVER_API_HUB_CLIENT_ID,
          "X-NCP-APIGW-API-KEY": env.NAVER_API_HUB_CLIENT_SECRET,
        },
      });
    } catch (_) {
      diagnostics.push({ step: "news", company: company.name, status: "request_error", reason: safeError(_) });
      continue;
    }
    diagnostics.push({ step: "news", company: company.name, status: "ok", count: Array.isArray(payload.items) ? payload.items.length : 0 });

    for (const item of payload.items || []) {
      const title = cleanHtml(item.title);
      const summary = cleanHtml(item.description);
      if (!isCompanyArticle(company, title)) continue;
      const published = parseDate(item.pubDate);
      if (published && published.getTime() < since) continue;
      const link = clean(item.originallink || item.link);
      rows.push({
        type: "news",
        company: company.name,
        category: classifyNews(`${title} ${summary}`),
        title,
        summary,
        link,
        media: mediaFromUrl(link),
        published_at: published ? kstTimestamp(published) : "",
        important: hasImportantSignal(`${title} ${summary}`),
      });
    }
  }

  return dedupe(rows, (item) => `${item.company}:${normalize(item.title)}`).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)) || companyIndex(a.company) - companyIndex(b.company));
}

async function collectGovernmentProjects(env, diagnostics) {
  const rows = [];
  for (const source of GOV_PROJECT_SOURCES) {
    const urlTemplate = clean(env[source.urlEnv] || source.defaultUrl);
    if (!urlTemplate) {
      diagnostics.push({ step: `grant:${source.key}`, status: "missing_config", required: source.urlEnv });
      continue;
    }
    const apiKey = clean(env[source.keyEnv]);
    if (source.keyEnv && !apiKey) {
      diagnostics.push({ step: `grant:${source.key}`, status: "missing_secret", required: source.keyEnv });
      continue;
    }
    const sourceKeywords = source.keywordless ? [""] : configuredGovernmentKeywords(env);
    for (const keyword of sourceKeywords) {
      try {
        const url = governmentProjectUrl(urlTemplate, apiKey, keyword);
        const host = new URL(url).hostname;
        if (!GOV_PROJECT_ALLOWED_HOSTS.has(host)) {
          diagnostics.push({ step: `grant:${source.key}`, keyword, status: "blocked_host", host });
          continue;
        }
        const response = await fetch(url, { headers: { Accept: "application/json, application/xml, text/xml, */*" } });
        const text = await response.text();
        if (!response.ok) {
          diagnostics.push({ step: `grant:${source.key}`, keyword, status: "http_error", http_status: response.status, body: text.slice(0, 160) });
          continue;
        }
        const parsed = parseGovernmentPayload(text, response.headers.get("content-type") || "");
        const normalized = normalizeGovernmentProjects(parsed, source, keyword);
        rows.push(...normalized);
        const diagnostic = { step: `grant:${source.key}`, keyword, status: "ok", count: normalized.length };
        if (!normalized.length && source.key === "ntis") {
          diagnostic.body = sanitizeErrorMessage(clean(text).slice(0, 260));
          diagnostic.hit_tags = (text.match(/<HIT\b/gi) || []).length;
          diagnostic.item_tags = (text.match(/<(item|row|list|data)\b/gi) || []).length;
        }
        if (source.keywordless) diagnostic.keyword = "전체";
        diagnostics.push(diagnostic);
      } catch (error) {
        diagnostics.push({ step: `grant:${source.key}`, keyword, status: "exception", error: safeError(error) });
      }
    }
  }
  return dedupe(rows, governmentProjectKey).sort(compareGovernmentProjects).slice(0, MAX_STORED_ITEMS);
}

async function collectFinancialMetrics(env, diagnostics) {
  if (!env.DART_API_KEY) {
    diagnostics.push({ step: "dart_financials", status: "missing_secret" });
    return [];
  }
  const fiscalYear = clean(env.DART_FINANCIAL_YEAR) || String(new Date().getFullYear() - 1);
  const reportCode = clean(env.DART_FINANCIAL_REPORT_CODE) || "11011";
  const rows = [];
  for (const company of TARGET_COMPANIES) {
    const url = new URL(DART_FINANCIAL_URL);
    url.searchParams.set("crtfc_key", env.DART_API_KEY);
    url.searchParams.set("corp_code", company.corpCode);
    url.searchParams.set("bsns_year", fiscalYear);
    url.searchParams.set("reprt_code", reportCode);
    try {
      const payload = await fetchJson(url.toString(), { headers: { Accept: "application/json,text/plain,*/*" } });
      diagnostics.push({ step: "dart_financials", company: company.name, year: fiscalYear, report_code: reportCode, status: payload.status || "unknown", count: Array.isArray(payload.list) ? payload.list.length : 0 });
      if (payload.status !== "000") continue;
      for (const item of payload.list || []) {
        const accountName = clean(item.account_nm);
        if (!isCoreFinancialAccount(accountName)) continue;
        rows.push({
          company: company.name,
          fiscal_year: fiscalYear,
          report_code: reportCode,
          account_name: accountName,
          account_detail: clean(item.account_detail),
          amount: numberAmount(item.thstrm_amount),
          currency: clean(item.currency) || "KRW",
          statement_name: clean(item.sj_nm),
          raw_json: JSON.stringify(item).slice(0, 5000),
        });
      }
    } catch (error) {
      diagnostics.push({ step: "dart_financials", company: company.name, status: "request_error", reason: safeError(error) });
    }
  }
  return dedupe(rows, financialMetricKey);
}

function isCoreFinancialAccount(accountName) {
  return ["매출액", "영업수익", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계"].includes(accountName);
}

function numberAmount(value) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text || text === "-") return null;
  const parsed = Number(text.replace(/[()]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return text.includes("(") && text.includes(")") ? -parsed : parsed;
}

function configuredGovernmentKeywords(env) {
  const raw = clean(env.GOV_PROJECT_KEYWORDS);
  if (!raw) return GOV_PROJECT_KEYWORDS;
  return raw.split(/[|,]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function governmentProjectUrl(template, apiKey, keyword) {
  if (template === BIZINFO_API_URL) {
    const url = new URL(BIZINFO_API_URL);
    url.searchParams.set("crtfcKey", apiKey || "");
    url.searchParams.set("dataType", "json");
    url.searchParams.set("searchCnt", "100");
    url.searchParams.set("hashtags", keyword || "");
    return url.toString();
  }
  if (template === KSTARTUP_API_URL || template.includes("/kisedKstartupService/announcementInformation")) {
    const url = new URL(template, "https://nidview.k-startup.go.kr");
    url.searchParams.set("page", "1");
    url.searchParams.set("perPage", "100");
    if (keyword) url.searchParams.set("cond[biz_pbanc_nm::LIKE]", keyword);
    url.searchParams.set("cond[rcrt_prgs_yn::EQ]", "Y");
    return url.toString();
  }
  if (template === KHIDI_LIST_URL || template.includes("khidi.or.kr/board")) {
    const url = new URL(template, "https://www.khidi.or.kr");
    url.searchParams.set("menuId", url.searchParams.get("menuId") || "MENU00101");
    url.searchParams.set("pageNum", "1");
    url.searchParams.set("rowCnt", "30");
    if (keyword) url.searchParams.set("schText", keyword);
    return url.toString();
  }
  const replaced = template
    .replaceAll("{key}", encodeURIComponent(apiKey || ""))
    .replaceAll("{apiKey}", encodeURIComponent(apiKey || ""))
    .replaceAll("{serviceKey}", encodeURIComponent(apiKey || ""))
    .replaceAll("{keyword}", encodeURIComponent(keyword || ""))
    .replaceAll("{query}", encodeURIComponent(keyword || ""))
    .replaceAll("{page}", "1")
    .replaceAll("{limit}", "100");
  return new URL(replaced).toString();
}

function parseGovernmentPayload(text, contentType) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  if (contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  if (contentType.includes("html") || /<html[\s>]/i.test(trimmed)) {
    const rows = htmlGovernmentItems(trimmed);
    if (rows.length) return rows;
  }
  return xmlItems(trimmed);
}

function htmlGovernmentItems(html) {
  return [...khidiHtmlItems(html), ...irisHtmlItems(html)];
}

function khidiHtmlItems(html) {
  if (!html.includes("MENU00101") && !html.includes("입찰정보")) return [];
  const rows = [];
  const trMatches = String(html || "").match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    if (!tr.includes("/board/view")) continue;
    const cells = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((match) => match[1]);
    if (cells.length < 5) continue;
    const linkMatch = tr.match(/href=["']([^"']*\/board\/view[^"']*)["']/i);
    const link = linkMatch ? absoluteUrl(decodeHtmlEntities(linkMatch[1]), "https://www.khidi.or.kr") : "";
    const idMatch = String(link).match(/[?&](?:linkId|no1)=([^&]+)/i);
    rows.push({
      id: idMatch ? idMatch[1] : clean(cells[0]),
      title: clean(cells[2]),
      category: clean(cells[1]) || "KHIDI 공고",
      agency: "한국보건산업진흥원",
      deadline: clean(cells[3]),
      announcementDate: clean(cells[4]),
      status: clean(cells[6]) || "공고",
      link,
      summary: clean(cells[2]),
    });
  }
  return rows;
}

function irisHtmlItems(html) {
  if (!html.includes("item-biz") || !html.includes("사업공고")) return [];
  const rows = [];
  const matches = String(html || "").match(/<div class="item-biz">[\s\S]*?<\/a>\s*<\/div>/gi) || [];
  for (const block of matches) {
    const title = textFromHtmlClass(block, "title");
    if (!title) continue;
    const viewMatch = block.match(/f_bsnsAncmBtinSituListForm_view\('([^']+)'\s*,\s*'([^']+)'\)/i);
    const period = textFromHtmlClass(block, "period");
    const departments = Array.from(block.matchAll(/<p class="department">([\s\S]*?)<\/p>/gi)).map((match) => clean(match[1])).filter(Boolean);
    rows.push({
      id: viewMatch ? viewMatch[1] : title,
      title,
      category: departments[0] || "IRIS 사업공고",
      agency: departments[1] || departments[0] || "IRIS",
      period,
      deadline: periodEndDate(period),
      announcementDate: periodStartDate(period),
      status: clean((block.match(/<span class="status[^>]*">([\s\S]*?)<\/span>/i) || [])[1]) || "사업공고",
      link: viewMatch ? `https://www.iris.go.kr/contents/retrieveBsnsAncmBtinSituListView.do?ancmId=${encodeURIComponent(viewMatch[1])}` : "https://iris.go.kr/main.do",
      summary: [departments[0], period].filter(Boolean).join(" · "),
    });
  }
  return rows;
}

function textFromHtmlClass(html, className) {
  const pattern = new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i");
  return clean((String(html || "").match(pattern) || [])[1]);
}

function absoluteUrl(value, base) {
  try { return new URL(value, base).toString(); } catch (_) { return clean(value); }
}

function xmlItems(xml) {
  const matches = xml.match(/<(item|row|list|data|HIT)[^>]*>[\s\S]*?<\/\1>/gi) || [];
  return matches.map((block) => {
    const row = {};
    const inner = block.replace(/^<([A-Za-z0-9_:\-가-힣]+)[^>]*>/, "").replace(/<\/([A-Za-z0-9_:\-가-힣]+)>\s*$/i, "");
    collectXmlFields(inner, row, "");
    return row;
  });
}

function collectXmlFields(xml, row, prefix) {
  const fieldMatches = Array.from(String(xml || "").matchAll(/<([A-Za-z0-9_:\-가-힣]+)[^>]*>([\s\S]*?)<\/\1>/g));
  for (const match of fieldMatches) {
    const key = match[1].replace(/^.*:/, "");
    const body = match[2] || "";
    const pathKey = prefix ? `${prefix}_${key}` : key;
    const value = decodeXml(body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (value && !row[key]) row[key] = value;
    if (value && !row[pathKey]) row[pathKey] = value;
    if (/<[A-Za-z0-9_:\-가-힣]+[^>]*>/.test(body)) collectXmlFields(body, row, pathKey);
  }
}

function normalizeGovernmentProjects(payload, source, keyword) {
  const result = [];
  for (const row of findGovernmentRows(payload)) {
    const title = firstField(row, ["title", "pblancNm", "pbancNm", "bizPbancNm", "biz_pbanc_nm", "intg_pbanc_biz_nm", "biz_sj", "ProjectTitle_Korean", "ProjectTitle", "Korean", "국문과제명", "사업명", "공고명", "과제명", "name", "subject"]);
    if (!title) continue;
    const link = firstField(row, ["link", "url", "detailUrl", "pblancUrl", "pbancUrl", "dtlUrl", "detl_pg_url", "biz_gdnc_url", "biz_aply_url", "상세URL", "상세페이지url"]);
    const period = firstField(row, ["reqstBeginEndDe", "applicationPeriod", "receptionPeriod", "ProjectPeriod", "접수기간", "신청기간"]);
    const deadline = normalizeGovernmentDate(firstField(row, ["deadline", "endDate", "End", "ProjectPeriod_End", "ProjectPeriodEnd", "receptionEndDate", "pbancRcptEndYmd", "pbanc_rcpt_end_dt", "reqstEndDate", "접수마감일", "신청마감일", "endYmd"])) || periodEndDate(period);
    const announcementDate = normalizeGovernmentDate(firstField(row, ["announcementDate", "startDate", "Start", "ProjectPeriod_Start", "ProjectPeriodStart", "pbancRcptBgngYmd", "pbanc_rcpt_bgng_dt", "pblancDe", "creatPnttm", "ProjectYear", "공고일", "등록일", "startYmd"])) || periodStartDate(period);
    const externalId = clean(firstField(row, ["pblancId", "pbancSn", "bizPbancSn", "pbanc_sn", "biz_pbanc_sn", "ProjectNumber", "projectNumber", "과제고유번호", "공고번호", "id"]));
    result.push({
      source: source.name,
      external_id: externalId,
      title: clean(title),
      agency: clean(firstField(row, ["agency", "agencyName", "jrsdInsttNm", "sprv_inst", "pbanc_ntrp_nm", "biz_prch_dprt_nm", "OrderAgency_Name", "ResearchAgency_Name", "Ministry_Name", "OrderAgency", "ResearchAgency", "Ministry", "Name", "기관명", "소관부처", "department", "organNm"])),
      category: clean(firstField(row, ["category", "bizCategory", "supportType", "supt_biz_clsfc", "분야", "사업분류"])) || keyword,
      summary: clean(firstField(row, ["summary", "description", "content", "supportContent", "pbanc_ctnt", "bsnsSumryCn", "Goal_Full", "Abstract_Full", "Effect_Full", "Goal", "Abstract", "Effect", "사업내용", "지원내용", "사업소개정보"])),
      link: link ? String(link).trim() : "",
      announcement_date: announcementDate,
      deadline,
      status: clean(firstField(row, ["status", "recruitmentStatus", "접수상태", "공고상태"])) || statusFromDeadline(deadline),
      budget: clean(firstField(row, ["budget", "supportBudget", "사업지원예산정보", "지원규모", "지원금액"])),
      target: clean(firstField(row, ["target", "supportTarget", "aply_trgt", "aply_trgt_ctnt", "사업지원대상정보", "지원대상", "대상"])),
      keywords: keyword,
      raw_json: JSON.stringify(row).slice(0, 5000),
    });
  }
  return result;
}

function findGovernmentRows(payload) {
  if (Array.isArray(payload)) return payload.filter((item) => item && typeof item === "object");
  if (!payload || typeof payload !== "object") return [];
  const queue = [payload];
  const candidates = [];
  while (queue.length) {
    const current = queue.shift();
    for (const value of Object.values(current || {})) {
      if (Array.isArray(value)) candidates.push(value);
      else if (value && typeof value === "object") queue.push(value);
    }
  }
  const arrays = candidates.map((items) => items.filter((item) => item && typeof item === "object")).filter((items) => items.length);
  arrays.sort((a, b) => b.length - a.length);
  return arrays[0] || [];
}

function firstField(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) return row[key];
  }
  const normalizedKeys = Object.keys(row || {}).reduce((acc, key) => { acc[normalize(key)] = key; return acc; }, {});
  for (const key of keys) {
    const actual = normalizedKeys[normalize(key)];
    if (actual && row[actual] !== undefined && row[actual] !== null && String(row[actual]).trim()) return row[actual];
  }
  return "";
}

function normalizeGovernmentDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const spaced = raw.match(/(20\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/);
  if (spaced) return `${spaced[1]}-${String(spaced[2]).padStart(2, "0")}-${String(spaced[3]).padStart(2, "0")}`;
  const compact = raw.match(/(20\d{2})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return raw.slice(0, 20);
}

function periodStartDate(value) {
  const dates = periodDates(value);
  return dates[0] || "";
}

function periodEndDate(value) {
  const dates = periodDates(value);
  return dates[dates.length - 1] || "";
}

function periodDates(value) {
  const raw = String(value || "");
  const matches = raw.match(/20\d{2}[.\-/년\s]*\d{1,2}[.\-/월\s]*\d{1,2}/g) || [];
  return matches.map(normalizeGovernmentDate).filter(Boolean);
}

function statusFromDeadline(deadline) {
  if (!deadline) return "확인 필요";
  const end = new Date(`${deadline}T23:59:59+09:00`);
  if (Number.isNaN(end.getTime())) return "확인 필요";
  return end.getTime() >= Date.now() ? "모집중" : "마감";
}

function compareGovernmentProjects(a, b) {
  const ad = a.deadline || "9999-12-31";
  const bd = b.deadline || "9999-12-31";
  return ad.localeCompare(bd) || String(b.announcement_date || "").localeCompare(String(a.announcement_date || ""));
}

function decodeXml(value) {
  return String(value || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function analyze(env, disclosures, news, diagnostics) {
  const fallback = fallbackAnalysis(disclosures, news);
  if (!env.GEMINI_API_KEY) {
    diagnostics.push({ step: "gemini", status: "missing_secret" });
    return fallback;
  }

  const context = { companies: [] };
  for (const company of TARGET_COMPANIES.map((item) => item.name)) {
    const companyDisclosures = disclosures.filter((item) => item.company === company).slice(0, 10);
    const companyNews = news.filter((item) => item.company === company).slice(0, 15);
    if (!companyDisclosures.length && !companyNews.length) continue;
    const timeline = await readJson(env, `company:${company}:timeline`, { events: [] });
    context.companies.push({
      company,
      profile: COMPANY_PROFILES[company] || {},
      recent_history: Array.isArray(timeline.events) ? timeline.events.slice(-5).reverse() : [],
      disclosures: companyDisclosures,
      news: companyNews,
    });
  }

  const prompt = {
    role: "경쟁사 공시/뉴스 브리핑 분석가",
    goal: "공시와 뉴스가 섞이지 않게 구분하되, 회사 맥락과 최근 이력을 참고해 오늘 볼 만한 포인트를 판단합니다.",
    rules: [
      "공시 요약에는 공시에서 확인된 내용만 직접 반영합니다.",
      "뉴스 요약에는 뉴스에서 확인된 내용만 반영합니다.",
      "수상, 행사, 단순 홍보는 중요도를 낮게 판단합니다.",
      "계약, 기술이전, 임상 단계 변화, 품목허가, 실적, 투자, M&A, 소송, 품질/안전, 경영권, 대규모 공급은 주의 깊게 봅니다.",
      "제공된 데이터에 없는 사실은 추정하지 않습니다.",
    ],
    output_format: {
      companies: [
        {
          company: "회사명",
          issue_type: "카테고리",
          today_summary: "오늘 요약 1문장",
          news_summary: "뉴스 주요 내용 1~2문장",
          important_point: "공시/뉴스를 구분한 중요 포인트 1~2문장",
          important_titles: ["중요하다고 볼 기사 또는 공시 제목"],
          topics: ["토픽"],
        },
      ],
    },
    input: context,
  };

  try {
    const models = unique([env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-3.5-flash-lite"].filter(Boolean));
    for (const model of models) {
      for (const responseMode of ["json", "plain"]) {
        const body = { contents: [{ role: "user", parts: [{ text: JSON.stringify(prompt) }] }] };
        if (responseMode === "json") body.generationConfig = { responseMimeType: "application/json" };
        const response = await fetch(GEMINI_API_URL.replace("{model}", model), {
          method: "POST",
          headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          diagnostics.push({ step: "gemini", status: "http_error", model, mode: responseMode, code: response.status, reason: geminiErrorReason(await response.text()) });
          continue;
        }
        const payload = await response.json();
        const text = extractGeminiText(payload);
        const normalized = normalizeGemini(JSON.parse(extractJson(text)));
        diagnostics.push({ step: "gemini", status: Object.keys(normalized).length ? "success" : "empty_result", model, mode: responseMode, company_count: Object.keys(normalized).length });
        return mergeAnalysis(fallback, normalized);
      }
    }
    return fallback;
  } catch (_) {
    diagnostics.push({ step: "gemini", status: "exception", reason: safeError(_) });
    return fallback;
  }
}

async function analyzeItems(env, disclosures, news, diagnostics) {
  if (!disclosures.length && !news.length) return [];
  if (!env.GEMINI_API_KEY) {
    diagnostics.push({ step: "gemini_item", status: "missing_secret" });
    return [];
  }

  const disclosureInputs = [];
  for (const item of disclosures) {
    const document = await disclosureDocumentText(env, item, diagnostics);
    if (!document.text) continue;
    disclosureInputs.push({ item, documentText: document.text });
  }

  const items = [
    ...disclosureInputs.map(({ item, documentText }) => ({
      item_type: "disclosure",
      item_id: disclosureKey(item),
      company: item.company,
      category: item.category,
      title: item.title,
      date: item.date,
      receipt_no: item.receipt_no || "",
      source_type: "dart_original_document",
      source_text: documentText,
    })),
    ...news.map((item) => ({
      item_type: "news",
      item_id: newsKey(item),
      company: item.company,
      category: item.category,
      title: item.title,
      published_at: item.published_at,
      media: item.media || "",
      source_text: [item.title, item.summary].filter(Boolean).join(" / "),
    })),
  ];

  if (!items.length) {
    diagnostics.push({ step: "gemini_item", status: "no_usable_source" });
    return [];
  }

  const prompt = {
    role: "공시와 뉴스의 개별 항목 요약 담당자",
    goal: "각 항목을 서로 섞지 않고, 해당 항목 자체에 있는 정보만 바탕으로 짧고 정확하게 요약합니다.",
    strict_rules: [
      "각 item_id별로 독립적으로 요약합니다.",
      "다른 회사, 다른 기사, 다른 공시의 내용을 끌어오지 않습니다.",
      "공시 항목에는 뉴스 내용을 연결하지 않습니다.",
      "뉴스 항목에는 다른 공시나 회사 최근 동향을 연결하지 않습니다.",
      "source_text에 없는 사실은 추정하지 않습니다.",
      "disclosure 항목의 source_text는 DART 원문에서 추출한 텍스트입니다. 공시 요약은 반드시 이 원문 텍스트만 근거로 씁니다.",
      "원문에서 금액, 상대방, 일정, 사유, 영향이 확인되면 구체적으로 적습니다.",
      "원문에서 확인되지 않는 내용은 추정하지 말고 caution에 '원문 표/첨부의 세부 항목 확인 필요'처럼 확인 행동만 씁니다.",
      "summary는 한 문장, key_points는 핵심 내용 1~2문장, caution은 확인할 점이 있을 때만 한 문장으로 씁니다.",
    ],
    output_format: {
      items: [
        {
          item_type: "news 또는 disclosure",
          item_id: "입력 item_id 그대로",
          company: "회사명",
          title: "제목",
          summary: "해당 항목 자체 요약 1문장",
          key_points: "해당 항목의 주요 내용 1~2문장",
          caution: "확인할 점. 없으면 빈 문자열",
        },
      ],
    },
    input: { items },
  };

  try {
    const models = unique([env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-3.5-flash-lite"].filter(Boolean));
    for (const model of models) {
      const body = {
        contents: [{ role: "user", parts: [{ text: JSON.stringify(prompt) }] }],
        generationConfig: { responseMimeType: "application/json" },
      };
      const response = await fetch(GEMINI_API_URL.replace("{model}", model), {
        method: "POST",
        headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        diagnostics.push({ step: "gemini_item", status: "http_error", model, code: response.status, reason: geminiErrorReason(await response.text()) });
        continue;
      }
      const payload = await response.json();
      const parsed = JSON.parse(extractJson(extractGeminiText(payload)));
      const result = normalizeItemSummaries(parsed, items, model);
      diagnostics.push({ step: "gemini_item", status: result.length ? "success" : "empty_result", model, item_count: result.length });
      return result;
    }
  } catch (_) {
    diagnostics.push({ step: "gemini_item", status: "exception", reason: safeError(_) });
  }
  return [];
}

function normalizeItemSummaries(parsed, inputItems, model) {
  const allowed = new Map(inputItems.map((item) => [`${item.item_type}:${item.item_id}`, item]));
  const rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.items) ? parsed.items : [];
  const result = [];
  for (const row of rows) {
    const key = `${clean(row.item_type)}:${clean(row.item_id)}`;
    const source = allowed.get(key);
    if (!source) continue;
    result.push({
      item_type: source.item_type,
      item_id: source.item_id,
      company: source.company,
      title: source.title,
      summary: clean(row.summary),
      key_points: clean(row.key_points),
      caution: clean(row.caution),
      generated_by: "gemini",
      model,
    });
  }
  return result;
}

async function disclosureDocumentText(env, item, diagnostics) {
  const receiptNo = clean(item.receipt_no);
  if (!receiptNo) {
    diagnostics.push({ step: "dart_document", status: "missing_receipt_no", title: item.title });
    return { text: "", status: "missing_receipt_no" };
  }

  const cached = await disclosureDocumentFromCache(env, receiptNo);
  if (cached && cached.document_text) {
    diagnostics.push({ step: "dart_document", status: "cache_hit", receipt_no: receiptNo, chars: cached.document_text.length });
    return { text: cached.document_text, status: "cache_hit" };
  }

  const url = new URL(DART_DOCUMENT_URL);
  url.searchParams.set("crtfc_key", env.DART_API_KEY || "");
  url.searchParams.set("rcept_no", receiptNo);

  let fetchedAt = kstTimestamp(new Date());
  try {
    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/zip,application/xml,text/xml,*/*",
        "User-Agent": "Mozilla/5.0 competitor-newsletter/1.0",
      },
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!response.ok) {
      const reason = `http_${response.status}`;
      await saveDisclosureDocument(env, receiptNo, item, "", "http_error", reason, fetchedAt);
      diagnostics.push({ step: "dart_document", status: "http_error", receipt_no: receiptNo, code: response.status });
      return { text: "", status: "http_error" };
    }

    if (!isZip(bytes)) {
      const message = strFromU8(bytes).slice(0, 500);
      const reason = dartDocumentErrorReason(message);
      await saveDisclosureDocument(env, receiptNo, item, "", "api_error", reason, fetchedAt);
      diagnostics.push({ step: "dart_document", status: "api_error", receipt_no: receiptNo, reason });
      return { text: "", status: "api_error" };
    }

    const text = extractTextFromDartZip(bytes);
    if (!text) {
      await saveDisclosureDocument(env, receiptNo, item, "", "empty", "zip_text_empty", fetchedAt);
      diagnostics.push({ step: "dart_document", status: "empty", receipt_no: receiptNo });
      return { text: "", status: "empty" };
    }

    const trimmed = text.slice(0, MAX_DISCLOSURE_TEXT_CHARS);
    await saveDisclosureDocument(env, receiptNo, item, trimmed, "success", "", fetchedAt);
    diagnostics.push({ step: "dart_document", status: "success", receipt_no: receiptNo, chars: trimmed.length });
    return { text: trimmed, status: "success" };
  } catch (_) {
    const reason = safeError(_);
    await saveDisclosureDocument(env, receiptNo, item, "", "exception", reason, fetchedAt);
    diagnostics.push({ step: "dart_document", status: "exception", receipt_no: receiptNo, reason });
    return { text: "", status: "exception" };
  }
}

async function disclosureDocumentFromCache(env, receiptNo) {
  if (!env.DB) return null;
  try {
    return await env.DB.prepare("SELECT document_text, status FROM disclosure_documents WHERE receipt_no = ? AND status = 'success' LIMIT 1").bind(receiptNo).first();
  } catch (_) {
    return null;
  }
}

async function saveDisclosureDocument(env, receiptNo, item, documentText, status, error, fetchedAt) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(`INSERT INTO disclosure_documents (receipt_no, company, title, document_text, status, error, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(receipt_no) DO UPDATE SET company=excluded.company, title=excluded.title, document_text=excluded.document_text, status=excluded.status, error=excluded.error, fetched_at=excluded.fetched_at`)
      .bind(receiptNo, item.company || "", item.title || "", documentText || "", status || "", error || "", fetchedAt).run();
  } catch (_) {
    // 원문 캐시 실패가 전체 요약 생성을 막지는 않게 둡니다.
  }
}

function isZip(bytes) {
  return bytes && bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function extractTextFromDartZip(bytes) {
  const files = unzipSync(bytes);
  const entries = Object.entries(files)
    .filter(([name]) => /\.(xml|html?|xhtml)$/i.test(name))
    .sort((a, b) => b[1].length - a[1].length);
  const chunks = [];
  for (const [, content] of entries) {
    const raw = strFromU8(content);
    const plain = xmlToPlainText(raw);
    if (plain) chunks.push(plain);
    if (chunks.join("\n").length >= MAX_DISCLOSURE_TEXT_CHARS) break;
  }
  return clean(chunks.join("\n")).slice(0, MAX_DISCLOSURE_TEXT_CHARS);
}

function xmlToPlainText(value) {
  return decodeEntities(String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, " $1 ")
    .replace(/<[^>]+>/g, "\n"))
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    const key = entity.toLowerCase();
    if (key[0] === "#") {
      const code = key[1] === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : " ";
  });
}

function dartDocumentErrorReason(text) {
  const status = (String(text || "").match(/<status>(.*?)<\/status>/i) || [])[1] || "";
  const message = (String(text || "").match(/<message>(.*?)<\/message>/i) || [])[1] || "";
  return [status, message].filter(Boolean).join(": ").slice(0, 300) || "not_zip_response";
}

function fallbackAnalysis(disclosures, news) {
  const result = {};
  for (const company of TARGET_COMPANIES.map((item) => item.name)) {
    const companyDisclosures = disclosures.filter((item) => item.company === company);
    const companyNews = news.filter((item) => item.company === company);
    if (!companyDisclosures.length && !companyNews.length) continue;
    const topics = topicWords(companyNews.map((item) => item.title));
    result[company] = {
      company,
      issue_type: companyDisclosures.length && companyNews.length ? "공시/뉴스" : companyDisclosures.length ? "공시" : "뉴스",
      today_summary: companyDisclosures.length ? `${company} 신규 공시 ${companyDisclosures.length}건이 확인됐습니다.` : `${company} 최신 뉴스 ${companyNews.length}건이 확인됐습니다.`,
      news_summary: topics.length ? `${topics.slice(0, 4).join(", ")} 관련 보도가 확인됐습니다.` : "주요 뉴스가 확인됐습니다.",
      important_point: companyDisclosures.length ? "공시는 원문에서 변경 내용, 금액, 일정, 상대방을 확인해야 합니다." : "뉴스는 반복 보도인지 신규 정보인지 구분해 볼 필요가 있습니다.",
      topics,
      important_titles: [...companyDisclosures.filter((item) => item.important).map((item) => item.title), ...companyNews.filter((item) => item.important).map((item) => item.title)],
      generated_by: "rules",
    };
  }
  return result;
}

function normalizeGemini(parsed) {
  const result = {};
  const rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.companies) ? parsed.companies : [];
  for (const row of rows) {
    if (!row || !row.company) continue;
    result[row.company] = {
      company: clean(row.company),
      issue_type: clean(row.issue_type),
      today_summary: clean(row.today_summary),
      news_summary: clean(row.news_summary || row.summary),
      important_point: clean(row.important_point || row.why_it_matters),
      topics: Array.isArray(row.topics) ? row.topics.map(clean).filter(Boolean).slice(0, 6) : [],
      important_titles: Array.isArray(row.important_titles) ? row.important_titles.map(clean).filter(Boolean).slice(0, 10) : [],
      generated_by: "gemini",
    };
  }
  return result;
}

function mergeAnalysis(fallback, gemini) {
  const merged = { ...fallback };
  for (const [company, item] of Object.entries(gemini)) {
    const usable = Object.fromEntries(Object.entries(item).filter(([, value]) => value !== "" && !(Array.isArray(value) && !value.length)));
    merged[company] = { ...(merged[company] || {}), ...usable };
  }
  return merged;
}

function extractGeminiText(payload) {
  return (payload.candidates || []).flatMap((candidate) => ((candidate.content || {}).parts || []).map((part) => part.text || "")).join("\n").trim();
}

function geminiErrorReason(text) {
  try {
    const parsed = JSON.parse(text || "{}");
    const error = parsed.error || {};
    return [error.status, error.message].filter(Boolean).join(": ").slice(0, 300) || "gemini_error";
  } catch (_) {
    return sanitizeErrorMessage(text).slice(0, 300) || "gemini_error";
  }
}

function extractJson(text) {
  const value = String(text || "").trim();
  if (value.startsWith("{") || value.startsWith("[")) return value;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const objectStart = value.indexOf("{");
  const objectEnd = value.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) return value.slice(objectStart, objectEnd + 1);
  const arrayStart = value.indexOf("[");
  const arrayEnd = value.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) return value.slice(arrayStart, arrayEnd + 1);
  return value;
}

function classifyDisclosure(title) {
  const compact = clean(title).replace(/\s+/g, "");
  if (["사업보고서", "반기보고서", "분기보고서"].some((word) => compact.includes(word))) return "정기공시";
  if (["주식등의대량보유", "임원ㆍ주요주주", "임원·주요주주", "최대주주", "소유주식", "지분변동"].some((word) => compact.includes(word))) return "지분/주주";
  if (["유상증자", "무상증자", "감자", "전환사채", "신주인수권부사채", "교환사채", "자금조달"].some((word) => compact.includes(word))) return "자금조달";
  if (["합병", "분할", "주식교환", "영업양수", "영업양도", "타법인주식", "유형자산양수", "유형자산양도", "취득결정", "처분결정"].some((word) => compact.includes(word))) return "투자/M&A";
  if (["공급계약", "판매계약", "단일판매", "기술이전", "라이선스", "임상시험", "품목허가", "특허", "계약체결", "계약해지"].some((word) => compact.includes(word))) return "사업/계약";
  return "경영/기타";
}

function classifyNews(text) {
  if (["임상", "신약", "R&D", "파이프라인", "기술이전", "라이선스"].some((word) => text.includes(word))) return "R&D";
  if (["허가", "품목", "식약처", "FDA"].some((word) => text.includes(word))) return "허가";
  if (["계약", "공급", "수출", "파트너"].some((word) => text.includes(word))) return "계약";
  if (["실적", "매출", "영업이익"].some((word) => text.includes(word))) return "실적";
  if (["지분", "승계", "주주", "경영권"].some((word) => text.includes(word))) return "지분/주주";
  if (["소송", "리스크", "품질", "안전"].some((word) => text.includes(word))) return "리스크";
  return "일반뉴스";
}

function scoreDisclosure(title, category, note) {
  let score = 0;
  if (IMPORTANT_CATEGORIES.has(category)) score += 30;
  if (title.includes("정정") || note.includes("정")) score += 12;
  for (const keyword of IMPORTANT_KEYWORDS) if (title.includes(keyword)) score += 10;
  if (["공정거래자율준수", "의결권대리", "주주총회소집"].some((word) => title.includes(word))) score -= 18;
  return score;
}

function hasImportantSignal(text) {
  return ["기술이전", "라이선스", "임상 3상", "임상3상", "품목허가", "대규모", "계약", "소송", "경영권", "지분", "FDA"].some((word) => text.includes(word));
}

function isCompanyArticle(company, title) {
  const haystack = normalize(title);
  return company.aliases.map(normalize).some((alias) => alias && haystack.includes(alias));
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  if (response.status >= 300 && response.status < 400) {
    const error = new Error("redirect_response");
    error.status = response.status;
    error.host = new URL(url).host;
    throw error;
  }
  if (!response.ok) {
    const error = new Error("fetch_not_ok");
    error.status = response.status;
    error.host = new URL(url).host;
    throw error;
  }
  return await response.json();
}

function ensureUsableRefresh(disclosures, news, diagnostics) {
  if (disclosures.length || news.length) return;
  const apiOk = diagnostics.some((item) => item.step === "dart" && ["000", "013"].includes(item.status)) || diagnostics.some((item) => item.step === "news" && item.status === "ok");
  const failed = diagnostics.some((item) => ["request_error", "http_error", "exception"].includes(item.status));
  if (failed && !apiOk) {
    const error = new Error("외부 API 호출이 실패해 기존 데이터를 유지합니다.");
    error.status = 502;
    throw error;
  }
}

function mergeDisclosures(incoming, existing) {
  return dedupe([...(incoming || []), ...(existing || [])], disclosureKey)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || companyIndex(a.company) - companyIndex(b.company))
    .slice(0, MAX_STORED_ITEMS);
}

function mergeNews(incoming, existing) {
  return dedupe([...(incoming || []), ...(existing || [])], newsKey)
    .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")) || companyIndex(a.company) - companyIndex(b.company))
    .slice(0, MAX_STORED_ITEMS);
}

function countNewRows(incoming, existing, keyFn) {
  const existingKeys = new Set((existing || []).map(keyFn).filter(Boolean));
  return dedupe(incoming || [], keyFn).filter((item) => !existingKeys.has(keyFn(item))).length;
}

function disclosureKey(item) {
  return item && item.receipt_no ? String(item.receipt_no) : `${item?.company || ""}:${normalize(item?.title || "")}:${item?.date || ""}`;
}

function newsKey(item) {
  return item ? `${item.company || ""}:${normalize(item.title || "")}` : "";
}

function safeError(error) {
  if (!error) return "unknown";
  if (typeof error === "string") return sanitizeErrorMessage(error).slice(0, 300) || "error";
  const parts = [];
  if (error.status) parts.push(`http_${error.status}`);
  if (error.name) parts.push(error.name);
  if (error.message) parts.push(sanitizeErrorMessage(error.message));
  if (parts.length) return parts.join(":").slice(0, 160);
  return "error";
}

function sanitizeErrorMessage(value) {
  return String(value || "")
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/crtfc_key=[^&\s]+/gi, "crtfc_key=***")
    .replace(/key=[^&\s]+/gi, "key=***")
    .replace(/api[_-]?key[^&\s]*/gi, "api_key=***")
    .replace(/AIza[0-9A-Za-z_-]+/g, "AIza***")
    .replace(/[A-Za-z0-9_-]{24,}/g, "***");
}

async function readJson(env, key, fallback) {
  const raw = await env.BRIEFING_KV.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function htmlResponse(html) {
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function cssResponse(css) {
  return new Response(css, {
    headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function javascriptResponse(script) {
  return new Response(script, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function emptyBriefing() {
  return {
    ok: true,
    date: "",
    updated_at: "",
    disclosures: [],
    news: [],
    government_projects: [],
    financial_metrics: [],
    analysis: {},
    summary: { disclosure_count: 0, news_count: 0, government_project_count: 0, financial_metric_count: 0, important_disclosure_count: 0, important_news_count: 0 },
  };
}

function clean(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function isoDate(value) {
  const text = clean(value);
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return text;
}

function cleanHtml(value) {
  return clean(String(value || "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<\/?b>/gi, ""));
}

function normalize(value) {
  return String(value || "").replace(/[^0-9A-Za-z가-힣]/g, "").toLowerCase();
}

function dedupe(rows, keyFn) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFn(row);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(rows) {
  return [...new Set(rows)];
}

function mediaFromUrl(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    return parts.length >= 3 && ["co", "com", "or", "ne"].includes(parts.at(-2)) && parts.at(-1) === "kr" ? parts.at(-3) : parts.at(-2) || host;
  } catch (_) {
    return "";
  }
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function yyyymmdd(date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date).replaceAll("-", "");
}

function kstDateKey(date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function kstTimestamp(date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

function companyIndex(company) {
  const index = TARGET_COMPANIES.findIndex((item) => item.name === company);
  return index >= 0 ? index : 999;
}

function topicWords(titles) {
  const stop = new Set(["관련", "뉴스", "오늘", "단독", "종합", "기자", "제약", "바이오", "공개", "확대", "강화"]);
  const words = titles.flatMap((title) => clean(title).replace(/[0-9]+(?:조|억|만|개|건|%)?/g, " ").replace(/[^0-9A-Za-z가-힣]/g, " ").split(/\s+/)).filter((word) => word.length >= 2 && !stop.has(word));
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([word]) => word);
}

function renderPage() {
  return renderReactPage();
}
function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

