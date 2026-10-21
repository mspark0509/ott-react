import { useState } from 'react';
import { useBaseballLive } from '../features/baseball/useBaseballLive';
import { BaseballPlayer } from '../features/baseball/BaseballPlayer';
import { GameChat } from '../features/sports/GameChat';
import './Sports.css';
import './Baseball.css';

const errors = { key_missing: '검색 키 설정 필요', permission_denied: 'API 권한 오류', quota_exceeded: '조회 할당량 초과', network_error: '네트워크 연결 오류', upstream_error: '제공처 응답 오류' };
function BroadcastCard({ video, selected, onSelect, rank }) {
  return <button className={`baseball-card ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => onSelect(video)}>
    <div className="baseball-thumbnail"><img src={video.thumbnail} alt="" loading="lazy" /><span className="sports-badge live">LIVE</span>{rank && <strong>TOP {rank}</strong>}</div>
    <div className="baseball-card-text"><h3>{video.title}</h3><p>{video.channelTitle}</p><span>{video.viewers === null ? '시청자 수 비공개' : `동시 시청 ${video.viewers.toLocaleString('ko-KR')}명`}</span></div>
  </button>;
}

export function Baseball() {
  const { data, select, refresh } = useBaseballLive();
  const [filter, setFilter] = useState('all');
  const games = filter === 'wbsc' ? data.games.filter((video) => video.channelId === data.wbscChannelId) : data.games;
  const top = games.filter((video) => video.viewers !== null).slice(0, 5);
  const selected = data.selected;
  const availability = data.status !== 'ready' ? 'unverified' : data.endedIds?.includes(selected?.id) ? 'ended'
    : data.games.some((video) => video.id === selected?.id) ? 'live' : 'unavailable';
  const chooseFilter = (next) => {
    setFilter(next);
    const first = next === 'wbsc' ? data.games.find((video) => video.channelId === data.wbscChannelId) : data.games[0];
    if (first) select(first);
  };
  const chooseVideo = (video) => {
    select(video);
    requestAnimationFrame(() => document.getElementById('baseball-watch')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  return <main className="sports-page baseball-page"><div className="sports-container">
    <div className="sports-title"><div><p className="sports-eyebrow">BASEBALL · WATCH TOGETHER</p><h1>야구<span>라이브</span></h1><p>지금 방송 중인 야구를 찾아 함께 보고 응원하세요.</p></div><button className="sports-primary" onClick={refresh}>목록 새로고침</button></div>
    <div className="sports-feed-note" role="status">{data.status === 'loading' ? '실시간 야구 방송을 검색하고 공개·임베드·방송 상태를 확인하고 있습니다.'
      : data.status === 'error' ? <><strong>{errors[data.code] || '검색 오류'}</strong><p>{data.message}</p></>
        : <><strong>검색된 라이브 {data.games.length}개</strong> · {new Date(data.checkedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' })} 확인 (한국 시간)<p>5분 캐시·자동 갱신 · YouTube 공개 데이터 · 실제 검색 결과만 표시합니다.</p></>}
      {data.truncated && data.status === 'ready' && <p>검색 제공처의 첫 150개 후보를 확인했습니다. 더 많은 후보가 있어 일부 방송은 포함되지 않을 수 있습니다.</p>}
    </div>
    <div className="baseball-filter-row"><div className="sports-filters" aria-label="야구 방송 필터"><button aria-pressed={filter === 'all'} onClick={() => chooseFilter('all')}>전체 라이브</button><button aria-pressed={filter === 'wbsc'} disabled={!data.wbscAvailable} onClick={() => chooseFilter('wbsc')}>WBSC 공식 채널</button></div>
      {data.status === 'ready' && !data.wbscAvailable && <p>WBSC 채널 식별을 확인하지 못해 공식 필터를 사용할 수 없습니다.</p>}</div>
    {selected && <div id="baseball-watch" className="sports-viewing baseball-viewing"><BaseballPlayer key={`player-${selected.id}`} video={selected} availability={availability} /><GameChat key={`chat-${selected.id}`} game={{ ...selected, status: availability }} roomCollection="baseballBroadcasts" sportName="야구" icon="⚾" /></div>}
    {data.status === 'ready' && <>
      {!games.length ? <div className="baseball-empty" role="status"><span>⚾</span><h2>{filter === 'wbsc' && !data.wbscAvailable ? 'WBSC 공식 채널을 확인하지 못했습니다' : '현재 확인된 야구 라이브가 없습니다'}</h2><p>진행 중인 방송만 표시합니다. 예시 영상이나 가짜 시청자 수는 추가하지 않습니다.</p></div> : <>
        <section className="baseball-top" aria-label="인기 야구 라이브"><div className="baseball-section-title"><h2>{top.length ? `인기 TOP ${top.length}` : '인기 순위'}</h2><p>동시 시청자 수가 공개된 방송 기준</p></div>
          {top.length ? <div className="baseball-top-grid">{top.map((video, index) => <BroadcastCard key={video.id} video={video} rank={index + 1} selected={selected?.id === video.id} onSelect={chooseVideo} />)}</div> : <p className="sports-feed-note">시청자 수가 공개된 방송이 없어 인기 순위를 표시하지 않습니다.</p>}</section>
        <section className="baseball-all" aria-label="전체 야구 라이브"><div className="baseball-section-title"><h2>전체 라이브 <span>{games.length}개</span></h2><p>검색 범위 안에서 확인된 방송 · 제목·채널 정보를 확인해 주세요</p></div><div className="baseball-all-grid">{games.map((video) => <BroadcastCard key={video.id} video={video} selected={selected?.id === video.id} onSelect={chooseVideo} />)}</div></section>
      </>}
    </>}
    <p className="baseball-source">출처: <a href="https://developers.google.com/youtube/v3/docs/search/list" target="_blank" rel="noopener noreferrer">YouTube Data API v3</a> · <a href="https://www.youtube.com/@WBSC" target="_blank" rel="noopener noreferrer">WBSC 채널</a>. 게임·시뮬레이션·하이라이트·해설·분석 제목은 제외합니다. 제목 필터만으로 실제 경기 여부를 완전히 판별할 수는 없습니다.</p>
  </div></main>;
}
