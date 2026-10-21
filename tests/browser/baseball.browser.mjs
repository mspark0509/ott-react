// Browser fixtures validate UI behavior, never real media or production Firebase.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve(process.env.BASEBALL_TEST_DEPS || '/tmp/ott-sports-browser', 'package.json'));
const { chromium } = require('playwright');
const origin = process.env.BASEBALL_TEST_URL || 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Fixture tests require a local development server.');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.clock.install();
  let mode = 'ready', calls = 0;
  const games = Array.from({ length: 6 }, (_, i) => ({ id: `Baseball00${i}`, title: `LIVE Baseball: Home ${i} vs Away ${i}`,
    channelTitle: i % 2 ? 'WBSC' : 'Baseball Club', channelId: i % 2 ? 'wbsc-id' : 'other', status: 'live', viewers: i === 5 ? null : 1000 - i * 100,
    thumbnail: `https://i.ytimg.com/vi/Baseball00${i}/mqdefault.jpg`, watchUrl: `https://www.youtube.com/watch?v=Baseball00${i}` }));
  await page.route('https://i.ytimg.com/**', (route) => route.fulfill({ body: '', contentType: 'image/png' }));
  await page.route('https://firestore.googleapis.com/**', (route) => route.abort());
  await page.route('**/api/fifa-live', (route) => route.fulfill({ status: 502, json: { error: 'fixture' } }));
  await page.route('https://site.api.espn.com/**', (route) => route.fulfill({ json: { events: [] } }));
  await page.route('**/api/baseball-live', (route) => {
    calls++;
    if (['key_missing', 'permission_denied', 'quota_exceeded', 'network_error'].includes(mode)) return route.fulfill({ status: 503, json: { code: mode, message: 'Fixture error explanation' } });
    return route.fulfill({ json: { games: mode === 'empty' ? [] : mode === 'few' ? games.slice(0, 2) : games, endedIds: [],
      wbscAvailable: true, wbscChannelId: 'wbsc-id', checkedAt: new Date().toISOString() } });
  });
  await page.route('**/api/baseball-status?*', (route) => route.fulfill({ json: { state: 'live' } }));
  for (const host of ['www.youtube-nocookie.com', 'www.youtube.com']) await page.route(`https://${host}/embed/**`, (route) => route.fulfill({ body: '<html>Player fixture</html>', contentType: 'text/html' }));
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ contentType: 'application/javascript', body:
    `window.YT={Player:class{constructor(frame,options){window.__baseballEvents=options.events;queueMicrotask(()=>options.events.onReady())}mute(){}playVideo(){}destroy(){}}};window.onYouTubeIframeAPIReady();` }));
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/sports`);
  await page.getByText('검색된 라이브 6개', { exact: true }).waitFor();
  assert.deepEqual((await page.locator('[aria-label="메인 메뉴"] li').allInnerTexts()).slice(-2), ['축구', '야구']);
  assert.equal(await page.locator('.baseball-top .baseball-card').count(), 5);
  assert.equal(await page.locator('.baseball-all .baseball-card').count(), 6);
  await page.getByRole('button', { name: 'WBSC 공식 채널', exact: true }).click();
  assert.equal(await page.locator('.baseball-all .baseball-card').count(), 3);
  assert.equal(await page.locator('.baseball-top .baseball-card').count(), 2);
  await page.getByRole('button', { name: '전체 라이브', exact: true }).click();
  await page.locator('.baseball-all .baseball-card').nth(2).click();
  await page.getByTitle(games[2].title).waitFor();
  assert.equal(await page.locator('.sports-video iframe').count(), 1, 'Switching broadcasts must destroy earlier players');
  assert.equal(await page.getByRole('complementary', { name: '경기 실시간 채팅' }).count(), 1, 'Only the selected chat room can remain mounted');
  assert.equal(await page.getByText('● 실시간 연결됨', { exact: false }).count(), 0, 'Local Firestore cache is not a verified server connection');
  const before = calls;
  await page.clock.fastForward(300001);
  await page.waitForTimeout(100);
  assert.ok(calls > before, 'Five-minute auto refresh must execute');
  assert.match(await page.getByTitle(games[2].title).getAttribute('src'), /Baseball002/);
  await page.evaluate(() => window.__baseballEvents.onStateChange({ data: 1 }));
  await page.getByText('영상 재생 중', { exact: true }).waitFor();
  await page.evaluate(() => window.__baseballEvents.onStateChange({ data: 0 }));
  await page.getByRole('heading', { name: '방송이 종료되었습니다' }).waitFor();
  assert.equal(await page.locator('.sports-video iframe').count(), 0, 'Ended streams must not continue as replays');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: '/tmp/baseball-mobile.png', fullPage: true });
  for (const [code, label] of Object.entries({ key_missing: '검색 키 설정 필요', permission_denied: 'API 권한 오류', quota_exceeded: '조회 할당량 초과', network_error: '네트워크 연결 오류' })) {
    mode = code; await page.reload(); await page.getByText(label, { exact: true }).waitFor();
    assert.equal(await page.locator('.baseball-card').count(), 0);
  }
  mode = 'empty'; await page.reload(); await page.getByRole('heading', { name: '현재 확인된 야구 라이브가 없습니다' }).waitFor();
  assert.equal(await page.locator('.baseball-card').count(), 0);
  mode = 'few'; await page.reload(); await page.getByRole('heading', { name: '인기 TOP 2', exact: true }).waitFor();
  assert.equal(await page.locator('.baseball-all .baseball-card').count(), 2);
  await page.goto(`${origin}/baseball`); await page.waitForURL('**/sports'); await page.reload();
  await page.getByRole('heading', { name: '야구라이브' }).waitFor();
  await page.getByRole('link', { name: '축구', exact: true }).click(); await page.waitForURL('**/football');
  await page.getByRole('heading', { name: '스포츠라이브' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS browser fixtures: routes, TOP5/counts, WBSC, video/chat switching cleanup, five-minute polling, ended handling, mobile, four error states, empty/fewer-than-five results, reload and preserved football. Real playback and Firebase delivery remain unverified.');
} finally { await browser.close(); }
