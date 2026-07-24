import { getMixingEngine, startAutoMix, stopAutoMix } from './lib/automix.js';
import {
  getZoomSetupChecklist,
  startBrowserAudioShare,
  stopBrowserAudioShare,
} from './lib/zoom-audio-bridge.js';
import {
  signIn,
  signOut,
  saveCredentials,
  getCredentials,
  hasCredentials,
  isSignedIn,
  getStoredUser,
  getAccessToken,
} from './lib/soundcloud-auth.js';

const status = document.querySelector('#status');
const automixBtn = document.querySelector('#automix');
const stopBtn = document.querySelector('#stop');
const shareAudioBtn = document.querySelector('#share-browser-audio');
const stopAudioBtn = document.querySelector('#stop-browser-audio');
const zoomChecklist = document.querySelector('#zoom-checklist');
const signedOutView = document.querySelector('#signed-out-view');
const signedInView = document.querySelector('#signed-in-view');
const credSetup = document.querySelector('#cred-setup');
const readyToSignin = document.querySelector('#ready-to-signin');
const clientIdInput = document.querySelector('#client-id');
const clientSecretInput = document.querySelector('#client-secret');
const saveCredsBtn = document.querySelector('#save-creds');
const signInBtn = document.querySelector('#sign-in');
const signOutBtn = document.querySelector('#sign-out');
const userNameEl = document.querySelector('#user-name');
const userUsernameEl = document.querySelector('#user-username');
const userAvatarEl = document.querySelector('#user-avatar');

function setStatus(message) {
  status.textContent = message;
}

function showView(view) {
  signedOutView.classList.toggle('hidden', view !== 'signed-out');
  signedInView.classList.toggle('hidden', view !== 'signed-in');

  if (view === 'signed-out') {
    hasCredentials().then((credsExist) => {
      credSetup.classList.toggle('hidden', credsExist);
      readyToSignin.classList.toggle('hidden', !credsExist);
    });
  }
}

async function updateSignedInUI() {
  const user = await getStoredUser();
  if (!user) return;

  userNameEl.textContent = user.username || 'SoundCloud User';
  userUsernameEl.textContent = `@${user.permalink || ''}`;
  if (user.avatar_url) {
    userAvatarEl.src = user.avatar_url;
  }
}

getZoomSetupChecklist().forEach((item) => {
  const li = document.createElement('li');
  li.textContent = item;
  zoomChecklist.append(li);
});

saveCredsBtn.addEventListener('click', async () => {
  const clientId = clientIdInput.value.trim();
  const clientSecret = clientSecretInput.value.trim();
  if (!clientId || !clientSecret) {
    setStatus('Please enter both Client ID and Client Secret.');
    return;
  }

  await saveCredentials(clientId, clientSecret);
  clientIdInput.value = '';
  clientSecretInput.value = '';
  showView('signed-out');
  setStatus('Credentials saved. Click "Sign in with SoundCloud".');
});

signInBtn.addEventListener('click', async () => {
  const { clientId, clientSecret } = await getCredentials();
  if (!clientId || !clientSecret) {
    setStatus('Save your SoundCloud Client ID and Secret first.');
    showView('signed-out');
    return;
  }

  signInBtn.disabled = true;
  setStatus('Opening SoundCloud sign-in…');
  try {
    const result = await signIn(clientId, clientSecret);
    setStatus(`Signed in as ${result.user?.username || 'SoundCloud user'}.`);
    showView('signed-in');
    await updateSignedInUI();
  } catch (error) {
    setStatus(`Sign-in failed: ${error.message}`);
  } finally {
    signInBtn.disabled = false;
  }
});

signOutBtn.addEventListener('click', async () => {
  await signOut();
  showView('signed-out');
  setStatus('Signed out.');
});

automixBtn.addEventListener('click', async () => {
  setStatus('Choose tracks in a page integration to start Auto Mix.');
  try {
    await startAutoMix([], { crossfadeSeconds: 12 });
  } catch (error) {
    setStatus(error.message);
  }
});

stopBtn.addEventListener('click', () => {
  stopAutoMix();
  setStatus('Mix stopped.');
});

shareAudioBtn.addEventListener('click', async () => {
  setStatus('Starting browser audio capture without screen video…');
  try {
    const mixer = getMixingEngine();
    await startBrowserAudioShare(mixer);
    setStatus('Browser audio is routed into the SCMix Pro Zoom audio stream.');
  } catch (error) {
    setStatus(error.message);
  }
});

stopAudioBtn.addEventListener('click', () => {
  stopBrowserAudioShare();
  setStatus('Browser audio sharing stopped.');
});

(async () => {
  const signedIn = await isSignedIn();
  if (signedIn) {
    showView('signed-in');
    await updateSignedInUI();
    const token = await getAccessToken();
    if (!token) {
      showView('signed-out');
      setStatus('Session expired. Sign in again.');
    } else {
      setStatus('Signed in and ready.');
    }
  } else {
    showView('signed-out');
  }
})();
