// Everything on the page comes from the files in /content.
// To add a section, add an entry to content/site.json and create its file.

const state = { site: null, sections: {}, tab: {}, sort: {} };

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

// Words wrapped in *asterisks* are shown in the accent color.
function highlight(text) {
  return String(text || "").split(/(\*[^*]+\*)/).filter(Boolean).map((part) =>
    /^\*.*\*$/.test(part) ? el("span", { class: "hl", text: part.slice(1, -1) }) : part
  );
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

function formatViews(n) {
  if (n == null || n === "") return "";
  n = Number(n);
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K views`;
  return `${n} views`;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function youtubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function platformOf(url) {
  const u = String(url);
  if (/youtu\.?be/.test(u)) return "YouTube";
  if (/tiktok\.com/.test(u)) return "TikTok";
  if (/instagram\.com/.test(u)) return "Instagram";
  if (/facebook\.com|fb\.watch/.test(u)) return "Facebook";
  return "Video";
}

function thumbnailFor(item) {
  if (item.thumbnail) return item.thumbnail;
  const id = youtubeId(item.url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function sortItems(items, mode) {
  const copy = [...items];
  if (mode === "views") copy.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0));
  else copy.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return copy;
}

function videoCard(item) {
  const img = thumbnailFor(item);
  const thumb = el("div", { class: "thumb" + (img ? " has-image" : "") }, [
    el("span", { class: "platform", text: platformOf(item.url) }),
    item.views ? el("span", { class: "badge", text: formatViews(item.views) }) : null,
  ]);
  if (img) thumb.style.backgroundImage = `url("${img}")`;
  const vertical = /\/shorts\//.test(item.url);
  return el("a", { class: "card" + (vertical ? " is-vertical" : ""), href: item.url, target: "_blank", rel: "noopener" }, [
    thumb,
    el("div", { class: "card-body" }, [
      el("h3", { text: item.title || "Untitled" }),
      el("div", { class: "meta", text: formatDate(item.date) }),
    ]),
  ]);
}

function pillGroup(options, active, onPick, label) {
  return el("div", { class: "pill-group", role: "tablist", "aria-label": label },
    options.map(([value, text]) =>
      el("button", {
        class: value === active ? "active" : "",
        role: "tab",
        "aria-selected": String(value === active),
        text,
        onclick: () => onPick(value),
      })
    )
  );
}

function renderVideos(id, data) {
  const tabs = data.tabs || [];
  const tabId = state.tab[id] || tabs[0]?.id;
  const sort = state.sort[id] || data.defaultSort || "recent";
  const tab = tabs.find((t) => t.id === tabId) || tabs[0];

  const rerender = () => render();
  const head = el("div", { class: "section-head" }, [
    el("div", {}, [
      data.eyebrow ? el("p", { class: "eyebrow", text: data.eyebrow }) : null,
      el("h2", {}, highlight(data.title)),
    ]),
    data.intro ? el("p", { class: "section-intro", text: data.intro }) : null,
  ]);
  const stacked = data.display === "stacked";
  const controls = el("div", { class: "controls" }, [
    stacked
      ? el("div", { class: "jump" }, tabs.filter((t) => t.items?.length).map((t) =>
          el("button", { text: `${t.label} →`, onclick: () => document.getElementById(`row-${id}-${t.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }) })
        ))
      : tabs.length > 1
        ? pillGroup(tabs.map((t) => [t.id, t.label]), tab?.id, (v) => { state.tab[id] = v; rerender(); }, "Platform")
        : el("span"),
    el("div", { class: "sort" }, [el("span", { class: "control-label", text: "Sort by" }), pillGroup([["views", "Most viewed"], ["recent", "Most recent"]], sort, (v) => { state.sort[id] = v; rerender(); }, "Sort")]),
  ]);

  if (stacked) {
    // Platforms without clips yet stay hidden on the public site.
    const filled = tabs.filter((t) => t.items?.length);
    if (!filled.length) return [head, el("div", { class: "empty", text: "New clips coming soon." })];
    return [head, controls, ...filled.map((t) => platformRow(t, sort, `row-${id}-${t.id}`))];
  }
  return [head, controls, videoGrid(tab, sortItems(tab?.items || [], sort))];
}

function videoGrid(tab, items) {
  return items.length
    ? el("div", { class: "grid" + (tab.layout === "vertical" ? " vertical" : "") }, items.map(videoCard))
    : el("div", { class: "empty", text: "New clips coming soon." });
}

// One platform shown as a horizontal row that scrolls with the arrows or by swiping.
function platformRow(tab, sort, anchor) {
  const items = sortItems(tab.items || [], sort);
  if (!items.length) {
    return el("section", { class: "platform-block" }, [
      el("div", { class: "platform-head" }, [el("h3", { text: tab.label })]),
      el("div", { class: "empty", text: "New clips coming soon." }),
    ]);
  }

  const row = el("div", { class: "row" + (tab.layout === "vertical" ? " vertical" : "") }, items.map(videoCard));
  const scroll = (dir) => row.scrollBy({ left: dir * row.clientWidth * 0.9, behavior: "smooth" });
  const prev = el("button", { class: "arrow", "aria-label": `Previous ${tab.label} clips`, text: "←", onclick: () => scroll(-1) });
  const next = el("button", { class: "arrow", "aria-label": `Next ${tab.label} clips`, text: "→", onclick: () => scroll(1) });

  const updateArrows = () => {
    prev.disabled = row.scrollLeft <= 4;
    next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
  };
  row.addEventListener("scroll", updateArrows, { passive: true });
  window.addEventListener("resize", updateArrows);
  requestAnimationFrame(updateArrows);

  return el("section", { class: "platform-block", id: anchor }, [
    el("div", { class: "platform-head" }, [
      el("h3", {}, [tab.label, el("span", { class: "count", text: String(items.length) })]),
      el("div", { class: "arrows" }, [prev, next]),
    ]),
    row,
  ]);
}

function renderText(data) {
  const side = el("aside", { class: "about-side" }, [
    ...(data.stats || []).flatMap((s) => [
      el("div", { class: "stat", text: s.value }),
      el("div", { class: "stat-label", text: s.label }),
    ]),
    data.links?.length ? el("h3", { text: "Find me" }) : null,
    ...(data.links || []).map((l) => el("a", { href: l.url, target: "_blank", rel: "noopener", text: l.label + " ↗" })),
  ]);
  return [
    el("div", { class: "section-head" }, [el("div", {}, [
      data.eyebrow ? el("p", { class: "eyebrow", text: data.eyebrow }) : null,
      el("h2", {}, highlight(data.title)),
    ])]),
    el("div", { class: "about" }, [
      el("div", {}, (data.paragraphs || []).map((p) => el("p", { text: p }))),
      side,
    ]),
  ];
}

function currentSectionId() {
  const hash = location.hash.slice(1);
  const ids = state.site.sections.map((s) => s.id);
  return ids.includes(hash) ? hash : ids[0];
}

async function render() {
  const id = currentSectionId();
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.dataset.id === id));

  const main = $("#main");
  try {
    if (!state.sections[id]) {
      const meta = state.site.sections.find((s) => s.id === id);
      state.sections[id] = await loadJSON(meta.file);
    }
    const data = state.sections[id];
    main.replaceChildren(...(data.type === "text" ? renderText(data) : renderVideos(id, data)));
  } catch (err) {
    main.replaceChildren(el("div", { class: "empty", text: err.message }));
  }
}

async function init() {
  state.site = await loadJSON("content/site.json");
  const { name, tagline, headline } = state.site;
  document.title = `${name} | ${tagline.replace(/\*/g, "")}`;
  $("#brand").textContent = name;
  $("#tagline").textContent = tagline;
  $("#hero-title").replaceChildren(...highlight(headline || name));
  $("#footer-name").textContent = name;
  $("#year").textContent = new Date().getFullYear();
  $("#nav").replaceChildren(
    ...state.site.sections.map((s) => el("a", { href: `#${s.id}`, "data-id": s.id, text: s.title }))
  );
  window.addEventListener("hashchange", render);
  render();
  renderShowcase();
}

// Load every video section once, for the featured slider and the stats strip.
async function allClips() {
  const clips = [];
  for (const meta of state.site.sections) {
    try {
      state.sections[meta.id] ||= await loadJSON(meta.file);
    } catch { continue; }
    const data = state.sections[meta.id];
    if (data.type !== "videos") continue;
    for (const tab of data.tabs || []) {
      for (const item of tab.items || []) clips.push({ ...item, section: data.title.replace(/\*/g, ""), platform: tab.label });
    }
  }
  return clips;
}

function compact(n) {
  return formatViews(n).replace(" views", "");
}

async function renderShowcase() {
  const clips = await allClips();
  const totalViews = clips.reduce((sum, c) => sum + (Number(c.views) || 0), 0);
  const stats = [
    ...(state.site.stats || []),
    ...(totalViews ? [{ value: compact(totalViews) + "+", label: "Total views" }] : []),
  ];
  $("#stats").replaceChildren(...stats.flatMap((s) => [
    el("div", { class: "stat" }, [el("dt", { text: s.label }), el("dd", { text: s.value })]),
  ]));

  const featured = [...clips].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, state.site.featuredCount || 4);
  if (!featured.length) return;

  const root = $("#showcase");
  root.hidden = false;
  let index = 0;
  let timer;

  const slides = featured.map((clip, i) => {
    const img = thumbnailFor(clip);
    const vertical = /\/shorts\/|tiktok|instagram/.test(clip.url);
    const backdrop = el("div", { class: "slide-backdrop" });
    const poster = el("a", { class: "slide-poster" + (vertical ? " is-vertical" : ""), href: clip.url, target: "_blank", rel: "noopener", "aria-label": `Watch ${clip.title}` },
      [img ? null : el("span", { text: clip.platform })]);
    if (img) backdrop.style.backgroundImage = poster.style.backgroundImage = `url("${img}")`;
    return el("article", { class: "slide", "aria-hidden": String(i !== 0) }, [
      backdrop,
      el("div", { class: "slide-inner" }, [
        el("div", { class: "slide-text" }, [
          el("p", { class: "slide-label", text: `${clip.section} · ${clip.platform}` }),
          el("h2", { text: clip.title }),
          el("dl", { class: "slide-stats" }, [
            clip.views ? el("div", {}, [el("dt", { text: "Views" }), el("dd", { text: compact(clip.views) })]) : null,
            el("div", {}, [el("dt", { text: "Platform" }), el("dd", { text: clip.platform })]),
            clip.date ? el("div", {}, [el("dt", { text: "Posted" }), el("dd", { text: formatDate(clip.date) })]) : null,
          ]),
          el("a", { class: "cta", href: clip.url, target: "_blank", rel: "noopener", text: "Watch now →" }),
        ]),
        poster,
      ]),
    ]);
  });

  const numbers = featured.map((_, i) =>
    el("button", { class: "slide-num", "aria-label": `Show clip ${i + 1}`, text: String(i + 1).padStart(2, "0"), onclick: () => go(i, true) })
  );

  function go(i, manual) {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, n) => { s.classList.toggle("active", n === index); s.setAttribute("aria-hidden", String(n !== index)); });
    numbers.forEach((b, n) => b.classList.toggle("active", n === index));
    clearInterval(timer);
    if (slides.length > 1 && !(manual && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      timer = setInterval(() => go(index + 1), 7000);
    }
  }

  const nav = slides.length > 1
    ? el("div", { class: "slide-nav" }, [
        el("div", { class: "slide-nums" }, numbers),
        el("div", { class: "arrows" }, [
          el("button", { class: "arrow", "aria-label": "Previous clip", text: "←", onclick: () => go(index - 1, true) }),
          el("button", { class: "arrow", "aria-label": "Next clip", text: "→", onclick: () => go(index + 1, true) }),
        ]),
      ])
    : null;

  root.replaceChildren(el("div", { class: "slides" }, slides), nav);
  go(0);
}

init();
