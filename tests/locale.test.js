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
