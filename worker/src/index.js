import { strFromU8, unzipSync } from "fflate";

const DART_VIEWER_URL = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=";
const DART_LIST_URL = "https://opendart.fss.or.kr/api/list.json";
const DART_DOCUMENT_URL = "https://opendart.fss.or.kr/api/document.xml";
const NAVER_NEWS_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/") return htmlResponse(renderPage());
      if (request.method === "GET" && url.pathname === "/api/latest") return jsonResponse(await latestBriefing(env));
      if (request.method === "GET" && url.pathname === "/api/archive") return jsonResponse(await archiveIndex(env));
      if (request.method === "GET" && url.pathname.startsWith("/api/archive/")) {
        const date = url.pathname.split("/").pop();
        return jsonResponse(await archiveBriefing(env, date));
      }
      if (request.method === "POST" && url.pathname === "/api/refresh") return await refresh(request, env);
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
  ensureUsableRefresh(collectedDisclosures, collectedNews, diagnostics);

  const now = new Date();
  const nowText = kstTimestamp(now);
  const runId = `refresh:${now.toISOString()}`;
  await cleanupOldData(env, now);

  const newDisclosures = await filterNewRows(env.DB, "disclosures", collectedDisclosures, disclosureKey);
  const newNews = await filterNewRows(env.DB, "news_articles", collectedNews, newsKey);
  const added = { disclosures: newDisclosures.length, news: newNews.length };
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
  statements.push(...itemSummaryStatements(env, itemSummaries, nowText));
  statements.push(env.DB.prepare("INSERT INTO refresh_runs (id, started_at, finished_at, disclosure_count, news_count, new_disclosure_count, new_news_count, diagnostics_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(runId, kstTimestamp(startedAt), nowText, collectedDisclosures.length, collectedNews.length, added.disclosures, added.news, JSON.stringify(diagnostics)));
  if (statements.length) await env.DB.batch(statements);

  const briefing = await latestBriefingFromD1(env, nowText, diagnostics);
  return jsonResponse({ ok: true, briefing, added });
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
  const disclosures = (disclosureRows.results || []).map(disclosureFromDb);
  const news = (newsRows.results || []).map(newsFromDb);
  const itemSummaries = await itemSummariesFromD1(env);
  return {
    ok: true,
    date: kstDateKey(new Date()),
    updated_at: updatedAt || (await latestRefreshTime(env)) || "",
    disclosures,
    news,
    analysis: {},
    item_summaries: itemSummaries,
    diagnostics,
    summary: {
      disclosure_count: disclosures.length,
      news_count: news.length,
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

function emptyBriefing() {
  return {
    ok: true,
    date: "",
    updated_at: "",
    disclosures: [],
    news: [],
    analysis: {},
    summary: { disclosure_count: 0, news_count: 0, important_disclosure_count: 0, important_news_count: 0 },
  };
}

function clean(value) {
  return String(value || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
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
  const companies = TARGET_COMPANIES.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("");
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>경쟁사 브리핑</title>
  <style>
    :root { --bg:#f6f4ef; --paper:#fffdf8; --ink:#1f2d3d; --muted:#756c61; --line:#eee7db; --soft:#f1eee7; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:Arial,'Malgun Gothic','Apple SD Gothic Neo',sans-serif; }
    main { max-width:1120px; margin:0 auto; padding:34px 18px 56px; }
    header { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; margin-bottom:20px; }
    h1 { margin:0 0 8px; font-size:34px; letter-spacing:-.03em; }
    .sub { margin:0; color:var(--muted); line-height:1.7; }
    .actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
    button, select, input { border:1px solid var(--line); border-radius:999px; background:#fff; color:var(--ink); font:inherit; }
    button { padding:11px 16px; cursor:pointer; font-weight:800; }
    button.primary { background:#1f2d3d; color:#fff; border-color:#1f2d3d; }
    button:disabled { opacity:.55; cursor:not-allowed; }
    select, input { padding:11px 14px; min-height:44px; }
    .filters { display:grid; grid-template-columns:190px 190px 1fr; gap:10px; padding:16px; background:var(--soft); border-radius:22px; margin:18px 0; }
    .tabs { display:flex; gap:8px; margin:20px 0 16px; }
    .tab.active { background:#1f2d3d; color:#fff; }
    .summary { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin:16px 0; }
    .metric, .card { background:var(--paper); border-radius:20px; box-shadow:0 8px 24px rgba(45,37,25,.05); }
    .metric { padding:16px 18px; color:var(--muted); font-weight:800; }
    .metric strong { display:block; margin-top:6px; color:var(--ink); font-size:28px; }
    .card { padding:20px 22px; margin-bottom:14px; }
    .top { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:10px; }
    .chip { display:inline-block; padding:7px 12px; border-radius:999px; color:#fff; font-weight:800; font-size:14px; }
    .badge { display:inline-block; margin-left:6px; padding:6px 10px; border-radius:999px; background:#f3efe7; color:var(--muted); font-weight:800; font-size:13px; }
    .important { background:#fff3d5; color:#8a5b00; }
    .date { color:#897f73; font-size:13px; white-space:nowrap; }
    h2 { margin:6px 0 8px; font-size:20px; line-height:1.45; letter-spacing:-.015em; }
    a { color:var(--ink); text-decoration:none; }
    a:hover { text-decoration:underline; }
    .body { color:#4d5966; line-height:1.75; }
    .point { margin-top:12px; padding:13px 15px; border-radius:15px; background:#fff7eb; color:#4d5966; line-height:1.7; }
    .panel { display:none; }
    .panel.active { display:block; }
    .empty { padding:28px; text-align:center; color:#8b8378; }
    .archive-row { display:flex; justify-content:space-between; gap:12px; align-items:center; }
    .newsletter-view { margin-top:14px; }
    .newsletter-frame { width:100%; min-height:760px; border:0; border-radius:18px; background:#fff; box-shadow:0 8px 24px rgba(45,37,25,.05); }
    .admin-actions { display:none; margin:10px 0 18px; padding:12px 14px; border-radius:18px; background:#f7f2ea; color:var(--muted); align-items:center; justify-content:space-between; gap:12px; }
    .admin-actions.open { display:flex; }
    .admin-actions p { margin:0; font-size:13px; }
    @media (max-width:760px) { header { display:block; } .actions { justify-content:flex-start; margin-top:16px; } .filters, .summary { grid-template-columns:1fr; } .top, .archive-row { display:block; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>경쟁사 브리핑</h1>
        <p class="sub">저장된 공시와 뉴스를 먼저 보여주고, 업데이트는 뒤에서 안전하게 실행합니다.</p>
      </div>
      <div class="actions">
        <span id="status" class="sub">불러오는 중...</span>
      </div>
    </header>
    <section class="summary">
      <div class="metric">오늘 공시<strong id="count-disclosures">0</strong></div>
      <div class="metric">오늘 뉴스<strong id="count-news">0</strong></div>
    </section>
    <section id="admin-actions" class="admin-actions" aria-hidden="true">
      <p>관리자 도구입니다. 요약 없는 최신 항목 10건만 AI 요약으로 채웁니다.</p>
      <button id="summarize" type="button">AI 요약 채우기</button>
    </section>
    <section class="filters">
      <select id="company"><option value="">전체 기업</option>${companies}</select>
      <select id="category"><option value="">전체 카테고리</option></select>
      <input id="search" type="search" placeholder="회사명, 제목, 요약 검색">
    </section>
    <nav class="tabs">
      <button class="tab active" data-tab="disclosures" type="button">공시</button>
      <button class="tab" data-tab="news" type="button">뉴스</button>
      <button class="tab" data-tab="archive" type="button">아카이브</button>
    </nav>
    <section id="disclosures" class="panel active"></section>
    <section id="news" class="panel"></section>
    <section id="archive" class="panel"></section>
  </main>
  <script>
    const colors = ${JSON.stringify(COMPANY_COLORS)};
    let briefing = ${JSON.stringify(emptyBriefing())};
    let archive = [];
    const state = { tab:'disclosures', company:'', category:'', search:'' };
    const $ = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
    const text = (value) => String(value ?? '').toLowerCase();
    const norm = (value) => String(value ?? '').replace(/[^0-9A-Za-z가-힣]/g, '').toLowerCase();

    async function load() {
      const [latestRes, archiveRes] = await Promise.all([fetch('/api/latest'), fetch('/api/archive')]);
      briefing = await latestRes.json();
      archive = await archiveRes.json();
      render();
    }

    function render() {
      $('status').textContent = briefing.updated_at ? '데이터 업데이트: ' + briefing.updated_at : '저장된 브리핑 없음';
      $('count-disclosures').textContent = todayDisclosures().length;
      $('count-news').textContent = todayNews().length;
      renderCategoryOptions();
      renderDisclosures();
      renderNews();
      renderArchive();
    }

    function todayKey() {
      return briefing.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    }

    function todayDisclosures() {
      const date = todayKey();
      return (briefing.disclosures || []).filter((item) => String(item.date || '').slice(0, 10) === date);
    }

    function todayNews() {
      const date = todayKey();
      return (briefing.news || []).filter((item) => String(item.published_at || '').slice(0, 10) === date);
    }

    function renderCategoryOptions() {
      const rows = state.tab === 'news' ? briefing.news || [] : state.tab === 'disclosures' ? briefing.disclosures || [] : [];
      const values = [...new Set(rows.map((item) => item.category).filter(Boolean))].sort();
      $('category').innerHTML = '<option value="">전체 카테고리</option>' + values.map((value) => '<option value="' + esc(value) + '" ' + (state.category === value ? 'selected' : '') + '>' + esc(value) + '</option>').join('');
    }

    function filtered(rows) {
      return rows.filter((item) => {
        const ai = itemAi(item);
        const haystack = text([item.company, item.category, item.title, item.summary, item.media, ai.summary, ai.key_points, ai.caution].join(' '));
        return (!state.company || item.company === state.company) && (!state.category || item.category === state.category) && (!state.search || haystack.includes(state.search));
      });
    }

    function renderDisclosures() {
      const rows = filtered(briefing.disclosures || []);
      $('disclosures').innerHTML = rows.length ? rows.map((item) => {
        const ai = itemAi(item);
        return '<article class="card"><div class="top"><div><span class="chip" style="background:' + esc(colors[item.company] || '#6f7f91') + '">' + esc(item.company) + '</span><span class="badge">' + esc(item.category || '기타') + '</span>' + (item.important ? '<span class="badge important">💡 공시 우선 확인</span>' : '') + '</div><div class="date">' + esc(item.date) + '</div></div><h2><a href="' + esc(item.link) + '" target="_blank" rel="noreferrer">' + esc(item.title) + '</a></h2>' + renderAiBlock(ai) + '</article>';
      }).join('') : '<div class="empty">조건에 맞는 공시가 없습니다.</div>';
    }

    function renderNews() {
      const rows = filtered(briefing.news || []);
      $('news').innerHTML = rows.length ? rows.map((item) => {
        const ai = itemAi(item);
        return '<article class="card"><div class="top"><div><span class="chip" style="background:' + esc(colors[item.company] || '#6f7f91') + '">' + esc(item.company) + '</span><span class="badge">' + esc(item.category || '일반뉴스') + '</span>' + (item.important ? '<span class="badge important">주요 뉴스</span>' : '') + '</div><div class="date">' + esc(item.published_at || '') + '</div></div><h2><a href="' + esc(item.link) + '" target="_blank" rel="noreferrer">' + esc(item.title) + '</a></h2>' + renderAiBlock(ai) + '<p class="body"><strong>기사 원문 일부</strong><br>' + esc(item.summary || '') + '</p></article>';
      }).join('') : '<div class="empty">조건에 맞는 뉴스가 없습니다.</div>';
    }

    function itemAi(item) {
      const type = item.type === 'disclosure' ? 'disclosure' : 'news';
      const id = type === 'disclosure' ? (item.receipt_no || (item.company + ':' + norm(item.title) + ':' + item.date)) : (item.company + ':' + norm(item.title));
      return briefing.item_summaries?.[type + ':' + id] || {};
    }

    function renderAiBlock(ai) {
      if (!ai || ai.generated_by !== 'gemini') return '';
      const lines = [ai.summary, ai.key_points, ai.caution].flatMap(aiLines).filter(Boolean).map(esc);
      return lines.length ? '<div class="point"><strong>AI 요약</strong><br>' + lines.join('<br>') + '</div>' : '';
    }

    function aiLines(value) {
      return String(value || '').replace(/<br\\s*\\/?>/gi, '\\n').split(/\\n+/).map((line) => line.trim()).filter(Boolean);
    }

    function renderArchive() {
      $('archive').innerHTML = archive.length ? archive.map((item) => '<article class="card archive-row"><div><h2>' + esc(item.date) + ' 브리핑</h2><p class="body">공시 ' + esc(item.disclosure_count) + '건 · 뉴스 ' + esc(item.news_count) + '건</p></div><button type="button" data-date="' + esc(item.date) + '">보기</button></article>').join('') : '<div class="empty">저장된 아카이브가 없습니다.</div>';
      document.querySelectorAll('[data-date]').forEach((button) => {
        button.onclick = () => showNewsletterArchive(button.dataset.date);
      });
    }

    async function showNewsletterArchive(date) {
      $('archive').innerHTML = '<div class="empty">뉴스레터를 불러오는 중...</div>';
      const response = await fetch('/api/archive/' + date);
      const data = await response.json();
      const html = data.newsletter?.html || '';
      if (!html) {
        $('archive').innerHTML = '<article class="card"><button type="button" id="archive-back">목록으로</button><div class="empty">저장된 뉴스레터 전문이 없습니다.</div></article>';
        $('archive-back').onclick = renderArchive;
        return;
      }
      $('archive').innerHTML = '<article class="card newsletter-view"><div class="top"><div><h2>' + esc(data.newsletter?.subject || date + ' 브리핑') + '</h2><p class="body">' + esc(data.updated_at || '') + ' 발송 뉴스레터</p></div><button type="button" id="archive-back">목록으로</button></div><iframe id="newsletter-frame" class="newsletter-frame" title="뉴스레터 전문"></iframe></article>';
      $('archive-back').onclick = renderArchive;
      $('newsletter-frame').srcdoc = html;
    }

    function setTab(tab) {
      state.tab = tab;
      state.category = '';
      document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === tab));
      renderCategoryOptions();
    }

    document.querySelectorAll('.tab').forEach((button) => button.onclick = () => { setTab(button.dataset.tab); render(); });
    $('company').onchange = (event) => { state.company = event.target.value; render(); };
    $('category').onchange = (event) => { state.category = event.target.value; render(); };
    $('search').oninput = (event) => { state.search = event.target.value.trim().toLowerCase(); render(); };
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'a') {
        const panel = $('admin-actions');
        panel.classList.toggle('open');
        panel.setAttribute('aria-hidden', panel.classList.contains('open') ? 'false' : 'true');
      }
    });
    $('summarize').onclick = async () => {
      const button = $('summarize');
      button.disabled = true;
      button.textContent = '요약 생성 중...';
      $('status').textContent = '요약 없는 최신 항목 10건을 AI가 정리하는 중입니다.';
      try {
        const password = prompt('업데이트 비밀번호를 입력해주세요.') || '';
        if (!password) throw new Error('업데이트 비밀번호가 입력되지 않았습니다.');
        const response = await fetch('/api/summarize-missing?limit=10', { method:'POST', headers:{ 'x-update-password': password } });
        if (response.status === 409) {
          alert('AI 요약 생성이 이미 진행 중입니다. 잠시 후 다시 확인해주세요.');
        } else if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          alert(errorBody.error || 'AI 요약 생성에 실패했습니다.');
        } else {
          const data = await response.json();
          await load();
          const geminiStatus = (data.diagnostics || []).filter((item) => item.step === 'gemini_item').map((item) => [item.status, item.code, item.reason].filter(Boolean).join(' / ')).join('\\n');
          if ((data.attempted || 0) === 0) {
            alert('AI 요약을 채울 항목이 없습니다.');
          } else if ((data.saved || 0) === 0) {
            alert('AI 요약 저장 0건입니다.\\n시도 항목: ' + (data.attempted || 0) + '건\\n' + (geminiStatus ? 'Gemini 상태:\\n' + geminiStatus : 'Gemini 응답 진단 정보가 없습니다.'));
          } else {
            alert('AI 요약 완료: ' + (data.saved || 0) + '건 저장, 남은 항목 ' + (data.remaining || 0) + '건');
          }
        }
      } catch (error) {
        alert(error.message || 'AI 요약 생성에 실패했습니다.');
      } finally {
        button.disabled = false;
        button.textContent = 'AI 요약 채우기';
        render();
      }
    };
    load().catch((error) => { $('status').textContent = '데이터를 불러오지 못했습니다.'; console.error(error); });
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
