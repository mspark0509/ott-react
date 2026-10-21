import { env } from 'node:process';
import { createLiveService, liveErrorResponse } from '../lib/baseball-live.js';

const getLive = createLiveService({ getKey: () => env.YOUTUBE_API_KEY || env.VITE_YOUTUBE_API_KEY });
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ code: 'method_not_allowed' }); }
  try {
    const result = await getLive();
    // Use the source timestamp so a new CDN fill cannot renew an older in-memory result.
    const remaining = Math.max(0, Math.floor((300000 - (Date.now() - Date.parse(result.checkedAt))) / 1000));
    if (remaining) response.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${remaining}`);
    return response.status(200).json(result);
  } catch (error) { return liveErrorResponse(error, response); }
}
