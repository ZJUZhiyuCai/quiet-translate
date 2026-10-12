import http from 'node:http';
import {readFile} from 'node:fs/promises';
const article = await readFile(new URL('../tests/fixtures/article.html', import.meta.url));
const stats = {requests: 0, active: 0, maxActive: 0, aborted: 0};
const server = http.createServer(async (req, res) => {
  if (req.url === '/stats') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(stats)); }
  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = ''; for await (const part of req) body += part;
    let data; try { data = JSON.parse(body); } catch { res.writeHead(400); return res.end('{}'); }
    stats.requests++; stats.active++; stats.maxActive = Math.max(stats.maxActive, stats.active);
    const source = data.messages.at(-1).content;
    if (source.startsWith('TEST_401') || data.model === 'TEST_401') { stats.active--; res.writeHead(401); return res.end('{}'); }
    if (source.startsWith('TEST_SLOW') || data.model === 'TEST_SLOW') await new Promise(resolve => setTimeout(resolve, 3000));
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache'});
    const text = source.startsWith('TEST_XSS') ? '<img src=x onerror=alert(1)> 这只是一段文字。' : '【测试译文】' + source.slice(0, 90) + '。工具安静地融入阅读，让每一段内容都清楚自然，保留原文的意思与节奏。';
    let index = 0, ended = false;
    const timer = setInterval(() => {
      if (index < text.length) { res.write('data: ' + JSON.stringify({choices: [{delta: {content: text.slice(index, index + 12)}}]}) + '\n\n'); index += 12; }
      else { ended = true; clearInterval(timer); stats.active--; res.end('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'); }
    }, 35);
    res.on('close', () => { clearInterval(timer); if (!ended) { stats.active--; stats.aborted++; } });
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(article);
});
server.listen(Number(process.env.QT_TEST_PORT) || 0, '127.0.0.1', () => console.log(`Translation test fixture: http://127.0.0.1:${server.address().port}/article`));
