async page => {
  const context=page.context(), worker=context.serviceWorkers()[0];
  if(!worker) throw new Error('The extension service worker is missing');
  const origin=worker.url().replace('/background.js','');
  await worker.evaluate(async origin => { await chrome.windows.create({url:['http://127.0.0.1:63717/article',origin+'/workspace.html'],type:'normal'}); }, origin);
  const article=context.pages().find(p=>p.url().includes('/article'));
  if(article) await article.waitForLoadState('domcontentloaded');
  return {origin,pages:context.pages().map(p=>p.url())};
}
