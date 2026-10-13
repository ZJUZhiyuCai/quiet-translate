import {MODEL_ID, validateSettings, throwIfAborted} from './core.js';
import {modelConnection} from './models.js';
import {settingsForModel} from './providers.js';
import {streamTranslation} from './transport.js';

export const BENCHMARK_TEXT = 'A quiet garden gives us room to read and think.';
export const BENCHMARK_LIMIT = 2000;
export const BENCHMARK_TIMEOUT = 20000;

export function benchmarkPlan(draft, models, saved) {
  if (!Array.isArray(models) || !models.length || models.length > BENCHMARK_LIMIT || models.some(id => typeof id !== 'string' || !MODEL_ID.test(id))) {
    throw new Error('Invalid model test list');
  }
  const connection = modelConnection(draft, saved);
  const settings = validateSettings({target: draft.target, reasoningEffort: draft.reasoningEffort, tokenParameter: draft.tokenParameter}, connection);
  return {settings: {...settings, cache: false, glossary: ''}, models: [...new Set(models)]};
}

export async function probeModel(settings, model, {signal, fetcher, timeoutMs = BENCHMARK_TIMEOUT, now = () => performance.now()} = {}) {
  throwIfAborted(signal);
  const controller = new AbortController(), abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, {once: true});
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), timeoutMs);
  const config = settingsForModel(settings, model), started = now(); let firstMs = null, streaming = null;
  try {
    await streamTranslation(BENCHMARK_TEXT, config, {
      signal: controller.signal, fetcher, retry: false, maxOutputTokens: 512, maxResponseBytes: 65536,
      onResponse: meta => { streaming = meta.streaming; },
      onText: text => { if (firstMs === null && text.trim()) firstMs = Math.max(0, now() - started); },
    });
    throwIfAborted(controller.signal);
    return {model, status: 'ok', firstMs: streaming ? firstMs : null, elapsedMs: Math.max(0, now() - started), streaming, reasoningEffort: config.reasoningEffort};
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    const status = controller.signal.reason?.name === 'TimeoutError' ? 'timeout'
      : ({401: 'auth', 402: 'balance', 403: 'denied', 404: 'missing', 429: 'limited'})[error.status]
        || (error.status >= 500 ? 'server' : error.status ? 'rejected' : 'failed');
    // Never return provider error bodies, generated text, credentials or raw errors.
    return {model, status, firstMs: null, elapsedMs: Math.max(0, now() - started), streaming};
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export async function runBenchmark(plan, {signal, onResult = () => {}, probe = probeModel, scheduler} = {}) {
  let cursor = 0, completed = 0, stopReason = null;
  const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  async function worker() {
    while (cursor < plan.models.length && !combined.aborted) {
      const model = plan.models[cursor++];
      onResult({model, status: 'running'});
      try {
        const invoke = () => probe(plan.settings, model, {signal: combined});
        const result = await (scheduler ? scheduler.schedule(invoke, {signal: combined, priority: -5}) : invoke());
        if (combined.aborted) break;
        completed++; onResult(result);
        if (['auth', 'balance', 'limited'].includes(result.status)) { stopReason = result.status; controller.abort(); }
      } catch (error) { if (!combined.aborted) throw error; }
    }
  }
  try { await Promise.all([worker(), worker()]); }
  finally { controller.abort(); }
  return {completed, total: plan.models.length, stopReason: signal?.aborted ? 'cancelled' : stopReason};
}
