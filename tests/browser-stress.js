async page => {
  const context = page.context(), worker = context.serviceWorkers()[0];
  const origin = worker.url().replace('/background.js', '');
  const workspace = context.pages().find(p => p.url().endsWith('/workspace.html'));
  const article = context.pages().find(p => p.url().includes('/article'));
  const base = new URL(article.url()).origin;
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({})).find(t=>t.url?.includes('/article')).id);
  const report = [];
  const check = (value, label) => { if (!value) throw new Error(label); report.push({check: label, pass: true}); };
  const stats = () => article.evaluate(url => fetch(url + '/stats').then(r => r.json()), base);
  const toggle = () => worker.evaluate(id => chrome.tabs.sendMessage(id, {type: 'qt-toggle'}), tabId);
  await article.bringToFront();
  await article.reload();
  await article.evaluate(() => scrollTo(0, 0));
  await article.evaluate(() => { window.__qaLongTasks=[]; new PerformanceObserver(list => window.__qaLongTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true}); });
  if (!(await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'qt-state'}),tabId)).enabled) await toggle();
  await article.locator('#first qt-line .text[data-loading=false]').waitFor();
  check((await article.locator('#first qt-line .text').innerText()).includes('测试译文'), 'Isolated mock API connected');
  await article.locator('#add').click();
  await article.locator('#added').scrollIntoViewIfNeeded();
  await article.locator('#added qt-line .text[data-loading=false]').waitFor();
  check((await article.locator('#added qt-line .text').innerText()).includes('New stories'), 'New dynamic paragraphs translated');
  await article.locator('#replace').click();
  await article.locator('#first').scrollIntoViewIfNeeded();
  await article.waitForFunction(() => document.querySelector('#first qt-line')?.shadowRoot.querySelector('.text').textContent.includes('has changed'));
  check(await article.locator('#first qt-line').count() === 1, 'Changing a paragraph replaces its translation without duplicates');

  // Insert a thousand paragraphs while staying at the top. Only the viewport is eligible.
  const before = await stats();
  const addedAt = Date.now();
  await article.locator('#stress').evaluate(button => button.click());
  await article.waitForTimeout(1200);
  const after = await stats();
  const performance = await article.evaluate(() => ({longTasks:window.__qaLongTasks.filter(v=>v>100),paragraphs:document.querySelectorAll('p').length,translated:document.querySelectorAll('qt-line').length}));
  check(performance.paragraphs >= 1000, '1,000-paragraph stress fixture created');
  check(after.requests - before.requests <= 8, 'Distant paragraphs do not trigger mass API requests');
  check(performance.translated < 40, 'Large page keeps translation DOM bounded to read content');
  report.push({largePage:performance,requestsAfterThousandParagraphInsert:after.requests-before.requests,observedMs:Date.now()-addedAt});
  // Translation above a newly reached paragraph can push that paragraph below
  // the viewport. Continue scrolling as a reader would until it stays in view.
  for (let attempt=0;attempt<5;attempt++) {
    await article.locator('#dynamic p').last().scrollIntoViewIfNeeded();
    await article.waitForTimeout(800);
    if (await article.locator('#dynamic p').last().locator('qt-line').count()) break;
  }
  await article.locator('#dynamic p').last().locator('qt-line .text[data-loading=false]').waitFor({timeout:20000});
  check(true, 'Far-away content becomes translatable when scrolled into view');
  await toggle();
  check(await article.locator('qt-line').count() === 0, 'Stop cleans all translations on large pages');

  await workspace.bringToFront();
  await workspace.locator('#source').fill('TEST_401 This request deliberately tests an expired API credential.');
  await workspace.locator('#translate').click();
  await workspace.locator('#error:not([hidden])').waitFor();
  check(/密钥无效|Invalid or expired API key/.test(await workspace.locator('#error').innerText()), 'Authentication failures give a clear recovery message');
  check(await workspace.locator('#copy').isDisabled(), 'Failed output is never presented as finished');
  await workspace.locator('#source').fill('TEST_XSS Untrusted model output must remain plain text.');
  await workspace.locator('#translate').click();
  await workspace.locator('#copy:not([disabled])').waitFor();
  check((await workspace.locator('#result').innerText()).includes('<img'), 'Markup-looking model output displayed literally');
  check(await workspace.locator('#result img').count() === 0, 'No executable HTML from model output');
  const beforeCancel = await stats();
  await workspace.locator('#source').fill('TEST_SLOW This request deliberately waits so that the stop button can cancel it.');
  await workspace.locator('#translate').click();
  await workspace.locator('#stop:not([hidden])').click();
  await workspace.locator('#status').filter({hasText:/已停止|Stopped/}).waitFor();
  check(!await workspace.locator('#source').getAttribute('readonly'), 'Cancel restores editing immediately');
  check(await workspace.locator('#copy').isDisabled(), 'Cancelled partial output cannot masquerade as complete');
  report.push({beforeCancelRequests:beforeCancel.requests});

  const full = Array.from({length:400},(_,i)=>`[${i}] A long document should keep every section in order. Read patiently, retain the original, and translate each sentence faithfully. `).join('\n').padEnd(60000,'x').slice(0,60000);
  await workspace.locator('#source').fill(full);
  await workspace.locator('#translate').click();
  await workspace.locator('#copy:not([disabled])').waitFor({timeout:55000});
  check((await workspace.locator('#source').inputValue()).length === 60000, 'Maximum 60,000-character input preserved');
  check(/翻译完成|Complete/.test(await workspace.locator('#status').innerText()), 'Maximum input completes its full chunk queue');
  report.push({maximumTextStatus:await workspace.locator('#status').innerText()});
  check((await stats()).maxActive <= 4, 'Global API concurrency stays at or below four');

  // Save preferences through the same extension message boundary as the real UI.
  const saved = await workspace.evaluate(async host => chrome.runtime.sendMessage({type:'qt-save',settings:{autoSites:[host]}}),new URL(base).host);
  check(saved.ok, 'Site preferences persist');
  await article.bringToFront(); await article.reload();
  await article.evaluate(() => scrollTo(0, 0));
  await article.locator('#first qt-line .text[data-loading=false]').waitFor();
  check(true, 'Per-site auto translation starts on a fresh navigation');
  const denied = await worker.evaluate(async id => {
    const result = await chrome.scripting.executeScript({target:{tabId:id},func:()=>chrome.runtime.sendMessage({type:'qt-save',settings:{model:'untrusted-replacement'}})});
    return result[0].result;
  }, tabId);
  check(denied.ok === false, 'Content scripts cannot change provider configuration');
  await workspace.evaluate(async host => chrome.runtime.sendMessage({type:'qt-save',settings:{excludedSites:[host]}}),new URL(base).host);
  await article.waitForFunction(()=>document.querySelectorAll('qt-line').length===0);
  check(true, 'Disabling a site immediately restores the original');
  await workspace.evaluate(()=>chrome.runtime.sendMessage({type:'qt-save',settings:{autoSites:[],excludedSites:[]}}));
  const popup=await context.newPage();
  await worker.evaluate(id=>chrome.tabs.update(id,{active:true}),tabId);
  await popup.goto(origin+'/popup.html');
  await popup.locator('#toggle:not([disabled])').waitFor();
  await popup.locator('body').screenshot({path:'output/playwright/popup-light.png'});
  await popup.emulateMedia({colorScheme:'dark'}); await popup.locator('body').screenshot({path:'output/playwright/popup-dark.png'});
  await popup.locator('#toggle').click();
  await popup.locator('#toggle-label').filter({hasText:/恢复原文|Restore original/}).waitFor();
  check(true, 'Popup toggle targets the active browser page');
  await popup.locator('#toggle').click();
  await popup.close();
  const commands=await worker.evaluate(()=>chrome.commands.getAll());
  check(commands.filter(c=>c.shortcut).length>=3, 'All three browser shortcuts registered');
  await workspace.evaluate(()=>chrome.runtime.sendMessage({type:'qt-cache-clear'}));
  const empty=await workspace.evaluate(()=>chrome.runtime.sendMessage({type:'qt-cache-stats'}));
  check(empty.entries===0, 'Clearing cache removes every stored translation');
  return report;
}
