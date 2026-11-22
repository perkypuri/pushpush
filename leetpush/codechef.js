injectPageScripts(["inject-common.js", "inject-codechef.js"]);

onPageMessage((m) => {
  if (!m.id || !once("cc:" + m.id)) return;
  if (!m.code) {
    reportError("CodeChef: accepted, but could not read your code");
    return;
  }
  const problem = m.problem ? String(m.problem).toUpperCase() : null;
  pushSolution({
    platform: "codechef",
    key: problem || `submission-${m.id}`,
    title: problem || `Submission ${m.id}`,
    slug: problem ? problem.toLowerCase() : `submission-${m.id}`,
    lang: m.lang || "unknown",
    code: m.code,
    url: problem ? `https://www.codechef.com/problems/${problem}` : `https://www.codechef.com/viewsolution/${m.id}`,
  });
});
