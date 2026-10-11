import {t} from './shared/i18n.js';
import {$, send, theme, languageOptions, notify, createTranslation} from './shared/ui.js';
import {endpointURL} from './shared/core.js';
import {api as chrome} from './shared/platform.js';
const form = $('#preferences-form');
let settings, test;
const field = name => form.elements.namedItem(name);
function preview() {
  $('#translation-preview').dataset.style = field('style').value;
  $('#translation-preview').style.fontSize = 14 * Number(field('fontSize').value) / 100 + 'px';
  $('#font-size-value').textContent = field('fontSize').value + '%';
  theme(field('theme').value);
}
function populate() {
  for (const name of ['selection', 'hover', 'cache']) field(name).checked = settings[name];
  for (const name of ['target', 'selectionMode', 'style', 'fontSize', 'theme', 'endpoint', 'model', 'glossary', 'reasoningEffort', 'tokenParameter', 'authMode']) field(name).value = settings[name];
  for (const name of ['autoSites', 'excludedSites']) field(name).value = settings[name].join('\n');
  field('apiKey').value = ''; field('apiKey').placeholder = settings.configured ? t("已保存 · 留空保持不变") : t("输入 API 密钥");
  $('#key-hint').textContent = settings.configured ? t("密钥已连接，仅存于此浏览器。") : t("仅保存在此浏览器，不参与同步。");
  preview();
  $('#test-connection').disabled = !settings.configured;
  $('#remove-key').disabled = !settings.configured;
}
async function cacheStats() {
  const stats = await send('qt-cache-stats');
  $('#cache-size').textContent = t("{0} 条译文 · {1} KB", stats.entries, (stats.bytes / 1024).toFixed(0));
}
function hostLines(name) {
  return field(name).value.split(/[\n,，]/).map(v => v.trim()).filter(Boolean).map(v => {
    try { return new URL(v.includes('://') ? v : 'https://' + v).host; } catch { throw new Error(t("网站域名格式不正确：") + v); }
  });
}
form.addEventListener('input', () => { $('#save-state').textContent = t("有未保存的修改"); preview(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  $('#save').disabled = true;
  try {
    const endpoint = endpointURL(field('endpoint').value);
    const origin = new URL(endpoint).origin + '/*';
    // Request optional permission directly inside the user gesture before any asynchronous work.
    const allowed = await chrome.permissions.request({origins: [origin]});
    if (!allowed) throw new Error(t("尚未允许访问此接口，设置未保存。"));
    const values = Object.fromEntries(new FormData(form));
    for (const name of ['selection', 'hover', 'cache']) values[name] = field(name).checked;
    values.endpoint = endpoint;
    values.autoSites = hostLines('autoSites'); values.excludedSites = hostLines('excludedSites');
    ({settings} = await send('qt-save', {settings: values}));
    populate(); $('#save-state').textContent = t("已保存"); notify(t("偏好已保存"));
  } catch (error) { notify(error.message, true); }
  finally { $('#save').disabled = false; }
});
$('#provider').onchange = event => {
  const presets = {
    openai: ['https://api.openai.com/v1', 'max_completion_tokens', 'bearer'],
    deepseek: ['https://api.deepseek.com/v1', 'max_tokens', 'bearer'],
    openrouter: ['https://openrouter.ai/api/v1', 'max_tokens', 'bearer'],
    siliconflow: ['https://api.siliconflow.cn/v1', 'max_tokens', 'bearer'],
    local: ['http://localhost:11434/v1', 'max_tokens', 'none'],
  };
  const preset = presets[event.target.value];
  if (!preset) return;
  [field('endpoint').value, field('tokenParameter').value, field('authMode').value] = preset;
  field('model').value = ''; field('apiKey').value = ''; field('reasoningEffort').value = 'default';
  $('#key-hint').textContent = t("请填写此服务的模型名和密钥，然后保存。");
  form.dispatchEvent(new Event('input')); field('model').focus();
};
$('#remove-key').onclick = async () => {
  try { ({settings} = await send('qt-save', {settings: {removeKey: true, authMode: 'bearer'}})); populate(); notify(t("密钥已移除")); }
  catch (error) { notify(error.message, true); }
};
$('#test-connection').onclick = async () => {
  $('#test-connection').disabled = true;
  $('#connection-status').textContent = t("正在测试…");
  test = createTranslation('Good tools help you read the world, one paragraph at a time.', {target: 'zh-CN', kind: 'probe'});
  try {
    const result = await test.promise;
    $('#connection-status').textContent = result.cached ? t("连接可用 · 命中缓存") : t("连接成功 · 首字 {0} 秒", (result.first / 1000).toFixed(1));
  } catch (error) { $('#connection-status').textContent = error.message; }
  finally { $('#test-connection').disabled = false; test = null; }
};
$('#clear-cache').onclick = async () => {
  try { await send('qt-cache-clear'); await cacheStats(); notify(t("缓存已清空")); }
  catch (error) { notify(error.message, true); }
};
window.addEventListener('pagehide', () => test?.cancel());
try {
  ({settings} = await send('qt-settings')); languageOptions($('#target'), settings.target); populate(); await cacheStats();
  if (!settings.configured) { $('#connection').scrollIntoView({block: 'start'}); field('model').focus({preventScroll: true}); }
} catch (error) { notify(error.message, true); }
