#!/usr/bin/env node
// 匯入開始追蹤之前的獎盃紀錄（例如自己截圖記下來的），讓獎盃走勢可以往前延伸。
//
// 輸入檔每行一筆「日期 時間 獎盃」，時間預設是台北時間（UTC+8），# 開頭是註解：
//   2026-10-15 00:00 0
//   2026-10-15 18:11 514
//   2026-10-16 01:37 1007
//
// 用法：
//   node scripts/import-trophies.mjs history.txt > history.sql
//   npx wrangler d1 execute DB --remote --file history.sql
//
// 時區可以用 --tz 調整（小時），例如日本：--tz 9
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const tzIdx = args.indexOf('--tz');
const tz = tzIdx >= 0 ? Number(args.splice(tzIdx, 2)[1]) : 8;
const file = args[0];
if (!file || !Number.isFinite(tz)) {
  console.error('用法：node scripts/import-trophies.mjs <檔案> [--tz 8] > history.sql');
  process.exit(1);
}

const rows = [];
for (const [i, raw] of readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})\s+([\d,]+)$/.exec(line);
  if (!m) { console.error(`第 ${i + 1} 行看不懂：${line}`); process.exit(1); }
  const [, y, mo, d, h, mi, t] = m;
  rows.push({ at: Date.UTC(+y, mo - 1, +d, h - tz, +mi), trophies: Number(t.replace(/,/g, '')), line });
}
rows.sort((a, b) => a.at - b.at);

// INSERT OR IGNORE：重複匯入同一個時間點不會出錯，也不會蓋掉排程記錄的資料
for (const r of rows) console.log(`INSERT OR IGNORE INTO player_snapshots (at, trophies) VALUES (${r.at}, ${r.trophies}); -- ${r.line}`);
console.error(`共 ${rows.length} 筆`);
