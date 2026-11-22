const $ = (id) => document.getElementById(id);
const boxes = [...document.querySelectorAll("input[data-p]")];
const SECTIONS = ["none", "pending", "connected", "error"];
const configured = typeof GITHUB_CLIENT_ID === "string" && !GITHUB_CLIENT_ID.startsWith("PASTE");

let reposLoaded = false;

const say = (t) => ($("status").textContent = t);
const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));

async function getToken() {
  const { token } = await chrome.storage.local.get("token");
  if (token) return token;
  const sync = await chrome.storage.sync.get("token");
  return sync.token || null;
}

function showSection(name) {
  SECTIONS.forEach((s) => ($("s-" + s).hidden = s !== name));
}

async function render() {
  const { auth } = await chrome.storage.local.get("auth");
  const state = auth ? auth.state : "none";
  showSection(state);

  $("connect").disabled = !configured;
  $("noconfig").hidden = configured;

  if (state === "pending") {
    $("usercode").textContent = auth.user_code;
    send({ type: "RESUME_LOGIN" });
  }
  if (state === "error") $("errmsg").textContent = auth.message;
  if (state === "connected") {
    $("login").textContent = "@" + auth.login;
    const canPrivate = auth.scope === "repo";
    $("private").disabled = !canPrivate;
    $("private").checked = canPrivate;
  } else {
    $("private").disabled = true;
    $("private").checked = false;
  }
  if (state === "connected" && !reposLoaded) loadRepos();
}

async function loadRepos() {
  reposLoaded = true;
  const token = await getToken();
  if (!token) return;
  try {
    const res = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator",
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return;
    const repos = await res.json();
    $("repos").innerHTML = "";
    repos
      .filter((r) => r.permissions && r.permissions.push)
      .forEach((r) => {
        const o = document.createElement("option");
        o.value = r.full_name;
        $("repos").appendChild(o);
      });
  } catch (_) {}
}

async function load() {
  const sync = await chrome.storage.sync.get(["repo", "branch", "folder", "enabled", "token"]);
  ["repo", "branch", "folder"].forEach((f) => ($(f).value = sync[f] || ""));
  $("pat").value = sync.token || "";
  boxes.forEach((b) => (b.checked = !sync.enabled || sync.enabled[b.dataset.p] !== false));
  const { last } = await chrome.storage.local.get("last");
  $("last").textContent = last ? `Last: ${last}` : "";
  await render();
}

async function save() {
  const v = {};
  ["repo", "branch", "folder"].forEach((f) => (v[f] = $(f).value.trim()));
  v.enabled = Object.fromEntries(boxes.map((b) => [b.dataset.p, b.checked]));
  const pat = $("pat").value.trim();
  if (pat) {
    v.token = pat;
    // A pasted token replaces any GitHub login.
    await chrome.storage.local.remove(["token", "auth"]);
  }
  await chrome.storage.sync.set(v);
  return v;
}

// ----- login buttons -----
$("connect").addEventListener("click", async () => {
  say("");
  const scope = document.querySelector('input[name="scope"]:checked').value;
  const r = await send({ type: "START_LOGIN", scope });
  if (r && r.error) say(r.error);
});
$("retry").addEventListener("click", async () => {
  await send({ type: "CANCEL_LOGIN" });
});
$("open").addEventListener("click", async () => {
  const { auth } = await chrome.storage.local.get("auth");
  if (auth) chrome.tabs.create({ url: auth.verification_uri });
});
$("copy").addEventListener("click", async () => {
  const { auth } = await chrome.storage.local.get("auth");
  if (!auth) return;
  try {
    await navigator.clipboard.writeText(auth.user_code);
    say("Code copied");
  } catch (_) {
    say("Copy failed, type the code manually");
  }
});
$("cancel").addEventListener("click", () => send({ type: "CANCEL_LOGIN" }));
$("logout").addEventListener("click", async () => {
  await send({ type: "LOGOUT" });
  reposLoaded = false;
  $("repos").innerHTML = "";
  say("Disconnected. To fully revoke access, remove the app in GitHub > Settings > Applications.");
});

// ----- repo / settings -----
$("create").addEventListener("click", async () => {
  const token = await getToken();
  if (!token) return say("Connect GitHub first");
  say("Creating...");
  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    body: JSON.stringify({
      name: "dsa-solutions",
      description: "My accepted solutions, pushed by LeetPush",
      private: $("private").checked,
      auto_init: true,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 201) {
    $("repo").value = j.full_name;
    $("branch").value = j.default_branch || "main";
    await save();
    reposLoaded = false;
    loadRepos();
    say(`Created ${j.full_name}`);
  } else if (res.status === 422) {
    const { auth } = await chrome.storage.local.get("auth");
    if (auth && auth.login) $("repo").value = `${auth.login}/dsa-solutions`;
    await save();
    say("dsa-solutions already exists, using it");
  } else {
    say(j.message || `GitHub ${res.status}`);
  }
});

$("save").addEventListener("click", async () => {
  await save();
  say("Saved");
  render();
});

$("test").addEventListener("click", async () => {
  const v = await save();
  const token = await getToken();
  if (!token || !v.repo) return say("Connect GitHub and enter a repo first");
  say("Checking...");
  try {
    const res = await fetch(`https://api.github.com/repos/${v.repo}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return say(`GitHub says ${res.status}: check the repo name and access`);
    const j = await res.json();
    say(j.permissions?.push ? "Repo found, push access OK" : "Repo found, but no write access");
  } catch (e) {
    say(`Failed: ${e.message}`);
  }
});

// Re-render live when the background worker updates the login state.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.auth || changes.token)) render();
  if (area === "local" && changes.last) $("last").textContent = `Last: ${changes.last.newValue}`;
});

load();
