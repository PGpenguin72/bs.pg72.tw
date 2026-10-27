// 分享圖（Open Graph）：1200×630 PNG，排程定期用最新資料重畫，存進 D1 的 kv 表
import { ImageResponse } from 'workers-og';

const CDN = 'https://cdn.brawlify.com';
const RANKS = { BRONZE: '青銅', SILVER: '白銀', GOLD: '黃金', DIAMOND: '鑽石', MYTHIC: '神話', LEGENDARY: '傳奇', MASTERS: '大師', MASTER: '大師', PRO: '職業' };
const rankName = n => (n ? n.replace(/^\S+/, w => RANKS[w.toUpperCase()] || w) : '–');
const title = s => (s || '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
const fmt = n => Math.round(n ?? 0).toLocaleString('en-US');
// workers-og 的 HTML 解析器不會把 &gt; 這類實體還原，會原封不動印出來；
// 所以不用實體跳脫，改把會破壞標籤的字元換成長得像的全形字
// 遊戲裡的名字可以夾顏色標籤 <c0>…</c>，畫圖前先拿掉
const esc = s => String(s ?? '').replace(/<\/?c\d*>/gi, '').replace(/[&<>"]/g, c => ({ '&': '＆', '<': '‹', '>': '›', '"': '＂' }[c]));
const TROPHY = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M18 8h28v14c0 9-6 16-14 16S18 31 18 22z" fill="#ffc21a"/><path d="M18 12H8c0 9 5 14 11 15M46 12h10c0 9-5 14-11 15" fill="none" stroke="#ffc21a" stroke-width="5" stroke-linecap="round"/><rect x="28" y="37" width="8" height="10" fill="#d98a00"/><rect x="18" y="47" width="28" height="9" rx="3" fill="#ffc21a"/></svg>');

// 從 D1 撈出分享圖和分享文字需要的資料
export async function ogData(db) {
  const kv = async k => { const r = await db.prepare('SELECT v FROM kv WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; };
  const [p, top, recent] = await Promise.all([
    kv('player'),
    db.prepare('SELECT brawler_id, name, trophies, prestige FROM brawlers_latest ORDER BY trophies DESC LIMIT 3').all(),
    db.prepare('SELECT outcome FROM battles ORDER BY at DESC LIMIT 30').all(),
  ]);
  if (!p) return null;
  const rec = recent.results.map(r => r.outcome);
  const w = rec.filter(o => o === 'W').length, l = rec.filter(o => o === 'L').length;
  return { p, top: top.results, rec, w, l };
}

export function shareText(d) {
  if (!d) return { title: '荒野戰績', desc: '荒野亂鬥個人戰績紀錄' };
  const { p, top, w, l } = d;
  const parts = [
    `🏆 ${fmt(p.trophies)} 盃`,
    p.totalPrestigeLevel ? `巔峰威望 ${p.totalPrestigeLevel}` : null,
    p.rankedRankName ? `排位賽 ${rankName(p.rankedRankName)}` : null,
    w + l ? `最近 ${w + l} 場 ${w} 勝 ${l} 敗` : null,
    top[0] ? `最強 ${title(top[0].name)} ${fmt(top[0].trophies)} 盃` : null,
  ].filter(Boolean);
  return { title: `${String(p.name).replace(/<\/?c\d*>/gi, '')} 的荒野戰績`, desc: parts.join(' · ') };
}

function html(d, now) {
  const { p, top, rec, w, l, site = 'bs.pg72.tw' } = d;
  const stamp = new Date(now).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const pill = (label, value, color = '#fff') => `<div style="display:flex;flex-direction:column;padding:12px 20px;border-radius:22px;background:rgba(255,255,255,0.09);border:1px solid rgba(255,255,255,0.16);margin-right:14px">
      <div style="font-size:20px;font-weight:700;color:rgba(235,235,245,0.62)">${label}</div>
      <div style="font-size:34px;font-weight:900;color:${color}">${value}</div></div>`;
  const dots = rec.slice(0, 20).reverse().map(o => `<div style="width:22px;height:22px;border-radius:7px;margin-right:6px;background:${o === 'W' ? '#30d158' : o === 'L' ? '#ff453a' : '#8e8e93'}"></div>`).join('');
  const [b1, ...rest] = top;
  const card = (b, i) => `<div style="display:flex;align-items:center;padding:10px 16px 10px 10px;border-radius:22px;background:rgba(28,30,38,0.82);border:1px solid rgba(255,255,255,0.16);margin-top:${i ? 12 : 0}px">
      <img src="${CDN}/brawlers/borderless/${b.brawler_id}.png" width="64" height="64" style="border-radius:16px"/>
      <div style="display:flex;flex-direction:column;margin-left:14px">
        <div style="font-size:26px;font-weight:900;color:#fff">${esc(title(b.name))}</div>
        <div style="display:flex;align-items:center;font-size:22px;font-weight:700;color:#ffd60a"><img src="${TROPHY}" width="22" height="22" style="margin-right:6px"/>${fmt(b.trophies)}${b.prestige ? `<span style="margin-left:10px;padding:0 10px;border-radius:99px;background:#ff9f0a;color:#3a2400;font-size:18px">巔 ${b.prestige}</span>` : ''}</div>
      </div></div>`;

  return `<div style="display:flex;width:1200px;height:630px;font-family:'Noto Sans TC';color:#fff;position:relative;
      background-color:#0d0e11;background-image:radial-gradient(circle at 15% 0%, rgba(66,133,244,0.55), rgba(13,14,17,0) 55%), radial-gradient(circle at 100% 40%, rgba(175,82,222,0.5), rgba(13,14,17,0) 55%), radial-gradient(circle at 60% 120%, rgba(255,159,10,0.35), rgba(13,14,17,0) 55%)">
    <div style="display:flex;flex-direction:column;justify-content:space-between;width:740px;padding:52px 0 44px 60px">
      <div style="display:flex;align-items:center">
        ${p.icon?.id ? `<img src="${CDN}/profile-icons/regular/${p.icon.id}.png" width="84" height="84" style="border-radius:24px;margin-right:22px"/>` : ''}
        <div style="display:flex;flex-direction:column">
          <div style="font-size:52px;font-weight:900;line-height:1.1">${esc(p.name)}</div>
          <div style="font-size:24px;font-weight:700;color:rgba(235,235,245,0.6)">${esc(p.tag)}${p.club?.name ? ` · ${esc(p.club.name)}` : ''}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column">
        <div style="font-size:24px;font-weight:700;color:rgba(235,235,245,0.62)">目前獎盃</div>
        <div style="display:flex;align-items:center;font-size:118px;font-weight:900;line-height:1;letter-spacing:-4px">
          <img src="${TROPHY}" width="96" height="96" style="margin-right:18px"/>${fmt(p.trophies)}</div>
        <div style="font-size:24px;font-weight:700;color:rgba(235,235,245,0.62);margin-top:6px">歷史最高 ${fmt(p.highestTrophies)}</div>
      </div>
      <div style="display:flex">
        ${pill('巔峰威望', fmt(p.totalPrestigeLevel), '#ffd60a')}
        ${pill('排位賽', esc(rankName(p.rankedRankName)))}
        ${pill('3v3 勝場', fmt(p['3vs3Victories']))}
      </div>
      <div style="display:flex;flex-direction:column">
        <div style="display:flex;font-size:22px;font-weight:700;color:rgba(235,235,245,0.75);margin-bottom:10px">最近 ${w + l} 場 · ${w} 勝 ${l} 敗${w + l ? ` · 勝率 ${Math.round((w / (w + l)) * 100)}%` : ''}</div>
        <div style="display:flex">${dots}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;justify-content:flex-end;width:400px;padding:0 50px 44px 0;position:relative">
      ${b1 ? `<img src="${CDN}/brawlers/model/${b1.brawler_id}.png" width="290" height="290" style="position:absolute;right:70px;top:4px;object-fit:contain"/>` : ''}
      <div style="display:flex;flex-direction:column">${top.map(card).join('')}</div>
    </div>
    <div style="display:flex;position:absolute;right:50px;bottom:12px;font-size:18px;font-weight:700;color:rgba(235,235,245,0.5)">${site} · ${stamp}</div>
  </div>`;
}

// 下載 Google Fonts 的子集字型（只含用到的字）。workers-og 內建的版本沒把中文做網址編碼，會漏字
async function loadFont(family, weight, text) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1' },
  }).then(r => r.text());
  const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error('font css: ' + css.slice(0, 120));
  return fetch(url).then(r => r.arrayBuffer());
}

// 畫出 PNG；回傳 Uint8Array
export async function renderOg(d, now = Date.now()) {
  // satori 規定有多個子節點的 div 一定要 display:flex，乾脆全部補上，順便去掉標籤間的空白節點
  const markup = html(d, now)
    .replace(/<div style="(?![^"]*display:)/g, "<div style=\"display:flex;")
    .replace(/>\s+</g, '><');
  // 字型只抓圖上用到的字（Google Fonts 的 text= 子集），檔案很小
  const text = [...new Set(markup.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '') + '0123456789,·')].join('');
  const [bold, black] = await Promise.all([700, 900].map(w => loadFont('Noto Sans TC', w, text)));
  const fonts = [{ name: 'Noto Sans TC', data: bold, weight: 700, style: 'normal' }, { name: 'Noto Sans TC', data: black, weight: 900, style: 'normal' }];
  // 玩家名字常用花式字母（𝓮 這類數學字母）和各種符號：抓得到就當備用字型，沒有就算了
  for (const fam of ['Noto Sans Math', 'Noto Sans Symbols 2', 'Noto Sans']) {
    try { fonts.push({ name: fam, data: await loadFont(fam, 400, text), weight: 700, style: 'normal' }); } catch {}
  }
  // emoji 用 Twemoji 圖片畫
  const res = new ImageResponse(markup, { width: 1200, height: 630, format: 'png', fonts, emoji: 'twemoji' });
  return new Uint8Array(await res.arrayBuffer());
}
