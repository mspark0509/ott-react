import { env } from 'node:process';
import { VIDEO_ID, liveErrorResponse, verifiedBaseball, videoDetails, youtubeClient } from '../lib/baseball-live.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ code: 'method_not_allowed' }); }
  const id = new URL(request.url, 'http://localhost').searchParams.get('id');
  if (!VIDEO_ID.test(id || '')) return response.status(400).json({ code: 'invalid_video' });
  try {
    const videos = await videoDetails(youtubeClient(env.YOUTUBE_API_KEY || env.VITE_YOUTUBE_API_KEY), [id]);
    const video = videos[0];
    const game = video && verifiedBaseball(video);
    return response.status(200).json({ id, state: video?.liveStreamingDetails?.actualEndTime ? 'ended' : game ? 'live' : 'unavailable' });
  } catch (error) { return liveErrorResponse(error, response); }
}
