// SoundCloud OAuth 2.1 with PKCE — Chrome Extension auth module

const AUTH_BASE = 'https://secure.soundcloud.com';
const TOKEN_URL = `${AUTH_BASE}/oauth/token`;
const AUTH_URL = `${AUTH_BASE}/authorize`;
const API_BASE = 'https://api.soundcloud.com';

const STORAGE_KEYS = {
  accessToken: 'sc_access_token',
  refreshToken: 'sc_refresh_token',
  expiresAt: 'sc_expires_at',
  user: 'sc_user',
};

function base64URLEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(digest);
}

async function getFromStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => resolve(result[key] ?? null));
  });
}

async function setInStorage(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

async function removeFromStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

export async function getAccessToken() {
  const token = await getFromStorage(STORAGE_KEYS.accessToken);
  const expiresAt = await getFromStorage(STORAGE_KEYS.expiresAt);

  if (!token) return null;
  if (expiresAt && Date.now() < expiresAt) return token;

  return refreshAccessToken();
}

export async function getStoredUser() {
  return getFromStorage(STORAGE_KEYS.user);
}

export async function signIn(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    throw new Error('SoundCloud client_id and client_secret are required. Register an app at https://soundcloud.com/you/apps');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const redirectUri = chrome.identity.getRedirectURL('scmix-auth');
  const state = generateCodeVerifier();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'non-expiring',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  let responseUrl;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({
      url: `${AUTH_URL}?${params.toString()}`,
      interactive: true,
    });
  } catch (error) {
    throw new Error(`SoundCloud auth popup was closed or failed: ${error.message}`);
  }

  if (!responseUrl) {
    throw new Error('No redirect URL received from auth flow.');
  }

  const url = new URL(responseUrl);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (!code) {
    const error = url.searchParams.get('error') || 'unknown_error';
    const description = url.searchParams.get('error_description') || 'No authorization code received';
    throw new Error(`SoundCloud auth error: ${error} — ${description}`);
  }

  if (returnedState !== state) {
    throw new Error('State mismatch — possible CSRF attack. Auth aborted.');
  }

  const tokenData = await exchangeCodeForToken(code, codeVerifier, clientId, clientSecret, redirectUri);
  await storeTokens({ ...tokenData, clientId, clientSecret });

  const user = await fetchCurrentUser(tokenData.access_token);
  await setInStorage({ [STORAGE_KEYS.user]: user });

  return { user, ...tokenData };
}

async function exchangeCodeForToken(code, codeVerifier, clientId, clientSecret, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json; charset=utf-8',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Token exchange succeeded but no access_token in response.');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in ?? 3600,
    scope: data.scope,
    token_type: data.token_type,
  };
}

async function refreshAccessToken() {
  const refreshToken = await getFromStorage(STORAGE_KEYS.refreshToken);
  const clientId = await getFromStorage('sc_client_id');
  const clientSecret = await getFromStorage('sc_client_secret');

  if (!refreshToken || !clientId || !clientSecret) {
    await signOut();
    return null;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json; charset=utf-8',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    await signOut();
    return null;
  }

  const data = await response.json();
  await storeTokens({ ...data, clientId, clientSecret });
  return data.access_token;
}

async function storeTokens(tokenData) {
  const expiresIn = tokenData.expires_in ?? 3600;
  const expiresAt = Date.now() + expiresIn * 1000 - 60_000;
  const toStore = {
    [STORAGE_KEYS.accessToken]: tokenData.access_token,
    [STORAGE_KEYS.expiresAt]: expiresAt,
  };

  if (tokenData.refresh_token) toStore[STORAGE_KEYS.refreshToken] = tokenData.refresh_token;
  if (tokenData.clientId) toStore.sc_client_id = tokenData.clientId;
  if (tokenData.clientSecret) toStore.sc_client_secret = tokenData.clientSecret;

  await setInStorage(toStore);
}

async function fetchCurrentUser(accessToken) {
  const response = await fetch(`${API_BASE}/me`, {
    headers: {
      accept: 'application/json; charset=utf-8',
      Authorization: `OAuth ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  return response.json();
}

export async function signOut() {
  await removeFromStorage(Object.values(STORAGE_KEYS));
  await removeFromStorage(['sc_client_id', 'sc_client_secret']);
}

export async function saveCredentials(clientId, clientSecret) {
  await setInStorage({
    sc_client_id: clientId,
    sc_client_secret: clientSecret,
  });
}

export async function getCredentials() {
  const clientId = await getFromStorage('sc_client_id');
  const clientSecret = await getFromStorage('sc_client_secret');
  return { clientId, clientSecret };
}

export async function hasCredentials() {
  const { clientId, clientSecret } = await getCredentials();
  return Boolean(clientId && clientSecret);
}

export async function isSignedIn() {
  const token = await getFromStorage(STORAGE_KEYS.accessToken);
  return Boolean(token);
}
