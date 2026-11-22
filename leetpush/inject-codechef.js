// CodeChef: best-effort. Remember the code sent with POSTs, then look for an
// "accepted" result code in JSON responses. Open DevTools > Console and filter
// for "[LeetPush]" to see what it sees if this needs adjusting.
(() => {
  let last = null;

  function findKey(o, keys, depth = 0) {
    if (!o || typeof o !== "object" || depth > 4) return undefined;
    for (const k of Object.keys(o)) {
      if (keys.includes(k) && o[k] != null && typeof o[k] !== "object") return o[k];
    }
    for (const k of Object.keys(o)) {
      const r = findKey(o[k], keys, depth + 1);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  window.__leetpushHook(({ url, method, reqBody, text }) => {
    if (!/codechef\.com/.test(url)) return;

    if (String(method).toUpperCase() === "POST" && reqBody) {
      const b = window.__leetpushParseBody(reqBody);
      const code = b && (b.sourceCode ?? b.source_code ?? b.source ?? b.code ?? b.program);
      if (typeof code === "string" && code.length) {
        last = { code, lang: b.language ?? b.lang ?? b.languageId, t: Date.now() };
      }
    }

    let j;
    try { j = JSON.parse(text); } catch (_) { return; }
    const verdict = String(findKey(j, ["result_code", "result"]) || "").toLowerCase();
    if (verdict) console.debug("[LeetPush] CodeChef verdict:", verdict, url);
    if (verdict !== "accepted" && verdict !== "ac") return;

    const id = findKey(j, ["solution_id", "submission_id", "sid"]) ?? (last && last.t) ?? Date.now();
    const problem =
      findKey(j, ["problemCode", "problem_code"]) ||
      (location.pathname.match(/\/(?:problems|submit)\/([A-Za-z0-9_]+)/) || [])[1] ||
      null;
    window.postMessage({
      source: "leetpush",
      id: String(id),
      problem,
      lang: (last && last.lang) || findKey(j, ["language", "lang"]),
      code: (last && last.code) || window.__leetpushEditorCode(),
    }, "*");
  });
})();
