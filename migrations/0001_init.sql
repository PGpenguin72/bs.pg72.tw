-- 只追蹤一個玩家（標籤在 wrangler.jsonc 的 PLAYER_TAG），所以表裡不放 tag。

-- 玩家快照：數值有變才記一筆，拿來畫獎盃走勢
CREATE TABLE player_snapshots (
  at INTEGER PRIMARY KEY,         -- epoch ms
  trophies INTEGER,
  highest_trophies INTEGER,
  exp_level INTEGER,
  exp_points INTEGER,
  victories_3v3 INTEGER,
  solo_victories INTEGER,
  duo_victories INTEGER,
  brawler_count INTEGER
);

-- 每隻英雄的最新狀態
CREATE TABLE brawlers_latest (
  brawler_id INTEGER PRIMARY KEY,
  name TEXT,
  power INTEGER,
  rank INTEGER,
  trophies INTEGER,
  highest_trophies INTEGER,
  gadgets INTEGER,
  star_powers INTEGER,
  gears INTEGER,
  updated_at INTEGER NOT NULL,
  raw TEXT NOT NULL
);

-- 英雄歷史：獎盃 / 等級 / 道具有變才記
CREATE TABLE brawler_snapshots (
  brawler_id INTEGER NOT NULL,
  at INTEGER NOT NULL,
  power INTEGER,
  rank INTEGER,
  trophies INTEGER,
  highest_trophies INTEGER,
  gadgets INTEGER,
  star_powers INTEGER,
  gears INTEGER,
  PRIMARY KEY (brawler_id, at)
);

-- 戰鬥紀錄（官方 API 只給最近 25 場，所以要一直抓一直存）
CREATE TABLE battles (
  battle_time TEXT PRIMARY KEY,   -- 官方格式 20261026T120000.000Z
  at INTEGER NOT NULL,            -- epoch ms
  event_id INTEGER,
  mode TEXT,
  map TEXT,
  type TEXT,                      -- ranked / soloRanked / friendly ...
  result TEXT,                    -- victory / defeat / draw，大亂鬥為 null
  rank INTEGER,                   -- 大亂鬥名次
  outcome TEXT,                   -- W / L / D（大亂鬥依名次換算）
  trophy_change INTEGER,
  duration INTEGER,
  brawler_id INTEGER,
  brawler_name TEXT,
  brawler_power INTEGER,
  brawler_trophies INTEGER,
  is_star_player INTEGER,
  teammates TEXT,                 -- JSON [{tag,name,brawler}]
  opponents TEXT,                 -- JSON
  raw TEXT NOT NULL
);
CREATE INDEX battles_at ON battles (at DESC);
CREATE INDEX battles_brawler ON battles (brawler_id);

-- 活動輪替（地圖 / 模式）歷史
CREATE TABLE events (
  event_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  mode TEXT,
  map TEXT,
  slot INTEGER,
  PRIMARY KEY (event_id, start_time)
);

-- 小型 key/value：玩家最新原始資料、戰隊、英雄清單、抓取狀態
CREATE TABLE kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
