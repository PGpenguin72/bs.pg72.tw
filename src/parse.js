// 把官方 API 的資料轉成要存進 D1 的列。純函式，方便測試。

export function normTag(tag) {
  return String(tag || '').trim().toUpperCase().replace(/^#/, '').replace(/O/g, '0');
}

// "20261026T120000.000Z" → epoch ms
export function battleTimeToMs(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(s || '');
  if (!m) return NaN;
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] || ''}Z`);
}

function brawlerOf(p) {
  // 一般模式是 brawler，對決（duels）是 brawlers 陣列
  return p.brawler || (Array.isArray(p.brawlers) ? p.brawlers[0] : null) || null;
}

function compact(p) {
  const b = brawlerOf(p);
  return { tag: normTag(p.tag), name: p.name, brawler: b ? { id: b.id, name: b.name, power: b.power, trophies: b.trophies } : null };
}

// 大亂鬥沒有勝負，用名次換算：單人前 4、雙人前 2、其餘前一半算贏
function showdownOutcome(mode, rank, groups) {
  if (rank == null) return null;
  let cut;
  if (/^solo/i.test(mode || '')) cut = 4;
  else if (/^duo/i.test(mode || '')) cut = 2;
  else cut = Math.max(1, Math.floor((groups || 0) / 2));
  return rank <= cut ? 'W' : 'L';
}

export function parseBattle(item, myTag) {
  const me = normTag(myTag);
  const b = item.battle || {};
  const ev = item.event || {};
  const mode = ev.mode || b.mode || null;

  // teams：[[p,p,p],[p,p,p]]；大亂鬥單人 / 部分模式：players：[p,...]
  const groups = Array.isArray(b.teams) ? b.teams : Array.isArray(b.players) ? b.players.map(p => [p]) : [];
  let myGroup = -1, mine = null;
  groups.forEach((g, i) => g.forEach(p => { if (normTag(p.tag) === me) { myGroup = i; mine = p; } }));

  const teammates = myGroup >= 0 ? groups[myGroup].filter(p => p !== mine).map(compact) : [];
  const opponents = groups.filter((_, i) => i !== myGroup).flat().map(compact);
  const br = mine ? brawlerOf(mine) : null;

  let outcome = null;
  if (b.result === 'victory') outcome = 'W';
  else if (b.result === 'defeat') outcome = 'L';
  else if (b.result === 'draw') outcome = 'D';
  else outcome = showdownOutcome(mode, b.rank, groups.length);

  return {
    battle_time: item.battleTime,
    at: battleTimeToMs(item.battleTime),
    event_id: ev.id ?? null,
    mode,
    map: ev.map ?? null,
    type: b.type ?? null,
    result: b.result ?? null,
    rank: b.rank ?? null,
    outcome,
    trophy_change: b.trophyChange ?? null,
    duration: b.duration ?? null,
    brawler_id: br?.id ?? null,
    brawler_name: br?.name ?? null,
    brawler_power: br?.power ?? null,
    brawler_trophies: br?.trophies ?? null,
    is_star_player: b.starPlayer && normTag(b.starPlayer.tag) === me ? 1 : 0,
    teammates: JSON.stringify(teammates),
    opponents: JSON.stringify(opponents),
    raw: JSON.stringify(item),
  };
}

export function playerSnapshot(p) {
  return {
    trophies: p.trophies ?? null,
    highest_trophies: p.highestTrophies ?? null,
    exp_level: p.expLevel ?? null,
    exp_points: p.expPoints ?? null,
    victories_3v3: p['3vs3Victories'] ?? null,
    solo_victories: p.soloVictories ?? null,
    duo_victories: p.duoVictories ?? null,
    brawler_count: Array.isArray(p.brawlers) ? p.brawlers.length : null,
    total_prestige: p.totalPrestigeLevel ?? null,
    ranked_elo: p.rankedElo ?? null,
  };
}

export function brawlerRow(b) {
  return {
    brawler_id: b.id,
    name: b.name,
    power: b.power ?? null,
    rank: b.rank ?? null,
    trophies: b.trophies ?? null,
    highest_trophies: b.highestTrophies ?? null,
    gadgets: (b.gadgets || []).length,
    star_powers: (b.starPowers || []).length,
    gears: (b.gears || []).length,
    prestige: b.prestigeLevel ?? null,
  };
}

// 比對兩筆資料的指定欄位是否相同
export function sameFields(a, b, keys) {
  if (!a || !b) return false;
  return keys.every(k => (a[k] ?? null) === (b[k] ?? null));
}

export const SNAPSHOT_KEYS = ['trophies', 'highest_trophies', 'exp_level', 'exp_points', 'victories_3v3', 'solo_victories', 'duo_victories', 'brawler_count', 'total_prestige', 'ranked_elo'];
export const BRAWLER_KEYS = ['power', 'rank', 'trophies', 'highest_trophies', 'gadgets', 'star_powers', 'gears', 'prestige'];
