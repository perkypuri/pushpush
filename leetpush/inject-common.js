// Page-world helper: wraps fetch and XHR once and lets each platform's
// inject script subscribe with window.__leetpushHook(fn).
// fn receives { url, method, reqBody, text } for every text/JSON response.
(() => {
  if (window.__leetpushHook) return;
  const listeners = [];
  window.__leetpushHook = (fn) => listeners.push(fn);
  const emit = (info) => {
    for (const fn of listeners) {
      try { fn(info); } catch (_) {}
    }
  };
  const abs = (u) => {
    try { return new URL(u, location.href).href; } catch (_) { return String(u); }
  };

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await origFetch.apply(this, arguments);
    try {
      const url = abs(typeof input === "string" ? input : (input && input.url) || input);
      const method = (init && init.method) || (input && input.method) || "GET";
      const reqBody = init && typeof init.body === "string" ? init.body : null;
      const ct = res.headers.get("content-type") || "";
      if (/json|text/i.test(ct)) {
        res.clone().text().then((text) => emit({ url, method, reqBody, text })).catch(() => {});
      }
    } catch (_) {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__lp = { method, url: abs(url) };
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const info = this.__lp;
    if (info) {
      this.addEventListener("load", () => {
        try {
          if (this.responseType === "" || this.responseType === "text") {
            emit({ url: info.url, method: info.method, reqBody: typeof body === "string" ? body : null, text: this.responseText });
          }
        } catch (_) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  // Request bodies are JSON or form-encoded; return a plain object either way.
  window.__leetpushParseBody = (body) => {
    if (!body) return null;
    try { return JSON.parse(body); } catch (_) {}
    try { return Object.fromEntries(new URLSearchParams(body)); } catch (_) {}
    return null;
  };

  // Fallback: read the code straight out of the page's editor (Monaco or Ace).
  window.__leetpushEditorCode = () => {
    try {
      const models = window.monaco?.editor?.getModels?.();
      if (models && models.length) return models[0].getValue();
    } catch (_) {}
    try {
      const el = document.querySelector(".ace_editor");
      const v = el?.env?.editor?.getValue?.();
      if (v) return v;
    } catch (_) {}
    return null;
  };
})();
