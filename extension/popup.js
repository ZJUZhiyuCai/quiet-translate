import {t} from './shared/i18n.js';
import {$, send, theme, languageOptions, notify} from './shared/ui.js';
import {api as chrome} from './shared/platform.js';
let settings, active;
function renderState(state) {
  active = state;
  $('#site').textContent = state.host || t("此页面不支持网页翻译");
  $('#toggle').disabled = !state.supported || !settings.configured;
  $('#auto-site').disabled = !state.supported;
  $('#auto-site').checked = settings.autoSites.includes(state.host);
  $('#toggle-label').textContent = state.enabled ? t("恢复原文") : t("翻译当前网页");
  $('#page-badge').textContent = state.enabled ? t("正在双语阅读") : t("双语阅读");
  const excluded = settings.excludedSites.includes(state.host);
  if (excluded) { $('#toggle').disabled = true; $('#toggle-label').textContent = t("本站已停用"); }
  $('#exclude').hidden = !state.supported;
  $('#exclude').textContent = excluded ? t("恢复本站") : t("本站停用");
  $('#auto-site').disabled ||= excluded;
  $('#progress').textContent = state.enabled ? t("已翻译 {0} 段{1}", state.done || 0, state.pending ? t(" · {0} 段处理中", state.pending) : t(" · 随阅读继续")) : state.supported ? t("只翻译读到的内容，轻快不打扰") : t("可复制文字，使用下方长文翻译");
  $('#retry').hidden = !state.errors;
}
async function save(patch) {
  try { const result = await send('qt-save', {settings: patch}); settings = result.settings; }
  catch (error) { notify(error.message, true); throw error; }
}
$('#settings').onclick = $('#setup-link').onclick = () => chrome.runtime.openOptionsPage();
$('#workspace').onclick = () => send('qt-open-workspace').catch(error => notify(error.message, true));
$('#toggle').onclick = async () => {
  $('#toggle').disabled = true;
  try {
    await send('qt-control', {tabId: active.tabId, action: 'qt-toggle'});
    renderState(await send('qt-active'));
  } catch (error) { notify(error.message, true); $('#toggle').disabled = false; }
};
$('#retry').onclick = async () => { try { await send('qt-control', {tabId: active.tabId, action: 'qt-retry'}); renderState(await send('qt-active')); } catch (error) { notify(error.message, true); } };
$('#target').onchange = async event => { try { await save({target: event.target.value}); } catch { event.target.value = settings.target; } };
$('#selection').onchange = async event => { try { await save({selection: event.target.checked}); } catch { event.target.checked = settings.selection; } };
$('#auto-site').onchange = async event => {
  const checked = event.target.checked;
  try {
    const autoSites = settings.autoSites.filter(host => host !== active.host);
    if (checked) autoSites.push(active.host);
    await save({autoSites});
    if (checked && !active.enabled) await send('qt-control', {tabId: active.tabId, action: 'qt-toggle'});
    renderState(await send('qt-active'));
  } catch { event.target.checked = !checked; }
};
$('#exclude').onclick = async () => {
  try {
    const excludedSites = settings.excludedSites.filter(host => host !== active.host);
    if (!settings.excludedSites.includes(active.host)) excludedSites.push(active.host);
    await save({excludedSites}); renderState(await send('qt-active'));
  } catch {}
};
try {
  $('#version').textContent = 'v' + chrome.runtime.getManifest().version;
  ({settings} = await send('qt-settings'));
  theme(settings.theme); languageOptions($('#target'), settings.target);
  $('#selection').checked = settings.selection; $('#setup').hidden = settings.configured;
  $('#model').replaceChildren();
  const dot = document.createElement('span'); dot.className = 'status-dot' + (settings.configured ? '' : ' off');
  $('#model').append(dot, document.createTextNode(settings.model || t("尚未连接")));
  renderState(await send('qt-active'));
  const timer = setInterval(async () => { if (active?.enabled) try { renderState(await send('qt-active')); } catch {} }, 1200);
  window.addEventListener('pagehide', () => clearInterval(timer));
} catch (error) { $('#toggle-label').textContent = t("重新打开试试"); notify(error.message, true); }
