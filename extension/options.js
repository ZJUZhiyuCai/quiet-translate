import {t} from './shared/i18n.js';
import {$, send, theme, languageOptions, notify, createTranslation} from './shared/ui.js';
import {endpointURL} from './shared/core.js';
import {api as chrome} from './shared/platform.js';
import {makeProfile, encryptProfile, readProfile, MAX_PROFILE_BYTES} from './shared/profile.js';
const form = $('#preferences-form');
let settings, test, saving = false, transferring = false, dirty = false, revision = 0, imported = false;
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
  field('apiKey').value = ''; credentialHint();
  preview();
  actions();
}
function credentialHint() {
  const hasKey = settings.configured && settings.authMode !== 'none';
  field('apiKey').placeholder = hasKey ? t("已保存 · 留空保持不变") : t("输入 API 密钥");
  $('#key-hint').textContent = settings.authMode === 'none' ? t("本机服务无需密钥。") : hasKey ? t("密钥已保存，仅存于此浏览器。") : t("仅保存在此浏览器，不参与同步。");
}
function actions() {
  $('#save').disabled = saving || transferring;
  $('#save-test').disabled = saving || transferring || Boolean(test);
  $('#test-connection').disabled = saving || transferring || Boolean(test) || !settings?.configured;
  $('#remove-key').disabled = saving || transferring || !settings?.configured || settings.authMode === 'none';
  for (const id of ['export-profile', 'import-profile']) $('#' + id).disabled = saving || transferring;
}
function cancelTest() { const previous = test; test = null; previous?.cancel(); }
// Saved and connected are different facts; each gets its own visible state.
function saveState(state, text) { const element = $('#save-state'); element.dataset.state = state; element.textContent = text; }
function connectionState(state, text) {
  const element = $('#connection-status'); element.dataset.state = state; element.textContent = text;
  $('#setup-success').hidden = state !== 'ok' || dirty;
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
form.addEventListener('input', event => {
  if (event.target.closest?.('#transfer')) return;
  dirty = true; revision++; saveState('dirty', t("有未保存的修改")); $('#setup-success').hidden = true; preview();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || transferring) return;
  const submittedRevision = revision;
  const testAfterSave = event.submitter?.id === 'save-test';
  let saved = false;
  saving = true; cancelTest(); actions();
  connectionState('idle', '');
  try {
    const endpoint = endpointURL(field('endpoint').value);
    const origin = new URL(endpoint).origin + '/*';
    const values = Object.fromEntries(new FormData(form));
    // An imported profile replaces credentials explicitly, even on the same provider.
    if (imported && !values.apiKey.trim()) values.removeKey = true;
    for (const name of ['selection', 'hover', 'cache']) values[name] = field(name).checked;
    values.endpoint = endpoint;
    values.autoSites = hostLines('autoSites'); values.excludedSites = hostLines('excludedSites');
    // Request optional permission directly inside the user gesture before any asynchronous work.
    const allowed = await chrome.permissions.request({origins: [origin]});
    if (!allowed) throw new Error(t("尚未允许访问此接口，设置未保存。"));
    ({settings} = await send('qt-save', {settings: values}));
    dirty = revision !== submittedRevision;
    // A permission prompt can stay open while the user continues editing.
    if (!dirty) populate(); else credentialHint();
    saveState(dirty ? 'dirty' : 'ok', dirty ? t("有未保存的修改") : t("已保存"));
    connectionState('idle', t("已保存 · 尚未测试连接"));
    if (!dirty) { imported = false; $('#import-summary').hidden = true; }
    saved = true;
    if (!testAfterSave) notify(t("偏好已保存"));
  } catch (error) { dirty = true; saveState('dirty', t("有未保存的修改")); notify(error.message, true); }
  finally { saving = false; actions(); }
  if (saved && testAfterSave && !dirty) {
    if (settings.configured) await probeConnection();
    else connectionState('error', t('请填写 API 密钥，再保存并测试连接。'));
  }
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
  if (saving) return;
  saving = true; cancelTest(); actions();
  try {
    ({settings} = await send('qt-save', {settings: {removeKey: true, authMode: 'bearer'}}));
    field('apiKey').value = ''; credentialHint();
    connectionState('idle', t("密钥已移除，请重新填写后保存并测试。"));
    saveState(dirty ? 'dirty' : 'ok', dirty ? t("有未保存的修改") : t("密钥已移除"));
    notify(t("密钥已移除"));
  }
  catch (error) { notify(error.message, true); }
  finally { saving = false; actions(); }
};
async function probeConnection() {
  if (saving || test || !settings.configured) return;
  connectionState('idle', t("正在测试…"));
  const job = test = createTranslation('Good tools help you read the world, one paragraph at a time.', {target: 'zh-CN', kind: 'probe'});
  actions();
  try {
    const result = await job.promise;
    if (test !== job) return;
    connectionState('ok', result.cached ? t("连接可用 · 命中缓存") : t("连接成功 · 首字 {0} 秒", (result.first / 1000).toFixed(1)));
  } catch (error) { if (test === job) connectionState('error', error.message); }
  finally { if (test === job) { test = null; actions(); } }
}
$('#test-connection').onclick = probeConnection;

// Export only persisted settings; the key is included only in a password-encrypted file.
$('#include-key').onchange = () => { $('#backup-password-field').hidden = !$('#include-key').checked; };
function downloadJSON(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#export-profile').onclick = async () => {
  if (saving || transferring) return;
  if (dirty) { notify(t('请先保存修改，再导出配置。'), true); return; }
  transferring = true; actions();
  try {
    const includeKey = $('#include-key').checked;
    const exported = await send('qt-export-settings', {includeKey});
    const data = includeKey ? await encryptProfile(exported.settings, $('#backup-password').value) : makeProfile(exported.settings);
    downloadJSON(data, includeKey ? 'quiet-translate-encrypted.json' : 'quiet-translate-preferences.json');
    $('#backup-password').value = '';
    notify(includeKey ? t('加密备份已导出，请妥善保管口令。') : t('偏好已导出，不包含 API 密钥。'));
  } catch (error) { notify(error.message, true); }
  finally { transferring = false; actions(); }
};
$('#import-profile').onclick = async () => {
  if (saving || transferring) return;
  const file = $('#profile-file').files[0];
  if (!file) { $('#profile-file').focus(); return; }
  if (dirty) { notify(t('请先保存修改，或刷新页面放弃修改后再导入。'), true); return; }
  if (file.size > MAX_PROFILE_BYTES) { notify(t('配置文件过大，请选择轻译导出的 JSON 文件。'), true); return; }
  const importRevision = revision;
  transferring = true; actions();
  try {
    const profile = await readProfile(await file.text(), $('#import-password').value);
    if (revision !== importRevision) throw new Error(t('导入期间设置已修改，请保存后重试。'));
    cancelTest();
    const persisted = settings;
    settings = profile.settings; populate(); settings = persisted;
    field('apiKey').value = profile.settings.apiKey;
    field('apiKey').placeholder = t('输入 API 密钥');
    $('#provider').value = 'custom';
    $('#key-hint').textContent = profile.hasKey ? t('密钥已从加密备份读入，保存后生效。') : t('此配置不含密钥，请填写自己的 API 密钥。');
    imported = true;
    form.dispatchEvent(new Event('input'));
    connectionState('idle', t('配置已读入，请确认接口地址后保存并测试。'));
    $('#import-summary').hidden = false;
    $('#import-summary').textContent = t('待导入：{0} · {1}。保存前不会修改现有连接。', profile.settings.endpoint, profile.settings.model || '—');
    $('#import-password').value = ''; $('#profile-file').value = '';
    $('#connection').scrollIntoView({block: 'start'}); $('#save-test').focus({preventScroll: true});
  } catch (error) { notify(error.message, true); }
  finally { transferring = false; actions(); }
};
$('#clear-cache').onclick = async () => {
  try { await send('qt-cache-clear'); await cacheStats(); notify(t("缓存已清空")); }
  catch (error) { notify(error.message, true); }
};
window.addEventListener('pagehide', () => test?.cancel());
try {
  ({settings} = await send('qt-settings')); languageOptions($('#target'), settings.target); populate(); await cacheStats();
  if (settings.configured) { connectionState('idle', t("已保存 · 尚未测试连接")); saveState('idle', t("偏好保存在这台设备上")); }
  else {
    connectionState('idle', t('填写模型和密钥，然后点击「保存并测试连接」。')); saveState('idle', t("偏好保存在这台设备上"));
    $('#connection').scrollIntoView({block: 'start'}); $('#provider').focus({preventScroll: true});
  }
} catch (error) { notify(error.message, true); }
