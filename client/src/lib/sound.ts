// Sons synthétisés (Web Audio), aucun fichier à charger : cloche du meneur, votes, cartes de quête, harpe, glas et chœurs.
import { useStore } from '../store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!useStore.getState().prefs.sound) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number; attack?: number } = {}): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.1, t0 + (opts.attack ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, opts: { gain?: number; delay?: number; freq?: number; type?: BiquadFilterType; q?: number; fade?: number; sweep?: number } = {}): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const buffer = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
  const data = buffer.getChannelData(0);
  const fade = opts.fade ?? 2;
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** fade;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.setValueAtTime(opts.freq ?? 2400, t0);
  if (opts.sweep) filter.frequency.exponentialRampToValueAtTime(opts.sweep, t0 + dur);
  if (opts.q) filter.Q.value = opts.q;
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.25;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t0);
}

/** Une cloche : une fondamentale et ses partiels inharmoniques qui s'éteignent lentement. */
function bell(freq: number, opts: { gain?: number; delay?: number; dur?: number } = {}): void {
  const g = opts.gain ?? 0.06;
  const dur = opts.dur ?? 1.8;
  [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(freq * m, dur / (1 + i * 0.6), { gain: g / (1 + i * 1.4), delay: opts.delay, attack: 0.004 }));
}

/** Ré mineur et Ré majeur, pour la harpe et les chœurs. */
const D = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880];
const Dm = [293.66, 329.63, 349.23, 440, 466.16, 587.33, 659.25, 698.46, 880];

/** Un accord tenu, comme des voix lointaines. */
function choir(notes: number[], dur: number, gain = 0.035, delay = 0): void {
  for (const f of notes) {
    tone(f, dur, { type: 'sawtooth', gain: gain * 0.35, delay, attack: dur * 0.35 });
    tone(f * 1.003, dur, { type: 'triangle', gain, delay, attack: dur * 0.3 });
  }
}

export const sfx = {
  /** À toi de mener, de voter ou de jouer : une cloche claire. */
  turn: () => bell(D[5], { gain: 0.05, dur: 1.4 }),
  /** La nuit tombe : une cloche grave et une nappe sourde. */
  night: () => {
    bell(D[0] / 2, { gain: 0.07, dur: 2.6 });
    choir([D[0] / 2, D[3] / 2], 2.4, 0.025, 0.2);
  },
  /** Ton rôle se dévoile. */
  reveal: (evil: boolean) => {
    const scale = evil ? Dm : D;
    [0, 2, 4, 5].forEach((n, i) => tone(scale[n], 0.9, { type: 'triangle', gain: 0.05, delay: i * 0.09 }));
    choir(evil ? [Dm[0], Dm[2], Dm[3]] : [D[0], D[2], D[3]], 1.6, 0.025, 0.25);
  },
  /** Un chevalier rejoint ou quitte l'équipe. */
  pick: (on: boolean) => tone(on ? 660 : 440, 0.09, { type: 'triangle', gain: 0.05, slide: on ? 1.25 : 0.8 }),
  /** Ton vote est posé. */
  vote: (yes: boolean) => {
    if (yes) tone(D[6], 0.25, { type: 'triangle', gain: 0.05 });
    else tone(D[0] / 2, 0.25, { type: 'square', gain: 0.025, slide: 0.85 });
  },
  /** Les bulletins se retournent tous ensemble. */
  ballots: (approved: boolean) => {
    for (let i = 0; i < 5; i++) noise(0.05, { gain: 0.14, freq: 2400 + i * 300, delay: i * 0.05, fade: 3 });
    if (approved) [3, 5, 7].forEach((n, i) => tone(D[n], 0.5, { type: 'triangle', gain: 0.05, delay: 0.3 + i * 0.08 }));
    else [4, 2, 0].forEach((n, i) => tone(Dm[n] / 2, 0.45, { type: 'square', gain: 0.022, delay: 0.3 + i * 0.1 }));
  },
  /** Une carte de quête qu'on retourne. */
  flip: (fail: boolean) => {
    noise(0.06, { gain: 0.25, freq: 3000, q: 0.8, fade: 3 });
    if (fail) {
      tone(110, 0.5, { type: 'sawtooth', gain: 0.04, slide: 0.7 });
      noise(0.3, { gain: 0.12, freq: 700, sweep: 200, fade: 1.5, delay: 0.03 });
    } else tone(D[4], 0.3, { type: 'triangle', gain: 0.045 });
  },
  /** Quête réussie : une harpe qui monte. */
  success: () => [0, 2, 3, 4, 5, 7, 8].forEach((n, i) => tone(D[n], 0.7, { type: 'triangle', gain: 0.055, delay: i * 0.07 })),
  /** Quête échouée : un glas. */
  fail: () => {
    bell(D[0] / 2, { gain: 0.08, dur: 2.4 });
    bell(Dm[2] / 2, { gain: 0.05, dur: 2.2, delay: 0.45 });
  },
  /** L'Assassin frappe. */
  stab: () => {
    noise(0.22, { gain: 0.2, freq: 1500, sweep: 7000, q: 2, fade: 1 });
    tone(80, 0.6, { type: 'sine', gain: 0.12, delay: 0.2, slide: 0.5 });
  },
  /** Fin de partie : les chœurs du camp vainqueur. */
  fanfare: (won: boolean, good: boolean) => {
    const scale = good ? D : Dm;
    choir([scale[0], scale[2], scale[3], scale[5]], 2.6, won ? 0.03 : 0.018);
    if (won) [0, 2, 3, 5, 3, 5, 8].forEach((n, i) => tone(scale[n], i === 6 ? 1.1 : 0.28, { type: 'triangle', gain: 0.06, delay: 0.4 + i * 0.14 }));
  },
  tap: () => tone(880, 0.05, { gain: 0.025, slide: 1.4 }),
};
