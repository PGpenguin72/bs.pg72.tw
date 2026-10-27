import test from 'node:test';
import assert from 'node:assert/strict';
import { normTag, battleTimeToMs, parseBattle } from '../src/parse.js';

const me = { tag: '#ABC', name: 'PG', brawler: { id: 16000000, name: 'SHELLY', power: 11, trophies: 700 } };
const mate = { tag: '#DEF', name: 'friend', brawler: { id: 16000001, name: 'COLT', power: 9, trophies: 500 } };
const foe = { tag: '#XYZ', name: 'foe', brawler: { id: 16000002, name: 'BULL', power: 10, trophies: 600 } };

test('normTag 去掉 # 並把 O 換成 0', () => {
  assert.equal(normTag(' #2lqo89y '), '2LQ089Y');
});

test('battleTimeToMs', () => {
  assert.equal(battleTimeToMs('20261026T120000.000Z'), Date.UTC(2026, 9, 26, 12));
  assert.ok(Number.isNaN(battleTimeToMs('garbage')));
});

test('3v3 勝利：分出隊友與對手、明星玩家', () => {
  const r = parseBattle({
    battleTime: '20261026T120000.000Z',
    event: { id: 1, mode: 'gemGrab', map: 'Hard Rock Mine' },
    battle: { mode: 'gemGrab', type: 'ranked', result: 'victory', duration: 120, trophyChange: 8, starPlayer: { tag: '#ABC' }, teams: [[foe], [me, mate]] },
  }, 'abc');
  assert.equal(r.outcome, 'W');
  assert.equal(r.brawler_id, 16000000);
  assert.equal(r.is_star_player, 1);
  assert.deepEqual(JSON.parse(r.teammates).map(p => p.tag), ['DEF']);
  assert.deepEqual(JSON.parse(r.opponents).map(p => p.tag), ['XYZ']);
});

test('單人大亂鬥用名次換算勝負', () => {
  const mk = rank => parseBattle({ battleTime: '20261026T120000.000Z', event: { mode: 'soloShowdown' }, battle: { mode: 'soloShowdown', rank, players: [me, foe] } }, 'ABC');
  assert.equal(mk(4).outcome, 'W');
  assert.equal(mk(5).outcome, 'L');
});

test('對決模式用 brawlers 陣列', () => {
  const duel = { tag: '#ABC', name: 'PG', brawlers: [{ id: 7, name: 'X' }] };
  const r = parseBattle({ battleTime: '20261026T120000.000Z', event: { mode: 'duels' }, battle: { result: 'defeat', players: [duel, foe] } }, 'ABC');
  assert.equal(r.brawler_id, 7);
  assert.equal(r.outcome, 'L');
});
