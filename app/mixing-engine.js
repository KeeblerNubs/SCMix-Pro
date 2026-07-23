const DEFAULT_CROSSFADE_SECONDS = 12;
const DEFAULT_EQ = Object.freeze({ low: 0, mid: 0, high: 0 });

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function equalPowerFade(position) {
  const phase = clamp(position, 0, 1) * (Math.PI / 2);
  return {
    outgoing: Math.cos(phase),
    incoming: Math.sin(phase),
  };
}

function createParamScheduler(param, value, atTime, rampSeconds = 0) {
  if (!param) return;
  param.cancelScheduledValues(atTime);
  if (rampSeconds > 0) {
    param.setValueAtTime(param.value, atTime);
    param.linearRampToValueAtTime(value, atTime + rampSeconds);
  } else {
    param.setValueAtTime(value, atTime);
  }
}

export class MixerDeck {
  constructor(audioContext, id) {
    this.audioContext = audioContext;
    this.id = id;
    this.source = null;
    this.buffer = null;
    this.startedAt = 0;
    this.pausedAt = 0;
    this.isPlaying = false;

    this.input = audioContext.createGain();
    this.low = audioContext.createBiquadFilter();
    this.mid = audioContext.createBiquadFilter();
    this.high = audioContext.createBiquadFilter();
    this.gain = audioContext.createGain();

    this.low.type = 'lowshelf';
    this.low.frequency.value = 320;
    this.mid.type = 'peaking';
    this.mid.frequency.value = 1000;
    this.mid.Q.value = 0.8;
    this.high.type = 'highshelf';
    this.high.frequency.value = 3200;

    this.input.connect(this.low);
    this.low.connect(this.mid);
    this.mid.connect(this.high);
    this.high.connect(this.gain);
    this.setEQ(DEFAULT_EQ);
    this.setGain(0);
  }

  connect(destination) {
    this.gain.connect(destination);
  }

  async load(source) {
    this.stop();
    if (source instanceof AudioBuffer) {
      this.buffer = source;
      return this;
    }

    if (source instanceof ArrayBuffer) {
      this.buffer = await this.audioContext.decodeAudioData(source.slice(0));
      return this;
    }

    if (typeof source === 'string') {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Unable to load audio source: ${response.status} ${response.statusText}`);
      }
      const data = await response.arrayBuffer();
      this.buffer = await this.audioContext.decodeAudioData(data);
      return this;
    }

    throw new TypeError('Deck source must be an AudioBuffer, ArrayBuffer, or URL string.');
  }

  play({ when = this.audioContext.currentTime, offset = this.pausedAt, gain = 1 } = {}) {
    if (!this.buffer) {
      throw new Error(`Deck ${this.id} cannot play before audio is loaded.`);
    }
    this.stop(false);
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.input);
    this.source.onended = () => {
      this.isPlaying = false;
      this.pausedAt = 0;
    };
    this.startedAt = when - offset;
    this.pausedAt = offset;
    this.isPlaying = true;
    this.setGain(gain, when);
    this.source.start(when, offset);
  }

  pause() {
    if (!this.isPlaying) return;
    this.pausedAt = this.audioContext.currentTime - this.startedAt;
    this.stop(false);
  }

  stop(resetOffset = true) {
    if (this.source) {
      try {
        this.source.stop();
      } catch (_) {
        // BufferSource may already be stopped; stopping is still idempotent for callers.
      }
      this.source.disconnect();
      this.source = null;
    }
    this.isPlaying = false;
    if (resetOffset) this.pausedAt = 0;
  }

  setGain(value, atTime = this.audioContext.currentTime, rampSeconds = 0) {
    createParamScheduler(this.gain.gain, clamp(value, 0, 1), atTime, rampSeconds);
  }

  setEQ({ low = this.low.gain.value, mid = this.mid.gain.value, high = this.high.gain.value } = {}, atTime = this.audioContext.currentTime) {
    this.low.gain.setValueAtTime(clamp(low, -24, 24), atTime);
    this.mid.gain.setValueAtTime(clamp(mid, -24, 24), atTime);
    this.high.gain.setValueAtTime(clamp(high, -24, 24), atTime);
  }

  get duration() {
    return this.buffer?.duration ?? 0;
  }

  get position() {
    return this.isPlaying ? this.audioContext.currentTime - this.startedAt : this.pausedAt;
  }
}

export class MixingEngine extends EventTarget {
  constructor({ audioContext, crossfadeSeconds = DEFAULT_CROSSFADE_SECONDS } = {}) {
    super();
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!audioContext && !Context) {
      throw new Error('Web Audio API is not available in this environment.');
    }

    this.audioContext = audioContext || new Context();
    this.crossfadeSeconds = crossfadeSeconds;
    this.master = this.audioContext.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.audioContext.destination);
    this.decks = [new MixerDeck(this.audioContext, 'A'), new MixerDeck(this.audioContext, 'B')];
    this.decks.forEach((deck) => deck.connect(this.master));
    this.activeDeckIndex = 0;
  }

  get activeDeck() {
    return this.decks[this.activeDeckIndex];
  }

  get cueDeck() {
    return this.decks[1 - this.activeDeckIndex];
  }

  async load(deckIndex, source) {
    await this.decks[deckIndex].load(source);
    this.dispatchEvent(new CustomEvent('deckload', { detail: { deckIndex } }));
  }

  async start() {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.activeDeck.play({ gain: 1 });
    this.cueDeck.setGain(0);
    this.dispatchEvent(new CustomEvent('play', { detail: { deckIndex: this.activeDeckIndex } }));
  }

  stop() {
    this.decks.forEach((deck) => deck.stop());
    this.dispatchEvent(new Event('stop'));
  }

  setMasterGain(value) {
    createParamScheduler(this.master.gain, clamp(value, 0, 1), this.audioContext.currentTime, 0.03);
  }

  setCrossfade(position, { atTime = this.audioContext.currentTime, rampSeconds = 0.03 } = {}) {
    const gains = equalPowerFade(position);
    this.activeDeck.setGain(gains.outgoing, atTime, rampSeconds);
    this.cueDeck.setGain(gains.incoming, atTime, rampSeconds);
    this.dispatchEvent(new CustomEvent('crossfade', { detail: { position: clamp(position, 0, 1), gains } }));
  }

  async transitionToCue({ duration = this.crossfadeSeconds, startCue = true } = {}) {
    const now = this.audioContext.currentTime;
    if (startCue && !this.cueDeck.isPlaying) {
      this.cueDeck.play({ when: now, gain: 0 });
    }
    this.setCrossfade(1, { atTime: now, rampSeconds: duration });
    globalThis.setTimeout(() => {
      this.activeDeck.stop();
      this.activeDeckIndex = 1 - this.activeDeckIndex;
      this.setCrossfade(0);
      this.dispatchEvent(new CustomEvent('transitionend', { detail: { deckIndex: this.activeDeckIndex } }));
    }, duration * 1000);
  }

  scheduleAutoMix({ remainingSeconds = this.crossfadeSeconds } = {}) {
    const leadTime = Math.max(0, this.activeDeck.duration - this.activeDeck.position - remainingSeconds);
    globalThis.setTimeout(() => this.transitionToCue({ duration: remainingSeconds }), leadTime * 1000);
    return leadTime;
  }
}

export function createMixingEngine(options) {
  return new MixingEngine(options);
}

export const mixingMath = Object.freeze({ clamp, equalPowerFade });
