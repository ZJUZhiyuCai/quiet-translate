async page => {
  const worker = page.context().serviceWorkers()[0];
  const site = new URL(page.url()).hostname;
  const index = site.includes('mozilla') ? 0 : site.includes('wikipedia') ? 1 : 2;
  const tabId = await worker.evaluate(async i => (await chrome.tabs.query({})).filter(t => t.index === i).at(-1).id, index);
  await worker.evaluate(id => chrome.tabs.update(id, {active: true}), tabId);
  const state = await worker.evaluate(id => chrome.tabs.sendMessage(id, {type: 'qt-state'}), tabId);
  if (state.enabled) await worker.evaluate(id => chrome.tabs.sendMessage(id, {type: 'qt-toggle'}), tabId);
  await page.evaluate(() => {
    getSelection().removeAllRanges(); scrollTo(0, 0);
    const scope = document.querySelector('main') || document.body;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {acceptNode:n => n.parentElement.closest('script,style,[data-qt-owned]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
    const originals = []; let n;
    while ((n = walker.nextNode())) originals.push({node:n,text:n.data});
    window.__qtLayout = {originals, links:[...scope.querySelectorAll('a')].map(node=>({node,href:node.getAttribute('href')})), width:document.documentElement.scrollWidth, boxes:[...scope.querySelectorAll('p,pre,table,img')].filter(e=>e.getClientRects().length).map(node=>({node,x:node.getBoundingClientRect().x,width:node.getBoundingClientRect().width})), tasks:[]};
    window.__qtLongObserver?.disconnect();
    window.__qtLongObserver = new PerformanceObserver(list=>window.__qtLayout.tasks.push(...list.getEntries().map(e=>Math.round(e.duration))));
    window.__qtLongObserver.observe({type:'longtask'});
  });
  await page.screenshot({path:`output/playwright/real-${site.split('.')[0]}-before.png`});
  await worker.evaluate(id => chrome.tabs.sendMessage(id, {type:'qt-toggle'}), tabId);
  await page.locator('qt-line .text[data-loading=false]').first().waitFor({timeout:60000});
  await page.waitForFunction(() => [...document.querySelectorAll('qt-line')].every(e=>e.shadowRoot.querySelector('.text').dataset.loading === 'false'), null, {timeout:60000});
  await page.screenshot({path:`output/playwright/real-${site.split('.')[0]}-bilingual.png`});
  const result = await page.evaluate(() => ({
    sourceIntact:__qtLayout.originals.every(v=>v.node.isConnected && v.node.data===v.text), linksIntact:__qtLayout.links.every(v=>v.node.isConnected && v.node.getAttribute('href')===v.href),
    widthBefore:__qtLayout.width,widthAfter:document.documentElement.scrollWidth, horizontalChanges:__qtLayout.boxes.filter(v=>Math.abs(v.node.getBoundingClientRect().width-v.width)>1 || Math.abs(v.node.getBoundingClientRect().x-v.x)>1).map(v=>({tag:v.node.tagName,before:v.width,after:v.node.getBoundingClientRect().width})).slice(0,8),
    translated:document.querySelectorAll('qt-line').length, chromeTranslations:document.querySelectorAll('header qt-line,nav qt-line,[role=navigation] qt-line').length, codeTranslations:document.querySelectorAll('pre qt-line,code qt-line').length,longTasks:__qtLayout.tasks,
    hosts:[...document.querySelectorAll('qt-line')].slice(0,12).map(e=>({parent:e.parentElement.tagName,source:e.parentElement.textContent.slice(0,60),chars:e.shadowRoot.querySelector('.text').textContent.length,error:e.shadowRoot.querySelector('.error').hidden?null:e.shadowRoot.querySelector('.error').textContent}))
  }));
  await worker.evaluate(id => chrome.tabs.sendMessage(id, {type:'qt-toggle'}), tabId);
  result.restored = await page.evaluate(() => ({
    injectedNodes:document.querySelectorAll('qt-line,qt-anchor').length,
    originalNodes:__qtLayout.originals.every(v=>v.node.isConnected&&v.node.data===v.text),
    horizontalChanges:__qtLayout.boxes.filter(v=>Math.abs(v.node.getBoundingClientRect().width-v.width)>1||Math.abs(v.node.getBoundingClientRect().x-v.x)>1).length,
  }));
  return {site,tabId,...result};
}
