injectPageScripts(["inject-common.js", "inject-leetcode.js"]);

const LC_QUERY = `
query submissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    code
    runtime
    memory
    lang { name verboseName }
    question { questionFrontendId title titleSlug difficulty }
  }
}`;

async function lcFetchDetails(submissionId) {
  const res = await fetch("https://leetcode.com/graphql/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: LC_QUERY, variables: { submissionId } }),
  });
  const json = await res.json();
  return json?.data?.submissionDetails;
}

onPageMessage(async (msg) => {
  const id = msg.submissionId;
  if (!id || !once("lc:" + id)) return;
  try {
    const d = await lcFetchDetails(id);
    if (!d?.code) throw new Error("LeetCode: could not read submission details");
    const q = d.question;
    pushSolution({
      platform: "leetcode",
      key: `${String(q.questionFrontendId).padStart(4, "0")}-${q.titleSlug}`,
      qid: q.questionFrontendId,
      title: q.title,
      slug: q.titleSlug,
      difficulty: q.difficulty,
      lang: d.lang.name,
      code: d.code,
      url: `https://leetcode.com/problems/${q.titleSlug}/`,
      stats: { Runtime: d.runtime, Memory: d.memory },
    });
  } catch (err) {
    reportError(String(err));
  }
});
