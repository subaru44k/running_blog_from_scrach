import { frequencyFromMidi } from './music.mjs';

let context;

function getContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  context ??= new AudioContextClass();
  return context;
}

export const AudioEngine = {
  isAvailable() {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
  },

  async unlock() {
    const audio = getContext();
    if (audio?.state === 'suspended') await audio.resume().catch(() => {});
  },

  playNote(note, duration = .45) {
    const audio = getContext();
    if (!audio || audio.state !== 'running') return;
    const time = audio.currentTime;
    const frequency = frequencyFromMidi(note.midi);
    const output = audio.createGain();
    output.gain.setValueAtTime(.0001, time);
    output.gain.exponentialRampToValueAtTime(.16, time + .018);
    output.gain.exponentialRampToValueAtTime(.07, time + .14);
    output.gain.exponentialRampToValueAtTime(.0001, time + duration);
    output.connect(audio.destination);
    for (const [type, multiplier, level] of [['sine', 1, 1], ['triangle', 2, .16]]) {
      const oscillator = audio.createOscillator();
      const layer = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency * multiplier, time);
      layer.gain.value = level;
      oscillator.connect(layer).connect(output);
      oscillator.start(time);
      oscillator.stop(time + duration + .02);
      oscillator.onended = () => { oscillator.disconnect(); layer.disconnect(); };
    }
    setTimeout(() => output.disconnect(), (duration + .1) * 1000);
  },

  playMetronomeBeat(accent = false) {
    const audio = getContext();
    if (!audio || audio.state !== 'running') return;
    const time = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = accent ? 740 : 520;
    gain.gain.setValueAtTime(.08, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .075);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(time);
    oscillator.stop(time + .08);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  },

  /** @param {{midi:number}[]} notes @param {(index:number,note:{midi:number})=>void} [onStep] @param {AbortSignal} [signal] @param {number} [stepMs] */
  async playSequence(notes, onStep = () => {}, signal, stepMs = 620) {
    for (const [index, note] of notes.entries()) {
      if (signal?.aborted) return false;
      onStep(index, note);
      this.playNote(note, Math.min(.48, stepMs / 1000 * .72));
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, stepMs);
        signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    return !signal?.aborted;
  },
};
