export const demoGames = [
  ['아스널', '토트넘', '에미레이츠 스타디움', '프리미어리그'],
  ['맨체스터 시티', '리버풀', '에티하드 스타디움', '프리미어리그'],
  ['레알 마드리드', '바르셀로나', '산티아고 베르나베우', '라리가'],
  ['아틀레티코 마드리드', '세비야', '메트로폴리타노', '라리가'],
  ['FC 서울', '전북 현대', '서울월드컵경기장', 'K리그1'],
  ['울산 HD', '포항 스틸러스', '울산문수축구경기장', 'K리그1'],
].map(([home, away, venue, league], index) => ({
  id: `football-demo-${index}`, home, away, venue, league,
  status: 'demo', matchTime: '중계 등록 대기',
}));

export function streamSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (['www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)
      && /^\/embed\/[\w-]+$/.test(url.pathname)) return { type: 'embed', url: url.href };
    if (/\.(mp4|webm|m3u8)$/i.test(url.pathname)) return { type: 'video', url: url.href };
  } catch { /* An absent or malformed URL has no playable source. */ }
  return null;
}

export function readGame(doc) {
  const data = doc.data();
  if (typeof data.home !== 'string' || typeof data.away !== 'string') return null;
  const text = (value) => typeof value === 'string' ? value.slice(0, 120) : '';
  return {
    id: doc.id, home: text(data.home), away: text(data.away),
    league: text(data.league), venue: text(data.venue), matchTime: text(data.matchTime),
    status: ['live', 'scheduled', 'finished'].includes(data.status) ? data.status : 'scheduled',
    homeScore: Number.isInteger(data.homeScore) && data.homeScore >= 0 ? data.homeScore : '–',
    awayScore: Number.isInteger(data.awayScore) && data.awayScore >= 0 ? data.awayScore : '–',
    streamUrl: typeof data.streamUrl === 'string' ? data.streamUrl.slice(0, 2048) : '',
  };
}

export const footballLeagues = [
  { id: 'eng.1', name: '프리미어리그' },
  { id: 'esp.1', name: '라리가' },
  { id: 'kor.1', name: 'K리그1' },
];

export function footballScheduleUrl(leagueId, now = new Date()) {
  if (!footballLeagues.some((league) => league.id === leagueId)) throw new Error('Unsupported league');
  const start = new Date(now); start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(now); end.setUTCDate(end.getUTCDate() + 14);
  const date = (value) => value.toISOString().slice(0, 10).replaceAll('-', '');
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${date(start)}-${date(end)}&limit=100`;
}

export function parseFootballSchedule(data, league) {
  if (!Array.isArray(data.events)) throw new Error('Invalid schedule response');
  return data.events.flatMap((event) => {
    const match = event.competitions?.[0];
    const home = match?.competitors?.find((team) => team.homeAway === 'home');
    const away = match?.competitors?.find((team) => team.homeAway === 'away');
    if (!/^\d+$/.test(event.id) || !home?.team?.displayName || !away?.team?.displayName) return [];
    const status = match.status || event.status || {};
    const score = (team) => {
      if (status.type?.state === 'pre') return '–';
      const value = team.score;
      return value !== undefined && value !== null && /^\d+$/.test(String(value)) ? Number(value) : '–';
    };
    return [{
      id: `football-${league.id}-${event.id}`, home: home.team.displayName, away: away.team.displayName,
      league: league.name, venue: match.venue?.fullName || '',
      status: status.type?.state === 'in' ? 'live' : status.type?.state === 'post' ? 'finished' : 'scheduled',
      homeScore: score(home), awayScore: score(away),
      matchTime: status.type?.shortDetail || status.displayClock || '', startsAt: event.date,
      watchUrl: 'https://www.coupangplay.com',
      gameUrl: `https://www.espn.com/soccer/match/_/gameId/${event.id}`,
    }];
  });
}
