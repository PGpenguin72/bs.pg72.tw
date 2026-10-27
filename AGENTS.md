# AGENTS.md

給 AI 程式助手（Claude Code、Codex 等）的專案說明。使用者文件請看 [README.md](README.md)。

## 專案是什麼

Cloudflare Worker + D1 + 靜態資產的荒野亂鬥戰績網站。一個部署只追蹤一個玩家（`PLAYER_TAG`）；要追蹤多人就用 wrangler 的 `env` 各開一個 Worker / D1 / key。

## 檔案

| 路徑 | 內容 |
|---|---|
| `src/worker.js` | 排程 `collect()`（抓 API → D1）、`/api/*` 路由、首頁 meta 注入、`/og.png` |
| `src/parse.js` | 純函式：解析戰鬥、玩家快照、英雄列。**有單元測試**（`test/parse.test.js`） |
| `src/og.js` | 分享圖：撈資料、分享文字、用 workers-og（satori + resvg）畫 1200×630 PNG |
| `migrations/` | D1 schema，只能新增檔案，不要改已經套用過的 migration |
| `public/` | 前端，純 HTML / CSS / JS，**沒有建置步驟**、沒有框架 |
| `public/app.js` | 所有前端邏輯、手刻 SVG 圖表、玻璃下拉選單元件 |
| `public/styles.css` | 主樣式（Liquid Glass 變數、儀表板、各元件） |
| `public/side.css` | 側邊欄（玩家卡 + 導覽）三種裝置的版面 |
| `wrangler.example.jsonc` | 設定範本。真正的 `wrangler.jsonc` 不進版控 |
| `scripts/import-trophies.mjs` | 把手記的歷史獎盃轉成 SQL |

## 指令

```bash
npm test                                   # node --test
npm run dev                                # 本機，port 7273
npx wrangler d1 migrations apply DB --local
npm run migrate                            # 線上 D1
npm run deploy                             # 有 env 的話每個 env 都要部署：npx wrangler deploy --env <name>
```

改完至少跑 `npm test`，以及 `node --check` 檢查改過的 JS。

## 資料流與規則

- 官方 API 只給最近 25 場戰鬥。`collect()` 只寫入比資料庫裡最新一場更新的戰鬥，`battle_time` 是主鍵
- 快照（`player_snapshots`、`brawler_snapshots`）**只在數值有變時**才寫一筆，用 `parse.js` 的 `SNAPSHOT_KEYS` / `BRAWLER_KEYS` 比對。新增欄位時要記得加進去
- 排行榜、輪替、戰隊每小時抓一次，英雄總表每天一次，計時存在 `kv` 表（`*_fetched`）
- 分享圖存在 `kv` 的 `og`（base64 PNG），有新戰鬥或超過一小時就重畫
- 統計用 `outcome`（W / L / D）。大亂鬥沒有勝負，用名次換算：單人前 4、雙人前 2、其他前一半算贏
- 時間：資料庫存 epoch ms（UTC）；「幾點、哪天」的統計用台北時間（`TPE = 8 * 3600`）

## 用語（介面都是繁體中文）

- 「**排位賽**」，不是「積分戰」（`soloRanked` / `rankedRankName`）
- 英雄達成巔峰威望後，「階 N」要顯示成「**巔 N**」（`tierLabel()`）。威望每 1,000 盃一級
- 「主力英雄」= **獎盃最高**的英雄，不是最常用的
- 給使用者看的文字、程式註解都用繁體中文

## 已知的坑

- **名字裡的顏色標籤**：玩家名稱、戰隊名可能夾 `<c0>…</c>` 這類遊戲顏色標籤，顯示前要去掉（`esc()` 已處理）
- **分享圖（workers-og）**：
  - 有多個子節點的 `<div>` 一定要 `display:flex`（`renderOg()` 會自動補）
  - HTML 實體（`&gt;`）**不會被還原**，會直接印出來 → 用全形字取代，不要用實體跳脫
  - 內建的 `loadGoogleFont` 沒把中文做網址編碼會漏字 → 用 `og.js` 自己的 `loadFont()`
  - emoji 用 `emoji: 'twemoji'`；花式字母靠 Noto Sans Math 等備用字型
- **`backdrop-filter` 會讓 `position: fixed` 的子元素以它為參考框**：手機版的底部分頁列在側邊欄裡，所以手機版側邊欄的玻璃效果畫在 `::after`，不要直接加回 `.side`
- **用腳本改檔案時**：`String.prototype.replace` 的第二個參數如果是字串，`$$`、`$&` 會被當成特殊符號 → 一律傳函式 `() => replacement`
- **Windows 開發機**：Hyper-V / WSL 常把 8649–8848、9181–9280 等 port 保留起來（包含 wrangler 預設的 8787 和 inspector 的 9229），所以 dev 用 7273 / 7274。重開 dev server 前要確認舊的 wrangler（node）行程真的停了，只砍 `workerd` 會被自動重生，多組搶同一個 port 會整個卡死
- 官方 API key 綁 IP；線上走 RoyaleAPI proxy（`45.79.218.79`），本機 `.dev.vars` 直連官方 API

## 不要做的事

- 不要把 key 寫進任何進版控的檔案（`BS_TOKEN` 只放 `wrangler secret` 和 `.dev.vars`）
- 不要提交 `wrangler.jsonc`
- 不要為了前端引入建置工具或框架；保持 `public/` 可以直接被瀏覽器載入
