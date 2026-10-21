import test from 'node:test';
import assert from 'node:assert/strict';
import { footballScheduleUrl, parseFootballSchedule, streamSource, readGame } from '../src/features/sports/games.js';

test('football schedule crosses year boundaries and rejects unknown leagues', () => {
  const url = new URL(footballScheduleUrl('eng.1', new Date('2026-12-30T15:00:00Z')));
  assert.equal(url.searchParams.get('dates'), '20261223-20270113');
  assert.match(url.pathname, /soccer\/eng\.1\/scoreboard/);
  assert.throws(() => footballScheduleUrl('mlb'));
});
test('football status, zero goals, match clock and room IDs come from the soccer feed', () => {
  const event = (id, state) => ({ id, date: '2026-10-21T18:00:00Z', competitions: [{ status: { type: { state, shortDetail: "67'" } }, competitors: [
    { homeAway: 'away', team: { displayName: 'Away' }, score: '2' },
    { homeAway: 'home', team: { displayName: 'Home' }, score: '0' },
  ] }] });
  const league = { id: 'eng.1', name: '프리미어리그' };
  const result = parseFootballSchedule({ events: [event('123', 'in'), event('124', 'pre'), event('125', 'post'), { id: '126' }] }, league);
  assert.deepEqual(result.map((game) => game.status), ['live', 'scheduled', 'finished']);
  assert.equal(result[0].id, 'football-eng.1-123');
  assert.equal(result[0].homeScore, 0);
  assert.equal(result[1].homeScore, '–');
  assert.equal(result[0].matchTime, "67'");
  assert.equal(result[0].gameUrl, 'https://www.espn.com/soccer/match/_/gameId/123');
  assert.throws(() => parseFootballSchedule({ error: 'denied' }, league));
});
test('only HTTPS video files and supported official embed hosts can render', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com/a.mp4', 'https://youtube.com.evil.test/embed/id', 'https://user:pass@example.com/a.mp4', 'https://example.com/page']) assert.equal(streamSource(url), null);
  assert.equal(streamSource('https://www.youtube-nocookie.com/embed/abc_123').type, 'embed');
  assert.equal(streamSource('https://cdn.example.com/live.m3u8?sig=abc').type, 'video');
});
test('invalid Firestore game documents are rejected and cannot invent live status', () => {
  assert.equal(readGame({ id: 'bad', data: () => ({}) }), null);
  const game = readGame({ id: 'valid', data: () => ({ home: 'A', away: 'B', status: 'bogus', homeScore: -1, awayScore: 0 }) });
  assert.equal(game.status, 'scheduled');
  assert.equal(game.homeScore, '–');
  assert.equal(game.awayScore, 0);
});
