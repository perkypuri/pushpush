// Codeforces: DOM-based. Works on your own status pages (/my or ?my=on).
// Existing accepted rows are ignored; a row that turns Accepted while the
// page is open gets pushed, so old submissions are never re-pushed.
(function () {
  const mine = /\/my\/?$/.test(location.pathname) || /[?&]my=on/.test(location.search);
  if (!mine) return;

  const acceptedRows = () =>
    [...document.querySelectorAll("tr[data-submission-id]")].filter((tr) =>
      tr.querySelector(".verdict-accepted")
    );

  const handled = new Set(acceptedRows().map((tr) => tr.dataset.submissionId));

  function sourceUrl(tr, cid, id, problemHref) {
    const a = tr.querySelector(".id-cell a");
    if (a && a.href) return a.href;
    if (/\/gym\//.test(problemHref)) return `${location.origin}/gym/${cid}/submission/${id}`;
    if (/\/problemset\//.test(problemHref)) return `${location.origin}/problemset/submission/${cid}/${id}`;
    return `${location.origin}/contest/${cid}/submission/${id}`;
  }

  async function processRow(tr) {
    const id = tr.dataset.submissionId;
    try {
      const a = tr.querySelector('a[href*="/problem/"]');
      if (!a) throw new Error("problem link not found");
      const href = a.getAttribute("href");
      const m = /\/(?:contest|gym)\/(\d+)\/problem\/(\w+)|\/problemset\/problem\/(\d+)\/(\w+)/.exec(href);
      if (!m) throw new Error("could not parse problem link");
      const cid = m[1] || m[3];
      const idx = m[2] || m[4];
      const title = a.textContent.trim().replace(/^\S+\s*-\s*/, "");

      const statusTd = tr.querySelector("td.status-cell");
      const lang = statusTd?.previousElementSibling?.textContent.trim() || "unknown";
      const runtime = statusTd?.nextElementSibling?.textContent.trim();
      const memory = statusTd?.nextElementSibling?.nextElementSibling?.textContent.trim();

      const res = await fetch(sourceUrl(tr, cid, id, href), { credentials: "include" });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const code = doc.querySelector("#program-source-text")?.textContent;
      if (!code) throw new Error("source code not found on submission page");

      pushSolution({
        platform: "codeforces",
        key: `${cid}${idx}-${slugify(title)}`,
        qid: `${cid}${idx}`,
        title,
        slug: slugify(title),
        lang,
        code,
        url: a.href,
        stats: { Time: runtime, Memory: memory },
      });
    } catch (err) {
      reportError(`Codeforces: ${err.message || err}`);
    }
  }

  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      acceptedRows().forEach((tr) => {
        const id = tr.dataset.submissionId;
        if (handled.has(id)) return;
        handled.add(id);
        processRow(tr);
      });
    }, 300);
  }).observe(document.body, { childList: true, subtree: true });
})();
