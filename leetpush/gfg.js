injectPageScripts(["inject-common.js", "inject-gfg.js"]);

onPageMessage((m) => {
  if (!m.slug || !once("gfg:" + m.id)) return;
  if (!m.code) {
    reportError("GeeksforGeeks: solved, but could not read your code");
    return;
  }
  pushSolution({
    platform: "gfg",
    key: m.slug,
    title: m.title || m.slug,
    slug: m.slug,
    difficulty: m.difficulty,
    lang: m.lang || "unknown",
    code: m.code,
    url: `https://www.geeksforgeeks.org/problems/${m.slug}/1`,
  });
});
