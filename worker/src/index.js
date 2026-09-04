const DART_VIEWER_URL = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=";
const DART_LIST_URL = "https://opendart.fss.or.kr/api/list.json";
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
      return new Response("Not found", { status: 404 });
    } catch (error) {
      const status = error && error.status ? error.status : 500;
      return jsonResponse({ ok: false, error: String(error && error.message ? error.message : error) }, status);
    }
  },
};

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
  const analysis = added.disclosures || added.news ? await analyze(env, newDisclosures, newNews, diagnostics) : {};

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
  if (hasGeminiAnalysis(analysis)) {
    statements.push(env.DB.prepare("INSERT INTO ai_briefings (id, briefing_date, created_at, scope, payload_json) VALUES (?, ?, ?, ?, ?)")
      .bind(`ai:${now.toISOString()}`, kstDateKey(now), nowText, "manual_refresh_new_items", JSON.stringify({ analysis, disclosure_ids: newDisclosures.map(disclosureKey), news_ids: newNews.map(newsKey) })));
  }
  statements.push(env.DB.prepare("INSERT INTO refresh_runs (id, started_at, finished_at, disclosure_count, news_count, new_disclosure_count, new_news_count, diagnostics_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(runId, kstTimestamp(startedAt), nowText, collectedDisclosures.length, collectedNews.length, added.disclosures, added.news, JSON.stringify(diagnostics)));
  if (statements.length) await env.DB.batch(statements);

  const briefing = await latestBriefingFromD1(env, nowText, diagnostics);
  return jsonResponse({ ok: true, briefing, added });
}

async function latestBriefingFromD1(env, updatedAt = "", diagnostics = []) {
  const cutoff = kstTimestamp(addDays(new Date(), -RETENTION_DAYS));
  const disclosureRows = await env.DB.prepare("SELECT * FROM disclosures WHERE first_seen_at >= ? ORDER BY disclosure_date DESC, company ASC").bind(cutoff).all();
  const newsRows = await env.DB.prepare("SELECT * FROM news_articles WHERE first_seen_at >= ? ORDER BY published_at DESC, company ASC").bind(cutoff).all();
  const disclosures = (disclosureRows.results || []).map(disclosureFromDb);
  const news = (newsRows.results || []).map(newsFromDb);
  const analysis = await latestAnalysisFromD1(env);
  return {
    ok: true,
    date: kstDateKey(new Date()),
    updated_at: updatedAt || (await latestRefreshTime(env)) || "",
    disclosures,
    news,
    analysis,
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

async function latestAnalysisFromD1(env) {
  const rows = await env.DB.prepare("SELECT payload_json FROM ai_briefings ORDER BY created_at DESC LIMIT 20").all();
  const merged = {};
  for (const row of rows.results || []) {
    const payload = parseJson(row.payload_json, {});
    const analysis = payload.analysis || payload.companies || payload;
    for (const [company, item] of Object.entries(analysis || {})) {
      if (!merged[company] && item && item.generated_by === "gemini") merged[company] = item;
    }
  }
  return merged;
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

function hasGeminiAnalysis(analysis) {
  return Object.values(analysis || {}).some((item) => item && item.generated_by === "gemini");
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
    .summary { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:16px 0; }
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
        <button id="refresh" class="primary" type="button">업데이트</button>
      </div>
    </header>
    <section class="summary">
      <div class="metric">전체 공시<strong id="count-disclosures">0</strong></div>
      <div class="metric">전체 뉴스<strong id="count-news">0</strong></div>
      <div class="metric">중요 공시<strong id="count-important-disclosures">0</strong></div>
      <div class="metric">중요 뉴스<strong id="count-important-news">0</strong></div>
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

    async function load() {
      const [latestRes, archiveRes] = await Promise.all([fetch('/api/latest'), fetch('/api/archive')]);
      briefing = await latestRes.json();
      archive = await archiveRes.json();
      render();
    }

    function render() {
      $('status').textContent = briefing.updated_at ? '데이터 업데이트: ' + briefing.updated_at : '저장된 브리핑 없음';
      $('count-disclosures').textContent = briefing.summary?.disclosure_count ?? briefing.disclosures?.length ?? 0;
      $('count-news').textContent = briefing.summary?.news_count ?? briefing.news?.length ?? 0;
      $('count-important-disclosures').textContent = briefing.summary?.important_disclosure_count ?? 0;
      $('count-important-news').textContent = briefing.summary?.important_news_count ?? 0;
      renderCategoryOptions();
      renderDisclosures();
      renderNews();
      renderArchive();
    }

    function renderCategoryOptions() {
      const rows = state.tab === 'news' ? briefing.news || [] : state.tab === 'disclosures' ? briefing.disclosures || [] : [];
      const values = [...new Set(rows.map((item) => item.category).filter(Boolean))].sort();
      $('category').innerHTML = '<option value="">전체 카테고리</option>' + values.map((value) => '<option value="' + esc(value) + '" ' + (state.category === value ? 'selected' : '') + '>' + esc(value) + '</option>').join('');
    }

    function filtered(rows) {
      return rows.filter((item) => {
        const analysis = briefing.analysis?.[item.company] || {};
        const haystack = text([item.company, item.category, item.title, item.summary, item.media, analysis.today_summary, analysis.news_summary, analysis.important_point].join(' '));
        return (!state.company || item.company === state.company) && (!state.category || item.category === state.category) && (!state.search || haystack.includes(state.search));
      });
    }

    function renderDisclosures() {
      const rows = filtered(briefing.disclosures || []);
      $('disclosures').innerHTML = rows.length ? rows.map((item) => {
        const analysis = briefing.analysis?.[item.company] || {};
        return '<article class="card"><div class="top"><div><span class="chip" style="background:' + esc(colors[item.company] || '#6f7f91') + '">' + esc(item.company) + '</span><span class="badge">' + esc(item.category || '기타') + '</span>' + (item.important ? '<span class="badge important">💡 공시 우선 확인</span>' : '') + '</div><div class="date">' + esc(item.date) + '</div></div><h2><a href="' + esc(item.link) + '" target="_blank" rel="noreferrer">' + esc(item.title) + '</a></h2>' + renderAiBlock(analysis, 'disclosure') + '</article>';
      }).join('') : '<div class="empty">조건에 맞는 공시가 없습니다.</div>';
    }

    function renderNews() {
      const rows = filtered(briefing.news || []);
      $('news').innerHTML = rows.length ? rows.map((item) => {
        const analysis = briefing.analysis?.[item.company] || {};
        return '<article class="card"><div class="top"><div><span class="chip" style="background:' + esc(colors[item.company] || '#6f7f91') + '">' + esc(item.company) + '</span><span class="badge">' + esc(item.category || '일반뉴스') + '</span>' + (item.important ? '<span class="badge important">주요 뉴스</span>' : '') + '</div><div class="date">' + esc(item.published_at || '') + '</div></div><h2><a href="' + esc(item.link) + '" target="_blank" rel="noreferrer">' + esc(item.title) + '</a></h2>' + renderAiBlock(analysis, 'news') + '<p class="body"><strong>기사 주요 내용</strong><br>' + esc(item.summary || '') + '</p></article>';
      }).join('') : '<div class="empty">조건에 맞는 뉴스가 없습니다.</div>';
    }

    function renderAiBlock(analysis, type) {
      if (!analysis || analysis.generated_by !== 'gemini') return '';
      const first = type === 'news' ? (analysis.news_summary || analysis.today_summary || '') : (analysis.today_summary || '');
      const second = analysis.important_point || '';
      const content = [first, second].filter(Boolean).join('<br>');
      return content ? '<div class="point"><strong>AI 요약</strong><br>' + esc(content) + '</div>' : '';
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
    $('refresh').onclick = async () => {
      const button = $('refresh');
      button.disabled = true;
      button.textContent = '업데이트 중...';
      $('status').textContent = '새 데이터 확인 중... 기존 데이터는 그대로 유지됩니다.';
      try {
        const password = prompt('업데이트 비밀번호를 입력해주세요.') || '';
        if (!password) throw new Error('업데이트 비밀번호가 입력되지 않았습니다.');
        const response = await fetch('/api/refresh', { method:'POST', headers:{ 'x-update-password': password } });
        if (response.status === 409) {
          alert('이미 업데이트가 진행 중입니다. 잠시 후 다시 확인해주세요.');
        } else if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          alert(errorBody.error || '업데이트에 실패했습니다. 기존 데이터는 유지됩니다.');
        } else {
          const data = await response.json();
          await load();
          alert('업데이트 완료: 새 공시 ' + (data.added?.disclosures ?? 0) + '건, 새 뉴스 ' + (data.added?.news ?? 0) + '건 추가');
        }
      } catch (error) {
        alert(error.message || '업데이트에 실패했습니다. 기존 데이터는 유지됩니다.');
      } finally {
        button.disabled = false;
        button.textContent = '업데이트';
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
