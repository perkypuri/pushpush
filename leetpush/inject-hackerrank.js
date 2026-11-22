// HackerRank: submission results come from
// /rest/contests/<contest>/challenges/<slug>/submissions/<id> (polled until done).
// "Run Code" uses a different endpoint, so only real Submit results match.
(() => {
  const RE = /\/rest\/contests\/([^/]+)\/challenges\/([^/?]+)\/submissions\/(\d+)/;
  window.__leetpushHook(({ url, text }) => {
    const m = RE.exec(url);
    if (!m) return;
    let j;
    try { j = JSON.parse(text); } catch (_) { return; }
    const model = j && (j.model || j);
    if (!model) return;
    console.debug("[LeetPush] HackerRank submission status:", model.status);
    if (model.status === "Accepted" && model.code) {
      window.postMessage({
        source: "leetpush",
        contest: m[1],
        slug: m[2],
        id: Number(m[3]),
        code: model.code,
        language: model.language,
        name: (model.challenge && model.challenge.name) || null,
      }, "*");
    }
  });
})();
