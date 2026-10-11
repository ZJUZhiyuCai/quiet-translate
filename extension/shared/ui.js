import {t, localize} from './i18n.js';
import {LANGUAGES} from './core.js';
import {api as chrome} from './platform.js';

export const $ = selector => document.querySelector(selector);
export async function send(type, values = {}) {
  const result = await chrome.runtime.sendMessage({type, ...values});
  if (!result?.ok) throw new Error(result?.error || t("轻译暂时没有响应，请重新打开。"));
  return result;
}
export function languageOptions(element, value) {
  for (const [id, label] of Object.entries(LANGUAGES)) {
    const option = document.createElement('option'); option.value = id; option.textContent = label; element.append(option);
  }
  element.value = value;
}
export function theme(value) {
  document.documentElement.dataset.theme = value || 'system';
}
let toastTimer;
export function notify(text, isError = false) {
  const element = $('#notice');
  if (!element) return;
  element.textContent = text; element.hidden = false; element.dataset.error = String(isError);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.hidden = true; }, isError ? 6500 : 2800);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); notify(t("译文已复制")); }
  catch { notify(t("复制失败，请选中文字后按 Ctrl+C"), true); }
}
export function createTranslation(text, {target, onUpdate = () => {}, kind = 'workspace'} = {}) {
  const port = chrome.runtime.connect({name: 'qt-translate'});
  const id = crypto.randomUUID(); let settled = false, rejectPromise;
  const promise = new Promise((resolve, reject) => {
    rejectPromise = reject;
    port.onMessage.addListener(event => {
      if (event.id !== id) return;
      if (event.type === 'update') { onUpdate(event); return; }
      settled = true;
      if (event.type === 'done') resolve(event);
      else reject(Object.assign(new Error(event.error || t("翻译已停止")), {name: event.type === 'cancelled' ? 'AbortError' : 'Error'}));
      port.disconnect();
    });
    port.onDisconnect.addListener(() => { if (!settled) { settled = true; reject(new Error(t("连接中断，请重试。"))); } });
    port.postMessage({id, type: 'translate', text, kind, target});
  });
  return {promise, cancel() {
    if (settled) return;
    settled = true; port.postMessage({id, type: 'cancel'}); port.disconnect();
    rejectPromise(Object.assign(new Error(t("翻译已停止")), {name: 'AbortError'}));
  }};
}

localize(document);
