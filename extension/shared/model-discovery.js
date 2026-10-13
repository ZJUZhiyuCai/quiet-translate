import {t} from './i18n.js';
import {api} from './platform.js';
import {endpointURL} from './core.js';
import {createModelPicker} from './model-picker.js';
import {createModelBenchmark} from './model-benchmark-ui.js';

export function createModelDiscovery({form, getSaved, isImported, isBusy, onSelect}) {
  const field = name => form.elements.namedItem(name), button = document.querySelector('#fetch-models');
  const status = document.querySelector('#models-status'), picker = createModelPicker(document.querySelector('#model-picker'), onSelect);
  const benchmark = createModelBenchmark({form, getDraft: draft, isBusy, onRunningChange: actions, onSelect(model, effort) {
    if (effort) field('reasoningEffort').value = effort;
    field('model').value = model; onSelect?.(model); picker.close();
    field('model').dispatchEvent(new Event('input', {bubbles: true})); picker.close();
  }});
  let revision = 0, timer, cancel, pending = false, permissionNeeded = false;
  const state = (kind, text) => { status.dataset.state = kind; status.textContent = text; };
  function actions() { button.disabled = pending || isBusy() || benchmark.running; button.textContent = t(pending ? '正在获取…' : permissionNeeded ? '允许访问并获取模型' : '获取模型'); benchmark.actions(); }
  function invalidate() {
    revision++; clearTimeout(timer); cancel?.(); cancel = null; pending = false; permissionNeeded = false;
    picker.setModels([]); benchmark.reset(); state('idle', t('填好密钥后自动获取模型，也可以直接手填。')); actions();
  }
  function draft() {
    const saved = getSaved(), endpoint = endpointURL(field('endpoint').value);
    return {endpoint, apiKey: field('apiKey').value, authMode: field('authMode').value,
      useSavedKey: !isImported() && endpoint === saved?.endpoint && saved?.authMode !== 'none',
      target: field('target').value, reasoningEffort: field('reasoningEffort').value, tokenParameter: field('tokenParameter').value};
  }
  async function fetchList(manual = false) {
    if (isBusy() || pending || benchmark.running) return;
    clearTimeout(timer);
    let config;
    try { config = draft(); }
    catch { state('error', t('请先填写有效的接口地址，也可直接手填模型。')); return; }
    if (config.authMode !== 'none' && !config.apiKey.trim() && !(config.useSavedKey && getSaved()?.configured)) {
      state('idle', t('请先填写此服务的 API 密钥，再获取模型。')); return;
    }
    const current = ++revision, origins = [new URL(config.endpoint).origin + '/*'];
    benchmark.reset();
    pending = true; actions(); state('loading', t('正在获取模型，手填仍然可用…'));
    try {
      // Permission requests must start synchronously in the explicit button click.
      // Debounced input can only use an already-granted host permission.
      const allowed = await (manual ? api.permissions.request({origins}) : api.permissions.contains({origins}));
      if (current !== revision) return;
      if (!allowed) {
        permissionNeeded = true; state('permission', t('请允许访问此接口后获取模型，或继续手动填写。')); return;
      }
      permissionNeeded = false;
      const result = await new Promise((resolve, reject) => {
        const connection = api.runtime.connect({name: 'qt-models'}); let settled = false;
        cancel = () => {
          if (settled) return;
          settled = true; connection.disconnect(); reject(new DOMException('Cancelled', 'AbortError'));
        };
        connection.onMessage.addListener(result => {
          if (settled) return; settled = true;
          if (result.ok) resolve(result); else reject(new Error(result.error));
          connection.disconnect();
        });
        connection.onDisconnect.addListener(() => { if (!settled) { settled = true; reject(new Error(t('模型列表连接中断，可重试或手动填写。'))); } });
        connection.postMessage({type: 'list', settings: config});
      });
      if (current !== revision) return;
      picker.setModels(result.models);
      benchmark.setModels(result.models);
      state(result.models.length ? 'ok' : 'idle', result.models.length
        ? t(result.partial ? '已获取部分模型（{0} 个），可下拉搜索，也可手填。' : '已获取 {0} 个模型，可下拉搜索，也可手填。', result.models.length)
        : t('没有可选择的模型，请手动填写，或检查账户权限。'));
    } catch (error) { if (current === revision) { picker.setModels([]); state('error', error.message); } }
    finally { if (current === revision) { cancel = null; pending = false; actions(); } }
  }
  field('apiKey').addEventListener('input', () => {
    invalidate();
    if (field('apiKey').value.trim()) timer = setTimeout(() => fetchList(), 800);
  });
  // Changing destinations never automatically sends the previous draft key there.
  for (const name of ['endpoint', 'authMode']) field(name).addEventListener('input', invalidate);
  button.addEventListener('click', () => fetchList(true));
  window.addEventListener('pagehide', invalidate);
  return {invalidate, actions};
}
