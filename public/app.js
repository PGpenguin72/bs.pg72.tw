const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
// 遊戲裡的名字可以夾顏色標籤 <c0>…</c>，顯示前先拿掉
const esc = s => String(s ?? '').replace(/<\/?c\d*>/gi, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n ?? 0).toLocaleString('zh-TW');
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n ?? 0));
const pct = (w, g) => (g ? Math.round((w / g) * 100) : 0);
const wr = r => pct(r.wins || 0, (r.wins || 0) + (r.losses || 0));
const get = path => fetch(path).then(r => { if (!r.ok) throw new Error(`${path} ${r.status}`); return r.json(); });
const title = s => (s || '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());

// 圖片（Brawlify CDN）
const CDN = 'https://cdn.brawlify.com';
const icon = id => `${CDN}/brawlers/borderless/${id}.png`;
const model = id => `${CDN}/brawlers/model/${id}.png`;
const mapImg = id => (id ? `${CDN}/maps/regular/${id}.png` : '');
const img = (src, cls = '', alt = '') => src ? `<img class="${cls}" src="${src}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">` : '';
const TROPHY = '/trophy.svg';

const MODES = {
  gemGrab: ['寶石爭奪戰', '#bf5af2'], brawlBall: ['亂鬥足球', '#5e8bff'], heist: ['金庫攻防戰', '#ff6ad5'],
  bounty: ['賞金獵人', '#2fd9e8'], knockout: ['極限淘汰賽', '#ff9f0a'], hotZone: ['熱區爭奪戰', '#ff453a'],
  wipeout: ['殲滅戰', '#64d2ff'], soloShowdown: ['單人荒野決鬥', '#30d158'], duoShowdown: ['雙人荒野決鬥', '#30d158'],
  trioShowdown: ['三人荒野決鬥', '#30d158'], duels: ['決鬥', '#ff6b4a'], siege: ['機甲攻堅戰', '#ff8a3d'],
  basketBrawl: ['亂鬥籃球', '#ff9f0a'], volleyBrawl: ['亂鬥排球', '#ffd60a'], payload: ['推車大戰', '#ac8e68'],
  bossFight: ['魔王挑戰', '#ff375f'], roboRumble: ['機器人大亂鬥', '#ff375f'], bigGame: ['狩獵巨獸', '#ff375f'],
  hunters: ['獵人行動', '#5ac8fa'], presentPlunder: ['禮物大劫案', '#ff453a'], paintBrawl: ['亂鬥油漆戰', '#bf5af2'],
  trophyThieves: ['獎盃大盜', '#ffd60a'], brawlHockey: ['亂鬥冰球', '#64d2ff'], airHockey: ['空氣曲棍球', '#5ac8fa'], megaBoss: ['超級魔王戰', '#ff375f'],
};
const modeName = m => MODES[m]?.[0] || (m ? m.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()) : '未知模式');
const modeColor = m => MODES[m]?.[1] || '#8e8e93';
const TYPES = { ranked: '獎盃戰', soloRanked: '排位賽', teamRanked: '組隊排位賽', friendly: '友誼賽', challenge: '挑戰賽', championshipChallenge: '錦標賽' };
const PALETTE = ['#0a84ff', '#bf5af2', '#ff9f0a', '#30d158', '#ff375f', '#64d2ff', '#ffd60a', '#8e8e93'];
const brawlerColor = id => PALETTE[(Number(id) || 0) % (PALETTE.length - 1)];
const TPE = { timeZone: 'Asia/Taipei' };
const when = ms => new Date(ms).toLocaleString('zh-TW', { ...TPE, hour: '2-digit', minute: '2-digit', hour12: false });
const dayLabel = ms => new Date(ms).toLocaleDateString('zh-TW', { ...TPE, month: 'long', day: 'numeric', weekday: 'short' });
const shortDate = ms => new Date(ms).toLocaleDateString('zh-TW', { ...TPE, month: 'numeric', day: 'numeric' });
const ago = ms => {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return '剛剛';
  if (s < 3600) return `${Math.floor(s / 60)} 分鐘前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小時前`;
  return `${Math.floor(s / 86400)} 天前`;
};

// 巔峰威望：每 1,000 盃一級
const PRESTIGE_STEP = 1000;
const nextPrestige = b => ((b.prestige || 0) + 1) * PRESTIGE_STEP;
const prestigeProgress = b => Math.max(0, Math.min(1, (b.trophies - (b.prestige || 0) * PRESTIGE_STEP) / PRESTIGE_STEP));
let pbid = 0;
function prestigeBadge(level, size = 28) {
  const id = 'pb' + pbid++;
  const c = level >= 3 ? ['#ff6ad5', '#bf5af2'] : level === 2 ? ['#7fd4ff', '#0a84ff'] : level === 1 ? ['#ffe680', '#ff9f0a'] : ['#c7c7cc', '#8e8e93'];
  return `<svg class="pbadge" width="${size}" height="${size}" viewBox="0 0 40 40" aria-label="威望 ${level}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
    <path d="M20 2 35 10.5v19L20 38 5 29.5v-19z" fill="url(#${id})" stroke="rgb(255 255 255 / .7)" stroke-width="1.5"/>
    <path d="M20 6 31.5 12.5v15L20 34 8.5 27.5v-15z" fill="none" stroke="rgb(255 255 255 / .35)"/>
    <text x="20" y="25.5" text-anchor="middle" font-size="15" font-weight="900" fill="#fff" style="paint-order:stroke" stroke="rgb(0 0 0 / .25)" stroke-width="2">${level}</text></svg>`;
}

// 階級標籤：達成巔峰威望後，遊戲裡的「階 N」會變成「巔 N」
const tierLabel = b => (b.prestige > 0 ? `巔 ${b.prestige}` : `階 ${b.rank}`);

// 攻略連結：Fandom 英雄頁（名字含 & 的走 Wiki 搜尋）、中文攻略搜尋、YouTube 教學
function guideLinks(name) {
  const t = title(name);
  const fandom = /&/.test(t)
    ? `https://brawlstars.fandom.com/wiki/Special:Search?search=${encodeURIComponent(t)}&go=Go`
    : `https://brawlstars.fandom.com/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;
  const links = [
    ['📖', 'Fandom Wiki', '技能、數值、造型', fandom],
    ['🔎', '中文攻略', '搜尋荒野亂鬥攻略', `https://www.google.com/search?q=${encodeURIComponent(`荒野亂鬥 ${t} 攻略`)}`],
    ['▶️', 'YouTube 教學', '看高手怎麼玩', `https://www.youtube.com/results?search_query=${encodeURIComponent(`brawl stars ${t} guide`)}`],
  ];
  return `<div class="guides">${links.map(([ic, n, d, u]) => `<a class="guide" href="${u}" target="_blank" rel="noopener"><span class="gi">${ic}</span><span><b>${n}</b><small>${d}</small></span><span class="ga">↗</span></a>`).join('')}</div>`;
}

// ---------- 玻璃下拉選單：把原生 <select> 藏起來，值和 change 事件照舊走 select ----------
function glassSelect(sel) {
  const wrap = document.createElement('div');
  wrap.className = 'gsel';
  sel.classList.add('gs-native');
  sel.tabIndex = -1;
  sel.after(wrap);
  wrap.innerHTML = `<button type="button" class="gsel-btn glass" aria-haspopup="listbox" aria-expanded="false"><span class="gsel-ic"></span><span class="gsel-label"></span><svg class="gsel-chev" viewBox="0 0 12 8" width="12" height="8"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    <div class="gsel-scrim" hidden></div><div class="gsel-menu" role="listbox" hidden></div>`;
  const btn = wrap.querySelector('.gsel-btn'), menu = wrap.querySelector('.gsel-menu'), scrim = wrap.querySelector('.gsel-scrim');
  const iconOf = o => o.dataset.icon ? `<img src="${o.dataset.icon}" alt="" loading="lazy">` : o.dataset.color ? `<i class="dot" style="--mc:${o.dataset.color}"></i>` : '';
  const opts = () => [...menu.querySelectorAll('.gsel-opt')];
  const sync = () => {
    const o = sel.options[sel.selectedIndex];
    wrap.querySelector('.gsel-label').textContent = o ? o.text : '';
    wrap.querySelector('.gsel-ic').innerHTML = o ? iconOf(o) : '';
    opts().forEach(b => b.setAttribute('aria-selected', b.dataset.value === sel.value));
  };
  const render = () => {
    menu.innerHTML = [...sel.options].map(o => `<button type="button" role="option" class="gsel-opt" data-value="${esc(o.value)}">${iconOf(o)}<span>${esc(o.text)}</span><svg class="ck" viewBox="0 0 16 16" width="14" height="14"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`).join('');
    sync();
  };
  const outside = e => { if (!wrap.contains(e.target) || e.target === scrim) close(false); };
  function close(focus = true) {
    if (menu.hidden) return;
    menu.hidden = scrim.hidden = true; wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    if (focus) btn.focus();
  }
  const open = () => {
    menu.hidden = scrim.hidden = false; wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    // 靠右邊太近就往左展開
    wrap.classList.toggle('right', btn.getBoundingClientRect().left + 300 > innerWidth);
    const cur = opts().find(b => b.dataset.value === sel.value) || opts()[0];
    cur?.focus(); cur?.scrollIntoView({ block: 'nearest' });
    document.addEventListener('pointerdown', outside, true);
  };
  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  btn.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); open(); } });
  menu.addEventListener('click', e => {
    const b = e.target.closest('.gsel-opt'); if (!b) return;
    if (sel.value !== b.dataset.value) { sel.value = b.dataset.value; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    sync(); close();
  });
  menu.addEventListener('keydown', e => {
    const list = opts(), i = list.indexOf(document.activeElement);
    const go = j => { e.preventDefault(); list[Math.max(0, Math.min(list.length - 1, j))]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1); else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(list.length - 1);
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(); }
    else if (e.key.length === 1) { // 打字跳到開頭相符的選項
      const k = e.key.toLowerCase(), m = b => b.textContent.trim().toLowerCase().startsWith(k);
      const j = list.findIndex((b, x) => x > i && m(b));
      const j2 = j >= 0 ? j : list.findIndex(m);
      if (j2 >= 0) go(j2);
    }
  });
  new MutationObserver(render).observe(sel, { childList: true });
  sel.addEventListener('change', sync);
  render();
}

// 數字跑動畫
function countUp(el, to, { format = fmt, dur = 700 } = {}) {
  if (!el) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !Number.isFinite(to)) { el.textContent = format(to); return; }
  const from = Number(el.dataset.v) || 0, t0 = performance.now();
  el.dataset.v = to;
  const step = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = format(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// iOS 分段控制的滑塊
function placeThumb(seg) {
  const on = seg.querySelector('button.on'), th = seg.querySelector('.seg-thumb');
  if (!on || !th) return;
  // 直的（電腦側邊欄）和橫的（平板 / 手機）都適用
  th.style.width = on.offsetWidth + 'px';
  th.style.height = on.offsetHeight + 'px';
  th.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
}
addEventListener('resize', () => $$('.seg').forEach(placeThumb));
matchMedia('(max-width: 1199px)').addEventListener('change', () => requestAnimationFrame(() => $$('.seg').forEach(placeThumb)));

// ---------- 圖表：玻璃提示框 ----------

function attachTip(wrap, svg, points, render) {
  // points: [{x(px in viewBox), y, html}]，滑鼠移動時找最近的點
  const tip = document.createElement('div');
  tip.className = 'tip';
  wrap.append(tip);
  const line = svg.querySelector('.tip-line'), dot = svg.querySelector('.tip-dot');
  const vb = svg.viewBox.baseVal;
  const move = e => {
    const r = svg.getBoundingClientRect();
    const cx = ((e.touches?.[0]?.clientX ?? e.clientX) - r.left) / r.width * vb.width;
    let best = points[0];
    for (const p of points) if (Math.abs(p.x - cx) < Math.abs(best.x - cx)) best = p;
    tip.innerHTML = render(best);
    tip.style.left = (best.x / vb.width) * r.width + 'px';
    tip.style.top = (best.y / vb.height) * r.height + 'px';
    tip.classList.add('on');
    if (line) { line.setAttribute('x1', best.x); line.setAttribute('x2', best.x); line.style.opacity = 1; }
    if (dot) { dot.setAttribute('cx', best.x); dot.setAttribute('cy', best.y); dot.style.opacity = 1; }
  };
  const leave = () => { tip.classList.remove('on'); if (line) line.style.opacity = 0; if (dot) dot.style.opacity = 0; };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', leave);
}

let gid = 0;
function areaChart(el, pts, { h = 240, color = 'var(--accent)', label = p => fmt(p.y), sub = p => shortDate(p.x) } = {}) {
  if (pts.length < 2) { el.innerHTML = '<div class="empty">資料還不夠畫圖，多打幾場再來看 ✌️</div>'; return; }
  const w = 900, pad = { l: 48, r: 14, t: 14, b: 26 }, id = 'ag' + gid++;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 10; y1 += 10; }
  const sp = y1 - y0; y0 -= sp * .1; y1 += sp * .12;
  const X = x => pad.l + ((x - x0) / (x1 - x0 || 1)) * (w - pad.l - pad.r);
  const Y = y => pad.t + (1 - (y - y0) / (y1 - y0)) * (h - pad.t - pad.b);
  // 平滑曲線（單調 cubic，避免超出資料範圍）
  const P = pts.map(p => [X(p.x), Y(p.y)]);
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 1; i < P.length; i++) {
    const [ax, ay] = P[i - 1], [bx, by] = P[i], mx = (ax + bx) / 2;
    d += `C${mx},${ay} ${mx},${by} ${bx},${by}`;
  }
  const area = `${d}L${P.at(-1)[0]},${h - pad.b}L${P[0][0]},${h - pad.b}Z`;
  const ticks = [0, 1, 2, 3].map(i => y0 + ((y1 - y0) * i) / 3);
  const xt = [0, .25, .5, .75, 1].map(f => x0 + (x1 - x0) * f);
  el.innerHTML = `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" role="img">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
      <filter id="${id}g" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    ${ticks.map(t => `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${pad.l - 8}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
    ${xt.map((t, i) => `<text x="${X(t)}" y="${h - 6}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${x1 - x0 < 2 * 864e5 ? when(t) : shortDate(t)}</text>`).join('')}
    <path d="${area}" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="6" opacity=".45" filter="url(#${id}g)"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="${P.at(-1)[0]}" cy="${P.at(-1)[1]}" r="5" fill="${color}" stroke="#fff" stroke-width="2"/>
    <line class="tip-line" y1="${pad.t}" y2="${h - pad.b}" style="opacity:0"/>
    <circle class="tip-dot" r="6" fill="${color}" stroke="#fff" stroke-width="2.5" style="opacity:0"/>
    <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
  </svg></div>`;
  attachTip(el.firstChild, el.querySelector('svg'), pts.map((p, i) => ({ x: P[i][0], y: P[i][1], p })), ({ p }) => `${label(p)}<small>${sub(p)}</small>`);
}

function dailyChart(el, rows) {
  if (!rows.length) { el.innerHTML = '<div class="empty">這段時間沒有戰鬥</div>'; return; }
  const w = 900, h = 220, pad = { l: 34, r: 40, t: 14, b: 26 };
  const H = h - pad.t - pad.b, max = Math.max(...rows.map(r => r.games), 1);
  const bw = (w - pad.l - pad.r) / rows.length, every = Math.ceil(rows.length / 10);
  let cum = 0; const cums = rows.map(r => (cum += r.trophy_change || 0));
  const cmin = Math.min(0, ...cums), cmax = Math.max(0, ...cums), cs = cmax - cmin || 1;
  const CY = v => pad.t + (1 - (v - cmin) / cs) * H;
  const pts = [];
  const bars = rows.map((r, i) => {
    const bwi = Math.max(2, Math.min(56, bw * .64)), cx = pad.l + i * bw + bw / 2, x = cx - bwi / 2;
    const hl = ((r.losses || 0) / max) * H, hw = ((r.wins || 0) / max) * H;
    pts.push({ x: cx, y: CY(cums[i]), r, cum: cums[i] });
    const rx = Math.min(5, bwi / 2);
    return `<rect x="${x}" y="${pad.t + H - hw - hl}" width="${bwi}" height="${hl}" rx="${rx}" fill="var(--loss)" opacity=".75"/>
      <rect x="${x}" y="${pad.t + H - hw}" width="${bwi}" height="${hw}" rx="${rx}" fill="var(--win)"/>
      ${i % every === 0 ? `<text x="${cx}" y="${h - 6}" text-anchor="middle">${r.day.slice(5).replace('-', '/')}</text>` : ''}`;
  }).join('');
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('');
  el.innerHTML = `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}">
    <line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + H}" y2="${pad.t + H}"/>
    <line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t}" y2="${pad.t}"/>
    <text x="${pad.l - 8}" y="${pad.t + 4}" text-anchor="end">${max}</text>
    <text x="${w - pad.r + 6}" y="${CY(cmax) + 4}">${signed(cmax)}</text>
    <text x="${w - pad.r + 6}" y="${CY(cmin) + 4}">${signed(cmin)}</text>
    ${bars}
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.length < 40 ? pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--accent)"/>`).join('') : ''}
    <line class="tip-line" y1="${pad.t}" y2="${pad.t + H}" style="opacity:0"/>
    <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
  </svg></div>`;
  attachTip(el.firstChild, el.querySelector('svg'), pts, p => `${p.r.games} 場 · 勝率 ${wr(p.r)}%<small>${p.r.day.replace(/-/g, '/')} · 獎盃 ${signed(p.r.trophy_change)}（累計 ${signed(p.cum)}）</small>`);
}

function spark(values, color) {
  if (values.length < 2) return '';
  const w = 120, h = 34, mn = Math.min(...values), mx = Math.max(...values), s = mx - mn || 1;
  const P = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - mn) / s) * (h - 6)]);
  const d = P.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const id = 'sp' + gid++;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${d}L${w},${h}L0,${h}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function ringChart(el, o) {
  const decided = (o.wins || 0) + (o.losses || 0);
  const p = decided ? (o.wins / decided) : 0, R = 80, C = 2 * Math.PI * R, id = 'rg' + gid++;
  el.innerHTML = `<div class="ring"><svg viewBox="0 0 200 200">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5df58a"/><stop offset="1" stop-color="#0a84ff"/></linearGradient></defs>
      <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--raised)" stroke-width="18"/>
      <circle cx="100" cy="100" r="${R}" fill="none" stroke="color-mix(in srgb, var(--loss) 55%, transparent)" stroke-width="18" stroke-dasharray="${C}" transform="rotate(-90 100 100)" opacity="${decided ? 1 : 0}"/>
      <circle class="arc" cx="100" cy="100" r="${R}" fill="none" stroke="url(#${id})" stroke-width="18" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C}" transform="rotate(-90 100 100)" style="transition: stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1); filter: drop-shadow(0 0 8px rgb(48 209 88 / .5))"/>
    </svg>
    <div class="center"><div class="pct"><span id="ring-pct">0</span><small style="font-size:.45em">%</small></div><div class="sub">勝率</div></div></div>
    <div class="wl"><span class="w">${fmt(o.wins)} 勝</span><span class="l">${fmt(o.losses)} 敗</span>${o.draws ? `<span class="d">${fmt(o.draws)} 平</span>` : ''}</div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => { el.querySelector('.arc').style.strokeDashoffset = C * (1 - p); }));
  countUp($('#ring-pct'), Math.round(p * 100));
}

function donut(el, rows) {
  if (!rows.length) { el.innerHTML = '<div class="empty">沒有資料</div>'; return; }
  const total = rows.reduce((a, r) => a + r.games, 0);
  const top = rows.slice(0, 7), rest = rows.slice(7).reduce((a, r) => a + r.games, 0);
  const segs = top.map((r, i) => ({ ...r, color: PALETTE[i] }));
  if (rest) segs.push({ name: '其他', games: rest, color: PALETTE[7] });
  const R = 70, C = 2 * Math.PI * R; let off = 0;
  const arcs = segs.map(s => {
    const len = (s.games / total) * C, gap = segs.length > 1 ? 3 : 0;
    const a = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${s.color}" stroke-width="22" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"><title>${esc(title(s.name))} ${s.games} 場</title></circle>`;
    off += len; return a;
  }).join('');
  el.innerHTML = `<div class="donut"><svg viewBox="0 0 180 180">${arcs}</svg><div class="c"><b>${segs.length - (rest ? 1 : 0)}${rest ? '+' : ''}</b><small>隻英雄</small></div></div>
    <ul>${segs.map(s => `<li><span class="sw" style="background:${s.color}"></span>${s.brawler_id ? img(icon(s.brawler_id)) : '<span></span>'}<span>${esc(title(s.name))}</span><span>${pct(s.games, total)}%</span></li>`).join('')}</ul>`;
}

function heatmap(el, cells) {
  const map = new Map(cells.map(c => [`${c.dow}-${c.hour}`, c]));
  const max = Math.max(1, ...cells.map(c => c.games));
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  let html = '<span></span>' + Array.from({ length: 24 }, (_, h) => `<span class="hl">${h % 3 === 0 ? h : ''}</span>`).join('');
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    html += `<span class="lbl">${days[d]}</span>`;
    for (let h = 0; h < 24; h++) {
      const c = map.get(`${d}-${h}`);
      const a = c ? 0.15 + 0.85 * (c.games / max) : 0;
      html += `<span class="cell" ${c ? `style="background: color-mix(in srgb, var(--blue) ${Math.round(a * 100)}%, var(--raised))" title="週${days[d]} ${h}:00 · ${c.games} 場 · 勝率 ${pct(c.wins, c.games)}%"` : `title="週${days[d]} ${h}:00 · 0 場"`}></span>`;
    }
  }
  el.innerHTML = html;
}

// ---------- 個人資料 ----------

// 導覽列右側的小數字
const setNav = (tab, html) => { const el = document.querySelector(`[data-nv="${tab}"]`); if (el) el.innerHTML = html; };

let summary = null;
async function loadSummary() {
  summary = await get('/api/summary');
  const p = summary.player;
  if (!p) { $('#name').textContent = '還沒有資料'; $('#tag').textContent = '等第一次排程抓完（最多 10 分鐘）'; return; }
  $('#name').textContent = p.name;
  document.title = `${p.name} · 荒野戰績`;
  $('#tag').textContent = p.tag;
  if (p.club?.name) { $('#club').textContent = '🛡️ ' + p.club.name.replace(/<\/?c\d*>/gi, ''); $('#club').hidden = false; }
  if (p.icon?.id) { const a = $('#avatar'); a.onerror = () => (a.hidden = true); a.src = `${CDN}/profile-icons/regular/${p.icon.id}.png`; a.hidden = false; }
  countUp($('#trophies'), p.trophies);
  $('#highest').textContent = `歷史最高 ${fmt(p.highestTrophies)} · 等級 ${fmt(p.expLevel)}`;
  const st = summary.state, up = $('#updated');
  up.textContent = st ? (st.ok ? `更新於 ${ago(st.last_fetch_at)}` : `上次更新失敗 · ${ago(st.last_fetch_at)}`) : '';
  up.classList.toggle('err', !!st && !st.ok);
  up.title = st?.error || '';
  const stat = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;
  $('#profile').innerHTML = stat(fmt(p['3vs3Victories']), '3v3 勝場') + stat(fmt(p.soloVictories), '單人勝場') + stat(fmt(p.duoVictories), '雙人勝場');
  setNav('battles', `${fmt(summary.totals.battles)} 場`);
  setNav('prestige', `${prestigeBadge(p.totalPrestigeLevel || 0, 16)}${fmt(p.totalPrestigeLevel)}`);
  setNav('ranking', esc(rankName(p.rankedRankName)));
}

function setBackdrop(topBrawler, lastMapId) {
  const set = (el, src) => { if (!src || el.dataset.src === src) return; el.dataset.src = src; el.classList.remove('on'); el.onload = () => el.classList.add('on'); el.src = src; };
  if (topBrawler) {
    $('.pcard').style.setProperty('--hc', brawlerColor(topBrawler));
    set($('#bg-brawler'), model(topBrawler));
    const h = $('#hero-brawler'); h.onerror = () => (h.hidden = true); h.onload = () => (h.hidden = false); h.src = model(topBrawler);
  }
  if (lastMapId) set($('#bg-map'), mapImg(lastMapId));
}

// ---------- 總覽 ----------

let days = 7;
async function loadOverview() {
  const [s, t] = await Promise.all([get(`/api/stats?days=${days}`), get(`/api/trophies?days=${days}`)]);
  const o = s.overall || {};

  ringChart($('#ring'), o);
  const kpi = (el, ic, label, hint, sparkHtml = '') => {
    el.innerHTML = `<div class="top"><span class="ic">${ic}</span>${label}</div><div class="v"></div><div class="h">${hint}</div>${sparkHtml ? `<div class="spark">${sparkHtml}</div>` : ''}`;
    return el.querySelector('.v');
  };
  let cum = 0;
  const cumTrophy = s.daily.map(d => (cum += d.trophy_change || 0));
  countUp(kpi($('#k-games'), '⚔️', '場數', s.daily.length ? `平均每天 ${fmt((o.games || 0) / s.daily.length)} 場` : '', spark(s.daily.map(d => d.games), 'var(--blue)')), o.games || 0);
  const kt = kpi($('#k-trophy'), '<img src="/trophy.svg" width="16" height="16" alt="">', '獎盃變化', '這段時間淨賺', spark(cumTrophy, o.trophy_change >= 0 ? 'var(--win)' : 'var(--loss)'));
  kt.className = 'v ' + (o.trophy_change > 0 ? 'pos' : o.trophy_change < 0 ? 'neg' : '');
  countUp(kt, o.trophy_change || 0, { format: signed });
  countUp(kpi($('#k-star'), '⭐', '明星玩家', o.games ? `${pct(o.star_player, o.games)}% 的場次` : ''), o.star_player || 0);

  // 連勝 / 連敗（從最新一場往回數）
  const rec = s.recent || [];
  let streak = 0; const first = rec.find(r => r.outcome === 'W' || r.outcome === 'L')?.outcome;
  for (const r of rec) { if (r.outcome === first) streak++; else if (r.outcome === 'W' || r.outcome === 'L') break; }
  let best = 0, curW = 0;
  for (const r of [...rec].reverse()) { curW = r.outcome === 'W' ? curW + 1 : r.outcome === 'L' ? 0 : curW; best = Math.max(best, curW); }
  const ks = kpi($('#k-streak'), first === 'L' ? '🧊' : '🔥', first === 'L' ? '目前連敗' : '目前連勝', `最近 30 場最長連勝 ${best}`);
  ks.className = 'v ' + (first === 'L' ? 'neg' : 'pos');
  countUp(ks, streak);

  $('#form').innerHTML = rec.length
    ? [...rec].reverse().map(r => `<div class="fdot ${r.outcome || 'N'}" title="${esc(modeName(r.mode))} · ${r.outcome === 'W' ? '勝' : r.outcome === 'L' ? '敗' : '—'} ${r.trophy_change != null ? signed(r.trophy_change) : ''}">${img(icon(r.brawler_id))}<i></i></div>`).join('')
    : '<div class="empty" style="grid-column:1/-1">還沒有戰鬥紀錄</div>';
  const rw = rec.filter(r => r.outcome === 'W').length, rl = rec.filter(r => r.outcome === 'L').length;
  $('#form-hint').textContent = rec.length ? `${rw} 勝 ${rl} 敗 · 左舊右新` : '';

  let tp = t.map(r => ({ x: r.at, y: r.trophies }));
  if (tp.length < 2 && summary?.player) {
    const since = days > 0 ? Date.now() - days * 864e5 : 0;
    const bs = (await get('/api/battles?limit=100')).filter(b => b.at >= since && b.trophy_change != null);
    let y = summary.player.trophies;
    tp = [{ x: Date.now(), y }];
    for (const b of bs) { tp.push({ x: b.at, y }); y -= b.trophy_change; }
    tp.reverse();
    if (bs.length) tp.unshift({ x: bs.at(-1).at - 60e3, y });
  }
  areaChart($('#trophy-chart'), tp, { label: p => `🏆 ${fmt(p.y)}`, sub: p => new Date(p.x).toLocaleString('zh-TW', { ...TPE, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) });
  $('#trophy-hint').textContent = tp.length > 1 ? `${signed(tp.at(-1).y - tp[0].y)} · 最低 ${fmt(Math.min(...tp.map(p => p.y)))} / 最高 ${fmt(Math.max(...tp.map(p => p.y)))}` : '';

  lastStats = s;
  renderMains();

  donut($('#usage'), s.byBrawler);

  $('#by-mode').innerHTML = s.byMode.length ? s.byMode.map(m => `<div class="hbar" style="--mc:${modeColor(m.mode)}">
      <div class="lab"><span><i class="mode-dot"></i>${esc(modeName(m.mode))}</span><span>${m.games} 場 · ${wr(m)}%</span></div>
      <div class="track"><div class="fill" data-w="${wr(m)}"></div></div></div>`).join('') : '<div class="empty">沒有資料</div>';
  requestAnimationFrame(() => requestAnimationFrame(() => $$('#by-mode .fill').forEach(f => (f.style.width = f.dataset.w + '%'))));

  dailyChart($('#daily-chart'), s.daily);
  heatmap($('#heatmap'), s.byWeekHour || []);

  $('#by-brawler').innerHTML = s.byBrawler.length ? `<div class="row head"><span></span><span>英雄</span><span class="r g">場數</span><span>勝率</span><span class="r">獎盃</span><span class="r s">明星</span></div>` +
    s.byBrawler.map(b => `<div class="row"><img src="${icon(b.brawler_id)}" alt="" loading="lazy"><span class="n">${esc(title(b.name))}</span><span class="r g">${b.games}</span>
      <span class="wbar"><span class="track"><span class="fill" style="display:block;width:${wr(b)}%"></span></span><span>${wr(b)}%</span></span>
      <span class="r ${b.trophy_change > 0 ? 'pos' : b.trophy_change < 0 ? 'neg' : ''}">${signed(b.trophy_change)}</span><span class="r s">${b.star_player || 0}⭐</span></div>`).join('')
    : '<div class="empty">沒有資料</div>';

  $('#by-map').innerHTML = s.byMap.slice(0, 8).map(m => `<div class="map-card" style="--mc:${modeColor(m.mode)}">
      ${img(mapImg(m.event_id))}
      <div class="cap"><div class="mn">${esc(m.map)}</div><div class="ms"><span>${esc(modeName(m.mode))}</span><span>${m.games} 場 · ${wr(m)}%</span></div></div>
    </div>`).join('') || '<div class="empty">沒有資料</div>';

  const grads = [['#ff9f0a', '#ff375f'], ['#0a84ff', '#5e5ce6'], ['#30d158', '#0a84ff'], ['#bf5af2', '#ff375f'], ['#64d2ff', '#30d158']];
  $('#teammates').innerHTML = s.teammates.map((m, i) => `<div class="mate">
      <span class="ini" style="--a:${grads[i % 5][0]};--b:${grads[i % 5][1]}">${esc([...(m.name || '?')][0])}</span>
      <span><div class="mn">${esc(m.name)}</div><div class="tg">#${esc(m.tag)}</div></span>
      <span class="num">${wr(m)}%<small>一起 ${m.games} 場</small></span></div>`).join('') || '<div class="empty">還沒有固定隊友</div>';

  return s;
}

// 主力英雄：獎盃最高的三隻（不是最常用），附上目前時間範圍內的戰績
let lastStats = null;
function renderMains() {
  if (!brawlers.length) return;
  const range = new Map((lastStats?.byBrawler || []).map(b => [b.brawler_id, b]));
  const top = [...brawlers].sort((a, b) => b.trophies - a.trophies).slice(0, 3);
  $('#mains').innerHTML = top.map((b, i) => {
    const r = range.get(b.brawler_id);
    return `<div class="main-card fade-in" data-id="${b.brawler_id}" style="--mc:${PALETTE[i]};animation-delay:${i * 80}ms">
      ${img(model(b.brawler_id))}
      <div class="no">#${i + 1} 獎盃最高 ${b.prestige ? `<span class="pk">${tierLabel(b)}</span>` : ''}</div>
      <div class="nm">${esc(title(b.name))}</div>
      <div class="st"><span><b>🏆 ${fmt(b.trophies)}</b></span>${r ? `<span>${r.games} 場 · 勝率 <b>${wr(r)}%</b></span>` : '<span>這段時間沒打</span>'}</div>
    </div>`;
  }).join('') || '<div class="empty">還沒有資料</div>';
}

// ---------- 戰鬥紀錄 ----------

let cursor = null, lastDay = '';
function battleItem(b) {
  const o = b.outcome || 'N';
  const res = b.rank != null ? `第 ${b.rank} 名` : { W: '勝利', L: '落敗', D: '平手' }[o] || '—';
  const self = { brawler: { id: b.brawler_id, name: b.brawler_name } };
  const face = (p, me) => p.brawler ? `<img class="${me ? 'self' : ''}" src="${icon(p.brawler.id)}" alt="" title="${esc(p.name || '我')}（${esc(title(p.brawler.name))}）" loading="lazy" onerror="this.style.visibility='hidden'">` : '';
  const foes = b.opponents.slice(0, 9);
  const day = dayLabel(b.at);
  const sep = day !== lastDay ? `<li class="day-sep">${day}</li>` : '';
  lastDay = day;
  return `${sep}<li class="battle glass ${o} fade-in" style="--mc:${modeColor(b.mode)}">
    <div class="pic">${img(mapImg(b.event_id), 'mapimg')}<img class="me" src="${icon(b.brawler_id)}" alt="" onerror="this.style.visibility='hidden'"><span class="pw">${b.brawler_power ?? '?'}</span></div>
    <div class="body">
      <div class="top">
        <span class="res">${res}</span>
        ${b.is_star_player ? '<span class="badge">⭐ 明星玩家</span>' : ''}
        <span class="tc ${b.trophy_change > 0 ? 'pos' : b.trophy_change < 0 ? 'neg' : ''}">${b.trophy_change != null ? `${signed(b.trophy_change)}<img src="${TROPHY}" alt="">` : ''}</span>
      </div>
      <div class="meta"><i class="mode-dot"></i><b>${esc(modeName(b.mode))}</b>${b.map ? ` · ${esc(b.map)}` : ''} · ${when(b.at)}${b.duration ? ` · ${Math.floor(b.duration / 60)}:${String(b.duration % 60).padStart(2, '0')}` : ''} · ${esc(TYPES[b.type] || b.type || '')}</div>
      <div class="teams">
        <span class="team mine">${face(self, true)}${b.teammates.map(p => face(p)).join('')}</span>
        ${foes.length ? `<span class="vs">VS</span><span class="team foe">${foes.map(p => face(p)).join('')}${b.opponents.length > 9 ? `<span class="hint">+${b.opponents.length - 9}</span>` : ''}</span>` : ''}
      </div>
    </div>
  </li>`;
}
async function loadBattles(reset) {
  if (reset) { cursor = null; lastDay = ''; $('#battle-list').innerHTML = ''; }
  const q = new URLSearchParams({ limit: 30 });
  if (cursor) q.set('before', cursor);
  if ($('#f-brawler').value) q.set('brawler', $('#f-brawler').value);
  if ($('#f-mode').value) q.set('mode', $('#f-mode').value);
  const rows = await get('/api/battles?' + q);
  if (reset && !rows.length) $('#battle-list').innerHTML = '<li class="empty">沒有符合的戰鬥</li>';
  $('#battle-list').insertAdjacentHTML('beforeend', rows.map(battleItem).join(''));
  cursor = rows.at(-1)?.at ?? cursor;
  $('#more').hidden = rows.length < 30;
  return rows;
}

// ---------- 英雄 ----------

let brawlers = [];
function renderBrawlers() {
  const k = $('#b-sort').value;
  const sorted = [...brawlers].sort((a, b) =>
    k === 'name' ? a.name.localeCompare(b.name)
      : k === 'winrate' ? (wr(b) - wr(a)) || ((b.games || 0) - (a.games || 0))
        : k === 'next' ? (nextPrestige(a) - a.trophies) - (nextPrestige(b) - b.trophies)
          : ((b[k] || 0) - (a[k] || 0)) || (b.trophies - a.trophies));
  $('#brawler-grid').innerHTML = sorted.map(b => `<button class="bcard glass" data-id="${b.brawler_id}" style="--mc:${brawlerColor(b.brawler_id)}">
    <div class="art">${img(model(b.brawler_id))}<span class="pw">${b.power}</span><span class="rk ${b.prestige ? 'pk' : ''}">${tierLabel(b)}</span></div>
    <div class="foot">
      <div class="nm">${esc(title(b.name))}${b.prestige ? prestigeBadge(b.prestige, 18) : ''}</div>
      <div class="tr"><img src="${TROPHY}" alt="">${fmt(b.trophies)}<small>最高 ${fmt(b.highest_trophies)}</small></div>
      <div class="gm">${b.games ? `${b.games} 場 · 勝率 ${wr(b)}%` : '還沒有戰鬥紀錄'}${b.max_win_streak ? ` · 🔥${b.max_win_streak}` : ''}</div>
      <div class="pprog" title="威望 ${(b.prestige || 0) + 1}：還差 ${fmt(nextPrestige(b) - b.trophies)} 盃"><i style="width:${prestigeProgress(b) * 100}%"></i></div>
      <div class="gm">威望 ${(b.prestige || 0) + 1} 還差 ${fmt(nextPrestige(b) - b.trophies)} 盃</div>
    </div></button>`).join('');
}
async function loadBrawlers() {
  brawlers = await get('/api/brawlers');
  const total = summary?.brawler_total;
  $('#brawler-note').textContent = `已解鎖 ${brawlers.length}${total ? ` / ${total}` : ''} 隻 · 點卡片看詳細`;
  setNav('brawlers', `${brawlers.length}${total ? ` / ${total}` : ''}`);
  renderBrawlers();
  renderMains();
  $('#f-brawler').innerHTML = '<option value="">全部英雄</option>' + [...brawlers].sort((a, b) => a.name.localeCompare(b.name))
    .map(b => `<option value="${b.brawler_id}" data-icon="${icon(b.brawler_id)}">${esc(title(b.name))}</option>`).join('');
  // 收藏進度
  const sum = k => brawlers.reduce((a, b) => a + (b[k] || 0), 0);
  const item = (ic, l, v, of) => `<div class="cstat"><span class="ci">${ic}</span><span><small>${l}</small><b>${fmt(v)}${of ? `<i> / ${fmt(of)}</i>` : ''}</b></span></div>`;
  $('#collection').innerHTML = [
    item('🦸', '英雄', brawlers.length, total),
    item('🛠️', '道具', sum('gadgets')), item('⭐', '星能力', sum('star_powers')),
    item('⚙️', '裝備', sum('gears')), item('⚡', '極限充能', sum('hypercharges')),
    item(prestigeBadge(1, 22), '威望英雄', brawlers.filter(b => b.prestige > 0).length),
  ].join('');
}

async function openBrawler(id) {
  const d = await get(`/api/brawler/${id}`);
  const l = d.latest, raw = l.raw || {};
  const gear = (arr, label) => arr?.length ? `<div class="gear-list"><b>${label}</b>${arr.map(x => `<span>${esc(title(x.name))}</span>`).join('')}</div>` : '';
  const games = d.maps.reduce((a, m) => a + m.games, 0), wins = d.maps.reduce((a, m) => a + (m.wins || 0), 0), losses = d.maps.reduce((a, m) => a + (m.losses || 0), 0);
  $('#brawler-detail').innerHTML = `
    <div class="dhead" style="--mc:${brawlerColor(l.brawler_id)}">${img(model(l.brawler_id))}
      <h3>${esc(title(l.name))}</h3>
      <div class="pl">
        <span class="chip">🏆 ${fmt(l.trophies)}（最高 ${fmt(l.highest_trophies)}）</span>
        ${l.prestige ? `<span class="chip pchip">${prestigeBadge(l.prestige, 16)} 威望 ${l.prestige}</span>` : ''}
        <span class="chip">等級 ${l.power}</span><span class="chip ${l.prestige ? 'pk' : ''}">${tierLabel(l)}</span>
        ${l.max_win_streak ? `<span class="chip">🔥 最高 ${l.max_win_streak} 連勝</span>` : ''}
        ${games ? `<span class="chip">${games} 場 · 勝率 ${pct(wins, wins + losses)}%</span>` : ''}
      </div>
    </div>
    <div class="dbody">
      <div class="full"><div class="card-head"><h2>攻略</h2></div>${guideLinks(l.name)}</div>
      <div class="full"><div class="card-head"><h2>巔峰威望 ${(l.prestige || 0) + 1}</h2><span class="hint">${fmt(l.trophies)} / ${fmt(nextPrestige(l))} · 還差 ${fmt(nextPrestige(l) - l.trophies)} 盃</span></div><div class="pprog big"><i style="width:${prestigeProgress(l) * 100}%"></i></div></div>
      ${gear(raw.gadgets, '道具')}${gear(raw.starPowers, '星能力')}${gear(raw.gears, '裝備')}${gear(raw.hyperCharges, '極限充能')}
      <div class="full"><div class="card-head"><h2>獎盃走勢</h2></div><div id="bd-chart" class="chart"></div></div>
      ${d.maps.length ? `<div class="full"><div class="card-head"><h2>地圖表現</h2></div><div class="map-grid">${d.maps.slice(0, 6).map(m => `<div class="map-card" style="--mc:${modeColor(m.mode)}">${img(mapImg(m.event_id))}<div class="cap"><div class="mn">${esc(m.map || modeName(m.mode))}</div><div class="ms"><span>${esc(modeName(m.mode))}</span><span>${m.games} 場 · ${wr(m)}%</span></div></div></div>`).join('')}</div></div>` : ''}
    </div>`;
  $('#brawler-dialog').showModal();
  areaChart($('#bd-chart'), d.history.map(r => ({ x: r.at, y: r.trophies })), { h: 200, color: brawlerColor(l.brawler_id) });
}

// ---------- 巔峰威望 ----------

function ringSvg(v, size = 120, grad = ['#ffe680', '#ff9f0a']) {
  const R = 52, C = 2 * Math.PI * R, id = 'rs' + gid++;
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${grad[0]}"/><stop offset="1" stop-color="${grad[1]}"/></linearGradient></defs>
    <circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--raised)" stroke-width="10"/>
    <circle cx="60" cy="60" r="${R}" fill="none" stroke="url(#${id})" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - v)}" transform="rotate(-90 60 60)"/></svg>`;
}

async function loadPrestige() {
  const p = await get('/api/prestige');
  const list = p.brawlers || [];
  const done = list.filter(b => b.prestige > 0);
  const total = p.total ?? done.reduce((a, b) => a + b.prestige, 0);
  const sumT = list.reduce((a, b) => a + (b.trophies || 0), 0);

  $('#p-total').innerHTML = `<div class="pt-badge">${prestigeBadge(total > 0 ? 1 : 0, 96)}</div>
    <div class="pt-body"><div class="hint">總巔峰威望</div><div class="pt-num" id="pt-num">0</div>
    <div class="pt-sub"><span><b>${done.length}</b> / ${list.length} 隻英雄達成</span><span>英雄獎盃合計 <b>${fmt(sumT)}</b></span></div></div>`;
  countUp($('#pt-num'), total || 0);

  const cand = [...list].sort((a, b) => (nextPrestige(a) - a.trophies) - (nextPrestige(b) - b.trophies));
  const n = cand[0];
  $('#p-next').innerHTML = n ? `<div class="hint">下一個升威望</div>
    <div class="pn-row"><div class="pn-ring">${ringSvg(prestigeProgress(n))}<img src="${icon(n.brawler_id)}" alt=""></div>
    <div><div class="pn-name">${esc(title(n.name))}</div><div class="pn-need">還差 <b>${fmt(nextPrestige(n) - n.trophies)}</b> 盃</div>
    <div class="hint">${fmt(n.trophies)} → ${fmt(nextPrestige(n))} · 威望 ${(n.prestige || 0) + 1}</div></div></div>` : '<div class="empty">沒有資料</div>';

  $('#p-near').innerHTML = cand.slice(0, 8).map(b => `<button class="near" data-id="${b.brawler_id}">
      <img src="${icon(b.brawler_id)}" alt="" loading="lazy">
      <span class="nm">${esc(title(b.name))}${b.prestige ? prestigeBadge(b.prestige, 18) : ''}</span>
      <span class="pprog"><i style="width:${prestigeProgress(b) * 100}%"></i></span>
      <span class="need">差 ${fmt(nextPrestige(b) - b.trophies)}</span></button>`).join('');

  $('#p-wall-hint').textContent = done.length ? `${done.length} 隻` : '';
  $('#p-wall').innerHTML = done.length ? done.map(b => `<button class="pw-card" data-id="${b.brawler_id}" style="--mc:${brawlerColor(b.brawler_id)}">
      ${img(model(b.brawler_id))}<span class="pw-b">${prestigeBadge(b.prestige, 34)}</span>
      <span class="pw-f"><b>${esc(title(b.name))}</b><small><img src="${TROPHY}" alt="">${fmt(b.trophies)}</small></span></button>`).join('')
    : '<div class="empty">還沒有英雄破 1,000 盃，加油！</div>';

  const stamp = ms => new Date(ms).toLocaleString('zh-TW', { ...TPE, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  $('#p-time').innerHTML = p.achieved.length ? p.achieved.map(a => `<div class="pt-item">${prestigeBadge(a.prestige, 30)}
      <img src="${icon(a.brawler_id)}" alt=""><span><b>${esc(title(a.name))}</b> 達成威望 ${a.prestige}<small>${stamp(a.at)}</small></span></div>`).join('')
    : '<div class="empty">從今天開始記錄。<br>之後英雄升威望，會在這裡留下時間 ✨</div>';

  // 英雄獎盃分布：每 100 盃一格，破千的格子用金色
  const top = Math.max(1100, Math.ceil(Math.max(0, ...list.map(b => b.trophies || 0)) / 100) * 100 + 100);
  const bins = Array.from({ length: top / 100 }, (_, i) => ({ lo: i * 100, items: [] }));
  for (const b of list) bins[Math.min(bins.length - 1, Math.floor((b.trophies || 0) / 100))].items.push(b);
  const w = 900, h = 210, pad = { l: 28, r: 8, t: 18, b: 24 }, H = h - pad.t - pad.b;
  const mx = Math.max(1, ...bins.map(x => x.items.length)), bw = (w - pad.l - pad.r) / bins.length;
  const lineX = pad.l + 10 * bw;
  $('#p-dist').innerHTML = `<svg viewBox="0 0 ${w} ${h}">
    <line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + H}" y2="${pad.t + H}"/>
    <text x="${pad.l - 6}" y="${pad.t + 8}" text-anchor="end">${mx}</text>
    <line x1="${lineX}" x2="${lineX}" y1="${pad.t - 8}" y2="${pad.t + H}" stroke="var(--accent)" stroke-dasharray="4 4" opacity=".7"/>
    <text x="${lineX + 6}" y="${pad.t}" style="fill:var(--accent)">威望線 1,000</text>
    ${bins.map((x, i) => {
      const hh = (x.items.length / mx) * H, bx = pad.l + i * bw + bw * .15, bwi = bw * .7;
      return `<g><title>${x.lo}–${x.lo + 99} 盃：${x.items.length} 隻${x.items.length ? '（' + x.items.map(b => title(b.name)).join('、') + '）' : ''}</title>
        <rect x="${bx}" y="${pad.t + H - hh}" width="${bwi}" height="${hh}" rx="4" fill="${x.lo >= 1000 ? 'var(--accent)' : 'var(--blue)'}" opacity="${x.lo >= 1000 ? 1 : .8}"/>
        ${i % Math.ceil(bins.length / 12) === 0 ? `<text x="${bx + bwi / 2}" y="${h - 6}" text-anchor="middle">${x.lo}</text>` : ''}</g>`;
    }).join('')}
  </svg>`;
}

// ---------- 排名 ----------

const RANKS = { BRONZE: '青銅', SILVER: '白銀', GOLD: '黃金', DIAMOND: '鑽石', MYTHIC: '神話', LEGENDARY: '傳奇', MASTERS: '大師', MASTER: '大師', PRO: '職業' };
const RANK_COLORS = { BRONZE: ['#e0a46e', '#9a5b2e'], SILVER: ['#e8eef7', '#8e9bb0'], GOLD: ['#ffe680', '#e0a800'], DIAMOND: ['#7fd4ff', '#0a84ff'], MYTHIC: ['#ff8ad8', '#bf5af2'], LEGENDARY: ['#ffd36b', '#ff6a00'], MASTERS: ['#ff9b9b', '#ff375f'], MASTER: ['#ff9b9b', '#ff375f'], PRO: ['#b4ffcb', '#30d158'] };
const rankKey = n => String(n || '').split(' ')[0].toUpperCase();
const rankName = n => n ? n.replace(/^\S+/, w => RANKS[w.toUpperCase()] || title(w)) : '–';

function ladder(el, board, me, label) {
  if (!board?.items?.length) { el.innerHTML = '<div class="empty">排行榜還沒抓到，等下一次排程</div>'; return; }
  const it = board.items, at = n => it[Math.min(n, it.length) - 1]?.trophies;
  const mine = it.find(p => p.tag === me.tag);
  const cut = at(200);
  const steps = [[1, at(1)], [10, at(10)], [100, at(100)], [200, cut]];
  el.innerHTML = `
    <div class="lad-me">${mine
      ? `<b>你在${label}第 ${mine.rank} 名！</b>`
      : `<span>${label}前 200 名門檻 <b>${fmt(cut)}</b> 盃</span><span class="hint">你目前 ${fmt(me.trophies)} 盃，還差 ${fmt(cut - me.trophies)}（${(me.trophies / cut * 100).toFixed(1)}%）</span>`}</div>
    <div class="lad-bar"><i style="width:${Math.min(100, me.trophies / cut * 100)}%"></i></div>
    <div class="lad-steps">${steps.map(([n, v]) => `<div><small>第 ${n} 名</small><b>${fmt(v)}</b></div>`).join('')}</div>
    <div class="lad-top">${it.slice(0, 10).map(p => `<div class="lt">
      <span class="lr ${p.rank <= 3 ? 'm' + p.rank : ''}">${p.rank}</span>
      ${img(p.icon?.id ? `${CDN}/profile-icons/regular/${p.icon.id}.png` : '', 'li')}
      <span class="ln"><b style="${p.nameColor ? `color:#${p.nameColor.slice(-6)}` : ''}">${esc(p.name)}</b><small>${esc(p.club?.name || '')}</small></span>
      <span class="lv"><img src="${TROPHY}" alt="">${fmt(p.trophies)}</span></div>`).join('')}</div>`;
}

async function loadRanking() {
  const r = await get('/api/rankings');
  const p = r.player || {};
  const k = rankKey(p.rankedRankName), c = RANK_COLORS[k] || ['#c7c7cc', '#8e8e93'];
  $('#r-ranked').innerHTML = `
    <div class="rk-emblem" style="--a:${c[0]};--b:${c[1]}"><svg viewBox="0 0 100 100"><path d="M50 4 90 22v30c0 24-18 38-40 44C28 90 10 76 10 52V22z" fill="url(#rkg)" stroke="rgb(255 255 255 / .6)" stroke-width="2"/><defs><linearGradient id="rkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></linearGradient></defs></svg><span>${esc((p.rankedRankName || '').split(' ')[1] || '')}</span></div>
    <div class="rk-body"><div class="hint">排位賽 · 第 ${esc(p.rankedSeasonId ?? '–')} 季</div>
      <div class="rk-name">${esc(rankName(p.rankedRankName))}</div>
      <div class="rk-elo"><b>${fmt(p.rankedElo)}</b> 分</div>
      <div class="rk-sub"><span>本季最高 ${esc(rankName(p.highestSeasonRankedRankName))} · ${fmt(p.highestSeasonRankedElo)}</span><span>生涯最高 ${esc(rankName(p.highestAllTimeRankedRankName))} · ${fmt(p.highestAllTimeRankedElo)}</span></div>
    </div>`;
  areaChart($('#r-elo'), (r.elo || []).map(x => ({ x: x.at, y: x.ranked_elo })), { h: 160, color: c[1], label: q => `${fmt(q.y)} 分` });

  $('#r-fame').innerHTML = `<div class="fame"><span class="fi">🌟</span><span><small>名聲</small><b>${esc(p.fameTierName ? title(p.fameTierName) : '–')}</b><i>${fmt(p.fame)} 點</i></span></div>`;

  const me = { tag: p.tag, trophies: p.trophies };
  ladder($('#r-tw'), r.boards?.TW, me, '台灣');
  ladder($('#r-global'), r.boards?.global, me, '全球');

  $('#r-brawlers').innerHTML = (r.brawlerBoards || []).length ? r.brawlerBoards.map(b => {
    const cut = b.TW?.cut, gcut = b.global?.cut;
    return `<button class="rb" data-id="${b.brawler_id}">
      <img src="${icon(b.brawler_id)}" alt="" loading="lazy">
      <span class="rb-n"><b>${esc(title(b.name))}</b><small><img src="${TROPHY}" alt="">${fmt(b.trophies)}${b.TW?.mine ? ` · 台灣第 ${b.TW.mine} 名` : ''}</small></span>
      <span class="rb-c"><small>台灣 #200</small><b>${cut ? fmt(cut) : '–'}</b><span class="pprog"><i style="width:${cut ? Math.min(100, b.trophies / cut * 100) : 0}%"></i></span></span>
      <span class="rb-c"><small>全球 #200</small><b>${gcut ? fmt(gcut) : '–'}</b><span class="pprog"><i style="width:${gcut ? Math.min(100, b.trophies / gcut * 100) : 0}%"></i></span></span>
    </button>`;
  }).join('') : '<div class="empty">英雄排行榜每小時抓一次，等下一次排程</div>';

  // 目前輪替的地圖 + 你在這張圖的歷史勝率
  const left = ms => { const m = Math.max(0, Math.round((ms - Date.now()) / 6e4)); return m >= 1440 ? `${Math.floor(m / 1440)} 天` : m >= 60 ? `${Math.floor(m / 60)} 小時 ${m % 60} 分` : `${m} 分`; };
  $('#r-rotation').innerHTML = (r.rotation || []).length ? r.rotation.map(e => `<div class="rot" style="--mc:${modeColor(e.mode)}">
      ${img(mapImg(e.event_id))}
      <div class="cap"><div class="mn">${esc(e.map || modeName(e.mode))}</div>
        <div class="ms"><span><i class="mode-dot"></i>${esc(modeName(e.mode))}</span><span>剩 ${left(e.end)}</span></div>
        <div class="ms">${e.games ? `<span>你：${e.games} 場 · 勝率 ${wr(e)}%</span>` : '<span>你還沒打過這張</span>'}</div></div>
    </div>`).join('') : '<div class="empty">輪替資料每小時抓一次</div>';
}

// ---------- 事件 ----------

const loaded = {};
function showTab(name) {
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  placeThumb($('#tabs'));
  $$('.tab').forEach(s => (s.hidden = s.id !== 'tab-' + name));
  if (name === 'battles' && !loaded.battles) { loaded.battles = true; loadBattles(true); }
  if (name === 'prestige' && !loaded.prestige) { loaded.prestige = true; loadPrestige(); }
  if (name === 'ranking' && !loaded.ranking) { loaded.ranking = true; loadRanking(); }
  try { localStorage.setItem('tab', name); } catch {}
  history.replaceState(null, '', name === 'overview' ? location.pathname : '#' + name);
}
$$('#tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
$$('#range button').forEach(b => b.addEventListener('click', () => {
  $$('#range button').forEach(x => x.classList.toggle('on', x === b));
  placeThumb($('#range'));
  days = Number(b.dataset.days);
  loadOverview();
}));
$('#more').addEventListener('click', () => loadBattles(false));
$('#f-brawler').addEventListener('change', () => loadBattles(true));
$('#f-mode').addEventListener('change', () => loadBattles(true));
$('#b-sort').addEventListener('change', renderBrawlers);
document.addEventListener('click', e => { const c = e.target.closest('.bcard, .main-card, .near, .pw-card, .rb'); if (c) openBrawler(c.dataset.id); });
$('#brawler-dialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
$('#refresh').addEventListener('click', async () => {
  const btn = $('#refresh'), label = btn.querySelector('span');
  btn.disabled = true; btn.classList.add('spin'); label.textContent = '更新中';
  try {
    const r = await fetch('/api/refresh', { method: 'POST' }).then(r => r.json());
    label.textContent = r.skipped ? '剛更新過' : r.ok ? `+${r.newBattles} 場` : '失敗';
    await init();
  } catch { label.textContent = '失敗'; }
  btn.classList.remove('spin');
  setTimeout(() => { btn.disabled = false; label.textContent = '更新'; }, 2500);
});

async function init() {
  await loadSummary();
  const [all] = await Promise.all([get('/api/stats?days=0'), loadOverview(), loadBrawlers()]);
  $('#f-mode').innerHTML = '<option value="">全部模式</option>' + all.byMode.filter(m => m.mode).map(m => `<option value="${esc(m.mode)}" data-color="${modeColor(m.mode)}">${esc(modeName(m.mode))}</option>`).join('');
  if (all.overall?.games) setNav('overview', `${wr(all.overall)}%`);
  const latest = await get('/api/battles?limit=1');
  setBackdrop([...brawlers].sort((a, b) => b.trophies - a.trophies)[0]?.brawler_id ?? all.byBrawler[0]?.brawler_id, latest[0]?.event_id);
  if (loaded.battles) loadBattles(true);
  if (loaded.prestige) loadPrestige();
  if (loaded.ranking) loadRanking();
}

['#f-brawler', '#f-mode', '#b-sort'].forEach(q => glassSelect($(q)));

let saved = location.hash.slice(1) || null;
try { saved ||= localStorage.getItem('tab'); } catch {}
showTab(saved && $(`#tabs [data-tab="${saved}"]`) ? saved : 'overview');
placeThumb($('#range'));
document.fonts?.ready.then(() => $$('.seg').forEach(placeThumb));
init().catch(e => { $('#name').textContent = '載入失敗'; $('#tag').textContent = e.message; });
