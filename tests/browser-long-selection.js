async page => {
  const worker = page.context().serviceWorkers()[0];
  const tab = await worker.evaluate(async()=> (await chrome.tabs.query({})).find(t=>t.index===2).id);
  await worker.evaluate(id=>chrome.tabs.update(id,{active:true}),tab);
  await page.reload({waitUntil:'domcontentloaded'});
  const reports=[];
  for (let run=0;run<2;run++) {
    await page.evaluate(()=>scrollTo(0,0));
    const source=await page.locator('font').first().evaluate(e=>{
      const r=document.createRange();r.selectNodeContents(e);getSelection().removeAllRanges();getSelection().addRange(r);
      e.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:500,clientY:240}));return getSelection().toString();
    });
    const launch=page.getByRole('button',{name:'翻译选中文字',exact:true});await launch.waitFor({state:'visible'});
    await page.evaluate(()=>{
      const r=document.querySelector('qt-overlay').shadowRoot;
      r.querySelector('.launch').addEventListener('click',()=>{
        window.__selectionLong={rewrites:0};let old='';const start=performance.now();
        const observer=new MutationObserver(()=>{
          const out=r.querySelector('.translation'),text=out.textContent;
          if(text){if(!__selectionLong.firstMs)__selectionLong.firstMs=performance.now()-start;if(old&&!text.startsWith(old))__selectionLong.rewrites++;old=text;}
          if(out.dataset.loading==='false'){__selectionLong.completeMs=performance.now()-start;observer.disconnect();}
        });observer.observe(r,{subtree:true,childList:true,attributes:true,characterData:true});
      },{capture:true,once:true});
    });
    await launch.click();await page.locator('qt-overlay .translation[data-loading=false]').waitFor({timeout:60000});
    reports.push(await page.evaluate(source=>{const r=document.querySelector('qt-overlay').shadowRoot;return {sourceChars:source.length,sourceMatches:r.querySelector('.source').textContent===source.trim(),resultChars:r.querySelector('.translation').textContent.length,end:r.querySelector('.translation').textContent.slice(-90),error:!r.querySelector('.error').hidden,status:r.querySelector('.meta').textContent,...__selectionLong};},source));
    if(run===0) {
      await page.setViewportSize({width:430,height:700});
      reports[run].narrowFits=await page.locator('qt-overlay .panel').evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight;});
      await page.screenshot({path:'output/playwright/real-paul-long-selection-narrow.png'});
      await page.setViewportSize({width:1360,height:1000});
    }
    await page.keyboard.press('Escape');
  }
  return reports;
}
