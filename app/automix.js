import { createMixingEngine } from './mixing-engine.js';

let engine;

export function getMixingEngine(options = {}) {
  if (!engine) {
    engine = createMixingEngine(options);
  }
  return engine;
}

export async function startAutoMix(playlist = [], options = {}) {
  const mixer = getMixingEngine(options);
  const [firstTrack, secondTrack] = playlist;

  if (!firstTrack) {
    throw new Error('AutoMix requires at least one track source.');
  }

  await mixer.load(0, firstTrack);
  if (secondTrack) {
    await mixer.load(1, secondTrack);
  }

  await mixer.start();
  if (secondTrack) {
    mixer.scheduleAutoMix({ remainingSeconds: options.crossfadeSeconds });
  }

  return mixer;
}

export function stopAutoMix() {
  if (engine) {
    engine.stop();
  }
}
