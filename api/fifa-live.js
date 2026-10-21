import { env } from 'node:process';
import { discoverFifaLive, discoverFifaLiveWithApi } from '../lib/fifa-live.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const deadline = AbortSignal.timeout(24000);
    const fetchOfficial = async (url) => {
      const result = await fetch(url, {
        signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]),
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' },
      });
      if (!result.ok) throw new Error('Official source unavailable');
      return result;
    };
    let games;
    const key = env.YOUTUBE_API_KEY || env.VITE_YOUTUBE_API_KEY;
    if (key) {
      try { games = await discoverFifaLiveWithApi(async (url) => (await fetchOfficial(url)).json(), key); }
      catch { /* Quota or API restrictions: try the public official channel. */ }
    }
    if (!games) games = await discoverFifaLive(async (url) => (await fetchOfficial(url)).text());
    response.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=25');
    return response.status(200).json({ games, checkedAt: new Date().toISOString(), source: 'FIFA official YouTube' });
  } catch {
    return response.status(502).json({ error: 'FIFA 공식 라이브를 확인하지 못했습니다. 공식 채널에서 확인해 주세요.' });
  }
}
