import {abortError, throwIfAborted} from './core.js';

export class Scheduler {
  constructor(limit = 4, backgroundLimit = 3) {
    this.limit = limit; this.backgroundLimit = backgroundLimit;
    this.active = 0; this.backgroundActive = 0; this.queue = []; this.sequence = 0;
  }
  schedule(run, {priority = 0, signal} = {}) {
    throwIfAborted(signal);
    if (this.queue.length >= 180) return Promise.reject(new Error('待翻译内容较多，请稍后重试。'));
    return new Promise((resolve, reject) => {
      const job = {run, priority, signal, resolve, reject, sequence: this.sequence++};
      job.abort = () => {
        const index = this.queue.indexOf(job);
        if (index >= 0) { this.queue.splice(index, 1); reject(signal.reason || abortError()); }
      };
      signal?.addEventListener('abort', job.abort, {once: true});
      this.queue.push(job); this.drain();
    });
  }
  drain() {
    this.queue.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    while (this.active < this.limit) {
      const index = this.queue.findIndex(job => job.priority >= 10 || this.backgroundActive < this.backgroundLimit);
      if (index < 0) return;
      const job = this.queue.splice(index, 1)[0];
      job.signal?.removeEventListener('abort', job.abort);
      const background = job.priority < 10;
      this.active++; if (background) this.backgroundActive++;
      Promise.resolve().then(() => { throwIfAborted(job.signal); return job.run(); })
        .then(job.resolve, job.reject).finally(() => {
          this.active--; if (background) this.backgroundActive--; this.drain();
        });
    }
  }
}
