async page => {
  const context = page.context(), worker = context.serviceWorkers()[0];
  const mdn = context.pages().find(p=>p.url().includes('developer.mozilla.org'));
  const source = await mdn.locator('main p').evaluateAll(nodes=>nodes.filter(e=>e.textContent.trim().length>150 && !e.closest('footer')).slice(0,18).map((e,i)=>`[Q${String(i+1).padStart(2,'0')}] ${e.textContent.trim()}`).join('\n\n'));
  const workspace = context.pages().find(p=>p.url().endsWith('/workspace.html')) || await context.newPage();
  await workspace.goto(worker.url().replace('/background.js','/workspace.html'));
  await workspace.getByRole('textbox',{name:'待翻译原文'}).fill(source);
  await workspace.evaluate(()=>{
    window.__liveLong = {updates:0,rewrites:0}; let previous='';
    document.querySelector('#translate').addEventListener('click',()=>{
      const at=performance.now();
      const observer=new MutationObserver(()=>{
        const text=document.querySelector('#result').textContent;
        if(text){if(!__liveLong.firstMs)__liveLong.firstMs=performance.now()-at; if(previous && !text.startsWith(previous))__liveLong.rewrites++; previous=text;__liveLong.updates++;}
        if(!document.querySelector('#copy').disabled){__liveLong.completeMs=performance.now()-at;observer.disconnect();}
      });
      observer.observe(document.querySelector('main'),{childList:true,subtree:true,attributes:true,characterData:true});
    },{once:true,capture:true});
  });
  await workspace.locator('#translate').click();
  await workspace.locator('#copy:not([disabled])').waitFor({timeout:60000});
  const report=await workspace.evaluate(source=>({sourceChars:source.length,sourceUnchanged:document.querySelector('#source').value===source,resultChars:document.querySelector('#result').textContent.length,markers:document.querySelector('#result').textContent.match(/\[Q\d+\]/g),status:document.querySelector('#status').textContent,overflow:document.documentElement.scrollWidth-innerWidth,...__liveLong}),source);
  await workspace.screenshot({path:'output/playwright/real-mdn-long.png'});
  return report;
}
