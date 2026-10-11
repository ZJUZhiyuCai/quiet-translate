import {t} from './i18n.js';
import {MAX_TEXT, normalizeText, splitText, cacheKey, abortError, throwIfAborted, publicSettings} from './core.js';
import {Scheduler} from './scheduler.js';
import {streamTranslation} from './transport.js';

export class TranslationEngine {
  constructor(cache, transport = streamTranslation) {
    this.cache = cache; this.transport = transport; this.scheduler = new Scheduler(); this.pending = new Map();
  }
  async chunk(text, settings, {signal, priority, onText}) {
    throwIfAborted(signal);
    const key = await cacheKey(text, settings);
    throwIfAborted(signal);
    const epoch = this.cache.epoch;
    if (settings.cache) {
      const value = await this.cache.get(key);
      throwIfAborted(signal);
      if (value) { onText(value, true); return {text: value, cached: true}; }
    }
    let entry = this.pending.get(key);
    if (entry?.controller.signal.aborted) entry = null;
    if (!entry) {
      entry = {controller: new AbortController(), listeners: new Set(), text: '', users: 0};
      this.pending.set(key, entry);
      entry.promise = this.scheduler.schedule(() => this.transport(text, settings, {
        signal: entry.controller.signal,
        onText: value => { entry.text = value; for (const callback of entry.listeners) callback(value, false); },
      }), {signal: entry.controller.signal, priority}).then(async value => {
        if (settings.cache) await this.cache.put(key, value, epoch);
        return {text: value, cached: false};
      }).finally(() => { if (this.pending.get(key) === entry) this.pending.delete(key); });
      entry.promise.catch(() => {});
    }
    entry.users++; entry.listeners.add(onText);
    if (entry.text) onText(entry.text, false);
    return new Promise((resolve, reject) => {
      let settled = false;
      const clean = () => {
        if (settled) return false;
        settled = true; signal?.removeEventListener('abort', abort); entry.listeners.delete(onText);
        if (--entry.users === 0) entry.controller.abort();
        return true;
      };
      const abort = () => { if (clean()) reject(signal?.reason || abortError()); };
      signal?.addEventListener('abort', abort, {once: true});
      entry.promise.then(value => { if (clean()) resolve(value); }, error => { if (clean()) reject(error); });
      if (signal?.aborted) abort();
    });
  }
  async translate(value, settings, {signal, priority = 0, onUpdate = () => {}} = {}) {
    const text = normalizeText(value);
    if (!text) throw new Error(t("先选中或粘贴一些文字。"));
    if (text.length > MAX_TEXT) throw new Error(t("单次最多支持 60,000 字符，请分成两次翻译。"));
    if (!publicSettings(settings).configured) throw new Error(t("请先在设置中连接翻译服务。"));
    const chunks = splitText(text);
    const parts = chunks.map(() => '');
    const finished = chunks.map(() => false);
    let completed = 0, hits = 0, cursor = 0;
    const controller = new AbortController();
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    // Buffer later chunks until preceding chunks finish, so already visible text never jumps.
    const emit = () => {
      const visible = [];
      for (let i = 0; i < parts.length; i++) { visible.push(parts[i]); if (!finished[i]) break; }
      onUpdate({text: visible.join('\n\n').trim(), completed, total: chunks.length, cached: completed === chunks.length && hits === completed});
    };
    async function worker(engine) {
      while (cursor < chunks.length) {
        throwIfAborted(combined);
        const index = cursor++;
        const result = await engine.chunk(chunks[index], settings, {
          signal: combined, priority,
          onText: translation => { parts[index] = translation; emit(); },
        });
        parts[index] = result.text; finished[index] = true; completed++; if (result.cached) hits++; emit();
      }
    }
    try { await Promise.all(Array.from({length: Math.min(3, chunks.length)}, () => worker(this))); }
    catch (error) { controller.abort(); throw error; }
    return {text: parts.join('\n\n').trim(), cached: hits === chunks.length, chunks: chunks.length};
  }
}
