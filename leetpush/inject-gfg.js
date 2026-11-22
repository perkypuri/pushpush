// GeeksforGeeks: remember the code sent with each POST to their API, then
// treat the "Problem Solved Successfully" verdict (Submit only) as Accepted.
(() => {
  const API_RE = /geeksforgeeks\.org\/.*(api|submit)/i;
  let last = null;

  window.__leetpushHook(({ url, method, reqBody, text }) => {
    if (!API_RE.test(url)) return;

    if (String(method).toUpperCase() === "POST" && reqBody) {
      const b = window.__leetpushParseBody(reqBody);
      const code = b && (b.source ?? b.code ?? b.sourceCode);
      if (typeof code === "string" && code.length) {
        last = { code, lang: b.language ?? b.lang, t: Date.now() };
      }
    }

    if (text && text.includes("Problem Solved Successfully")) {
      const slug = (location.pathname.match(/\/problems\/([^/]+)/) || [])[1];
      const code = (last && last.code) || window.__leetpushEditorCode();
      const diff = (document.body.innerText.match(/Difficulty:\s*(Basic|School|Easy|Medium|Hard)/i) || [])[1];
      console.debug("[LeetPush] GFG accepted", slug, !!code);
      window.postMessage({
        source: "leetpush",
        id: `${slug}:${last ? last.t : Date.now()}`,
        slug,
        title: document.title.split(/\s[|-]\s/)[0].trim(),
        lang: last && last.lang,
        code,
        difficulty: diff,
      }, "*");
    }
  });
})();
