const { google } = require('googleapis');
const db = require('../db');

const youtube = google.youtube('v3');

function ensureKey() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if(!apiKey) throw new Error('Missing YOUTUBE_API_KEY');
  return apiKey;
}

// Fetch stats for a known channel ID
async function fetchChannelStats(channelId) {
  const apiKey = ensureKey();
  const resp = await youtube.channels.list({
    key: apiKey,
    id: channelId,
    part: ['snippet','statistics']
  });
  if(!resp.data.items || resp.data.items.length === 0) return null;
  const ch = resp.data.items[0];
  return mapChannel(ch);
}

// Search by query (name, handle, etc.) returning first matching channel summary
async function searchChannel(query) {
  const apiKey = ensureKey();
  // If user pasted a URL or handle, try to extract patterns
  const trimmed = query.trim();
  // Direct channel id
  if(/^UC[0-9A-Za-z_-]{20,}$/.test(trimmed)) {
    return await fetchChannelStats(trimmed);
  }
  // Handle format @something
  let q = trimmed.replace(/^@/, '');
  const resp = await youtube.search.list({
    key: apiKey,
    q,
    type: ['channel'],
    maxResults: 1,
    part: ['snippet']
  });
  if(!resp.data.items || resp.data.items.length === 0) return null;
  const item = resp.data.items[0];
  const channelId = item.id?.channelId;
  if(!channelId) return null;
  return await fetchChannelStats(channelId); // get full stats
}

function mapChannel(ch) {
  return {
    channel_id: ch.id,
    title: ch.snippet?.title,
    description: ch.snippet?.description,
    country: ch.snippet?.country || null,
    thumbnails: ch.snippet?.thumbnails || {},
    view_count: parseInt(ch.statistics?.viewCount||'0',10),
    subscriber_count: parseInt(ch.statistics?.subscriberCount||'0',10),
    video_count: parseInt(ch.statistics?.videoCount||'0',10)
  };
}

async function saveSnapshot(stats) {
  if(!stats) return null;
  const { channel_id, title, description, country, view_count, subscriber_count, video_count } = stats;
  const res = await db.query(`INSERT INTO youtube_channel_snapshots
    (channel_id,title,description,country,view_count,subscriber_count,video_count)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [channel_id,title,description,country,view_count,subscriber_count,video_count]);
  return res.rows[0];
}

async function latestSnapshot(channelId) {
  const res = await db.query(`SELECT * FROM youtube_channel_snapshots
    WHERE channel_id = $1 ORDER BY fetched_at DESC LIMIT 1`, [channelId]);
  return res.rows[0] || null;
}

async function historicalSnapshots(channelId, limit=30) {
  const res = await db.query(`SELECT * FROM youtube_channel_snapshots
    WHERE channel_id = $1 ORDER BY fetched_at DESC LIMIT $2`, [channelId, limit]);
  return res.rows;
}

async function listDistinctChannelIds() {
  const res = await db.query('SELECT DISTINCT channel_id FROM youtube_channel_snapshots');
  return res.rows.map(r=>r.channel_id);
}

// Compute summary including deltas and simple grade placeholder
async function getChannelSummary(channelId) {
  const latest = await latestSnapshot(channelId) || await (async ()=>{ const s = await fetchChannelStats(channelId); if(s) await saveSnapshot(s); return await latestSnapshot(channelId); })();
  if(!latest) return null;
  const history = await historicalSnapshots(channelId, 60); // up to 60 recent snapshots
  const last7 = history.filter((_,i)=> i < 7); // history ordered DESC
  const last30 = history.filter((_,i)=> i < 30);
  const delta = (arr, field) => {
    if(arr.length < 2) return 0;
    const newest = arr[0][field];
    const oldest = arr[arr.length-1][field];
    return newest - oldest;
  };
  const subs7 = delta(last7, 'subscriber_count');
  const subs30 = delta(last30, 'subscriber_count');
  const views30 = delta(last30, 'view_count');
  const earningsLow = Math.round((views30/1000) * 0.5); // simplistic CPM $0.5 - $4.0
  const earningsHigh = Math.round((views30/1000) * 4);
  const grade = computeGrade(latest.subscriber_count, latest.view_count);
  return { latest, subs7, subs30, views30, estimatedMonthlyEarnings: { low: earningsLow, high: earningsHigh }, grade };
}

function computeGrade(subs, views) {
  if(subs > 10000000) return 'A+';
  if(subs > 5000000) return 'A';
  if(subs > 1000000) return 'A-';
  if(subs > 500000) return 'B+';
  if(subs > 100000) return 'B';
  if(subs > 50000) return 'B-';
  if(subs > 10000) return 'C+';
  if(subs > 1000) return 'C';
  return 'D';
}

module.exports = { fetchChannelStats, searchChannel, saveSnapshot, latestSnapshot, historicalSnapshots, listDistinctChannelIds, getChannelSummary };
