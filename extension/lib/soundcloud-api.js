import { getAccessToken } from './soundcloud-auth.js';

const API_BASE = 'https://api.soundcloud.com';

async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not signed in to SoundCloud. Sign in first.');
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json; charset=utf-8',
      Authorization: `OAuth ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new Error('SoundCloud session expired. Please sign in again.');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SoundCloud API error (${response.status}): ${text}`);
  }

  if (response.status === 204) return null;

  return response.json();
}

export async function getMe() {
  return apiFetch('/me');
}

export async function getLikes({ limit = 50, offset = 0 } = {}) {
  return apiFetch(`/likes/tracks?limit=${limit}&offset=${offset}&linked_partitioning=true`);
}

export async function getPlaylists({ showTracks = false, limit = 50 } = {}) {
  return apiFetch(`/me/playlists?show_tracks=${showTracks}&limit=${limit}&linked_partitioning=true`);
}

export async function getPlaylistTracks(playlistId, { limit = 100 } = {}) {
  return apiFetch(`/playlists/${playlistId}?limit=${limit}&linked_partitioning=true`);
}

export async function resolve(url) {
  return apiFetch(`/resolve?url=${encodeURIComponent(url)}`);
}

export async function searchTracks(query, { limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(offset),
    access: 'playable',
    linked_partitioning: 'true',
  });
  return apiFetch(`/tracks?${params.toString()}`);
}

export async function getTrack(trackId) {
  return apiFetch(`/tracks/${trackId}`);
}
