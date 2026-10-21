/// <reference lib="webworker" />
/**
 * Runs the circulation model off the main thread and streams samples to the UI in real time.
 * Messages in:  reset {params, warmup} · params {params} · speed {value} · run {running}
 * Messages out: frame {samples, beats} · ghost {samples}
 */
import { createHemoRunner, type RunnerMessage } from './hemoRunner';

const runner = createHemoRunner((msg) => (self as unknown as Worker).postMessage(msg));
self.onmessage = (e: MessageEvent<RunnerMessage>) => runner.handle(e.data);
