async page => {
  const context = page.context();
  const worker = context.serviceWorkers()[0];
  const origin = worker.url().replace('/background.js', '');
  const article = context.pages().find(p => p.url().includes('/article'));
  const workspace = context.pages().find(p => p.url().endsWith('/workspace.html'));
  await article.reload();
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({})).find(tab => tab.url?.includes('/article')).id);
  await worker.evaluate(id => chrome.tabs.update(id, {active: true}), tabId);
  const report = [];
  const check = (value, label) => { if (!value) throw new Error(label); report.push({check: label, pass: true}); };
  let state = await worker.evaluate(id => chrome.tabs.sendMessage(id, {type: 'qt-state'}), tabId);
  if (!state.enabled) await worker.evaluate(id => chrome.tabs.sendMessage(id, {type: 'qt-toggle'}), tabId);
  await article.locator('#first qt-line .text[data-loading=false]').waitFor({timeout: 30000});
  await article.locator('#second qt-line .text[data-loading=false]').waitFor({timeout: 30000});
  check(/\p{Script=Han}/u.test(await article.locator('#first qt-line .text').innerText()), 'Comet / actual GLM paragraph translation');
  check(await article.locator('nav qt-line,pre qt-line,[contenteditable] qt-line,[translate=no] qt-line,textarea qt-line').count() === 0, 'Code, navigation, editors and opted-out text untouched');
  check(await article.locator('#chinese qt-line').count() === 0, 'Already-Chinese content skipped');
  await article.evaluate(() => { window.__qaLink = document.querySelector('#original-link'); window.scrollTo(0, 0); });
  await article.screenshot({path: 'output/playwright/comet-bilingual-light.png'});
  await worker.evaluate(id => chrome.tabs.sendMessage(id, {type: 'qt-toggle'}), tabId);
  check(await article.locator('qt-line').count() === 0, 'Restoring original removes every injected paragraph');
  check(await article.evaluate(() => window.__qaLink === document.querySelector('#original-link') && window.__qaLink.getAttribute('href') === '#second'), 'Original link identity and behavior preserved');
  await article.locator('#first').evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const selected = getSelection(); selected.removeAllRanges(); selected.addRange(range);
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: rect.left + 260, clientY: rect.bottom}));
  });
  await article.getByRole('button', {name: '翻译选中文字', exact: true}).click();
  await article.locator('qt-overlay .translation[data-loading=false]').waitFor({timeout: 30000});
  check((await article.locator('qt-overlay .translation').innerText()).length > 15, 'Selection bubble produces a real translation');
  check((await article.locator('qt-overlay .meta').innerText()).includes('缓存'), 'Page and selection share cached translations');
  await article.getByRole('button', {name: '固定浮层', exact: true}).click();
  await article.locator('h1').click();
  check(await article.getByRole('dialog', {name: '轻译划线翻译'}).isVisible(), 'Pinned selection survives outside clicks');
  await article.screenshot({path: 'output/playwright/comet-selection-light.png'});
  await article.keyboard.press('Escape');
  check(!await article.getByRole('dialog', {name: '轻译划线翻译'}).isVisible(), 'Escape dismisses selection');

  const paragraphs = [
    'Good tools have a way of disappearing. They leave us with the thing we came for: the sentence, the idea, the quiet moment when something unfamiliar begins to make sense.',
    'Reading in another language can feel like looking through a window that is almost clear. We recognize a shape, catch a phrase, and then lose the thread. A good translation simply brings the view a little closer.',
    'There is a difference between understanding every word and understanding what a writer means. Tone lives between the words. A familiar reference, a deliberate pause, a phrase repeated twice: these details make writing feel human.',
    'When the translation sits just below the original, you can move between two ways of seeing without losing your place. The page remains the page. You continue at your own pace.',
  ];
  const source = Array.from({length: 16}, (_, i) => `[${i + 1}] ${paragraphs[i % 4]}`).join('\n\n');
  await workspace.getByRole('textbox', {name: '待翻译原文'}).fill(source);
  await workspace.getByRole('button', {name: '开始翻译', exact: true}).click();
  await workspace.locator('#copy:not([disabled])').waitFor({timeout: 55000});
  const result = await workspace.locator('#result').innerText();
  check(await workspace.locator('#source').inputValue() === source, 'Long-text source preserved byte-for-byte');
  check(result.includes('[1]') && result.includes('[16]'), 'Actual long translation reaches final numbered paragraph');
  check(result.length > 500, 'Long translation has substantive output');
  report.push({realLongStatus: await workspace.locator('#status').innerText(),sourceChars: source.length,resultChars: result.length});
  await workspace.screenshot({path: 'output/playwright/workspace-translated-light.png'});
  await workspace.locator('#translate').click();
  await workspace.locator('#copy:not([disabled])').waitFor({timeout: 5000});
  check((await workspace.locator('#status').innerText()).includes('缓存'), 'Long translation reopens from local cache');
  await workspace.emulateMedia({colorScheme: 'dark'});
  await workspace.screenshot({path: 'output/playwright/workspace-translated-dark.png'});
  await workspace.setViewportSize({width: 430, height: 930});
  check(await workspace.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Long-text workspace fits a 430px viewport');
  await workspace.screenshot({path: 'output/playwright/workspace-mobile.png', fullPage: true});
  await workspace.setViewportSize({width: 1360, height: 1000}); await workspace.emulateMedia({colorScheme: 'light'});

  const options = await context.newPage(); await options.goto(origin + '/options.html');
  await options.locator('#cache-size').filter({hasText: '条译文'}).waitFor();
  check(await options.locator('input[name=apiKey]').inputValue() === '', 'Settings never redisplay stored credentials');
  await options.screenshot({path: 'output/playwright/options-light.png', fullPage: true});
  await options.emulateMedia({colorScheme: 'dark'}); await options.screenshot({path: 'output/playwright/options-dark.png', fullPage: true});
  await options.setViewportSize({width: 430, height: 930});
  check(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Settings fit a 430px viewport');
  const localStorageHasKey = await worker.evaluate(async () => {
    const data = await chrome.storage.local.get(null); return JSON.stringify(data).includes('apiKey');
  });
  check(!localStorageHasKey, 'No API key in content-script-accessible storage.local');
  await options.close();
  return report;
}
