// Helpers shared by every platform's content script (same isolated world).

// Load page-world scripts in order (async=false keeps the order).
function injectPageScripts(files) {
  files.forEach((file) => {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL(file);
    s.async = false;
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  });
}

// Messages posted by the page-world scripts.
function onPageMessage(cb) {
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== "leetpush") return;
    cb(e.data);
  });
}

var _seen = new Set();
function once(key) {
  if (_seen.has(key)) return false;
  _seen.add(key);
  return true;
}

// payload: { platform, key, qid?, title, slug, difficulty?, lang, code, url, stats? }
function pushSolution(payload) {
  chrome.runtime.sendMessage({ type: "PUSH", data: payload });
}

function reportError(message) {
  chrome.runtime.sendMessage({ type: "ERROR", message });
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
