import {t} from './i18n.js';
import {api} from './platform.js';

const labels = {queued: '等待测速', running: '测速中…', ok: '可用', cancelled: '未测完', timeout: '20 秒超时',
  auth: '密钥无效', balance: '余额不足', denied: '无权限', missing: '模型不存在', limited: '触发限流',
  server: '服务异常', rejected: '参数不兼容', failed: '未返回完整译文'};

export function createModelBenchmark({form, getDraft, isBusy, onSelect, onRunningChange = () => {}}) {
  const root = document.querySelector('#model-speed'), search = root.querySelector('#speed-filter');
  const start = root.querySelector('#speed-start'), stop = root.querySelector('#speed-stop'), sort = root.querySelector('#speed-sort');
  const panel = root.querySelector('#speed-results'), body = root.querySelector('tbody'), summary = root.querySelector('#speed-status');
  let catalog = [], entries = new Map(), rows = new Map(), port, running = false, revision = 0, finished = 0, total = 0, contextKey = '';
  const filtered = () => {
    const query = search.value.trim().toLowerCase();
    return catalog.filter(model => (model.id + ' ' + model.name).toLowerCase().includes(query));
  };
  function actions() {
    const count = filtered().length;
    start.disabled = running || isBusy() || !count;
    start.textContent = t('一键测速（{0}）', count);
    stop.hidden = !running; search.disabled = running; sort.disabled = running;
  }
  function setRunning(value) { running = value; actions(); onRunningChange(); }
  function status(text) { summary.textContent = text; }
  function updateRow(result) {
    const row = rows.get(result.model); if (!row) return;
    row.dataset.status = result.status;
    row.children[1].textContent = t(labels[result.status] || labels.failed);
    row.children[2].textContent = result.status === 'ok' ? (result.streaming
      ? t('{0} 秒', (result.firstMs / 1000).toFixed(2))
      : t('整包 {0} 秒', (result.elapsedMs / 1000).toFixed(2))) : '—';
    row.querySelector('button').disabled = result.status !== 'ok';
  }
  function reorder() {
    const rank = value => value.status === 'ok' ? value.streaming ? 0 : 1 : ['queued', 'running'].includes(value.status) ? 2 : 3;
    const ordered = [...entries.values()];
    if (sort.value === 'speed') ordered.sort((a, b) => rank(a) - rank(b) || (a.status === 'ok' && b.status === 'ok'
      ? (a.streaming ? a.firstMs : a.elapsedMs) - (b.streaming ? b.firstMs : b.elapsedMs) : a.model.localeCompare(b.model)));
    else ordered.sort((a, b) => a.model.localeCompare(b.model));
    for (const result of ordered) body.append(rows.get(result.model));
  }
  function markStopped() {
    for (const [id, result] of entries) if (['running', 'queued'].includes(result.status)) {
      const next = {...result, status: 'cancelled'}; entries.set(id, next); updateRow(next);
    }
  }
  function cancel() {
    revision++; const previous = port; port = null; previous?.disconnect();
    if (running) { markStopped(); setRunning(false); reorder(); status(t('已停止 · 完成 {0}/{1}', finished, total)); }
  }
  function resetResults() {
    cancel(); entries.clear(); rows.clear(); body.replaceChildren(); panel.hidden = true;
    status(''); finished = 0; total = 0; contextKey = '';
  }
  function reset() { resetResults(); catalog = []; root.hidden = true; search.value = ''; actions(); }
  function setModels(models) { resetResults(); catalog = models; root.hidden = !catalog.length; actions(); }
  async function begin() {
    if (running || isBusy()) return;
    const models = filtered(); if (!models.length) return;
    let config;
    try { config = getDraft(); } catch { status(t('请先填写有效的接口地址，也可直接手填模型。')); return; }
    const nextContext = JSON.stringify([config.target, config.reasoningEffort, config.tokenParameter]);
    if (contextKey && nextContext !== contextKey) resetResults();
    contextKey = nextContext;
    // Preserve successes from other filtered batches on this exact draft connection.
    for (const model of models) {
      entries.set(model.id, {model: model.id, status: 'queued'});
      if (!rows.has(model.id)) {
        const row = document.createElement('tr'); row.dataset.model = model.id;
        for (let i = 0; i < 4; i++) row.append(document.createElement('td'));
        const id = document.createElement('span'); id.className = 'speed-model'; id.textContent = model.id; row.children[0].append(id);
        if (model.name) { const name = document.createElement('small'); name.textContent = model.name; row.children[0].append(name); }
        const use = document.createElement('button'); use.type = 'button'; use.className = 'outline small'; use.textContent = t('选用');
        use.setAttribute('aria-label', t('选用 {0}（保存后生效）', model.id));
        use.addEventListener('click', () => { cancel(); onSelect(model.id, entries.get(model.id)?.reasoningEffort); status(t('已选用 {0}，保存后生效。', model.id)); });
        row.children[3].append(use); rows.set(model.id, row); body.append(row);
      }
      updateRow(entries.get(model.id));
    }
    finished = 0; total = models.length; panel.hidden = false; reorder(); setRunning(true);
    const current = ++revision;
    status(t('测速中 · {0}/{1} · 双路并发', finished, total));
    try {
      // Existing discovery has already obtained the host permission; never prompt
      // automatically or reuse credentials on a different destination.
      const connection = port = api.runtime.connect({name: 'qt-benchmark'});
      connection.onMessage.addListener(message => {
        if (current !== revision) return;
        if (message.type === 'result' && entries.has(message.result?.model)) {
          entries.set(message.result.model, message.result); updateRow(message.result);
          if (message.result.status !== 'running') finished++;
          status(t('测速中 · {0}/{1} · 双路并发', finished, total));
        } else if (message.type === 'done' || message.type === 'error') {
          revision++; port = null; markStopped(); setRunning(false); reorder();
          status(message.type === 'error' ? message.error : message.stopReason
            ? t('已停止 · {0} · 完成 {1}/{2}', t(labels[message.stopReason] || '未测完'), finished, total)
            : t(sort.value === 'speed' ? '测速完成 · {0}/{1} · 已按首字延迟排序' : '测速完成 · {0}/{1}', finished, total));
          connection.disconnect();
        }
      });
      connection.onDisconnect.addListener(() => {
        void api.runtime.lastError;
        if (current !== revision) return;
        port = null; markStopped(); setRunning(false); reorder(); status(t('测速连接已断开，已完成的结果仍保留。'));
      });
      connection.postMessage({type: 'start', settings: config, models: models.map(model => model.id)});
    } catch { if (current === revision) { cancel(); status(t('测速连接已断开，已完成的结果仍保留。')); } }
  }
  search.addEventListener('input', actions);
  search.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); begin(); } });
  start.addEventListener('click', begin); stop.addEventListener('click', cancel); sort.addEventListener('change', reorder);
  // Results are comparable only within one target/compatibility configuration.
  for (const name of ['target', 'reasoningEffort', 'tokenParameter']) form.elements.namedItem(name).addEventListener('input', resetResults);
  return {reset, setModels, actions, get running() { return running; }};
}
