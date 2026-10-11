// Firefox exposes Promise APIs through browser; Chromium also supports chrome.
export const api = globalThis.browser ?? globalThis.chrome;
