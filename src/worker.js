import { ogData, shareText, renderOg } from './og.js';
import { normTag, battleTimeToMs, parseBattle, playerSnapshot, brawlerRow, sameFields, SNAPSHOT_KEYS, BRAWLER_KEYS } from './parse.js';

const HOUR = 3600_000;
const TPE = 8 * 3600; // 台北時區位移（秒），統計「幾點 / 哪天」用

// ---------- 官方 API ----------

async function api(env, path) {
  const base = env.API_BASE || 'https://bsproxy.royaleapi.dev/v1';
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${env.BS_TOKEN}`, Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${path} → HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function kvGet(db, k) {
  const r = await db.prepare('SELECT v, updated_at FROM kv WHERE k = ?').bind(k).first();
  return r ? { v: JSON.parse(r.v), at: r.updated_at } : null;
}
function kvPut(db, k, v, now) {
  return db.prepare('INSERT INTO kv (k, v, updated_at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at')
    .bind(k, JSON.stringify(v), now);
}
function insert(db, table, row, verb = 'INSERT') {
  const keys = Object.keys(row);
  return db.prepare(`${verb} INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).bind(...keys.map(k => row[k]));
}

// ---------- 排程：抓資料存進 D1 ----------

export async function collect(env, now = Date.now()) {
  const db = env.DB;
  const tag = normTag(env.PLAYER_TAG);
  const enc = encodeURIComponent('#' + tag);
  const stmts = [];
  let newBattles = 0;

  try {
    const [player, log] = await Promise.all([api(env, `/players/${enc}`), api(env, `/players/${enc}/battlelog`)]);
    stmts.push(kvPut(db, 'player', player, now));

    // 玩家快照：有變才記
    const snap = playerSnapshot(player);
    const last = await db.prepare('SELECT * FROM player_snapshots ORDER BY at DESC LIMIT 1').first();
    if (!sameFields(snap, last, SNAPSHOT_KEYS)) stmts.push(insert(db, 'player_snapshots', { at: now, ...snap }));

    // 英雄：有變才更新最新狀態並記一筆歷史
    const { results: prev } = await db.prepare('SELECT * FROM brawlers_latest').all();
    const prevById = new Map(prev.map(r => [r.brawler_id, r]));
    for (const b of player.brawlers || []) {
      const row = brawlerRow(b);
      const old = prevById.get(row.brawler_id);
      if (sameFields(row, old, BRAWLER_KEYS)) continue;
      const { brawler_id, name, ...rest } = row;
      stmts.push(insert(db, 'brawler_snapshots', { brawler_id, at: now, ...rest }));
      stmts.push(insert(db, 'brawlers_latest', { ...row, max_win_streak: b.maxWinStreak ?? null, updated_at: now, raw: JSON.stringify(b) }, 'INSERT OR REPLACE'));
    }

    // 戰鬥：只寫比資料庫裡最新一場還新的
    const maxRow = await db.prepare('SELECT MAX(battle_time) AS t FROM battles').first();
    const maxT = maxRow?.t || '';
    for (const item of log.items || []) {
      if (!item.battleTime || item.battleTime <= maxT) continue;
      const row = parseBattle(item, tag);
      if (!Number.isFinite(row.at)) continue;
      stmts.push(insert(db, 'battles', row, 'INSERT OR IGNORE'));
      newBattles++;
    }

    // 戰隊：每小時一次
    if (player.club?.tag) {
      const club = await kvGet(db, 'club');
      if (!club || now - club.at > HOUR || club.v.tag !== player.club.tag) {
        try { stmts.push(kvPut(db, 'club', await api(env, `/clubs/${encodeURIComponent(player.club.tag)}`), now)); } catch (e) { console.warn('club', e.message); }
      }
    }

    // 活動輪替：每小時一次
    const evState = await kvGet(db, 'events_fetched');
    if (!evState || now - evState.at > HOUR) {
      try {
        const rot = await api(env, '/events/rotation');
        stmts.push(kvPut(db, 'rotation', (rot || []).map(e => ({ event_id: e.event?.id, mode: e.event?.mode, map: e.event?.map, start: battleTimeToMs(e.startTime), end: battleTimeToMs(e.endTime) })), now));
        for (const e of rot || []) {
          stmts.push(insert(db, 'events', { event_id: e.event?.id, start_time: e.startTime, end_time: e.endTime, mode: e.event?.mode, map: e.event?.map, slot: e.slotId ?? null }, 'INSERT OR IGNORE'));
        }
        stmts.push(kvPut(db, 'events_fetched', 1, now));
      } catch (e) { console.warn('events', e.message); }
    }

    // 排行榜：每小時一次。官方只公開前 200 名
    const boardState = await kvGet(db, 'boards_fetched');
    if (!boardState || now - boardState.at > HOUR) {
      try {
        const slim = r => (r.items || []).map(p => ({ rank: p.rank, tag: normTag(p.tag), name: p.name, nameColor: p.nameColor, icon: p.icon, trophies: p.trophies, club: p.club?.name ? { name: p.club.name } : null }));
        const [tw, gl] = await Promise.all(['TW', 'global'].map(c => api(env, `/rankings/${c}/players?limit=200`)));
        stmts.push(kvPut(db, 'board_TW', { items: slim(tw) }, now), kvPut(db, 'board_global', { items: slim(gl) }, now));
        // 自己最高的 6 隻英雄：各自的台灣 / 全球榜門檻
        const top = [...(player.brawlers || [])].sort((a, b) => b.trophies - a.trophies).slice(0, 6);
        const boards = await Promise.all(top.map(async b => {
          const one = async c => {
            const items = (await api(env, `/rankings/${c}/brawlers/${b.id}?limit=200`)).items || [];
            const mine = items.find(p => normTag(p.tag) === tag);
            return { cut: items.at(-1)?.trophies ?? null, first: items[0]?.trophies ?? null, mine: mine?.rank ?? null };
          };
          const [TW, global] = await Promise.all([one('TW'), one('global')]);
          return { brawler_id: b.id, name: b.name, trophies: b.trophies, TW, global };
        }));
        stmts.push(kvPut(db, 'brawler_boards', boards, now), kvPut(db, 'boards_fetched', 1, now));
      } catch (e) { console.warn('rankings', e.message); }
    }

    // 英雄總表：每天一次（看還有哪些沒解鎖）
    const list = await kvGet(db, 'brawler_list');
    if (!list || now - list.at > 24 * HOUR) {
      try { stmts.push(kvPut(db, 'brawler_list', (await api(env, '/brawlers')).items || [], now)); } catch (e) { console.warn('brawlers', e.message); }
    }

    // 資料版本：除了一定會寫的 player 之外還有別的寫入，代表資料真的變了 → 換版本，前端的快取跟著失效
    if (stmts.length > 1) stmts.push(kvPut(db, 'version', now, now));
    stmts.push(kvPut(db, 'state', { ok: true, last_fetch_at: now, new_battles: newBattles }, now));
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));

    // 分享圖：有新戰鬥、或超過一小時就重畫
    const og = await db.prepare("SELECT updated_at FROM kv WHERE k = 'og'").first();
    if (newBattles || !og || now - og.updated_at > HOUR) {
      try { await saveOg(db, now, env.SITE); } catch (e) { console.warn('og', e.message); }
    }
    return { ok: true, newBattles };
  } catch (e) {
    console.error('collect', e.message);
    await kvPut(db, 'state', { ok: false, last_fetch_at: now, error: e.message }, now).run();
    return { ok: false, error: e.message };
  }
}

async function saveOg(db, now = Date.now(), site) {
  const d = await ogData(db);
  if (!d) return;
  const png = await renderOg({ ...d, site }, now);
  let bin = '';
  for (let i = 0; i < png.length; i += 0x8000) bin += String.fromCharCode(...png.subarray(i, i + 0x8000));
  // 分享文字另外存一筆小的：首頁只需要標題和描述，不用每次讀整張圖
  await db.batch([kvPut(db, 'og', { png: btoa(bin) }, now), kvPut(db, 'og_meta', shareText(d), now)]);
}

// ---------- 邊緣快取 ----------
// 前端的請求都帶 ?v=資料版本（排程抓到新資料才會變），同一版本的結果可以放心在 CDN 上存很久；
// 沒帶版本的（像 /api/init）只存幾十秒。
async function cached(req, ctx, ttl, browserTtl, make) {
  const cache = caches.default;
  const key = new Request(req.url, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await make();
  if (res.status !== 200) return res;
  const body = await res.arrayBuffer();
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', `public, max-age=${ttl}`);
  ctx.waitUntil(cache.put(key, new Response(body, { status: 200, headers })));
  headers.set('Cache-Control', `public, max-age=${browserTtl}`);
  return new Response(body, { status: 200, headers });
}

async function serveOg(env) {
  let og = await kvGet(env.DB, 'og');
  if (!og) { await saveOg(env.DB, Date.now(), env.SITE); og = await kvGet(env.DB, 'og'); }
  if (!og) return new Response('not ready', { status: 404 });
  const bytes = Uint8Array.from(atob(og.v.png), c => c.charCodeAt(0));
  return new Response(bytes, { headers: { 'Content-Type': 'image/png' } });
}

// 首頁：把最新數據塞進分享用的 meta（爬蟲不會跑 JS）
async function serveIndex(req, env) {
  const res = await env.ASSETS.fetch(new Request(new URL('/', req.url), req));
  const og = await kvGet(env.DB, 'og_meta');
  const t = og?.v || shareText(null);
  const url = new URL(req.url);
  const image = `${url.origin}/og.png?v=${og?.at || 0}`;
  const tags = [
    ['property', 'og:type', 'website'], ['property', 'og:site_name', '荒野戰績'], ['property', 'og:locale', 'zh_TW'],
    ['property', 'og:url', url.origin + '/'], ['property', 'og:title', t.title], ['property', 'og:description', t.desc],
    ['property', 'og:image', image], ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'], ['property', 'og:image:alt', t.desc],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', t.title], ['name', 'twitter:description', t.desc], ['name', 'twitter:image', image],
  ];
  const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const out = new HTMLRewriter()
    .on('title', { element: e => e.setInnerContent(t.title) })
    .on('meta[name="description"]', { element: e => e.setAttribute('content', t.desc) })
    .on('head', { element: e => e.append(tags.map(([k, n, v]) => `<meta ${k}="${n}" content="${attr(v)}">`).join(''), { html: true }) })
    .transform(res);
  const h = new Headers(out.headers);
  h.delete('ETag');
  return new Response(out.body, { status: out.status, headers: h });
}

// ---------- API ----------

function json(data, status = 200, maxAge = 30) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}` },
  });
}

function sinceFrom(url, now) {
  const days = Number(url.searchParams.get('days') || 0);
  return days > 0 ? now - days * 24 * HOUR : 0;
}

const WINS = `SUM(outcome = 'W') AS wins, SUM(outcome = 'L') AS losses, SUM(outcome = 'D') AS draws, COUNT(*) AS games, COALESCE(SUM(trophy_change), 0) AS trophy_change`;

async function stats(db, since) {
  const q = (sql, ...args) => db.prepare(sql).bind(since, ...args).all().then(r => r.results);
  const [overall] = await q(`SELECT ${WINS}, SUM(is_star_player) AS star_player, MIN(at) AS first_at, MAX(at) AS last_at FROM battles WHERE at >= ?`);
  const [byBrawler, byMode, byMap, byType, byHour, daily, teammates, byWeekHour] = await Promise.all([
    q(`SELECT brawler_id, MAX(brawler_name) AS name, ${WINS}, SUM(is_star_player) AS star_player FROM battles WHERE at >= ? AND brawler_id IS NOT NULL GROUP BY brawler_id ORDER BY games DESC`),
    q(`SELECT mode, ${WINS} FROM battles WHERE at >= ? GROUP BY mode ORDER BY games DESC`),
    q(`SELECT mode, map, MAX(event_id) AS event_id, ${WINS} FROM battles WHERE at >= ? AND map IS NOT NULL GROUP BY mode, map ORDER BY games DESC LIMIT 40`),
    q(`SELECT type, ${WINS} FROM battles WHERE at >= ? GROUP BY type ORDER BY games DESC`),
    q(`SELECT CAST(strftime('%H', at / 1000 + ${TPE}, 'unixepoch') AS INTEGER) AS hour, ${WINS} FROM battles WHERE at >= ? GROUP BY hour ORDER BY hour`),
    q(`SELECT date(at / 1000 + ${TPE}, 'unixepoch') AS day, ${WINS} FROM battles WHERE at >= ? GROUP BY day ORDER BY day`),
    q(`SELECT json_extract(t.value, '$.tag') AS tag, MAX(json_extract(t.value, '$.name')) AS name,
         COUNT(*) AS games, SUM(b.outcome = 'W') AS wins, SUM(b.outcome = 'L') AS losses
       FROM battles b, json_each(b.teammates) t WHERE b.at >= ?
       GROUP BY tag HAVING games >= 2 ORDER BY games DESC LIMIT 20`),
    // 星期（0 = 週日）× 小時，畫熱力圖
    q(`SELECT CAST(strftime('%w', at / 1000 + ${TPE}, 'unixepoch') AS INTEGER) AS dow, CAST(strftime('%H', at / 1000 + ${TPE}, 'unixepoch') AS INTEGER) AS hour, COUNT(*) AS games, SUM(outcome = 'W') AS wins FROM battles WHERE at >= ? GROUP BY dow, hour`),
  ]);
  // 最近 30 場的勝負（不受時間範圍影響），前端畫連勝 / 近況
  const { results: recent } = await db.prepare('SELECT outcome, trophy_change, brawler_id, mode FROM battles ORDER BY at DESC LIMIT 30').all();
  return { overall, byBrawler, byMode, byMap, byType, byHour, daily, teammates, byWeekHour, recent };
}

async function summaryData(db) {
  const [player, club, state, list, totals, firstSnap] = await Promise.all([
    kvGet(db, 'player'), kvGet(db, 'club'), kvGet(db, 'state'), kvGet(db, 'brawler_list'),
    db.prepare('SELECT COUNT(*) AS battles, MIN(at) AS first_at FROM battles').first(),
    db.prepare('SELECT MIN(at) AS at FROM player_snapshots').first(),
  ]);
  const p = player?.v || null;
  if (p) delete p.brawlers; // 英雄清單另外從 /api/brawlers 拿
  return {
    player: p, club: club?.v || null, state: state?.v || null,
    totals: { ...totals, tracking_since: firstSnap?.at || null },
    brawler_total: list?.v?.length || null,
  };
}

async function trophiesData(db, since) {
  const { results } = await db.prepare('SELECT at, trophies, highest_trophies, exp_level FROM player_snapshots WHERE at >= ? ORDER BY at').bind(since).all();
  return results;
}

async function battlesData(db, { limit = 30, before = 9e15, brawler, mode } = {}) {
  const where = ['at < ?'], args = [before];
  if (brawler) { where.push('brawler_id = ?'); args.push(Number(brawler)); }
  if (mode) { where.push('mode = ?'); args.push(mode); }
  const { results } = await db.prepare(
    `SELECT battle_time, at, event_id, mode, map, type, result, rank, outcome, trophy_change, duration, brawler_id, brawler_name, brawler_power, brawler_trophies, is_star_player, teammates, opponents
     FROM battles WHERE ${where.join(' AND ')} ORDER BY at DESC LIMIT ?`).bind(...args, Math.min(limit, 100)).all();
  for (const r of results) { r.teammates = JSON.parse(r.teammates || '[]'); r.opponents = JSON.parse(r.opponents || '[]'); }
  return results;
}

async function brawlersData(db) {
  const { results } = await db.prepare(
    `SELECT l.brawler_id, l.name, l.power, l.rank, l.trophies, l.highest_trophies, l.gadgets, l.star_powers, l.gears, l.prestige, l.max_win_streak, l.updated_at,
       COALESCE(json_array_length(json_extract(l.raw, '$.hyperCharges')), 0) AS hypercharges,
       s.games, s.wins, s.losses, s.trophy_change
     FROM brawlers_latest l
     LEFT JOIN (SELECT brawler_id, COUNT(*) AS games, SUM(outcome = 'W') AS wins, SUM(outcome = 'L') AS losses, SUM(trophy_change) AS trophy_change FROM battles GROUP BY brawler_id) s
       ON s.brawler_id = l.brawler_id
     ORDER BY l.trophies DESC`).all();
  return results;
}

async function handleApi(req, env, url) {
  const db = env.DB;
  const now = Date.now();
  const path = url.pathname.replace(/\/+$/, '');

  // 開頁面一次拿齊首頁要的東西，順便給前端資料版本號（之後的請求都帶著它，才能長時間快取）
  if (path === '/api/init') {
    const since = sinceFrom(url, now);
    const [version, summary, st, all, trophies, brawlers, latest] = await Promise.all([
      kvGet(db, 'version'), summaryData(db), stats(db, since), since ? stats(db, 0) : null,
      trophiesData(db, since), brawlersData(db), battlesData(db, { limit: 1 }),
    ]);
    return json({ version: version?.at || summary.state?.last_fetch_at || 0, summary, stats: st, all: all || st, trophies, brawlers, latest });
  }

  if (path === '/api/summary') return json(await summaryData(db));

  if (path === '/api/trophies') return json(await trophiesData(db, sinceFrom(url, now)));

  if (path === '/api/battles') {
    const q = url.searchParams;
    return json(await battlesData(db, { limit: Number(q.get('limit')) || 30, before: Number(q.get('before')) || 9e15, brawler: q.get('brawler'), mode: q.get('mode') }));
  }

  if (path === '/api/stats') return json(await stats(db, sinceFrom(url, now)));

  if (path === '/api/brawlers') return json(await brawlersData(db));

  const m = /^\/api\/brawler\/(\d+)$/.exec(path);
  if (m) {
    const id = Number(m[1]);
    const [latest, history, maps] = await Promise.all([
      db.prepare('SELECT brawler_id, name, power, rank, trophies, highest_trophies, gadgets, star_powers, gears, prestige, max_win_streak, raw FROM brawlers_latest WHERE brawler_id = ?').bind(id).first(),
      db.prepare('SELECT at, power, rank, trophies, highest_trophies, gadgets, star_powers, gears FROM brawler_snapshots WHERE brawler_id = ? ORDER BY at').bind(id).all(),
      db.prepare(`SELECT mode, map, MAX(event_id) AS event_id, ${WINS} FROM battles WHERE brawler_id = ? GROUP BY mode, map ORDER BY games DESC LIMIT 30`).bind(id).all(),
    ]);
    if (!latest) return json({ error: 'not found' }, 404);
    latest.raw = JSON.parse(latest.raw);
    return json({ latest, history: history.results, maps: maps.results });
  }

  // 巔峰威望：每 1,000 盃一級。升級時間從 brawler_snapshots 前後比對（LAG）推出來
  if (path === '/api/prestige') {
    const [player, list, ups, totals] = await Promise.all([
      kvGet(db, 'player'),
      db.prepare('SELECT brawler_id, name, trophies, highest_trophies, prestige, max_win_streak FROM brawlers_latest ORDER BY trophies DESC').all(),
      db.prepare(`SELECT s.brawler_id, l.name, s.at, s.prestige, s.trophies FROM (
          SELECT brawler_id, at, prestige, trophies, LAG(prestige) OVER (PARTITION BY brawler_id ORDER BY at) AS prev FROM brawler_snapshots
        ) s JOIN brawlers_latest l ON l.brawler_id = s.brawler_id
        WHERE s.prev IS NOT NULL AND s.prestige > s.prev ORDER BY s.at DESC LIMIT 50`).all(),
      db.prepare('SELECT at, total_prestige FROM player_snapshots WHERE total_prestige IS NOT NULL ORDER BY at').all(),
    ]);
    return json({ total: player?.v?.totalPrestigeLevel ?? null, brawlers: list.results, achieved: ups.results, history: totals.results });
  }

  if (path === '/api/rankings') {
    const [player, tw, gl, bb, rot, elo] = await Promise.all([
      kvGet(db, 'player'), kvGet(db, 'board_TW'), kvGet(db, 'board_global'), kvGet(db, 'brawler_boards'), kvGet(db, 'rotation'),
      db.prepare('SELECT at, ranked_elo FROM player_snapshots WHERE ranked_elo IS NOT NULL ORDER BY at').all(),
    ]);
    const p = player?.v || {};
    delete p.brawlers;
    p.tag = normTag(p.tag);
    // 目前輪替的地圖，配上自己在那張圖的歷史戰績
    const rotation = (rot?.v || []).filter(e => !e.end || e.end > now);
    if (rotation.length) {
      const ids = rotation.map(e => e.event_id).filter(Boolean);
      const { results } = await db.prepare(`SELECT event_id, ${WINS} FROM battles WHERE event_id IN (${ids.map(() => '?').join(',')}) GROUP BY event_id`).bind(...ids).all();
      const byId = new Map(results.map(r => [r.event_id, r]));
      for (const e of rotation) Object.assign(e, byId.get(e.event_id) || {});
    }
    return json({ player: p, boards: { TW: tw?.v, global: gl?.v }, boardsAt: tw?.at || null, brawlerBoards: bb?.v || [], rotation, elo: elo.results }, 200, 120);
  }

  if (path === '/api/events') {
    const { results } = await db.prepare('SELECT * FROM events ORDER BY start_time DESC LIMIT 60').all();
    return json(results, 200, 300);
  }

  // 手動更新：60 秒內抓過就不再抓，避免被狂按打爆 API 額度
  if (path === '/api/refresh' && req.method === 'POST') {
    const state = await kvGet(db, 'state');
    if (state && now - state.at < 60_000) return json({ ok: true, skipped: true, state: state.v }, 200, 0);
    return json(await collect(env, now), 200, 0);
  }

  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const versioned = url.searchParams.has('v');
    if (url.pathname === '/og.png') return cached(req, ctx, versioned ? 86400 : 600, versioned ? 86400 : 600, () => serveOg(env));
    if (url.pathname === '/' || url.pathname === '/index.html') return cached(req, ctx, 60, 0, () => serveIndex(req, env));
    if (url.pathname.startsWith('/api/')) {
      const run = async () => {
        try { return await handleApi(req, env, url); }
        catch (e) { console.error(e); return json({ error: 'internal error' }, 500, 0); }
      };
      // 手動更新不能快取；其餘 GET：有版本號存一天，沒有的存 30 秒
      if (req.method !== 'GET') return run();
      return cached(req, ctx, versioned ? 86400 : 30, versioned ? 3600 : 10, run);
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(collect(env));
  },
};
