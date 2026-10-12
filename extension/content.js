(() => {
  'use strict';
  const {t, localize} = globalThis.QuietTranslateLocale;
  const chrome = globalThis.browser ?? globalThis.chrome;
  if (globalThis.__quietTranslate) return;
  globalThis.__quietTranslate = true;
  const OWN = '[data-qt-owned]';
  const BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th,dd,dt,div,section';
  const SEMANTIC = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th,dd,dt';
  const SKIP = 'script,style,noscript,pre,code,textarea,input,select,button,svg,canvas,video,audio,iframe,nav,footer,header:not(article header):not(main header),[role="banner"],[role="navigation"],[role="menu"],[role="toolbar"],[role="tablist"],[role="button"],[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[hidden],[aria-hidden="true"],' + OWN;
  const PROSE_SKIP = SKIP.replace(',code,', ',');
  let prefs = {target: 'zh-CN', selection: true, hover: true, selectionMode: 'button', style: 'line', fontSize: 100, autoSites: [], excludedSites: []};
  let enabled = false, pageEpoch = 0, visibleObserver, mutations, scanQueue = [], scanScheduled = false;
  let pageActive = 0, hoverElement, hoverTimer, selectedText = '', selectionRange, selectionTimer;
  let panelJob, pinned = false, panelSource = '', panelResult = '', panelTarget;
  let panelRange, panelAnchor, panelSide, positionFrame;
  let port, disconnectTimer, mutationTimer, changedRoots = new Set(), lastURL = location.href;
  const records = new Map(), jobs = new Map(), segmentRoots = new Set();
  let overlay, shadow, launcher, panel, toast, toastTimer;
  async function message(value) {
    try {
      const response = await chrome.runtime.sendMessage(value);
      if (!response?.ok) throw new Error(response?.error || t("扩展已更新，请刷新网页。"));
      return response;
    } catch (error) {
      if (/context invalidated|receiving end|message port/i.test(error.message)) throw new Error(t("轻译已更新，请刷新网页后继续。"));
      throw error;
    }
  }
  function ensurePort() {
    clearTimeout(disconnectTimer);
    if (port) return port;
    port = chrome.runtime.connect({name: 'qt-translate'});
    const connection = port;
    connection.onMessage.addListener(event => {
      const job = jobs.get(event.id);
      if (!job) return;
      if (event.type === 'update') { job.update(event); return; }
      jobs.delete(event.id);
      if (event.type === 'done') job.resolve(event);
      else job.reject(Object.assign(new Error(event.error || t("翻译已停止")), {name: event.type === 'cancelled' ? 'AbortError' : 'Error'}));
      if (!jobs.size) disconnectTimer = setTimeout(() => { const old = port; port = null; old?.disconnect(); }, 10000);
    });
    connection.onDisconnect.addListener(() => {
      if (port && port !== connection) return;
      port = null;
      for (const job of jobs.values()) job.reject(new Error(t("连接已中断，点击重试即可。")));
      jobs.clear();
    });
    return port;
  }
  function translate(text, kind, update, target = prefs.target) {
    const id = crypto.randomUUID();
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    try {
      const connection = ensurePort();
      jobs.set(id, {resolve, reject, update});
      connection.postMessage({type: 'translate', id, text, target, kind});
    } catch { jobs.delete(id); reject(new Error(t("轻译已更新，请刷新网页后继续。"))); }
    return {promise, cancel() {
      if (!jobs.has(id)) return;
      jobs.delete(id); try { port?.postMessage({type: 'cancel', id}); } catch {}
      reject(Object.assign(new Error(t("翻译已停止")), {name: 'AbortError'}));
    }};
  }
  function own(node) { return (node?.nodeType === 1 ? node : node?.parentElement)?.closest(OWN); }
  function editable(node) { return (node?.nodeType === 1 ? node : node?.parentElement)?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])'); }
  function blocked() { return prefs.excludedSites.includes(location.host); }
  function sourceText(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Keep identifiers inside prose; standalone code/pre blocks are still never candidates.
        if (node.nodeType === 1) return node.matches(PROSE_SKIP) ? NodeFilter.FILTER_REJECT : node.tagName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let value = '', node;
    while ((node = walker.nextNode())) { value += node.nodeType === 1 ? '\n' : node.nodeValue; if (value.length > 60000) return ''; }
    return value.replace(/[\t ]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
  }
  function foreign(text) {
    const letters = text.match(/\p{L}/gu) || [];
    if (letters.length < 2) return false;
    if (prefs.target.startsWith('zh')) {
      if (/[\u3040-\u30ff\uac00-\ud7af]/.test(text)) return true;
      const han = (text.match(/\p{Script=Han}/gu) || []).length;
      return han / letters.length < 0.6;
    }
    if (prefs.target === 'en' && document.documentElement.lang.toLowerCase().startsWith('en') && /^[\x00-\x7F\s\p{P}]+$/u.test(text)) return false;
    return true;
  }
  function candidate(element) {
    if (!element.matches(BLOCK) || element.closest(SKIP)) return false;
    if (element.matches('div,section') && (element.querySelector(SEMANTIC + ',div,section') || element.textContent.trim().length < 25)) return false;
    if (element.matches(SEMANTIC) && element.querySelector(SEMANTIC)) return false;
    return true;
  }
  function ensureUI() {
    if (overlay?.isConnected) return;
    overlay = document.createElement('qt-overlay'); overlay.setAttribute('data-qt-owned', 'ui'); overlay.dataset.theme = prefs.theme || 'system';
    overlay.style.cssText = 'all:initial!important;position:fixed!important;inset:0 auto auto 0!important;width:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:visible!important;z-index:2147483647!important;pointer-events:none!important;color-scheme:light dark!important;';
    shadow = overlay.attachShadow({mode: 'open'});
    shadow.innerHTML = `<style>
      :host{--q-ui:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans SC","Noto Sans CJK SC","Microsoft YaHei UI","Microsoft YaHei",sans-serif;--q-reading:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Noto Serif SC","Source Han Serif SC","Songti SC",STSong,"Noto Serif CJK SC",serif;--q-scheme:light;--q-bg:#fffefb;--q-fg:#26342f;--q-muted:#626f66;--q-line:#e5e9e3;--q-accent:#397965;--q-error:#a45138;--q-soft:#f1f6f1;--q-shadow:0 12px 48px #172f2524,0 2px 8px #172f2512;color-scheme:light;font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--q-fg)}
      @media(prefers-color-scheme:dark){:host{--q-scheme:dark;--q-bg:#202723;--q-fg:#e2e9e3;--q-muted:#9ea9a1;--q-line:#39453c;--q-accent:#9acfb7;--q-error:#e0a088;--q-soft:#2c3830;--q-shadow:0 12px 48px #0006;color-scheme:dark}}
      :host([data-theme=light]){--q-scheme:light;--q-bg:#fffefb;--q-fg:#26342f;--q-muted:#626f66;--q-line:#e5e9e3;--q-accent:#397965;--q-error:#a45138;--q-soft:#f1f6f1;--q-shadow:0 12px 48px #172f2524,0 2px 8px #172f2512;color-scheme:light}
      :host([data-theme=dark]){--q-scheme:dark;--q-bg:#202723;--q-fg:#e2e9e3;--q-muted:#9ea9a1;--q-line:#39453c;--q-accent:#9acfb7;--q-error:#e0a088;--q-soft:#2c3830;--q-shadow:0 12px 48px #0006;color-scheme:dark}
      *{box-sizing:border-box}button,select{font:inherit}button{display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;border:0;background:none;color:inherit;padding:6px;border-radius:7px}button:hover{background:var(--q-soft)}button:focus-visible,select:focus-visible{outline:2px solid var(--q-accent);outline-offset:3px}button:disabled{opacity:.5;cursor:default}[hidden]{display:none!important}
      /* The host resets inherited page styles with all:initial!important. Set typography inside the shadow tree. */
      .panel,.launch,.toast{font:14px/1.65 var(--q-ui);color:var(--q-fg);color-scheme:var(--q-scheme)}
      .launch{position:fixed;width:32px;height:32px;border:1px solid var(--q-line);background:var(--q-bg);box-shadow:0 3px 14px #172f2525;color:var(--q-accent);font-size:14px;font-weight:650;border-radius:10px;pointer-events:auto}
      .panel{position:fixed;width:min(392px,calc(100vw - 24px));max-height:min(520px,calc(100vh - 28px));border:1px solid var(--q-line);border-radius:14px;background:var(--q-bg);box-shadow:var(--q-shadow);pointer-events:auto;overflow:hidden;display:flex;flex-direction:column;text-align:left;letter-spacing:normal}
      header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--q-line);flex-shrink:0}.brand{display:flex;align-items:center;gap:7px;font-weight:600;color:var(--q-accent)}.spacer{flex:1;min-width:0}.pin[aria-pressed=true]{color:var(--q-accent);background:var(--q-soft)}select{color:var(--q-muted);font-size:12px;border:0;background:transparent;max-width:105px;padding:3px}
      /* Body owns the scroll so a long translation never pushes the actions out of reach. */
      .body{padding:14px 16px;overflow:auto;overscroll-behavior:contain;min-height:0;flex:1 1 auto;scrollbar-width:thin}.source{font-size:12px;line-height:1.7;color:var(--q-muted);max-height:64px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding-bottom:10px;margin-bottom:11px;border-bottom:1px solid var(--q-line)}.translation{white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--q-reading);font-size:16px;line-height:1.9;font-kerning:normal;user-select:text}.translation[data-loading=true]:empty::before{content:attr(data-loading-label);font-size:13px;color:var(--q-muted)}.translation[data-loading=true]:not(:empty)::after{content:'';display:inline-block;width:4px;height:14px;margin-left:5px;border-radius:2px;background:var(--q-accent);animation:blink 1s infinite}.error{font-size:12.5px;line-height:1.7;color:var(--q-error,#bc6b4f);margin-top:11px}
      footer{padding:8px 12px;border-top:1px solid var(--q-line);display:flex;align-items:center;gap:8px;flex-shrink:0;background:var(--q-bg)}.meta{color:var(--q-muted);font-size:11px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.text-btn{font-size:12px}.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 17px;border-radius:30px;background:var(--q-bg);color:var(--q-fg);border:1px solid var(--q-line);box-shadow:var(--q-shadow);font-size:13px;max-width:calc(100vw - 30px);pointer-events:auto;white-space:nowrap}
      @keyframes blink{50%{opacity:.2}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}
    </style>
    <button class="launch" aria-label="翻译选中文字" title="翻译 · Alt+Q" hidden>译</button>
    <section class="panel" role="dialog" aria-label="轻译划线翻译" hidden>
      <header><span class="brand"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 4C11 3 4 6 4 12a7 7 0 0 0 7 7c6 0 9-7 8-15Z"/><path d="m7 17 8-9"/></svg>轻译</span><span class="spacer"></span><select aria-label="译文语言"><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="en">English</option><option value="ja">日本語</option><option value="ko">한국어</option><option value="fr">Français</option><option value="de">Deutsch</option><option value="es">Español</option><option value="ru">Русский</option><option value="pt">Português</option><option value="ar">العربية</option><option value="vi">Tiếng Việt</option></select><button class="pin" title="固定浮层" aria-label="固定浮层" aria-pressed="false"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6ZM12 15v7"/></svg></button><button class="close" title="关闭 · Esc" aria-label="关闭翻译"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <div class="body"><div class="source"></div><div class="translation" dir="auto"></div><div class="error" role="status" hidden></div></div>
      <footer><span class="meta" role="status">连接中</span><span class="spacer"></span><button class="retry text-btn" hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></svg>重试</button><button class="expand text-btn" title="在长文翻译中打开">展开 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button><button class="copy" title="复制译文" aria-label="复制译文" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/></svg></button></footer>
    </section><div class="toast" role="status" hidden></div>`;
    localize(shadow);
    shadow.querySelector('.translation').dataset.loadingLabel = t('正在翻译…');
    launcher = shadow.querySelector('.launch'); panel = shadow.querySelector('.panel'); toast = shadow.querySelector('.toast');
    document.documentElement.append(overlay);
    try { overlay.setAttribute('popover', 'manual'); overlay.showPopover(); } catch {}
    launcher.addEventListener('mousedown', event => event.preventDefault());
    launcher.addEventListener('click', () => showSelection(selectedText));
    shadow.querySelector('.close').addEventListener('click', closePanel);
    shadow.querySelector('.pin').addEventListener('click', () => { pinned = !pinned; shadow.querySelector('.pin').setAttribute('aria-pressed', String(pinned)); });
    shadow.querySelector('select').addEventListener('change', event => { panelTarget = event.target.value; showSelection(panelSource, true); });
    shadow.querySelector('.retry').addEventListener('click', () => showSelection(panelSource, true));
    shadow.querySelector('.copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(panelResult); notify(t("译文已复制")); } catch { notify(t("复制失败，可选中译文后按 Ctrl+C")); }
    });
    shadow.querySelector('.expand').addEventListener('click', () => message({type: 'qt-open-workspace', text: panelSource}).catch(error => notify(error.message)));
  }
  function notify(text) { ensureUI(); toast.textContent = text; toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 2600); }
  function closePanel() { panelJob?.cancel(); panelJob = null; if (panel) panel.hidden = true; panelRange = null; pinned = false; shadow?.querySelector('.pin').setAttribute('aria-pressed', 'false'); }
  function rangeRect(range) {
    if (!range?.commonAncestorContainer.isConnected) return null;
    const rects = [...range.getClientRects()].filter(r => r.width && r.height);
    return rects.filter(r => r.bottom >= 0 && r.top <= innerHeight).at(-1) || rects.at(-1);
  }
  function schedulePosition(refreshAnchor = false) {
    if (refreshAnchor && !pinned) panelAnchor = null;
    if (positionFrame) return;
    positionFrame = requestAnimationFrame(() => { positionFrame = 0; positionPanel(); });
  }
  function positionPanel() {
    if (!panel || panel.hidden) return;
    const margin = 12, gap = 10;
    const width = Math.min(392, innerWidth - margin * 2), maxHeight = Math.max(0, Math.min(520, innerHeight - margin * 2));
    if (pinned && panel.style.top) {
      const top = Math.max(margin, Math.min(parseFloat(panel.style.top), innerHeight - margin - Math.min(160, maxHeight)));
      panel.style.top = top + 'px';
      panel.style.left = Math.max(margin, Math.min(parseFloat(panel.style.left), innerWidth - width - margin)) + 'px';
      panel.style.maxHeight = Math.max(0, Math.min(520, innerHeight - top - margin)) + 'px';
      return;
    }
    if (!panelAnchor) {
      panelAnchor = rangeRect(panelRange) || {left: innerWidth - 420, bottom: 80, top: 70};
      const below = innerHeight - margin - panelAnchor.bottom - gap, above = panelAnchor.top - gap - margin;
      const currentSpace = panelSide === 'above' ? above : below;
      if (!panelSide || currentSpace < Math.min(160, maxHeight)) panelSide = below >= Math.min(320, maxHeight) || below >= above ? 'below' : 'above';
    }
    const r = panelAnchor, space = panelSide === 'above' ? r.top - gap - margin : innerHeight - margin - r.bottom - gap;
    // Reserve a side for the whole stream. Measure its real height, including errors and controls.
    panel.style.maxHeight = (space >= 160 ? Math.min(maxHeight, space) : maxHeight) + 'px';
    const height = panel.offsetHeight;
    const top = panelSide === 'above' ? r.top - gap - height : r.bottom + gap;
    panel.style.left = Math.max(margin, Math.min(r.left, innerWidth - width - margin)) + 'px';
    panel.style.top = Math.max(margin, Math.min(top, innerHeight - height - margin)) + 'px';
  }
  async function showSelection(text, reuse = false) {
    text = (text || window.getSelection()?.toString() || '').trim();
    if (!text) { notify(t("先选中一段文字，再按 Alt+Q")); return; }
    if (blocked()) { notify(t("本站已停用轻译，可在插件菜单中恢复")); return; }
    ensureUI(); launcher.hidden = true; panelJob?.cancel();
    if (!reuse) {
      panelTarget = prefs.target;
      const selection = window.getSelection();
      panelRange = selection?.rangeCount && selection.toString().trim() === text && !own(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : selectedText === text ? selectionRange?.cloneRange() : null;
      panelAnchor = null; panelSide = null;
    }
    panelSource = text; panelResult = ''; panel.hidden = false;
    shadow.querySelector('select').value = panelTarget;
    const output = shadow.querySelector('.translation'), errorBox = shadow.querySelector('.error'), meta = shadow.querySelector('.meta');
    shadow.querySelector('.source').textContent = text;
    output.textContent = ''; output.dataset.loading = 'true'; errorBox.hidden = true;
    shadow.querySelector('.retry').hidden = true; shadow.querySelector('.copy').disabled = true;
    meta.textContent = t("正在翻译"); positionPanel();
    const task = translate(text, 'selection', update => {
      if (panelJob !== task) return;
      output.textContent = update.text; panelResult = update.text;
      if (update.total > 1) meta.textContent = t("{0} / {1} 段", update.completed, update.total);
      schedulePosition();
    }, panelTarget);
    panelJob = task;
    try {
      const result = await task.promise;
      if (panelJob !== task) return;
      output.textContent = panelResult = result.text;
      meta.textContent = result.cached ? t("来自本地缓存") : t("{0} 秒 · 翻译完成", (result.elapsed / 1000).toFixed(1));
      shadow.querySelector('.copy').disabled = false;
    } catch (error) {
      if (panelJob !== task || error.name === 'AbortError') return;
      errorBox.textContent = error.message; errorBox.hidden = false;
      shadow.querySelector('.retry').hidden = false; meta.textContent = panelResult ? t("译文尚未完成") : t("未能完成");
    } finally { if (panelJob === task) { output.dataset.loading = 'false'; schedulePosition(); } }
  }
  function inspectSelection(event) {
    if (!prefs.selection || blocked() || event?.composedPath().some(node => node === overlay)) return;
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || editable(selection.anchorNode) || editable(selection.focusNode) || own(selection.anchorNode)) return;
      const text = selection.toString().trim();
      if (!text || text.length < 2) { if (launcher) launcher.hidden = true; return; }
      const rects = [...selection.getRangeAt(0).getClientRects()].filter(r => r.width && r.height && r.bottom >= 0 && r.top <= innerHeight);
      if (!rects.length) return;
      const rect = rects.at(-1); selectedText = text;
      selectionRange = selection.getRangeAt(0).cloneRange();
      ensureUI();
      if (prefs.selectionMode === 'instant') { if (!pinned) showSelection(text); return; }
      launcher.style.left = Math.min(innerWidth - 42, Math.max(8, event?.clientX || rect.right)) + 'px';
      launcher.style.top = Math.min(innerHeight - 42, Math.max(8, (event?.clientY || rect.bottom) + 12)) + 'px';
      launcher.hidden = false;
    }, 90);
  }
  document.addEventListener('mouseup', inspectSelection, {passive: true});
  document.addEventListener('keyup', event => { if (event.key === 'Shift' || event.key.startsWith('Arrow')) inspectSelection(event); }, {passive: true});
  document.addEventListener('pointerdown', event => {
    if (event.composedPath().includes(overlay)) return;
    if (launcher) launcher.hidden = true;
    if (panel && !panel.hidden && !pinned) closePanel();
  }, {passive: true});
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closePanel(); if (launcher) launcher.hidden = true; }
    if (event.key === 'Alt' && !event.repeat && prefs.hover && !blocked() && hoverElement && !editable(event.target) && !window.getSelection()?.toString()) {
      hoverTimer = setTimeout(() => translateHovered(hoverElement), 420);
    } else if (event.key !== 'Alt') clearTimeout(hoverTimer);
  }, {passive: true});
  document.addEventListener('keyup', event => { if (event.key === 'Alt') clearTimeout(hoverTimer); }, {passive: true});
  document.addEventListener('pointerover', event => {
    if (!prefs.hover || blocked() || own(event.target)) return;
    hoverElement = event.target.closest?.(BLOCK);
  }, {passive: true});
  window.addEventListener('blur', () => { clearTimeout(hoverTimer); if (launcher) launcher.hidden = true; });
  window.addEventListener('resize', () => schedulePosition(true), {passive: true});
  window.addEventListener('scroll', event => {
    if (event.composedPath().includes(overlay)) return;
    if (launcher) launcher.hidden = true;
    if (panel && !panel.hidden && !pinned) schedulePosition(true);
  }, {passive: true, capture: true});

  function attachTranslation(record) {
    const host = document.createElement('qt-line'); host.setAttribute('data-qt-owned', 'translation');
    const sourceStyle = getComputedStyle(record.segmentOwner || record.element);
    record.baseFont = Math.min(20, Math.max(13, parseFloat(sourceStyle.fontSize) * 0.95));
    host.style.cssText = `all:initial;display:block;contain:style;color:inherit;text-align:start;margin:8px 0 ${record.segmentNodes ? '-1em' : '12px'};overflow-wrap:anywhere;font-family:${sourceStyle.fontFamily};font-size:${record.baseFont * prefs.fontSize / 100}px;line-height:1.8;letter-spacing:normal;`;
    host.dir = 'auto'; host.lang = prefs.target;
    const root = host.attachShadow({mode: 'open'});
    root.innerHTML = `<style>:host{--q-rule:color-mix(in srgb,currentColor 28%,transparent);--q-soft:color-mix(in srgb,currentColor 5%,transparent)}.wrap{color:color-mix(in srgb,currentColor 65%,#799c88 35%);white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;text-align:start}.line{border-left:2px solid var(--q-rule);padding-left:12px}.soft{background:var(--q-soft);padding:10px 14px;border-radius:7px}.text[data-loading=true]:empty:before{content:attr(data-loading-label);font-size:12px;opacity:.55}.text[data-loading=true]:not(:empty):after{content:'';display:inline-block;width:3px;height:12px;margin-left:5px;background:var(--q-rule)}.error{font:12px/1.6 system-ui;color:inherit;padding:4px 0}button{cursor:pointer;border:0;border-bottom:1px solid currentColor;color:inherit;background:none;padding:0;margin-left:8px;font:inherit}button:focus-visible{outline:2px solid currentColor;outline-offset:3px}[hidden]{display:none!important}</style><div class="wrap"><span class="text" data-loading="true"></span><span class="error" role="status" hidden></span></div>`;
    root.querySelector('.wrap').classList.add(prefs.style);
    record.host = host; record.output = root.querySelector('.text'); record.error = root.querySelector('.error');
    record.output.dataset.loadingLabel = t('翻译中');
    if (record.segmentNodes) record.segmentNodes.at(-1).after(host);
    else record.element.append(host);
  }
  function legacySegments(element) {
    // Old articles use inline <font> and double <br>, not paragraph elements.
    // Insert beside their original nodes without wrapping, splitting, or replacing them.
    if (segmentRoots.has(element)) return true;
    const owners = new Set([...element.querySelectorAll('br')].filter(br => !br.closest(SKIP)).map(br => br.parentElement));
    let added = false;
    for (const owner of owners) {
      if (owner.querySelector(SEMANTIC + ',div,section')) continue;
      const nodes = [...owner.childNodes].filter(n => !own(n));
      const groups = []; let group = [], breaks = 0;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.nodeName === 'BR') {
          let next = i + 1;
          while (nodes[next]?.nodeType === 3 && !nodes[next].textContent.trim()) next++;
          if (nodes[next]?.nodeName === 'BR') {
            if (group.length) groups.push(group); group = []; breaks++;
            i = next;
            while (nodes[i + 1]?.nodeName === 'BR' || (nodes[i + 1]?.nodeType === 3 && !nodes[i + 1].textContent.trim())) i++;
            continue;
          }
        }
        group.push(node);
      }
      if (group.length) groups.push(group);
      if (breaks < 2) continue;
      for (const segmentNodes of groups) {
        const text = segmentNodes.map(n => n.nodeType === 3 ? n.data : n.nodeName === 'BR' ? '\n' : sourceText(n)).join('').trim();
        if (!foreign(text) || records.size >= 2400) continue;
        const marker = document.createElement('qt-anchor'); marker.setAttribute('data-qt-owned', 'anchor');
        marker.style.cssText = 'all:initial;display:inline;font-size:0;line-height:0;';
        segmentNodes[0].before(marker);
        const record = {element: marker, text, state: 'idle', visible: false, epoch: pageEpoch, segmentOwner: owner, segmentRoot: element, segmentNodes};
        records.set(marker, record); visibleObserver?.observe(marker); added = true;
      }
    }
    if (added) segmentRoots.add(element);
    return added;
  }
  function addCandidate(element) {
    if (records.size >= 2400 || records.has(element) || !candidate(element)) return;
    if (element.querySelector('br') && legacySegments(element)) return;
    const text = sourceText(element);
    if (!foreign(text)) return;
    const record = {element, text, state: 'idle', visible: false, epoch: pageEpoch};
    records.set(element, record); visibleObserver?.observe(element);
    return record;
  }
  function queueScan(root) {
    if (!enabled || !root?.isConnected || own(root)) return;
    if (scanQueue.length > 80) return;
    scanQueue.push({root, walker: null}); scheduleScan();
  }
  function scheduleScan() {
    if (scanScheduled || !enabled) return;
    scanScheduled = true;
    const idle = window.requestIdleCallback?.bind(window) || (fn => setTimeout(fn, 10));
    const epoch = pageEpoch;
    idle(() => {
      scanScheduled = false;
      if (!enabled || epoch !== pageEpoch) return;
      const start = performance.now(); let count = 0;
      while (scanQueue.length && performance.now() - start < 7 && count < 160) {
        const item = scanQueue[0];
        if (!item.root.isConnected) { scanQueue.shift(); continue; }
        if (!item.walker) {
          if (item.root.nodeType !== 1 || item.root.matches(SKIP)) { scanQueue.shift(); continue; }
          addCandidate(item.root);
          item.walker = document.createTreeWalker(item.root, NodeFilter.SHOW_ELEMENT, {acceptNode: node => node.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
        }
        const element = item.walker.nextNode(); count++;
        if (element) addCandidate(element); else scanQueue.shift();
      }
      if (scanQueue.length) scheduleScan();
      pump();
    }, {timeout: 160});
  }
  function pump() {
    if (!enabled || document.hidden) return;
    const queue = [...records.values()].filter(record => record.state === 'idle' && record.visible && record.element.isConnected);
    queue.sort((a, b) => Math.abs(a.element.getBoundingClientRect().top - innerHeight / 3) - Math.abs(b.element.getBoundingClientRect().top - innerHeight / 3));
    while (pageActive < 3 && queue.length) startRecord(queue.shift());
  }
  function startRecord(record, manual = false) {
    if (!record.element.isConnected || record.state === 'loading') return;
    const style = getComputedStyle(record.element);
    if (style.display === 'none' || style.visibility === 'hidden' || !record.element.getClientRects().length) return;
    record.state = 'loading'; record.epoch = pageEpoch;
    record.host?.remove(); attachTranslation(record);
    const epoch = pageEpoch; if (!manual) pageActive++;
    const task = translate(record.text, manual ? 'selection' : 'page', update => {
      if (record.job === task && record.host.isConnected) record.output.textContent = update.text;
    });
    record.job = task;
    task.promise.then(result => {
      if (record.job !== task) return;
      record.output.textContent = result.text; record.state = 'done';
    }, error => {
      if (record.job !== task || error.name === 'AbortError') return;
      record.state = 'error'; record.error.hidden = false;
      record.error.textContent = error.message;
      const retry = document.createElement('button'); retry.textContent = t("重试");
      retry.addEventListener('click', () => startRecord(record, true)); record.error.append(retry);
    }).finally(() => {
      if (record.job === task) { record.output.dataset.loading = 'false'; record.job = null; }
      if (!manual && epoch === pageEpoch) { pageActive--; pump(); }
    });
  }
  function translateHovered(element) {
    if (!element || !candidate(element)) return;
    let record = records.get(element);
    if (record?.state === 'done') { record.host?.animate([{opacity: .35}, {opacity: 1}], {duration: 300}); return; }
    if (!record) {
      const text = sourceText(element); if (!foreign(text)) return;
      record = {element, text, state: 'idle', epoch: pageEpoch}; records.set(element, record);
    }
    if (pageActive >= 3 && jobs.size >= 4) { notify(t("正在翻译，稍候即可")); return; }
    startRecord(record, true);
  }
  function refreshChanged() {
    if (!enabled) return;
    if (location.href !== lastURL) { lastURL = location.href; }
    for (const root of segmentRoots) if (!root.isConnected || [...changedRoots].some(changed => root.contains(changed) || changed.contains(root))) {
      for (const [key, record] of records) if (record.segmentRoot === root) {
        record.job?.cancel(); record.host?.remove(); visibleObserver.unobserve(key); key.remove(); records.delete(key);
      }
      segmentRoots.delete(root); if (root.isConnected) queueScan(root);
    }
    for (const [element, record] of records) {
      if (!element.isConnected) { record.job?.cancel(); record.host?.remove(); visibleObserver.unobserve(element); records.delete(element); }
    }
    for (const root of changedRoots) {
      if (!root.isConnected || own(root)) continue;
      let ancestor = root;
      while (ancestor && ancestor !== document.body && !records.has(ancestor)) ancestor = ancestor.parentElement;
      const record = records.get(ancestor);
      if (record) {
        const nextText = sourceText(ancestor);
        if (nextText !== record.text || (record.host && !record.host.isConnected)) {
          record.job?.cancel(); record.host?.remove(); record.text = nextText;
          record.state = foreign(nextText) ? 'idle' : 'skip';
        }
      }
      queueScan(root);
    }
    changedRoots.clear(); pump();
  }
  function startPage(silent = false) {
    if (enabled) return;
    if (blocked()) { notify(t("本站已停用轻译，可在插件菜单中恢复")); return; }
    if (!prefs.configured) { notify(t("先在轻译设置中连接翻译服务")); message({type: 'qt-open-settings'}).catch(() => {}); return; }
    enabled = true; pageEpoch++; pageActive = 0;
    visibleObserver = new IntersectionObserver(entries => {
      for (const entry of entries) { const record = records.get(entry.target); if (record) record.visible = entry.isIntersecting; }
      pump();
    }, {rootMargin: '220px 0px'});
    for (const record of records.values()) visibleObserver.observe(record.element);
    mutations = new MutationObserver(changes => {
      for (const change of changes) {
        if (own(change.target)) continue;
        if (change.type === 'childList' && [...change.addedNodes, ...change.removedNodes].every(node => own(node))) continue;
        const root = change.target.nodeType === 1 ? change.target : change.target.parentElement;
        if (root && changedRoots.size < 70) changedRoots.add(root);
        if (change.type === 'childList') for (const node of change.addedNodes) if (node.nodeType === 1 && !own(node) && changedRoots.size < 70) changedRoots.add(node);
      }
      if (changedRoots.size && !mutationTimer) mutationTimer = setTimeout(() => { mutationTimer = null; refreshChanged(); }, 180);
    });
    mutations.observe(document.body, {childList: true, subtree: true, characterData: true});
    queueScan(document.body);
    message({type: 'qt-page-state', enabled: true}).catch(() => {});
    if (!silent) notify(t("双语阅读已开启 · Alt+T 恢复原文"));
  }
  function stopPage(silent = false) {
    enabled = false; pageEpoch++; pageActive = 0;
    visibleObserver?.disconnect(); mutations?.disconnect();
    clearTimeout(mutationTimer); mutationTimer = null; changedRoots.clear(); scanQueue = []; scanScheduled = false;
    for (const record of records.values()) { record.job?.cancel(); record.host?.remove(); if (record.segmentNodes) record.element.remove(); }
    records.clear(); segmentRoots.clear(); message({type: 'qt-page-state', enabled: false}).catch(() => {});
    if (!silent) notify(t("已恢复原文"));
  }
  function state() {
    const values = [...records.values()];
    return {enabled, done: values.filter(r => r.state === 'done').length, pending: values.filter(r => r.state === 'loading').length, errors: values.filter(r => r.state === 'error').length, detected: values.length};
  }
  function applySettings(next) {
    const changeLanguage = next.target !== prefs.target;
    prefs = next;
    if (overlay) overlay.dataset.theme = prefs.theme || 'system';
    if (blocked()) { stopPage(true); closePanel(); if (launcher) launcher.hidden = true; return; }
    if (!prefs.selection && launcher) launcher.hidden = true;
    if (enabled && changeLanguage) { stopPage(true); startPage(true); }
    else for (const record of records.values()) if (record.host) {
      const wrap = record.host.shadowRoot?.querySelector('.wrap');
      if (wrap) wrap.className = 'wrap ' + prefs.style;
      record.host.style.fontSize = record.baseFont * prefs.fontSize / 100 + 'px';
    }
  }
  const initialized = message({type: 'qt-settings'}).then(result => {
    applySettings(result.settings);
    if (prefs.autoSites.includes(location.host) && !blocked()) startPage(true);
  }).catch(() => {});
  chrome.runtime.onMessage.addListener((request, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    (async () => {
      await initialized;
      if (request.type === 'qt-toggle') { if (enabled || records.size) stopPage(); else startPage(); }
      else if (request.type === 'qt-selection') await showSelection(request.text);
      else if (request.type === 'qt-settings') applySettings(request.settings);
      else if (request.type === 'qt-retry') { for (const record of records.values()) if (record.state === 'error') record.state = 'idle'; pump(); }
      return state();
    })().then(reply, () => reply(state()));
    return true;
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pump(); });
  window.addEventListener('pagehide', event => { if (!event.persisted) { stopPage(true); closePanel(); port?.disconnect(); } });
})();
