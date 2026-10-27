-- 巔峰威望：英雄每 1,000 盃升一級威望；玩家有總威望等級
ALTER TABLE player_snapshots ADD COLUMN total_prestige INTEGER;
ALTER TABLE brawlers_latest ADD COLUMN prestige INTEGER;
ALTER TABLE brawlers_latest ADD COLUMN max_win_streak INTEGER;
ALTER TABLE brawler_snapshots ADD COLUMN prestige INTEGER;
