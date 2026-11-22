// LeetCode: the page polls /submissions/detail/<id>/check/ after Submit.
(() => {
  const CHECK_RE = /\/submissions\/detail\/(\d+)\/check/;
  window.__leetpushHook(({ url, text }) => {
    const m = CHECK_RE.exec(url);
    if (!m) return;
    let d;
    try { d = JSON.parse(text); } catch (_) { return; }
    if (d.state === "SUCCESS" && d.status_msg === "Accepted") {
      window.postMessage({ source: "leetpush", submissionId: Number(m[1]) }, "*");
    }
  });
})();
