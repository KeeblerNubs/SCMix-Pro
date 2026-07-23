const ZOOM_MUSICIAN_AUDIO_PROFILE = Object.freeze({
  originalSound: true,
  highFidelityMusicMode: true,
  stereoAudio: true,
  echoCancellation: true,
  sampleRate: 48000,
  channelCount: 2,
});

let browserAudioSession;

function getChromeRuntime() {
  return globalThis.chrome;
}

function captureCurrentTabAudio() {
  const chromeRuntime = getChromeRuntime();
  if (!chromeRuntime?.tabCapture?.capture) {
    return Promise.reject(new Error('Browser tab audio capture is not available in this browser.'));
  }

  return new Promise((resolve, reject) => {
    chromeRuntime.tabCapture.capture({ audio: true, video: false }, (stream) => {
      const error = chromeRuntime.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!stream) {
        reject(new Error('No browser audio stream was captured.'));
        return;
      }
      resolve(stream);
    });
  });
}

export function getZoomMusicianAudioProfile() {
  return { ...ZOOM_MUSICIAN_AUDIO_PROFILE };
}

export function getZoomSetupChecklist() {
  return [
    'In Zoom audio settings, enable Original Sound for Musicians.',
    'Turn High fidelity music mode on.',
    'Turn Stereo audio on.',
    'Keep Echo cancellation on when your microphone or room monitoring needs feedback control.',
    'Choose the SCMix Pro/virtual audio device as the Zoom microphone, or share this tab audio from Zoom Web.',
  ];
}

export async function startBrowserAudioShare(mixer) {
  if (!mixer?.connectExternalStream) {
    throw new TypeError('A MixingEngine instance is required to share browser audio.');
  }

  if (browserAudioSession) {
    return browserAudioSession;
  }

  const stream = await captureCurrentTabAudio();
  const input = mixer.connectExternalStream(stream, { label: 'Browser audio', gain: 1 });
  browserAudioSession = { stream, input };
  return browserAudioSession;
}

export function stopBrowserAudioShare() {
  if (!browserAudioSession) return;
  browserAudioSession.input.disconnect();
  browserAudioSession.stream.getTracks().forEach((track) => track.stop());
  browserAudioSession = undefined;
}
