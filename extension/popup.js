import { getMixingEngine, startAutoMix, stopAutoMix } from '../app/automix.js';
import {
  getZoomSetupChecklist,
  startBrowserAudioShare,
  stopBrowserAudioShare,
} from '../app/zoom-audio-bridge.js';

const status = document.querySelector('#status');
const automix = document.querySelector('#automix');
const stop = document.querySelector('#stop');
const shareBrowserAudio = document.querySelector('#share-browser-audio');
const stopBrowserAudio = document.querySelector('#stop-browser-audio');
const zoomChecklist = document.querySelector('#zoom-checklist');

function setStatus(message) {
  status.textContent = message;
}

getZoomSetupChecklist().forEach((item) => {
  const li = document.createElement('li');
  li.textContent = item;
  zoomChecklist.append(li);
});

automix.addEventListener('click', async () => {
  setStatus('Choose tracks in a page integration to start Auto Mix.');
  try {
    await startAutoMix([], { crossfadeSeconds: 12 });
  } catch (error) {
    setStatus(error.message);
  }
});

stop.addEventListener('click', () => {
  stopAutoMix();
  setStatus('Mix stopped.');
});

shareBrowserAudio.addEventListener('click', async () => {
  setStatus('Starting browser audio capture without screen video...');
  try {
    const mixer = getMixingEngine();
    await startBrowserAudioShare(mixer);
    setStatus('Browser audio is routed into the SCMix Pro Zoom audio stream.');
  } catch (error) {
    setStatus(error.message);
  }
});

stopBrowserAudio.addEventListener('click', () => {
  stopBrowserAudioShare();
  setStatus('Browser audio sharing stopped.');
});

console.log('SCMix Pro mixing engine loaded');
