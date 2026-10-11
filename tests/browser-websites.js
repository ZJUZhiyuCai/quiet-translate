// Run in playwright-cli against one of the real sites, with cache disabled in the isolated profile.
async page => {
  const site = new URL(page.url()).hostname;
  const report = {site, url: page.url(), selections: []};
  const pick = site.includes('mozilla') ? 'main p' : site.includes('wikipedia') ? '.mw-parser-output p' : 'font';
  const eligible = page.locator(pick).filter({hasNot: page.locator('qt-line')});
  const indexes = await eligible.evaluateAll(nodes => nodes.map((e, i) => ({i, n: e.textContent.trim().length, visible: !!e.getClientRects().length})).filter(e => e.visible && e.n > 150).map(e => e.i).slice(0, 3));
  for (const index of indexes) {
    const element = eligible.nth(index);
    await element.scrollIntoViewIfNeeded();
    const chars = await element.evaluate(e => {
      const range = document.createRange(); range.selectNodeContents(e);
      if (range.toString().length > 1200) {
        const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let node, remaining = 500;
        while ((node = walker.nextNode())) { if (node.length >= remaining) { range.setEnd(node, remaining); break; } remaining -= node.length; }
      }
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      const rect = [...range.getClientRects()].find(r => r.top >= 0 && r.bottom < innerHeight) || e.getBoundingClientRect();
      window.__qtSelectAt = performance.now();
      e.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: Math.min(innerWidth - 80, rect.left + 100), clientY: Math.max(0, Math.min(innerHeight - 90, rect.bottom))}));
      return sel.toString().length;
    });
    await page.getByRole('button', {name: '翻译选中文字', exact: true}).waitFor({state: 'visible'});
    await page.evaluate(() => {
      const root = document.querySelector('qt-overlay').shadowRoot;
      window.__qtTiming = {launcher: performance.now() - window.__qtSelectAt};
      root.querySelector('.launch').addEventListener('click', () => {
        const started = performance.now(); window.__qtTiming.started = started;
        const observer = new MutationObserver(() => {
          const out = root.querySelector('.translation');
          if (out.textContent && !window.__qtTiming.first) window.__qtTiming.first = performance.now() - started;
          if (out.dataset.loading === 'false') { window.__qtTiming.complete = performance.now() - started; observer.disconnect(); }
        });
        observer.observe(root, {subtree: true, childList: true, characterData: true, attributes: true});
      }, {once: true, capture: true});
    });
    await page.getByRole('button', {name: '翻译选中文字', exact: true}).click();
    await page.locator('qt-overlay .translation[data-loading=false]').waitFor({timeout: 60000});
    report.selections.push(await page.evaluate(chars => {
      const r = document.querySelector('qt-overlay').shadowRoot; const bounds = r.querySelector('.panel').getBoundingClientRect();
      return {chars, launcherMs: Math.round(window.__qtTiming.launcher), firstMs: Math.round(window.__qtTiming.first), completeMs: Math.round(window.__qtTiming.complete), resultChars:r.querySelector('.translation').textContent.length, error:r.querySelector('.error').hidden ? null : r.querySelector('.error').textContent, fits:bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight, status:r.querySelector('.meta').textContent};
    }, chars));
    await page.screenshot({path: `output/playwright/real-${site.split('.')[0]}-selection.png`});
    await page.keyboard.press('Escape');
  }
  return report;
}
