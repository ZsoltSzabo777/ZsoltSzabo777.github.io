// Site editor: reads and writes the content/*.json files through the GitHub API.
// The token is kept only in this browser's localStorage.

const REPO = "ZsoltSzabo777/zsoltszabo777.github.io";
const BRANCH = "main";
const TOKEN_KEY = "site-editor-token";

const $ = (sel) => document.querySelector(sel);
const files = {}; // path -> { data, sha }
let sections = [];
let pending = new Map(); // item -> { views, removed }

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(value) {
  try { value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

function status(text, kind = "info") {
  const box = $("#status");
  box.hidden = !text;
  box.className = `status ${kind}`;
  box.textContent = text || "";
  if (text) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function api(path, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/vnd.github+json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("GitHub didn't accept the token. Disconnect and paste a new one.");
  if (res.status === 403 || res.status === 404) throw new Error("The token can't access the repository. Check it has Contents: Read and write on zsoltszabo777.github.io.");
  if (res.status === 409) throw new Error("The file changed somewhere else. Reload the page and try again.");
  if (!res.ok) throw new Error(`GitHub error ${res.status}`);
  return res.json();
}

async function readFile(path) {
  const json = await api(`${path}?ref=${BRANCH}`);
  files[path] = { data: JSON.parse(fromBase64(json.content)), sha: json.sha };
  return files[path].data;
}

async function writeFile(path, message) {
  const { data, sha } = files[path];
  const res = await api(path, {
    method: "PUT",
    body: JSON.stringify({ message, content: toBase64(JSON.stringify(data, null, 2) + "\n"), sha, branch: BRANCH }),
  });
  files[path].sha = res.content.sha;
}

function detectPlatform(url) {
  const u = String(url).toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "facebook";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("/shorts/")) return "shorts";
  if (u.includes("youtu")) return "youtube";
  return null;
}

function currentSection() {
  return sections.find((s) => s.id === $("#section").value);
}
function currentTab() {
  const data = files[currentSection().file].data;
  return data.tabs.find((t) => t.id === $("#platform").value);
}

function fillPlatforms() {
  const data = files[currentSection().file].data;
  $("#platform").replaceChildren(...data.tabs.map((t) => new Option(t.label, t.id)));
}

function renderList() {
  pending = new Map();
  $("#save-list").hidden = true;
  const tab = currentTab();
  $("#list-title").textContent = `${tab.label} clips (${tab.items.length})`;
  const items = [...tab.items].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
  if (!items.length) {
    $("#list").replaceChildren(Object.assign(document.createElement("p"), { className: "hint", textContent: "No clips here yet." }));
    return;
  }
  $("#list").replaceChildren(...items.map((item) => {
    const row = document.createElement("div");
    row.className = "clip";

    const info = document.createElement("div");
    const link = Object.assign(document.createElement("a"), { href: item.url, target: "_blank", rel: "noopener", textContent: item.title || item.url });
    const date = Object.assign(document.createElement("small"), { textContent: item.date || "" });
    info.append(link, date);

    const views = Object.assign(document.createElement("input"), { type: "number", min: 0, value: item.views ?? "", title: "Views" });
    views.addEventListener("input", () => {
      pending.set(item, { ...(pending.get(item) || {}), views: views.value });
      $("#save-list").hidden = false;
    });

    const remove = Object.assign(document.createElement("button"), { className: "remove", type: "button", textContent: "Remove" });
    remove.addEventListener("click", () => {
      const removed = !pending.get(item)?.removed;
      pending.set(item, { ...(pending.get(item) || {}), removed });
      row.classList.toggle("removed", removed);
      remove.textContent = removed ? "Undo" : "Remove";
      $("#save-list").hidden = false;
    });

    row.append(info, views, remove);
    return row;
  }));
}

async function onAdd(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  status("Saving…");
  try {
    const section = currentSection();
    await readFile(section.file); // get the latest copy before changing it
    const tab = files[section.file].data.tabs.find((t) => t.id === $("#platform").value);
    const url = $("#url").value.trim();
    if (tab.items.some((i) => i.url === url)) throw new Error("That link is already on the site.");
    const item = { title: $("#title").value.trim(), url, date: $("#date").value };
    if ($("#views").value !== "") item.views = Number($("#views").value);
    tab.items.push(item);
    await writeFile(section.file, `Add clip: ${item.title}`);
    status(`Saved "${item.title}" to ${tab.label}. It will appear on the site in a minute or two.`, "ok");
    $("#title-hint").textContent = autoTitle = "";
    $("#url").value = $("#title").value = $("#views").value = "";
    renderList();
  } catch (err) {
    status(err.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function onSaveList() {
  const button = $("#save-list");
  button.disabled = true;
  status("Saving…");
  try {
    const section = currentSection();
    const changes = [...pending].map(([item, change]) => ({ url: item.url, ...change }));
    await readFile(section.file);
    const tab = files[section.file].data.tabs.find((t) => t.id === $("#platform").value);
    for (const change of changes) {
      const item = tab.items.find((i) => i.url === change.url);
      if (!item) continue;
      if (change.removed) tab.items.splice(tab.items.indexOf(item), 1);
      else if (change.views !== undefined) {
        if (change.views === "") delete item.views;
        else item.views = Number(change.views);
      }
    }
    await writeFile(section.file, `Update ${tab.label} clips`);
    status("Changes saved. The site will update in a minute or two.", "ok");
    renderList();
  } catch (err) {
    status(err.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function start() {
  if (!getToken()) {
    $("#connect").hidden = false;
    return;
  }
  status("Loading…");
  try {
    const site = await readFile("content/site.json");
    sections = [];
    for (const s of site.sections) {
      const data = await readFile(s.file);
      if (data.type === "videos") sections.push(s);
    }
    $("#section").replaceChildren(...sections.map((s) => new Option(s.title, s.id)));
    fillPlatforms();
    renderList();
    $("#date").value = new Date().toISOString().slice(0, 10);
    $("#editor").hidden = false;
    status("");
  } catch (err) {
    status(err.message, "error");
    $("#editor").hidden = false;
  }
}

$("#save-token").addEventListener("click", () => {
  const value = $("#token").value.trim();
  if (!value) return;
  setToken(value);
  $("#connect").hidden = true;
  start();
});
$("#disconnect").addEventListener("click", () => {
  setToken(null);
  location.reload();
});
$("#section").addEventListener("change", () => { fillPlatforms(); renderList(); });
$("#platform").addEventListener("change", renderList);
// Public oEmbed endpoints that return a video's title. noembed.com is a fallback
// for when a platform's own endpoint blocks requests from the browser.
const OEMBED = {
  youtube: (u) => [`https://www.youtube.com/oembed?format=json&url=${u}`, `https://noembed.com/embed?url=${u}`],
  shorts: (u) => [`https://www.youtube.com/oembed?format=json&url=${u}`, `https://noembed.com/embed?url=${u}`],
  tiktok: (u) => [`https://www.tiktok.com/oembed?url=${u}`, `https://noembed.com/embed?url=${u}`],
};
let autoTitle = "";
let titleTimer;

async function fetchTitle(url) {
  const platform = detectPlatform(url);
  const hint = $("#title-hint");
  if (!OEMBED[platform]) {
    if (autoTitle && $("#title").value === autoTitle) $("#title").value = autoTitle = "";
    hint.textContent = platform ? "Instagram and Facebook don't share titles, so type this one in." : "";
    return;
  }
  hint.textContent = "Getting the title…";
  for (const endpoint of OEMBED[platform](encodeURIComponent(url))) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.title) continue;
      if ($("#url").value.trim() !== url) return; // the link changed while we waited
      // Only overwrite the title if it's empty or was filled in automatically.
      const title = $("#title").value;
      if (!title || title === autoTitle) {
        $("#title").value = autoTitle = data.title.trim();
      }
      hint.textContent = "Title copied from the video. You can edit it.";
      return;
    } catch {}
  }
  hint.textContent = "Couldn't get the title automatically, so type it in.";
}

$("#url").addEventListener("input", () => {
  clearTimeout(titleTimer);
  const url = $("#url").value.trim();
  if (/^https?:\/\/\S+\.\S+/.test(url)) titleTimer = setTimeout(() => fetchTitle(url), 400);
  else $("#title-hint").textContent = "";
});

$("#url").addEventListener("input", () => {
  const platform = detectPlatform($("#url").value);
  if (!platform) return;
  // Pick the first section that has this platform, preferring the one already selected.
  const order = [currentSection(), ...sections.filter((s) => s !== currentSection())];
  const match = order.find((s) => files[s.file].data.tabs.some((t) => t.id === platform));
  if (!match) return;
  if (match !== currentSection()) { $("#section").value = match.id; fillPlatforms(); }
  if ($("#platform").value !== platform) { $("#platform").value = platform; renderList(); }
});
$("#add-form").addEventListener("submit", onAdd);
$("#save-list").addEventListener("click", onSaveList);

start();
