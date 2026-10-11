import {t} from './shared/i18n.js';
import {$, send, theme, languageOptions, notify, copyText, createTranslation} from './shared/ui.js';
let settings, task, resultText = '', translatedSource = '', complete = false;
const source = $('#source');
function count() {
  $('#count').textContent = source.value.length.toLocaleString() + ' / 60,000';
  $('#translate').disabled = !source.value.trim() || Boolean(task) || !settings?.configured;
  $('#clear').disabled = !source.value || Boolean(task);
}
function busy(value) {
  $('#stop').hidden = !value; $('#progress-track').hidden = !value;
  $('#result').dataset.loading = String(value); source.readOnly = value;
  $('#target').disabled = value; $('#import').disabled = value;
  count();
}
async function start() {
  const text = source.value.trim();
  if (!text || task) return;
  if (!settings.configured) { notify(t("先在设置中连接翻译服务"), true); return; }
  translatedSource = text; resultText = ''; complete = false;
  source.scrollTop = 0; $('.target-pane').scrollTop = 0;
  $('#copy').disabled = $('#download').disabled = true;
  $('#result').textContent = ''; $('#result').hidden = false; $('#empty').hidden = true; $('#error').hidden = true;
  $('#progress').style.width = '0'; $('#status').textContent = t("正在连接翻译服务…");
  const current = createTranslation(text, {target: $('#target').value, onUpdate: event => {
    if (task !== current) return;
    resultText = event.text; $('#result').textContent = event.text;
    $('#status').textContent = t("正在翻译 · {0} / {1} 段", event.completed, event.total);
    $('#progress').style.width = (100 * event.completed / event.total) + '%';
  }});
  task = current; busy(true);
  try {
    const result = await current.promise;
    resultText = result.text; complete = true; $('#result').textContent = result.text;
    $('#status').textContent = result.cached ? t("翻译完成 · 来自本地缓存") : t("翻译完成 · {0} 秒 · {1} 段", (result.elapsed / 1000).toFixed(1), result.chunks);
    $('#copy').disabled = $('#download').disabled = false;
  } catch (error) {
    if (error.name === 'AbortError') $('#status').textContent = t("已停止 · 保留已显示的部分译文");
    else { $('#error').textContent = error.message + t("\n点击「重新翻译」即可重试。"); $('#error').hidden = false; $('#status').textContent = t("译文尚未完成"); }
  } finally {
    task = null; busy(false); $('#translate').textContent = t("重新翻译 ↗");
    // Partial output stays visibly marked and cannot be exported as a finished translation.
  }
}
source.addEventListener('input', () => {
  if (translatedSource && source.value.trim() !== translatedSource) {
    $('#status').textContent = t("原文已修改 · 点击翻译以更新右侧结果");
    $('#copy').disabled = $('#download').disabled = true; complete = false;
  }
  count();
});
$('#translate').onclick = start;
$('#stop').onclick = () => task?.cancel();
document.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); start(); } });
$('#copy').onclick = () => { if (complete) copyText(resultText); };
$('#clear').onclick = () => {
  source.value = ''; resultText = ''; translatedSource = ''; complete = false;
  $('#result').textContent = ''; $('#result').hidden = true; $('#empty').hidden = false; $('#error').hidden = true;
  $('#copy').disabled = $('#download').disabled = true;
  $('#status').textContent = t("最多 60,000 字符 · 不保存原文草稿"); $('#translate').textContent = t("开始翻译 ↗"); count(); source.focus();
};
$('#target').onchange = () => {
  if (resultText) { complete = false; $('#copy').disabled = $('#download').disabled = true; $('#status').textContent = t("语言已切换 · 点击翻译以更新结果"); }
};
$('#download').onclick = () => {
  if (!complete) return;
  const blob = new Blob([t("原文\n\n") + translatedSource + t("\n\n────────────────────────\n\n译文\n\n") + resultText], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = t("轻译-双语文本.txt"); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async () => {
  const file = $('#file').files[0]; if (!file) return;
  try {
    if (file.size > 300000) throw new Error(t("文件较大，请选取不超过 60,000 字符的部分。"));
    const text = await file.text();
    if (text.length > 60000) throw new Error(t("文本超过 60,000 字符，请拆分后导入。"));
    if (text.includes('\u0000')) throw new Error(t("请导入 UTF-8 编码的 TXT 或 Markdown 文件。"));
    source.value = text; source.dispatchEvent(new Event('input')); notify(t("文本已导入"));
  } catch (error) { notify(error.message, true); }
  finally { $('#file').value = ''; }
};
window.addEventListener('pagehide', () => task?.cancel());
try {
  ({settings} = await send('qt-settings')); theme(settings.theme); languageOptions($('#target'), settings.target);
  $('#model').textContent = settings.model || t("尚未连接");
  if (location.hash) {
    const draft = await send('qt-draft', {id: location.hash.slice(1)}); source.value = draft.text;
    history.replaceState(null, '', location.pathname);
  }
  if (!settings.configured) { $('#status').textContent = t("先在「偏好设置」中连接翻译服务"); notify(t("还差一步：在偏好设置中连接翻译服务。"), true); }
  count();
} catch (error) { notify(error.message, true); }
