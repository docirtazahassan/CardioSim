/**
 * Real-time driver for HemoSimulator. Used inside the Web Worker, and directly on the main thread
 * as a fallback when workers are unavailable.
 */
import type { HemoParams } from '../data/types';
import { paramsFor } from '../engine/hemo/params';
import { HemoSimulator, type BeatSummary, type Sample } from '../engine/hemo/simulator';

export type RunnerMessage =
  | { type: 'reset'; params: HemoParams; warmup?: number }
  | { type: 'params'; params: HemoParams }
  | { type: 'speed'; value: number }
  | { type: 'run'; running: boolean }
  | { type: 'dispose' };

export type RunnerOutput =
  | { type: 'frame'; samples: Sample[]; beats: BeatSummary[]; t: number }
  | { type: 'ghost'; samples: Sample[]; beat: BeatSummary };

const TICK_MS = 50;

export function createHemoRunner(post: (m: RunnerOutput) => void) {
  let sim: HemoSimulator | null = null;
  let speed = 1;
  let running = true;
  let lastSampleT = 0;
  let lastBeatCount = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let ghostSent = false;

  const sendGhost = () => {
    if (ghostSent) return;
    ghostSent = true;
    const g = new HemoSimulator(paramsFor('normal-hemo'), { sampleEvery: 4, maxSamples: 4000 });
    g.advance(14);
    const b = g.beats[g.beats.length - 2];
    if (b) post({ type: 'ghost', beat: b, samples: g.samples.filter((s) => s.t >= b.tStart && s.t <= b.tEnd) });
  };

  const flush = () => {
    if (!sim) return;
    const fresh = sim.samples.filter((s) => s.t > lastSampleT);
    if (fresh.length) lastSampleT = fresh[fresh.length - 1].t;
    const newBeats = sim.beats.length >= lastBeatCount ? sim.beats.slice(lastBeatCount) : sim.beats.slice(-1);
    lastBeatCount = sim.beats.length;
    post({ type: 'frame', samples: fresh, beats: newBeats, t: sim.t });
  };

  const tick = () => {
    if (!sim || !running) return;
    sim.advance((TICK_MS / 1000) * speed);
    // keep the sample buffer from growing without bound
    if (sim.samples.length > 5000) sim.samples.splice(0, sim.samples.length - 5000);
    flush();
  };

  return {
    handle(m: RunnerMessage) {
      switch (m.type) {
        case 'reset': {
          sim = new HemoSimulator(m.params, { sampleEvery: 4, maxSamples: 8000 });
          sim.advance(m.warmup ?? 12);
          // send the last 12 s of warm-up so the screen is full immediately
          lastSampleT = sim.t - 12;
          lastBeatCount = Math.max(0, sim.beats.length - 14);
          flush();
          sendGhost();
          if (!timer) timer = setInterval(tick, TICK_MS);
          break;
        }
        case 'params':
          sim?.setParams(m.params);
          break;
        case 'speed':
          speed = m.value;
          break;
        case 'run':
          running = m.running;
          break;
        case 'dispose':
          if (timer) clearInterval(timer);
          timer = null;
          sim = null;
          break;
      }
    },
  };
}
