import {t} from './shared/i18n.js';
import {DEFAULTS, LANGUAGES, MAX_TEXT, validateSettings, publicSettings, readableError, normalizeText} from './shared/core.js';
import {TranslationCache} from './shared/cache.js';
import {TranslationEngine} from './shared/engine.js';
import {SettingsStore} from './shared/settings.js';
import {api as chrome} from './shared/platform.js';
import {modelConnection, fetchModels} from './shared/models.js';

const cache = new TranslationCache();
const engine = new TranslationEngine(cache);
const settingsStore = new SettingsStore();
let settings;
const ready = (async () => {
  await chrome.storage.local.setAccessLevel?.({accessLevel: 'TRUSTED_CONTEXTS'});
  await chrome.storage.session.setAccessLevel?.({accessLevel: 'TRUSTED_CONTEXTS'});
  const stored = await settingsStore.get();
  // Preserve the low-effort behavior of installations created before 1.1.
  if (stored?.apiKey && stored.reasoningEffort === undefined) stored.reasoningEffort = 'low';
  settings = validateSettings(stored || {}, DEFAULTS);
  if (!stored) {
    try {
      const bootstrap = await (await fetch(chrome.runtime.getURL('bootstrap.json'))).json();
      settings = validateSettings(bootstrap, DEFAULTS);
    } catch {}
    await settingsStore.set(settings);
  }
})();

function trusted(sender) { return sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL('')); }
function assertTrusted(sender) { if (!trusted(sender)) throw new Error(t("此操作只能在轻译设置中完成。")); }
async function broadcast() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id, {type: 'qt-settings', settings: publicSettings(settings)}, {frameId: 0})));
}
async function sendToPage(tabId, message) {
  try { return await chrome.tabs.sendMessage(tabId, message, {frameId: 0}); }
  catch {
    try {
      await chrome.scripting.executeScript({target: {tabId}, files: ['shared/locale.js', 'content.js']});
      return await chrome.tabs.sendMessage(tabId, message, {frameId: 0});
    } catch { throw new Error(t("这个页面不允许扩展运行。可复制文字到「长文翻译」。")); }
  }
}
async function openWorkspace(text = '') {
  let fragment = '';
  if (text) {
    const id = crypto.randomUUID();
    await chrome.storage.session.set({['draft:' + id]: normalizeText(text).slice(0, MAX_TEXT)});
    fragment = '#' + id;
  }
  await chrome.tabs.create({url: chrome.runtime.getURL('workspace.html') + fragment});
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  (async () => {
    await ready;
    switch (message?.type) {
      case 'qt-settings': return {settings: publicSettings(settings)};
      case 'qt-export-settings': {
        assertTrusted(sender);
        const exported = {...settings};
        if (message.includeKey !== true) delete exported.apiKey;
        return {settings: exported};
      }
      case 'qt-save': {
        assertTrusted(sender);
        const next = validateSettings(message.settings || {}, settings);
        const origin = new URL(next.endpoint).origin + '/*';
        if (next.endpoint !== settings.endpoint && !await chrome.permissions.contains({origins: [origin]})) throw new Error(t("请先允许访问该翻译接口。"));
        await settingsStore.set(next); settings = next; await broadcast();
        return {settings: publicSettings(settings)};
      }
      case 'qt-active': {
        assertTrusted(sender);
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (!tab?.id || !/^https?:/.test(tab.url || '')) return {supported: false};
        const state = await sendToPage(tab.id, {type: 'qt-state'});
        return {supported: true, tabId: tab.id, host: new URL(tab.url).host, ...state};
      }
      case 'qt-control': {
        assertTrusted(sender);
        if (!Number.isInteger(message.tabId) || !['qt-toggle', 'qt-retry'].includes(message.action)) throw new Error(t("无效操作。"));
        return await sendToPage(message.tabId, {type: message.action});
      }
      case 'qt-open-settings': await chrome.runtime.openOptionsPage(); return {};
      case 'qt-open-workspace': await openWorkspace(typeof message.text === 'string' ? message.text : ''); return {};
      case 'qt-draft': {
        assertTrusted(sender);
        if (!/^[a-f0-9-]{36}$/.test(message.id || '')) return {text: ''};
        const key = 'draft:' + message.id;
        const result = await chrome.storage.session.get(key); await chrome.storage.session.remove(key);
        return {text: result[key] || ''};
      }
      case 'qt-cache-stats': assertTrusted(sender); return await cache.stats();
      case 'qt-cache-clear': assertTrusted(sender); await cache.clear(); return {};
      case 'qt-page-state': {
        if (sender.tab?.id) {
          await chrome.action.setBadgeText({tabId: sender.tab.id, text: message.enabled ? t("译") : ''});
          await chrome.action.setBadgeBackgroundColor({tabId: sender.tab.id, color: '#397965'});
        }
        return {};
      }
      default: throw new Error(t("未知操作。"));
    }
  })().then(result => reply({ok: true, ...result}), error => reply({ok: false, error: readableError(error)}));
  return true;
});

chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'qt-models') {
    if (!trusted(port.sender)) { port.disconnect(); return; }
    const controller = new AbortController(); let started = false;
    port.onDisconnect.addListener(() => controller.abort());
    port.onMessage.addListener(message => {
      if (started || message?.type !== 'list') return;
      started = true;
      (async () => {
        await ready;
        const connection = modelConnection(message.settings, settings);
        if (!await chrome.permissions.contains({origins: [new URL(connection.endpoint).origin + '/*']})) throw new Error(t('请允许访问此接口后获取模型，或继续手动填写。'));
        return await fetchModels(connection, {signal: controller.signal});
      })().then(result => { if (!controller.signal.aborted) port.postMessage({ok: true, ...result}); }, error => {
        if (!controller.signal.aborted) port.postMessage({ok: false, error: readableError(error)});
      }).finally(() => port.disconnect()).catch(() => {});
    });
    return;
  }
  if (port.name !== 'qt-translate' || port.sender?.id !== chrome.runtime.id) { port.disconnect(); return; }
  const jobs = new Map();
  let disconnected = false, pulse;
  const post = value => { if (!disconnected) try { port.postMessage(value); } catch {} };
  port.onDisconnect.addListener(() => {
    disconnected = true; clearInterval(pulse);
    for (const job of jobs.values()) job.controller.abort(); jobs.clear();
  });
  port.onMessage.addListener(message => {
    if (message?.type === 'cancel') { jobs.get(message.id)?.controller.abort(); return; }
    if (message?.type === 'ping') { post({type: 'pong'}); return; }
    if (message?.type !== 'translate' || typeof message.id !== 'string' || message.id.length > 100 || jobs.has(message.id)) return;
    if (jobs.size >= 4) { post({id: message.id, type: 'error', error: t("任务较多，请稍后重试。")}); return; }
    const job = {controller: new AbortController(), latest: null, timer: null, sent: 0};
    jobs.set(message.id, job);
    if (!pulse) pulse = setInterval(() => post({type: 'heartbeat'}), 15000);
    const started = performance.now(); let first = null;
    const flush = () => {
      clearTimeout(job.timer); job.timer = null;
      if (job.latest) { post({id: message.id, type: 'update', ...job.latest}); job.latest = null; job.sent = performance.now(); }
    };
    (async () => {
      await ready;
      if (typeof message.text !== 'string' || message.text.length > MAX_TEXT) throw new Error(t("单次最多支持 60,000 字符。"));
      const config = {...settings};
      if (message.target && LANGUAGES[message.target]) config.target = message.target;
      if (message.kind === 'probe' && trusted(port.sender)) config.cache = false;
      // Incognito translations never enter the persistent cache.
      if (port.sender?.tab?.incognito || port.sender?.incognito) config.cache = false;
      const priority = ['selection', 'probe'].includes(message.kind) ? 10 : message.kind === 'workspace' ? 5 : 0;
      const result = await engine.translate(message.text, config, {
        signal: job.controller.signal, priority,
        onUpdate: update => {
          if (disconnected || job.controller.signal.aborted) return;
          if (first === null && update.text) first = performance.now() - started;
          job.latest = update;
          if (performance.now() - job.sent > 45) flush();
          else if (!job.timer) job.timer = setTimeout(flush, 45);
        },
      });
      flush(); post({id: message.id, type: 'done', ...result, elapsed: performance.now() - started, first});
    })().catch(error => {
      flush(); post({id: message.id, type: error.name === 'AbortError' ? 'cancelled' : 'error', error: readableError(error)});
    }).finally(() => {
      clearTimeout(job.timer); jobs.delete(message.id);
      if (!jobs.size) { clearInterval(pulse); pulse = null; }
    });
  });
});

async function menus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({id: 'qt-selection', title: t("用轻译翻译选中文字"), contexts: ['selection']});
  chrome.contextMenus.create({id: 'qt-page', title: t("轻译 · 翻译网页 / 恢复原文"), contexts: ['page']});
  chrome.contextMenus.create({id: 'qt-workspace', title: t("轻译 · 打开长文翻译"), contexts: ['action']});
}
chrome.runtime.onInstalled.addListener(details => {
  ready.then(async () => {
    await menus();
    if (details.reason === 'install' && !publicSettings(settings).configured) await chrome.runtime.openOptionsPage();
  }).catch(() => {});
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'qt-workspace') return await openWorkspace();
    if (info.menuItemId === 'qt-selection') {
      try { await sendToPage(tab.id, {type: 'qt-selection', text: info.selectionText}); }
      catch { await openWorkspace(info.selectionText); }
    } else await sendToPage(tab.id, {type: 'qt-toggle'});
  } catch {}
});
chrome.commands.onCommand.addListener(async command => {
  try {
    if (command === 'open-workspace') return await openWorkspace();
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab?.id) await sendToPage(tab.id, {type: command === 'toggle-page' ? 'qt-toggle' : 'qt-selection'});
  } catch { /* Restricted browser pages cannot host an overlay. */ }
});
