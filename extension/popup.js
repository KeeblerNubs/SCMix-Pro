import { startAutoMix, stopAutoMix } from '../app/automix.js';

const status = document.querySelector('#status');
const automix = document.querySelector('#automix');
const stop = document.querySelector('#stop');

function setStatus(message) {
  status.textContent = message;
}

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

console.log('SCMix Pro mixing engine loaded');
