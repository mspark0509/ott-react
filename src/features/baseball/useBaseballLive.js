import { useEffect, useState } from 'react';

export function useBaseballLive() {
  const [version, setVersion] = useState(0);
  const [data, setData] = useState({ status: 'loading', games: [], selected: null, endedIds: [], wbscAvailable: false });
  useEffect(() => {
    let active = true;
    let controller;
    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch('/api/baseball-live', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(28000)]), cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) {
          if (active) setData((previous) => ({ ...previous, status: 'error', games: [], code: result.code, message: result.message }));
          return;
        }
        if (!Array.isArray(result.games) || !Number.isFinite(Date.parse(result.checkedAt))
          || Math.abs(Date.now() - Date.parse(result.checkedAt)) > 330000) throw new Error('Stale or invalid response');
        if (active) setData((previous) => ({ ...result, status: 'ready',
          selected: result.games.find((game) => game.id === previous.selected?.id) || previous.selected || result.games[0] || null }));
      } catch {
        if (active) setData((previous) => ({ ...previous, status: 'error', games: [], code: 'network_error', message: '라이브 목록을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.' }));
      }
    }
    load();
    const timer = setInterval(load, 300000);
    return () => { active = false; clearInterval(timer); controller?.abort(); };
  }, [version]);
  return { data,
    select: (game) => setData((previous) => ({ ...previous, selected: game })),
    refresh: () => { setData((previous) => ({ ...previous, status: previous.games.length ? previous.status : 'loading' })); setVersion((previous) => previous + 1); } };
}
