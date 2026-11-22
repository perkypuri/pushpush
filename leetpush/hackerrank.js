injectPageScripts(["inject-common.js", "inject-hackerrank.js"]);

onPageMessage((m) => {
  if (!m.slug || !m.id || !once("hr:" + m.id)) return;
  const title =
    m.name || m.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const inContest = m.contest && m.contest !== "master";
  pushSolution({
    platform: "hackerrank",
    key: (inContest ? m.contest + "-" : "") + m.slug,
    title,
    slug: m.slug,
    lang: m.language || "unknown",
    code: m.code,
    url: inContest
      ? `https://www.hackerrank.com/contests/${m.contest}/challenges/${m.slug}`
      : `https://www.hackerrank.com/challenges/${m.slug}/problem`,
  });
});
