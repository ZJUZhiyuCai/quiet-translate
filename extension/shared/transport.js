import {t} from './i18n.js';
import {translationPrompt, httpError, throwIfAborted} from './core.js';

export async function readSSE(body, onEvent, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', data = [];
  function line(value) {
    if (value === '') {
      if (data.length) { onEvent(data.join('\n')); data = []; }
    } else if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
  }
  try {
    while (true) {
      throwIfAborted(signal);
      const {done, value} = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, {stream: true});
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        line(buffer.slice(0, index).replace(/\r$/, '')); buffer = buffer.slice(index + 1);
      }
      if (buffer.length > 1024 * 1024) throw new Error(t("服务响应过大，请重试。"));
      if (done) { if (buffer) line(buffer.replace(/\r$/, '')); line(''); break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

const pause = (ms, signal) => new Promise((resolve, reject) => {
  throwIfAborted(signal);
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  signal?.addEventListener('abort', abort, {once: true});
});

export async function streamTranslation(text, settings, {signal, onText, fetcher = fetch} = {}) {
  let result = '', finish = null, complete = false;
  const timeout = AbortSignal.timeout(60000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const payload = {
    model: settings.model, stream: true,
    [settings.tokenParameter || 'max_tokens']: Math.min(8192, Math.max(2048, Math.ceil(text.length * 2.5) + 512)),
    messages: [{role: 'system', content: translationPrompt(settings.target, settings.glossary)}, {role: 'user', content: text}],
  };
  // Many compatible providers reject unsupported sampling/reasoning parameters.
  if (settings.reasoningEffort && settings.reasoningEffort !== 'default') payload.reasoning_effort = settings.reasoningEffort;
  const headers = {'Content-Type': 'application/json'};
  if (settings.authMode !== 'none') headers.Authorization = 'Bearer ' + settings.apiKey;
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    throwIfAborted(combined);
    response = await fetcher(settings.endpoint + '/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify(payload), signal: combined, credentials: 'omit', redirect: 'error', cache: 'no-store',
    });
    if (response.ok) break;
    if (attempt === 0 && [408, 429, 500, 502, 503, 504].includes(response.status)) {
      const seconds = Number(response.headers.get('retry-after'));
      await response.body?.cancel();
      await pause(seconds > 0 ? Math.min(seconds * 1000, 8000) : 700 + Math.random() * 300, combined);
    } else { await response.body?.cancel(); throw httpError(response.status); }
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') throw new Error(t("译文被服务截断，请减少文本长度后重试。"));
    if (typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) throw new Error(t("服务返回了空译文，请重试。"));
    onText?.(choice.message.content); return choice.message.content.trim();
  }
  if (!response.body) throw new Error(t("服务没有返回内容，请重试。"));
  await readSSE(response.body, raw => {
    if (raw === '[DONE]') { complete = true; return; }
    let event;
    try { event = JSON.parse(raw); } catch { throw new Error(t("翻译数据传输异常，请重试。")); }
    if (event.error) throw new Error(t("翻译服务中断了响应，请重试。"));
    const choice = event.choices?.[0];
    if (choice?.finish_reason) { finish = choice.finish_reason; complete = true; }
    const content = choice?.delta?.content;
    if (typeof content === 'string') { result += content; onText?.(result); }
    if (result.length > 100000) throw new Error(t("服务响应过大，请减少文本长度。"));
  }, combined);
  throwIfAborted(combined);
  if (finish === 'length') throw new Error(t("译文被服务截断，请减少文本长度后重试。"));
  if (finish === 'content_filter') throw new Error(t("服务未能翻译这段内容。"));
  if (!complete) throw new Error(t("连接提前结束，译文尚未完成，请重试。"));
  if (!result.trim()) throw new Error(t("服务返回了空译文，请重试。"));
  return result.trim();
}
