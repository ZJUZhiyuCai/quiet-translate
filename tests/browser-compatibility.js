// Controlled regressions for structures discovered on the real sites; uses only the local mock API.
async page => {
  const context=page.context(), worker=context.serviceWorkers()[0];
  const article=context.pages().find(p=>p.url().includes('/article'));
  const tabId=await worker.evaluate(async()=> (await chrome.tabs.query({})).find(t=>t.url?.includes('/article')).id);
  const toggle=()=>worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'qt-toggle'}),tabId);
  if((await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'qt-state'}),tabId)).enabled)await toggle();
  await worker.evaluate(id=>chrome.tabs.update(id,{active:true}),tabId);
  const report=[]; const check=(value,label)=>{if(!value)throw new Error(label);report.push({pass:true,check:label});};
  await article.evaluate(()=>{
    document.body.innerHTML='<header><ol><li>Documentation navigation</li></ol></header><main><article><header><h1>Source article heading</h1></header><p id="inline">Call <code>getBoundingClientRect()</code> to measure a visible element. <code translate="no">SKIP_IDENTIFIER</code></p><pre><code>const untouched = true;</code></pre><div id="old"><font id="legacy">First paragraph keeps the original linked <a href="#inline">reference</a> in place.<br><br>Second paragraph begins a different idea for the reader.<br><br>Third paragraph closes this short legacy article.</font></div><p id="single">A sentence on the first line.<br>Another sentence on the second line.</p></article></main>';
    document.body.style.cssText='margin:24px;max-width:760px;color:#17251e;background:#fff;font:16px/1.6 sans-serif';
    window.__legacyNodes=[...document.querySelector('#legacy').childNodes];
    window.__originalLink=document.querySelector('#legacy a');
    window.__bodySource=document.body.textContent; scrollTo(0,0);
  });
  await toggle();
  await article.locator('#inline qt-line .text[data-loading=false]').waitFor();
  await article.waitForFunction(()=>document.querySelectorAll('#legacy qt-line').length===3 && [...document.querySelectorAll('#legacy qt-line')].every(e=>e.shadowRoot.querySelector('.text').dataset.loading==='false'));
  check(await article.locator('body > header qt-line').count()===0,'Global navigation untouched');
  check(await article.locator('article header h1 qt-line').count()===1,'Article heading remains eligible');
  const inline=await article.locator('#inline qt-line .text').innerText();
  check(inline.includes('getBoundingClientRect()'),'Inline API identifier reaches translation service');
  check(!inline.includes('SKIP_IDENTIFIER'),'Explicit translate=no inside code still respected');
  check(await article.locator('pre qt-line').count()===0,'Standalone code stays untouched');
  check(await article.evaluate(()=>__legacyNodes.every(n=>n.isConnected)&&__originalLink===document.querySelector('#legacy a')),'Legacy paragraph and link objects preserved');
  check(await article.evaluate(()=>[...document.querySelectorAll('#legacy qt-line')].every(h=>h.previousSibling&&h.nextSibling?.nodeName==='BR'||h===document.querySelector('#legacy').lastChild)),'Legacy translations inserted between original paragraphs');
  check((await article.locator('#single qt-line .text').innerText()).includes('\n'),'Single line break preserved without forced paragraph splitting');
  const light=await article.locator('#inline qt-line .wrap').evaluate(e=>getComputedStyle(e).color);
  await article.evaluate(()=>{document.body.style.color='#f1f5f2';document.body.style.background='#171c19';});
  const dark=await article.locator('#inline qt-line .wrap').evaluate(e=>getComputedStyle(e).color);
  check(light!==dark,'Existing translation follows page color change without network or observer');
  await article.evaluate(()=>{__legacyNodes.find(n=>n.nodeType===3&&n.data.startsWith('Second')).data='Updated second paragraph is translated after the source changes.';});
  await article.waitForFunction(()=>[...document.querySelectorAll('#legacy qt-line')].some(h=>h.shadowRoot.querySelector('.text').textContent.includes('Updated second')));
  check(await article.locator('#legacy qt-line').count()===3,'Changed legacy paragraph refreshes without duplicate blocks');
  await toggle();
  check(await article.locator('qt-line,qt-anchor').count()===0,'Restore removes both translation hosts and paragraph anchors');
  check(await article.evaluate(()=>__legacyNodes.every(n=>n.isConnected)&&__originalLink===document.querySelector('#legacy a')),'Restore retains the original source nodes');
  return report;
}
