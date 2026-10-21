import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { GameChat } from '../features/sports/GameChat';
import { demoGames, footballScheduleUrl, footballLeagues, parseFootballSchedule, readGame, streamSource } from '../features/sports/games';
import './Sports.css';

const statusLabel = { live: 'LIVE', scheduled: '경기 예정', finished: '경기 종료', demo: '예시 경기' };

function GamePlayer({ game }) {
  const source = streamSource(game.streamUrl);
  const [failed, setFailed] = useState(false);
  return <section className="sports-watch" aria-label="경기 중계">
    <div className="sports-video">
      {game.status === 'live' && source && !failed ? source.type === 'embed'
        ? <iframe title={`${game.home} 대 ${game.away} 공식 중계`} src={source.url} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        : <video controls playsInline src={source.url} onError={() => setFailed(true)} aria-label="실시간 축구 중계" />
        : <div className="sports-video-empty"><span className="sports-football">⚽</span>
          <span className={`sports-badge ${game.status}`}>{statusLabel[game.status]}</span>
          <h2>{game.home} <span>vs</span> {game.away}</h2>
          <p>{failed ? '이 브라우저에서 영상을 재생할 수 없습니다.' : game.status === 'demo' ? '중계가 등록되면 이곳에서 함께 시청할 수 있어요.' : game.status === 'finished' ? '종료된 경기입니다.' : game.status === 'scheduled' ? '경기 시작을 기다리고 있어요.' : game.watchUrl ? '중계 서비스에서 제공 여부를 확인하고 함께 응원하세요.' : '중계 영상을 준비하고 있습니다.'}</p>
          {game.watchUrl && <a className="sports-primary sports-watch-link" href={game.watchUrl} target="_blank" rel="noopener noreferrer">축구 중계 서비스 ↗</a>}
          {game.watchUrl && <p className="sports-access-note">모든 경기의 중계를 보장하지 않습니다. 이용권·지역 제한을 확인해 주세요.</p>}
          {failed && <button className="sports-primary" onClick={() => setFailed(false)}>다시 시도</button>}
        </div>}
    </div>
    <div className="sports-watch-info"><div><span className={`sports-badge ${game.status}`}>{statusLabel[game.status]}</span><span>{game.league} · {game.venue}</span></div>
      <h2>{game.home} <span>vs</span> {game.away}</h2>
      <p>{game.matchTime || '경기 정보 업데이트 대기'} · {game.status === 'demo' ? '실제 일정·점수가 아닌 화면 예시입니다.' : '경기 정보는 제공처 업데이트에 따라 반영됩니다.'}</p>
      {game.startsAt && <p>경기 시간: {new Date(game.startsAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 시간)</p>}
      {game.gameUrl && <a className="sports-source-link" href={game.gameUrl} target="_blank" rel="noopener noreferrer">ESPN 경기 상세 ↗</a>}
      {source?.type === 'video' && <p className="sports-muted">HLS 중계는 브라우저의 기본 HLS 지원이 필요합니다.</p>}
    </div>
  </section>;
}

export function Sports() {
  const [games, setGames] = useState([]);
  const [footballGames, setFootballGames] = useState([]);
  const [footballState, setFootballState] = useState('loading');
  const [refresh, setRefresh] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('전체');
  const [feedState, setFeedState] = useState(db ? 'loading' : 'unconfigured');
  useEffect(() => {
    let active = true;
    let controller;
    async function load() {
      controller?.abort();
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const results = await Promise.allSettled(footballLeagues.map(async (league) => {
          const response = await fetch(footballScheduleUrl(league.id), { signal: controller.signal });
          if (!response.ok) throw new Error('Schedule unavailable');
          return parseFootballSchedule(await response.json(), league);
        }));
        const successful = results.filter((result) => result.status === 'fulfilled');
        if (!successful.length) throw new Error('Schedule unavailable');
        const next = successful.flatMap((result) => result.value);
        const rank = { live: 0, scheduled: 1, finished: 2 };
        next.sort((a, b) => rank[a.status] - rank[b.status] || (a.status === 'finished'
          ? Date.parse(b.startsAt) - Date.parse(a.startsAt) : Date.parse(a.startsAt) - Date.parse(b.startsAt)));
        if (active) { setFootballGames(next); setFootballState(successful.length === footballLeagues.length ? 'connected' : 'partial'); setUpdatedAt(new Date()); }
      } catch { if (active) setFootballState('error'); }
      finally { clearTimeout(timeout); }
    }
    load();
    const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); controller?.abort(); };
  }, [refresh]);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(query(collection(db, 'footballGames'), limit(50)), (snapshot) => {
      setGames(snapshot.docs.map(readGame).filter(Boolean));
      setFeedState('connected');
    }, () => setFeedState('error'));
  }, []);
  const mergedGames = [...footballGames.map((game) => ({ ...game, ...games.find((item) => item.id === game.id) })), ...games.filter((game) => !footballGames.some((item) => item.id === game.id))];
  const allGames = [...mergedGames, ...demoGames.slice(0, Math.max(0, 6 - mergedGames.length))];
  const visibleGames = filter === '전체' ? allGames : allGames.filter((game) => game.league === filter);
  const selected = visibleGames.find((game) => game.id === selectedId) || visibleGames[0];
  const liveCount = mergedGames.filter((game) => game.status === 'live').length;

  return <main className="sports-page">
    <div className="sports-container">
      <div className="sports-title"><div><p className="sports-eyebrow">PLAY TOGETHER, CHEER TOGETHER</p><h1>스포츠<span>라이브</span></h1><p>오늘의 축구, 함께 보고 함께 응원하세요.</p></div>
        <div className="sports-live-count"><i />{['loading', 'error'].includes(footballState) && !games.length ? '중계 정보 연결 대기' : `${liveCount}개 경기 중계 중`}</div></div>
      <div className="sports-feed-note" role="status">
        {footballState === 'loading' ? '축구 경기 정보를 불러오고 있습니다.' : footballState === 'error' ? '축구 경기 정보를 불러오지 못했습니다. 마지막 정보가 최신이 아닐 수 있습니다.' : `ESPN 축구 일정 · 최근 7일~향후 14일 · 30초마다 갱신 · ${updatedAt?.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })} 기준 (한국 시간)`}
        {footballState === 'error' && <button className="sports-retry" onClick={() => setRefresh((value) => value + 1)}>다시 연결</button>}
        {footballState === 'partial' && <p>일부 리그 정보를 가져오지 못했습니다. 연결된 리그만 표시합니다.</p>}
        <p>예시 표시가 있는 카드는 실제 일정이 아닙니다. {feedState === 'unconfigured' ? '실시간 응원 채팅은 서비스 연결을 준비 중입니다.' : feedState === 'error' ? '추가 경기·채팅 서비스에 연결하지 못했습니다.' : '추가 중계는 제공처 등록 시 반영됩니다.'}</p>
      </div>
      <div className="sports-official-links"><span>축구 중계 서비스</span><a href="https://www.coupangplay.com" target="_blank" rel="noopener noreferrer">쿠팡플레이 ↗</a><a href="https://www.plus.fifa.com/" target="_blank" rel="noopener noreferrer">FIFA+ ↗</a><small>경기별 제공 여부·이용권·지역 제한을 확인해 주세요.</small></div>
      <section className="sports-schedule" aria-label="축구 경기 목록">
        <div className="sports-schedule-heading"><h2>⚽ 축구 <span>{allGames.length}경기</span></h2>
          <div className="sports-filters" aria-label="리그 선택">{['전체', ...footballLeagues.map((league) => league.name)].map((league) => <button key={league} aria-pressed={filter === league} onClick={() => { setFilter(league); setSelectedId(null); }}>{league}</button>)}</div></div>
        <div className="sports-game-grid">{visibleGames.map((game) => <button key={game.id} className={`sports-game-card ${selected?.id === game.id ? 'selected' : ''}`} aria-pressed={selected?.id === game.id} onClick={() => setSelectedId(game.id)}>
          <div className="sports-card-top"><span className={`sports-badge ${game.status}`}>{statusLabel[game.status]}</span><span>{game.league}</span></div>
          <div className="sports-team"><span><i>{game.home.slice(0, 1)}</i>{game.home}</span><strong>{game.status === 'demo' ? '–' : game.homeScore}</strong></div>
          <div className="sports-team"><span><i>{game.away.slice(0, 1)}</i>{game.away}</span><strong>{game.status === 'demo' ? '–' : game.awayScore}</strong></div>
          <div className="sports-card-bottom"><span>{game.venue}</span><span>{game.matchTime || statusLabel[game.status]}</span></div>
        </button>)}</div>
      </section>
      {selected ? <div className="sports-viewing"><GamePlayer key={selected.id + selected.streamUrl} game={selected} /><GameChat key={selected.id} game={selected} /></div>
        : <p className="sports-feed-note">이 리그에 등록된 경기가 없습니다.</p>}
    </div>
  </main>;
}
