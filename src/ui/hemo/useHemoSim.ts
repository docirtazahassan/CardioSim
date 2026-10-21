/** React hook around the hemodynamics worker: keeps a rolling buffer of samples and beats. */
import { useEffect, useRef, useState } from 'react';
import type { HemoParams } from '../../data/types';
import type { BeatSummary, Sample } from '../../engine/hemo/simulator';
import { createHemoRunner, type RunnerMessage, type RunnerOutput } from '../../workers/hemoRunner';

const BUFFER_S = 13;

export interface HemoView {
  samples: Sample[];
  beats: BeatSummary[];
  ghost: { samples: Sample[]; beat: BeatSummary } | null;
  t: number;
  /** Increments when the preset is reset (charts can clear trails). */
  epoch: number;
}

export function useHemoSim(params: HemoParams, resetKey: string, running: boolean, speed: number) {
  const send = useRef<(m: RunnerMessage) => void>(() => {});
  const buf = useRef<{ samples: Sample[]; beats: BeatSummary[]; t: number }>({ samples: [], beats: [], t: 0 });
  const [view, setView] = useState<HemoView>({ samples: [], beats: [], ghost: null, t: 0, epoch: 0 });
  const ghostRef = useRef<HemoView['ghost']>(null);
  const epochRef = useRef(0);

  // create worker once
  useEffect(() => {
    let worker: Worker | null = null;
    let dirty = false;
    const onOut = (m: RunnerOutput) => {
      if (m.type === 'ghost') { ghostRef.current = { samples: m.samples, beat: m.beat }; dirty = true; return; }
      const b = buf.current;
      b.samples.push(...m.samples);
      const cut = m.t - BUFFER_S;
      let i = 0;
      while (i < b.samples.length && b.samples[i].t < cut) i++;
      if (i) b.samples.splice(0, i);
      b.beats.push(...m.beats);
      if (b.beats.length > 60) b.beats.splice(0, b.beats.length - 60);
      b.t = m.t;
      dirty = true;
    };
    try {
      worker = new Worker(new URL('../../workers/hemo.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<RunnerOutput>) => onOut(e.data);
      send.current = (m) => worker!.postMessage(m);
    } catch {
      const r = createHemoRunner(onOut);
      send.current = (m) => r.handle(m);
    }
    // repaint at ~12 fps
    const iv = setInterval(() => {
      if (!dirty) return;
      dirty = false;
      const b = buf.current;
      setView({ samples: b.samples.slice(), beats: b.beats.slice(), ghost: ghostRef.current, t: b.t, epoch: epochRef.current });
    }, 80);
    return () => {
      clearInterval(iv);
      send.current({ type: 'dispose' });
      worker?.terminate();
    };
  }, []);

  // full reset when the preset changes
  useEffect(() => {
    buf.current = { samples: [], beats: [], t: 0 };
    epochRef.current++;
    send.current({ type: 'reset', params, warmup: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // live parameter changes (maneuvers, interventions, sliders)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    send.current({ type: 'params', params });
  }, [params]);

  useEffect(() => { send.current({ type: 'run', running }); }, [running]);
  useEffect(() => { send.current({ type: 'speed', value: speed }); }, [speed]);

  return view;
}

/** Samples belonging to a beat. */
export function beatSamples(view: HemoView, beat: BeatSummary | undefined) {
  if (!beat) return [];
  return view.samples.filter((s) => s.t >= beat.tStart && s.t <= beat.tEnd);
}

/** Most recent beat that is completely inside the buffer. */
export function lastFullBeat(view: HemoView, back = 0) {
  const t0 = view.samples[0]?.t ?? Infinity;
  const ok = view.beats.filter((b) => b.tStart >= t0);
  return ok[ok.length - 1 - back];
}
