import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../extension/shared/locale.js',import.meta.url),'utf8');
test('UI language follows the browser and leaves source-language names intact', () => {
  for(const [language,expected] of [['en-US','Translate this page'],['zh-CN','翻译当前网页']]) {
    const context=vm.createContext({browser:{i18n:{getUILanguage:()=>language}}});
    vm.runInContext(source,context);
    const {t}=context.QuietTranslateLocale;
    assert.equal(t('翻译当前网页'),expected);
    assert.equal(t('简体中文'),'简体中文');
    assert.equal(t('Unrecognized source text'),'Unrecognized source text');
    assert.equal(t('{0} / {1} 段',2,7), language==='en-US'?'2 / 7 parts':'2 / 7 段');
  }
});
test('Mac UI names Option and Command in both languages without changing translation placeholders', () => {
  for (const language of ['zh-CN', 'en-US']) {
    for (const navigator of [{platform: 'MacIntel'}, {platform: 'Win32', userAgentData: {platform: 'macOS'}}]) {
      const context = vm.createContext({navigator, browser: {i18n: {getUILanguage: () => language}}});
      vm.runInContext(source, context);
      const {t, isMac} = context.QuietTranslateLocale;
      assert.equal(isMac, true);
      assert.match(t('先选中一段文字，再按 Alt+Q'), /⌥ Option\+Q/);
      assert.match(t('复制失败，请选中文字后按 Ctrl+C'), /⌘ Cmd\+C/);
      assert.equal(t('Alt T'), '⌥ Option T');
      assert.equal(t('Ctrl'), '⌘ Cmd');
      assert.equal(t('{0}', 'Original Ctrl+C and Alt+Q'), 'Original Ctrl+C and Alt+Q');
    }
  }
  const context = vm.createContext({navigator: {platform: 'Win32'}});
  vm.runInContext(source, context);
  assert.equal(context.QuietTranslateLocale.t('Alt T'), 'Alt T');
});
