importScripts("config.js");

const PLATFORM_NAME = {
  leetcode: "LeetCode",
  codeforces: "Codeforces",
  codechef: "CodeChef",
  hackerrank: "HackerRank",
  gfg: "GeeksforGeeks",
};

// First matching rule wins (order matters: c++ before c, javascript before java...).
const EXT_RULES = [
  [/c\+\+|cpp/, "cpp"],
  [/c#|csharp/, "cs"],
  [/typescript/, "ts"],
  [/javascript|node/, "js"],
  [/python|pypy/, "py"],
  [/kotlin/, "kt"],
  [/java/, "java"],
  [/golang|(^|[^a-z])go([^a-z]|$)/, "go"],
  [/rust/, "rs"],
  [/swift/, "swift"],
  [/ruby/, "rb"],
  [/scala/, "scala"],
  [/php/, "php"],
  [/dart/, "dart"],
  [/racket/, "rkt"],
  [/erlang/, "erl"],
  [/elixir/, "ex"],
  [/bash|shell/, "sh"],
  [/sql/, "sql"],
  [/(^|[^a-z+#])c(\d+)?([^a-z+#]|$)/, "c"],
];

function extFor(lang) {
  const l = String(lang || "").toLowerCase();
  for (const [re, ext] of EXT_RULES) if (re.test(l)) return ext;
  return "txt";
}

const b64 = (str) => btoa(unescape(encodeURIComponent(str)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function badge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000);
}

async function gh(path, token, options = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
}

// The OAuth token (local) wins; a manually pasted token (sync) is the fallback.
async function getToken() {
  const local = await chrome.storage.local.get("token");
  if (local.token) return local.token;
  const sync = await chrome.storage.sync.get("token");
  return sync.token || null;
}

// ---------- GitHub login (device flow) ----------

const FORM = {
  Accept: "application/json",
  "Content-Type": "application/x-www-form-urlencoded",
};
let polling = false;

async function startLogin(scope) {
  if (!GITHUB_CLIENT_ID || GITHUB_CLIENT_ID.startsWith("PASTE")) {
    throw new Error("Set GITHUB_CLIENT_ID in config.js first");
  }
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: FORM,
    body: new URLSearchParams({ client_id: GITHUB_CLIENT_ID, scope }),
  });
  const d = await res.json();
  if (!res.ok || d.error) {
    if (d.error === "device_flow_disabled") {
      throw new Error("Tick 'Enable Device Flow' in your GitHub OAuth app settings");
    }
    throw new Error(d.error_description || d.error || `GitHub ${res.status}`);
  }
  await chrome.storage.local.set({
    auth: {
      state: "pending",
      user_code: d.user_code,
      verification_uri: d.verification_uri,
      device_code: d.device_code,
      interval: d.interval || 5,
      expires_at: Date.now() + d.expires_in * 1000,
      scope,
    },
  });
  pollForToken(); // runs in the background, not awaited
}

async function pollForToken() {
  if (polling) return;
  polling = true;
  try {
    while (true) {
      const { auth } = await chrome.storage.local.get("auth");
      if (!auth || auth.state !== "pending") return; // cancelled or finished
      if (Date.now() > auth.expires_at) throw new Error("Login code expired. Try again.");

      await sleep(auth.interval * 1000);
      // An extension API call each round keeps the service worker alive.
      await chrome.storage.local.set({ lastPoll: Date.now() });

      const res = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: FORM,
        body: new URLSearchParams({
          client_id: GITHUB_CLIENT_ID,
          device_code: auth.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });
      const d = await res.json();

      if (d.access_token) {
        const who = await (await gh("/user", d.access_token)).json();
        await chrome.storage.local.set({
          token: d.access_token,
          auth: { state: "connected", login: who.login, scope: auth.scope },
        });
        return;
      }
      if (d.error === "authorization_pending") continue;
      if (d.error === "slow_down") {
        auth.interval = d.interval || auth.interval + 5;
        await chrome.storage.local.set({ auth });
        continue;
      }
      throw new Error(d.error_description || d.error || "Login failed");
    }
  } catch (e) {
    await chrome.storage.local.set({ auth: { state: "error", message: e.message } });
  } finally {
    polling = false;
  }
}

// The service worker can be stopped by Chrome; the popup calls this to resume.
async function resumeLogin() {
  const { auth } = await chrome.storage.local.get("auth");
  if (auth && auth.state === "pending" && !polling) pollForToken();
}

// ---------- Pushing to GitHub ----------

// Create or update a file; skips the commit if content is unchanged.
async function putFile({ token, repo, branch, path, content, message }) {
  const url = `/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  let sha;
  const existing = await gh(`${url}?ref=${encodeURIComponent(branch)}`, token);
  if (existing.ok) {
    const j = await existing.json();
    if (j.content && j.content.replace(/\n/g, "") === b64(content)) return "unchanged";
    sha = j.sha;
  } else if (existing.status !== 404) {
    throw new Error(`GitHub ${existing.status}: ${(await existing.text()).slice(0, 200)}`);
  }
  const res = await gh(url, token, {
    method: "PUT",
    body: JSON.stringify({ message, content: b64(content), branch, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return sha ? "updated" : "created";
}

async function pushSolution(d) {
  const cfg = await chrome.storage.sync.get(["repo", "branch", "folder", "enabled"]);
  if (cfg.enabled && cfg.enabled[d.platform] === false) return "disabled";
  const token = await getToken();
  if (!token || !cfg.repo) {
    throw new Error("Connect GitHub and choose a repo in the LeetPush popup first");
  }

  const branch = cfg.branch || "main";
  const platformName = PLATFORM_NAME[d.platform] || d.platform;
  const dir = [(cfg.folder || "").replace(/^\/|\/$/g, ""), platformName, d.key]
    .filter(Boolean)
    .join("/");
  const label = `${d.qid ? d.qid + ". " : ""}${d.title}`;

  const result = await putFile({
    token,
    repo: cfg.repo,
    branch,
    path: `${dir}/${d.slug}.${extFor(d.lang)}`,
    content: d.code,
    message: `Add ${platformName}: ${label} (${d.lang})`,
  });

  if (result !== "unchanged") {
    const stats = Object.entries(d.stats || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    const readme =
      `# ${label}\n\n- Platform: ${platformName}\n` +
      (d.difficulty ? `- Difficulty: ${d.difficulty}\n` : "") +
      `- Language: ${d.lang}\n` +
      (stats ? stats + "\n" : "") +
      `- Problem: ${d.url}\n`;
    await putFile({
      token,
      repo: cfg.repo,
      branch,
      path: `${dir}/README.md`,
      content: readme,
      message: `Add README for ${platformName}: ${label}`,
    });
  }
  return result;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case "PUSH": {
      const d = msg.data;
      pushSolution(d)
        .then(async (result) => {
          if (result === "disabled") return;
          badge("OK", "#2e7d32");
          await chrome.storage.local.set({
            last: `${new Date().toLocaleString()}: ${PLATFORM_NAME[d.platform]} ${d.qid ? d.qid + ". " : ""}${d.title} (${result})`,
          });
        })
        .catch(async (err) => {
          badge("ERR", "#c62828");
          await chrome.storage.local.set({ last: `Error: ${err.message}` });
        });
      return;
    }
    case "ERROR":
      badge("ERR", "#c62828");
      chrome.storage.local.set({ last: `Error: ${msg.message}` });
      return;
    case "START_LOGIN":
      startLogin(msg.scope)
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ error: e.message }));
      return true;
    case "RESUME_LOGIN":
      resumeLogin().then(() => sendResponse({ ok: true }));
      return true;
    case "CANCEL_LOGIN":
      chrome.storage.local.remove("auth").then(() => sendResponse({ ok: true }));
      return true;
    case "LOGOUT":
      chrome.storage.local.remove(["auth", "token"]).then(() => sendResponse({ ok: true }));
      return true;
  }
});
