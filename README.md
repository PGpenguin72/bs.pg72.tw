# 荒野戰績 Brawl Stars Tracker

自己架、免費、**無限期保存**的荒野亂鬥（Brawl Stars）個人戰績網站。

官方 API 只給最近 25 場戰鬥，市面上的工具想看更久的紀錄大多要付費。這個專案用 Cloudflare Workers 的排程每 10 分鐘抓一次，把每一場戰鬥存進你自己的 D1 資料庫，資料想存多久就存多久。

**範例：** [bs.pg72.tw](https://bs.pg72.tw)

![分享圖範例](docs/og.png)

*English summary: a self-hosted Brawl Stars stats tracker running on Cloudflare Workers + D1. A cron job saves every battle so your history is kept beyond the official API's 25-battle window. The UI is in Traditional Chinese. MIT licensed.*

## 功能

- **總覽**：勝率環、場數 / 獎盃變化 / 明星玩家 / 連勝、最近 30 場、獎盃走勢、獎盃最高的主力英雄、英雄使用比例、各模式勝率、每日戰況、星期 × 時段熱力圖、英雄表現、地圖、常一起玩的隊友
- **戰鬥紀錄**：地圖照片、雙方隊伍、獎盃變化，可依英雄 / 模式篩選
- **英雄**：卡牌牆、收藏進度、每隻英雄的獎盃走勢、地圖表現、道具 / 星能力 / 裝備 / 極限充能，附 Wiki、中文攻略、YouTube 教學連結
- **巔峰威望**：總威望、下一個升威望的英雄、離下個 1,000 盃最近的排行、升級時間軸、英雄獎盃分布
- **排名**：排位賽段位與分數走勢、台灣 / 全球排行榜門檻與前 10 名、主力英雄的排行門檻、目前輪替地圖附你在每張圖的勝率
- **分享圖**：有新戰鬥就自動重畫 Open Graph 圖片，貼到 Discord / LINE 會顯示最新戰績
- **介面**：Liquid Glass 風格，電腦（側邊欄＋儀表板）、平板、手機（底部分頁列）各有專屬版面，支援深色 / 淺色模式

## 架構

```
Cloudflare Worker（src/worker.js）
├── scheduled（每 10 分鐘）→ 官方 API（經 RoyaleAPI proxy）→ D1
│     玩家資料、最近 25 場戰鬥、英雄、戰隊、輪替、排行榜，以及重畫分享圖
├── /api/*        → 從 D1 算統計回傳 JSON
├── / 、/og.png   → 首頁塞入最新的分享 meta、回傳分享圖
└── 其餘          → public/ 靜態檔（純 HTML / CSS / JS，沒有建置步驟）
```

- 官方 API 的 key 必須綁定 IP，但 Worker 的出口 IP 不固定，所以走 [RoyaleAPI 的免費 proxy](https://docs.royaleapi.com/#/proxy)，key 綁 `45.79.218.79`
- 圖片（英雄、地圖、頭像）來自 [Brawlify](https://brawlify.com) 的 CDN
- 用量很小：每天寫入約 1～2 千列，一年的戰鬥資料大約 50～150 MB

## 部署

需要：Cloudflare 帳號、Node.js 18+、Brawl Stars 開發者帳號。

### 1. 取得專案

```bash
git clone https://github.com/PGpenguin72/bs.pg72.tw.git brawl-stars-tracker
cd brawl-stars-tracker
npm install
npx wrangler login
```

### 2. 申請 API key

到 [developer.brawlstars.com](https://developer.brawlstars.com) → My Account → Create New Key，**IP 填 `45.79.218.79`**。想在本機開發的話，也把你自己的 IP 加進去（同一把 key 可以綁多個 IP）。

### 3. 建立資料庫與設定

```bash
npx wrangler d1 create brawl-stars-tracker     # 記下 database_id
cp wrangler.example.jsonc wrangler.jsonc       # 把標了 TODO 的地方改掉
```

`wrangler.jsonc` 裡要填：Cloudflare 帳號 ID（`npx wrangler whoami` 看得到）、D1 的 `database_id`、你的玩家標籤（不用加 `#`）、網域。沒有自己的網域的話，把 `workers_dev` 改成 `true` 並刪掉 `routes`。

### 4. 建資料表、部署、存 key

```bash
npm run migrate                       # 在線上 D1 建資料表
npm run deploy
npx wrangler secret put BS_TOKEN      # 貼上 API key
```

部署完 10 分鐘內排程就會抓第一次；也可以直接按網頁右上角的「更新」。

### 匯入以前的獎盃紀錄（選用）

官方 API 不提供歷史獎盃。如果你有自己記下來的數字（例如截圖），可以寫成文字檔匯入，獎盃走勢就會往前延伸：

```text
# history.txt：日期 時間 獎盃（台北時間）
2026-10-15 00:00 0
2026-10-15 18:11 514
2026-10-16 01:37 1007
```

```bash
npm run import-trophies -- history.txt > history.sql
npx wrangler d1 execute DB --remote --file history.sql
```

### 追蹤其他玩家

每個玩家是一個獨立的 Worker + D1 + key，用 wrangler 的 `env` 共用同一份程式碼。設定方式寫在 `wrangler.example.jsonc` 最下面。

## 本機開發

```bash
cp .dev.vars.example .dev.vars    # 填 BS_TOKEN（本機直連官方 API，key 要綁你的 IP）
npx wrangler d1 migrations apply DB --local
npm run dev                       # http://127.0.0.1:7273
npm test
```

## 限制

- 只能保存**開始部署之後**的戰鬥；之前的紀錄官方 API 拿不到
- 官方排行榜只公開前 200 名，所以沒辦法知道「台灣第幾名」，只能顯示離榜單還差多少
- 介面目前只有繁體中文

## 授權

程式碼以 [MIT License](LICENSE) 釋出。

本專案為非官方粉絲作品，未經 Supercell 認可、贊助或核准，Supercell 對其不負任何責任。詳見 [Supercell 粉絲內容政策](https://supercell.com/en/fan-content-policy/)。英雄、地圖等圖片的權利屬於 Supercell，經由 Brawlify 載入，不在本授權範圍內。
