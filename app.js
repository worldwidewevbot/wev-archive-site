const state = {
  filter: "all",
  page: "selected",
  adminUnlocked: sessionStorage.getItem("wevCmsUnlocked") === "true",
  adminItemId: null,
  catalogSource: "published",
  catalogSort: "releaseDate",
  catalogSearch: "",
  catalogTag: "all",
  activePreviewTrackId: null,
  selectedTrackIds: new Set(),
  openProjectId: null,
  openProjectSurface: null,
  lastFocusedElement: null,
  data: null
};

const els = {
  selectedList: document.querySelector(".selected-list"),
  selectedProjectPanel: document.querySelector(".selected-project-panel"),
  filterBar: document.querySelector(".filter-bar"),
  archiveList: document.querySelector(".archive-list"),
  archiveProjectPanel: document.querySelector(".archive-layout .project-panel"),
  worksDek: document.querySelector(".works-dek"),
  worksList: document.querySelector(".works-list"),
  videoList: document.querySelector(".video-list"),
  dateList: document.querySelector(".date-list"),
  projectModal: document.querySelector(".project-modal"),
  trackTable: document.querySelector(".track-table"),
  catalogTags: document.querySelector(".catalog-tags"),
  catalogSearch: document.querySelector(".catalog-search input"),
  catalogSourceButtons: document.querySelectorAll("[data-source]"),
  catalogSortButtons: document.querySelectorAll("[data-sort]"),
  spotifyPreview: document.querySelector(".spotify-preview"),
  selectedTracks: document.querySelector(".selected-tracks"),
  requestForm: document.querySelector(".request-form"),
  requestMail: document.querySelector(".request-mail"),
  adminArchiveEditor: document.querySelector(".admin-archive-editor"),
  adminGate: document.querySelector(".admin-gate"),
  adminLogin: document.querySelector(".admin-login"),
  adminLoginError: document.querySelector(".admin-login-error"),
  adminPanel: document.querySelector(".admin-panel"),
  adminItemSelect: document.querySelector(".admin-item-select"),
  adminEditor: document.querySelector(".admin-editor"),
  adminExport: document.querySelector(".admin-export"),
  adminActions: document.querySelectorAll("[data-admin-action]"),
  licensingIntro: document.querySelector("#licensing-intro")
};

async function loadArchive() {
  const response = await fetch("data/archive.json");
  if (!response.ok) {
    throw new Error(`Archive content failed to load: ${response.status}`);
  }
  state.data = await response.json();
  applyArchiveDraft();
  render();
}

function render() {
  const { site, filters, items, videos, dates, licensing } = state.data;
  void site;
  setText(els.licensingIntro, licensing.intro);
  syncCollectionDesignations();
  renderSelectedWorks(getSelectedWorks());
  renderWorks();
  renderFilters(filters);
  renderItems(mergeArchiveItems(getSelectedWorks(), items, videos));
  renderVideos(videos);
  renderDates(dates);
  renderCatalog();
  bindCatalogControls();
  renderPage();
}

function mergeArchiveItems(selectedWorks, items, videos = []) {
  const seen = new Set();
  const videoItems = videos.map((video, index) => ({
    id: `video-${video.id}`,
    type: "video",
    year: video.year || "video",
    title: video.title,
    dek: video.caption,
    description: "Selected public video embed.",
    links: [{ label: "youtube", url: video.url }],
    tags: ["video", "youtube"],
    video,
    sortIndex: index
  }));
  return [...selectedWorks, ...items, ...videoItems].filter((item) => item.showInArchive !== false).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).sort(sortByMostRecent);
}

function renderSelectedWorks(works) {
  if (!els.selectedList) return;
  els.selectedList.replaceChildren(...works.sort(sortByMostRecent).map((work) => renderItem(work, { selected: true })));
}

function syncCollectionDesignations() {
  const selectedIds = new Set((state.data.selectedWorks || []).map((item) => item.id));
  const worksIds = new Set(state.data.sections?.works?.featuredIds || []);
  state.data.items.forEach((item) => {
    item.isSelectedWork = item.isSelectedWork || selectedIds.has(item.id);
    item.showInWorks = item.showInWorks || worksIds.has(item.id);
    if (item.showInArchive === undefined) item.showInArchive = true;
  });
  state.data.selectedWorks = getSelectedWorks();
  if (state.data.sections?.works) state.data.sections.works.featuredIds = getWorksItems().map((item) => item.id);
  if (!state.adminItemId && state.data.items.length) state.adminItemId = [...state.data.items].sort(sortByMostRecent)[0].id;
}

function getSelectedWorks() {
  return state.data.items.filter((item) => item.isSelectedWork);
}

function getWorksItems() {
  return state.data.items.filter((item) => item.showInWorks);
}

function sortByMostRecent(a, b) {
  const aTime = getSortTime(a);
  const bTime = getSortTime(b);
  if (aTime !== bTime) return bTime - aTime;
  return String(a.title || "").localeCompare(String(b.title || ""));
}

function getSortTime(item) {
  const raw = item.date || item.year || "";
  const match = String(raw).match(/\d{4}(?:-\d{2})?(?:-\d{2})?/);
  if (!match) return 0;
  const value = match[0].length === 4 ? `${match[0]}-12-31` : match[0].length === 7 ? `${match[0]}-28` : match[0];
  const time = new Date(`${value}T12:00:00`).getTime();
  return Number.isFinite(time) ? time : 0;
}

function renderWorks() {
  if (!els.worksList || !state.data.sections?.works) return;
  const section = state.data.sections.works;
  setText(els.worksDek, section.dek);
  const archiveItems = mergeArchiveItems(getSelectedWorks(), state.data.items, state.data.videos);
  const byId = new Map(archiveItems.map((item) => [item.id, item]));
  const featured = getWorksItems().map((item) => byId.get(item.id) || item).filter(Boolean).sort(sortByMostRecent);
  els.worksList.replaceChildren(...featured.map((item) => renderItem(item, { compact: true, surface: "licensing" })));
}

function renderFilters(filters) {
  if (!els.filterBar) return;
  els.filterBar.replaceChildren(
    ...filters.map((filter) => {
      const button = document.createElement("button");
      button.className = "filter-button";
      button.type = "button";
      button.textContent = filter;
      button.setAttribute("aria-pressed", String(filter === state.filter));
      button.addEventListener("click", () => {
        state.filter = filter;
        renderItems(mergeArchiveItems(getSelectedWorks(), state.data.items, state.data.videos));
        renderFilters(state.data.filters);
      });
      return button;
    })
  );
}

function renderItems(items) {
  if (!els.archiveList) return;
  const visible = state.filter === "all" ? items : items.filter((item) => item.type === state.filter);
  els.archiveList.replaceChildren(...visible.map(renderItem));
}

function renderItem(item, options = {}) {
  const article = document.createElement("article");
  article.className = options.selected ? "archive-item selected-work" : options.compact ? "archive-item works-item" : "archive-item";
  article.dataset.type = item.type;
  const media = renderItemMedia(item);
  article.innerHTML = `
    <div class="archive-copy">
      <div class="meta">
        <div>${escapeHtml(item.type)}</div>
        <div>${escapeHtml(item.year)}</div>
      </div>
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="dek">${escapeHtml(item.dek)}</p>
        <p class="description">${escapeHtml(item.description)}</p>
        <div class="link-row" aria-label="Links">
          ${item.links.map((link) => renderLink(link, item)).join("")}
        </div>
        <div class="tag-row" aria-label="Tags">
          ${item.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        ${renderBlockSummary(item)}
      </div>
    </div>
    ${media}
  `;
  article.querySelectorAll("[data-action='open-project']").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openProject(item.id, options.surface || (options.selected ? "selected" : "archive"));
    });
  });
  return article;
}

function renderItemMedia(item) {
  const media = getPrimaryMedia(item);
  if (item.video) return renderVideoEmbed(item.video);
  if (media?.kind === "video") {
    return `<video class="archive-media" src="${escapeAttribute(media.src)}" controls playsinline preload="metadata"></video>`;
  }
  return `<img class="archive-media" src="${escapeAttribute(media?.src || item.image || "assets/placeholder-release.svg")}" alt="" loading="lazy" />`;
}

function getPrimaryMedia(item) {
  if (Array.isArray(item.media) && item.media.length) return item.media[0];
  if (item.image) return { kind: "image", src: item.image };
  return null;
}

function renderBlockSummary(item) {
  const blocks = item.blocks || [];
  if (!blocks.length) return "";
  return `<div class="block-summary">${blocks.slice(0, 3).map((block) => `<span>${escapeHtml(block.type || "block")}</span>`).join("")}</div>`;
}

function createYoutubeEmbedUrl(video) {
  const embedUrl = new URL(`https://www.youtube.com/embed/${video.id}`);
  embedUrl.search = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    origin: window.location.origin
  }).toString();
  return embedUrl;
}

function renderVideoCard(video) {
  const article = document.createElement("article");
  article.className = "video-card";
  article.innerHTML = `
    ${renderVideoEmbed(video)}
    <a class="video-link" href="${escapeAttribute(video.url)}" target="_blank" rel="noreferrer">
      <span>${escapeHtml(video.title)}</span>
      <small>${escapeHtml(video.caption)} / open on youtube</small>
    </a>
  `;
  return article;
}

function renderVideos(videos) {
  if (!els.videoList) return;
  els.videoList.replaceChildren(...videos.map((video) => renderVideoCard(video)));
}

function renderDates(dates) {
  if (!els.dateList) return;
  els.dateList.replaceChildren(
    ...dates.map((date) => {
      const row = document.createElement("div");
      row.className = "date-row";
      row.innerHTML = `
        <time datetime="${escapeAttribute(date.date)}">${formatDate(date.date)}</time>
        <div>
          <strong>${escapeHtml(date.city)}</strong>
          <span>${escapeHtml([date.venue, date.status, date.tickets, date.age].filter(Boolean).join(" / "))}</span>
        </div>
      `;
      return row;
    })
  );
}

function renderVideoEmbed(video) {
  const embedUrl = createYoutubeEmbedUrl(video);
  return `<iframe class="video-embed archive-media" src="${escapeAttribute(embedUrl.href)}" title="${escapeAttribute(video.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>`;
}

function renderLink(link, item) {
  const action = link.action ? ` data-action="${escapeAttribute(link.action)}"` : "";
  const target = link.action ? "" : ' target="_blank" rel="noreferrer"';
  return `<a class="text-link" href="${escapeAttribute(link.url)}"${action}${target}>${escapeHtml(link.label)}</a>`;
}

function renderProjectDetail(item) {
  return `
    <article class="project-detail">
      <div class="project-detail-media">
        ${renderProjectMedia(item)}
        <button class="text-link button-link project-close" type="button" data-action="close-project">close</button>
      </div>
      <div class="project-detail-copy">
        <div class="meta">
          <div>${escapeHtml(item.type)}</div>
          <div>${escapeHtml(item.year)}</div>
        </div>
        <h2>${escapeHtml(item.project.headline)}</h2>
        ${item.project.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        ${renderProjectBlocks(item)}
        <div class="link-row" aria-label="Links">
          ${item.project.links.map((link) => `<a class="text-link" href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`).join("")}
        </div>
      </div>
    </article>
  `;
}

function renderProjectMedia(item) {
  const media = getPrimaryMedia(item);
  if (media?.kind === "video") {
    return `<video src="${escapeAttribute(media.src)}" controls playsinline preload="metadata"></video>`;
  }
  return `<img src="${escapeAttribute(media?.src || item.image || "assets/placeholder-release.svg")}" alt="" />`;
}

function renderProjectBlocks(item) {
  const blocks = item.blocks || [];
  if (!blocks.length) return "";
  return `<div class="project-blocks">${blocks.map(renderProjectBlock).join("")}</div>`;
}

function renderProjectBlock(block) {
  if (block.type === "image") return `<figure><img src="${escapeAttribute(block.src || "")}" alt="" /><figcaption>${escapeHtml(block.caption || "")}</figcaption></figure>`;
  if (block.type === "video") return `<figure><video src="${escapeAttribute(block.src || "")}" controls playsinline preload="metadata"></video><figcaption>${escapeHtml(block.caption || "")}</figcaption></figure>`;
  if (block.type === "embed") return `<p><a class="text-link" href="${escapeAttribute(block.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(block.label || block.url || "embed")}</a></p>`;
  if (block.type === "quote") return `<blockquote>${escapeHtml(block.text || "")}</blockquote>`;
  if (block.type === "link") return `<p><a class="text-link" href="${escapeAttribute(block.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(block.label || block.url || "link")}</a></p>`;
  return `<p>${escapeHtml(block.text || "")}</p>`;
}

function bindProjectClose(panel) {
  panel.querySelectorAll("[data-action='close-project']").forEach((button) => {
    button.addEventListener("click", closeProject);
  });
}

function openProject(id, surface = "archive") {
  const archiveItems = mergeArchiveItems(getSelectedWorks(), state.data.items, state.data.videos);
  const item = archiveItems.find((entry) => entry.id === id);
  if (!item || !item.project) return;

  state.openProjectId = id;
  state.openProjectSurface = surface;

  if (surface === "selected" && els.selectedList && els.selectedProjectPanel) {
    els.selectedList.hidden = true;
    els.selectedProjectPanel.hidden = false;
    els.selectedProjectPanel.innerHTML = renderProjectDetail(item);
    bindProjectClose(els.selectedProjectPanel);
    els.selectedProjectPanel.scrollIntoView({ block: "start" });
    return;
  }

  if (!els.archiveList || !els.filterBar || !els.archiveProjectPanel) return;
  if (surface !== "archive") {
    openProjectModal(item);
    return;
  }
  els.archiveList.hidden = true;
  els.filterBar.hidden = true;
  els.archiveProjectPanel.hidden = false;
  els.archiveProjectPanel.innerHTML = renderProjectDetail(item);
  bindProjectClose(els.archiveProjectPanel);
}

function openProjectModal(item) {
  if (!els.projectModal) return;
  state.lastFocusedElement = document.activeElement;
  document.body.classList.add("modal-open");
  const panel = els.projectModal.querySelector(".project-panel");
  panel.innerHTML = renderProjectDetail(item);
  bindProjectClose(els.projectModal);
  els.projectModal.hidden = false;
}

function closeProject() {
  state.openProjectId = null;
  const surface = state.openProjectSurface;
  state.openProjectSurface = null;

  if (surface === "selected" && els.selectedProjectPanel && els.selectedList) {
    els.selectedProjectPanel.hidden = true;
    els.selectedProjectPanel.replaceChildren();
    els.selectedList.hidden = false;
    return;
  }

  if (!els.archiveProjectPanel || !els.archiveList || !els.filterBar) return;
  if (els.projectModal && !els.projectModal.hidden) {
    els.projectModal.hidden = true;
    els.projectModal.querySelector(".project-panel")?.replaceChildren();
    document.body.classList.remove("modal-open");
    state.lastFocusedElement?.focus?.();
    return;
  }
  els.archiveProjectPanel.hidden = true;
  els.archiveProjectPanel.replaceChildren();
  els.archiveList.hidden = false;
  els.filterBar.hidden = false;
}

function renderCatalog() {
  if (!els.trackTable) return;
  const tracks = getVisibleTracks();
  renderCatalogButtons();
  renderCatalogTags();
  renderSpotifyPreview();
  renderTracks(tracks);
  renderSelectedTracks();
  renderAdminGate();
  renderAdminArchiveEditor();
  renderAdminEditor();
}

function renderAdminArchiveEditor() {
  if (!els.adminArchiveEditor) return;
  if (!state.adminUnlocked) {
    els.adminArchiveEditor.replaceChildren();
    return;
  }
  renderAdminPicker();
  const item = state.data.items.find((entry) => entry.id === state.adminItemId) || state.data.items[0];
  if (!item) return;
  state.adminItemId = item.id;
  const article = document.createElement("article");
  article.className = "admin-item";
  article.dataset.itemId = item.id;
  article.innerHTML = `
    <div class="admin-item-head">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml([item.type, item.year].filter(Boolean).join(" / "))}</span>
    </div>
    <div class="admin-designations" aria-label="Site placement">
      <label><input data-item-flag="showInArchive" type="checkbox" ${item.showInArchive !== false ? "checked" : ""} /> <span>archive</span></label>
      <label><input data-item-flag="isSelectedWork" type="checkbox" ${item.isSelectedWork ? "checked" : ""} /> <span>selected work</span></label>
      <label><input data-item-flag="showInWorks" type="checkbox" ${item.showInWorks ? "checked" : ""} /> <span>sync/licensing work</span></label>
    </div>
    <label><span>title</span><input data-item-field="title" value="${escapeAttribute(item.title || "")}" /></label>
    <label><span>type</span><select data-item-field="type">${state.data.filters.filter((filter) => filter !== "all").map((filter) => `<option>${escapeHtml(filter)}</option>`).join("")}</select></label>
    <label><span>date / year</span><input data-item-field="date" value="${escapeAttribute(item.date || item.year || "")}" /></label>
    <label class="wide"><span>dek</span><input data-item-field="dek" value="${escapeAttribute(item.dek || "")}" /></label>
    <label class="wide"><span>description</span><textarea data-item-field="description" rows="3">${escapeHtml(item.description || "")}</textarea></label>
    <label class="wide"><span>tags</span><input data-item-field="tags" value="${escapeAttribute((item.tags || []).join(", "))}" /></label>
    <label class="wide"><span>links</span><textarea data-item-field="links" rows="3">${escapeHtml(formatLinksForEdit(item.links || []))}</textarea></label>
    <label class="wide"><span>content blocks</span><textarea data-item-field="blocks" rows="5">${escapeHtml(formatBlocksForEdit(item))}</textarea></label>
    <label class="wide media-upload"><span>upload image / video</span><input data-item-upload type="file" accept="image/*,video/*" /></label>
    <div class="media-bin">${renderAdminMediaBin(item)}</div>
  `;
  article.querySelector("[data-item-field='type']").value = item.type;
  article.querySelectorAll("[data-item-field]").forEach((input) => {
    input.addEventListener("change", handleArchiveItemChange);
  });
  article.querySelectorAll("[data-item-flag]").forEach((input) => {
    input.addEventListener("change", handleArchiveFlagChange);
  });
  article.querySelector("[data-item-upload]").addEventListener("change", handleArchiveUpload);
  article.querySelectorAll("[data-remove-media]").forEach((button) => {
    button.addEventListener("click", handleRemoveMedia);
  });
  els.adminArchiveEditor.replaceChildren(article);
}

function renderAdminGate() {
  if (!els.adminGate || !els.adminPanel) return;
  els.adminGate.hidden = state.adminUnlocked;
  els.adminPanel.hidden = !state.adminUnlocked;
}

function renderAdminPicker() {
  if (!els.adminItemSelect) return;
  const items = [...state.data.items].sort(sortByMostRecent);
  els.adminItemSelect.replaceChildren(
    ...items.map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = [item.date || item.year, item.title, item.type].filter(Boolean).join(" / ");
      return option;
    })
  );
  els.adminItemSelect.value = state.adminItemId || items[0]?.id || "";
}

function handleArchiveFlagChange(event) {
  const item = getAdminItem(event.target);
  if (!item) return;
  item[event.target.dataset.itemFlag] = event.target.checked;
  syncCollectionDesignations();
  saveArchiveDraft();
  render();
}

function handleArchiveItemChange(event) {
  const item = getAdminItem(event.target);
  if (!item) return;
  const field = event.target.dataset.itemField;
  if (field === "tags") {
    item.tags = splitLinesOrCommas(event.target.value);
  } else if (field === "links") {
    item.links = parseLinksFromEdit(event.target.value);
    item.project = item.project || { headline: item.title, body: [], links: [] };
    item.project.links = item.links.filter((link) => !link.action);
  } else if (field === "blocks") {
    item.blocks = parseBlocksFromEdit(event.target.value);
  } else if (field === "date") {
    item.date = event.target.value.trim();
    item.year = inferYear(item.date);
  } else {
    item[field] = event.target.value.trim();
    if (field === "title" && item.project) item.project.headline = item.title;
  }
  saveArchiveDraft();
  render();
}

function handleArchiveUpload(event) {
  const item = getAdminItem(event.target);
  const file = event.target.files?.[0];
  if (!item || !file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const kind = file.type.startsWith("video/") ? "video" : "image";
    item.media = [{ kind, src: reader.result, name: file.name }, ...(item.media || [])];
    item.image = kind === "image" ? reader.result : item.image;
    saveArchiveDraft();
    render();
  });
  reader.readAsDataURL(file);
}

function handleRemoveMedia(event) {
  const item = getAdminItem(event.target);
  if (!item) return;
  const index = Number(event.target.dataset.removeMedia);
  item.media = (item.media || []).filter((_, mediaIndex) => mediaIndex !== index);
  saveArchiveDraft();
  render();
}

function getAdminItem(target) {
  const id = target.closest("[data-item-id]")?.dataset.itemId;
  return state.data.items.find((item) => item.id === id);
}

function renderAdminMediaBin(item) {
  const media = item.media || [];
  if (!media.length) return `<p class="empty-note">No uploaded media.</p>`;
  return media.map((entry, index) => `<button class="selected-track" type="button" data-remove-media="${index}">${escapeHtml(entry.name || entry.kind || "media")} ×</button>`).join("");
}

function formatLinksForEdit(links) {
  return links.filter((link) => !link.action).map((link) => `${link.label || "link"} | ${link.url || ""}`).join("\n");
}

function parseLinksFromEdit(value) {
  const links = [{ label: "open project", url: "#", action: "open-project" }];
  value.split("\n").map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const [label, url] = line.split("|").map((part) => part.trim());
    if (url) links.push({ label: label || "link", url });
  });
  return links;
}

function formatBlocksForEdit(item) {
  const blocks = item.blocks?.length ? item.blocks : (item.project?.body || []).map((text) => ({ type: "text", text }));
  return blocks.map((block) => `${block.type || "text"} | ${block.text || block.caption || block.url || ""}`).join("\n");
}

function parseBlocksFromEdit(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [typeRaw, contentRaw] = line.split("|");
    const type = (typeRaw || "text").trim().toLowerCase();
    const content = (contentRaw || "").trim();
    if (type === "link" || type === "embed") return { type, label: content, url: content };
    if (type === "quote") return { type, text: content };
    return { type: "text", text: content || line };
  });
}

function splitLinesOrCommas(value) {
  return value.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean);
}

function inferYear(value) {
  const match = String(value || "").match(/\d{4}/);
  return match ? match[0] : value;
}

function getVisibleTracks() {
  const tracks = [...state.data.licensing.tracks];
  return tracks
    .filter((track) => track.source === state.catalogSource)
    .filter((track) => {
      if (state.catalogTag === "all") return true;
      return getTrackTags(track).includes(state.catalogTag);
    })
    .filter((track) => {
      const query = state.catalogSearch.trim().toLowerCase();
      if (!query) return true;
      return [track.title, track.artist, track.release, track.status, track.notes, ...getTrackTags(track)].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (state.catalogSort === "bpm") return Number(a.bpm || 0) - Number(b.bpm || 0);
      if (state.catalogSort === "title") return a.title.localeCompare(b.title);
      return String(b.releaseDate || "").localeCompare(String(a.releaseDate || ""));
    });
}

function renderCatalogButtons() {
  els.catalogSourceButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.source === state.catalogSource));
  });
  els.catalogSortButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.sort === state.catalogSort));
  });
}

function renderCatalogTags() {
  if (!els.catalogTags) return;
  const tags = ["all", ...new Set(state.data.licensing.tracks.flatMap(getTrackTags).sort((a, b) => a.localeCompare(b)))];
  els.catalogTags.replaceChildren(
    ...tags.map((tagName) => {
      const button = document.createElement("button");
      button.className = "tag-button";
      button.type = "button";
      button.textContent = tagName;
      button.setAttribute("aria-pressed", String(tagName === state.catalogTag));
      button.addEventListener("click", () => {
        state.catalogTag = tagName;
        renderCatalog();
      });
      return button;
    })
  );
}

function renderTracks(tracks) {
  if (!els.trackTable) return;
  els.trackTable.replaceChildren(
    ...tracks.map((track) => {
      const row = document.createElement("div");
      row.className = "track-row";
      row.role = "listitem";
      row.dataset.trackId = track.id;
      const isSelected = state.selectedTrackIds.has(track.id);
      const isPreviewing = state.activePreviewTrackId === track.id;
      const spotifyId = getSpotifyTrackId(track);
      const artwork = track.artwork || "assets/placeholder-license.svg";
      const releaseDate = formatReleaseDate(track.releaseDate);
      const tags = getTrackTags(track);
      const bpm = formatBpm(track.bpm);
      const spotifyEmbedUrl = spotifyId ? createSpotifyEmbedUrl(spotifyId) : "";
      row.innerHTML = `
        <div class="track-hero" style="--track-art: url('${escapeAttribute(artwork)}')">
          <img class="track-artwork" src="${escapeAttribute(artwork)}" alt="" loading="lazy" />
          <div class="track-main">
            <strong class="track-title">${escapeHtml(track.title)}</strong>
            <span class="track-release">${escapeHtml(track.release || track.source)}</span>
            ${bpm ? `<span class="track-bpm">${escapeHtml(bpm)}</span>` : ""}
          </div>
          ${releaseDate ? `<span class="track-date">${escapeHtml(releaseDate)}</span>` : ""}
          <button class="track-preview" type="button" ${spotifyId ? "" : "disabled"} aria-label="${escapeAttribute(isPreviewing ? `Close Spotify preview for ${track.title}` : `Preview ${track.title} on Spotify`)}" aria-pressed="${isPreviewing}">
            <span>${isPreviewing ? "Close preview" : "Preview"}</span>
          </button>
        </div>
        <div class="track-lower">
          ${tags.length ? `<div class="track-tags" aria-label="Track tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
          <div class="track-actions">
            <span class="track-status">${escapeHtml(track.status || "clearable")}</span>
            <button class="track-select" type="button" aria-pressed="${isSelected}">${isSelected ? "Requested" : "Request"}</button>
          </div>
        </div>
        ${
          isPreviewing && spotifyEmbedUrl
            ? `<div class="track-player"><iframe src="${escapeAttribute(spotifyEmbedUrl)}" title="${escapeAttribute(`Spotify preview: ${track.title}`)}" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager"></iframe></div>`
            : ""
        }
      `;
      row.querySelector(".track-select").addEventListener("click", () => {
        state.selectedTrackIds.clear();
        state.selectedTrackIds.add(track.id);
        renderCatalog();
        scrollToRequestForm();
      });
      row.querySelector(".track-preview").addEventListener("click", () => {
        state.activePreviewTrackId = isPreviewing ? null : track.id;
        renderCatalog();
      });
      return row;
    })
  );
}

function renderSpotifyPreview() {
  if (!els.spotifyPreview) return;
  els.spotifyPreview.hidden = true;
  els.spotifyPreview.replaceChildren();
}

function formatReleaseDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return String(value);
  return `${year}-${month}-${day}`;
}

function formatBpm(value) {
  if (value === null || value === undefined || value === "") return "";
  const bpm = Number(value);
  if (!Number.isFinite(bpm) || bpm <= 0) return "";
  return `${Number.isInteger(bpm) ? bpm : bpm.toFixed(2).replace(/\.?0+$/, "")} bpm`;
}

function renderSelectedTracks() {
  if (!els.selectedTracks) return;
  const selected = state.data.licensing.tracks.filter((track) => state.selectedTrackIds.has(track.id));
  els.selectedTracks.replaceChildren(
    ...(selected.length
      ? selected.map((track) => {
          const row = document.createElement("button");
          row.className = "selected-track";
          row.type = "button";
          row.textContent = [track.title, formatBpm(track.bpm)].filter(Boolean).join(" / ");
          row.addEventListener("click", () => {
            state.selectedTrackIds.delete(track.id);
            renderCatalog();
          });
          return row;
        })
      : [Object.assign(document.createElement("p"), { className: "empty-note", textContent: "No tracks selected." })])
  );
  updateRequestMail(selected);
}

function updateRequestMail(selectedTracks) {
  if (!els.requestForm || !els.requestMail) return;
  const formData = new FormData(els.requestForm);
  const selectedText = selectedTracks.map((track) => `- ${track.title}`).join("\n");
  const body = [
    `Name: ${formData.get("name") || ""}`,
    `Email: ${formData.get("email") || ""}`,
    `Usage: ${formData.get("usage") || ""}`,
    "",
    "Tracks:",
    selectedText || "-",
    "",
    `Notes: ${formData.get("notes") || ""}`
  ].join("\n");
  els.requestMail.href = `mailto:hello@wev.world?subject=Music%20licensing%20inquiry&body=${encodeURIComponent(body)}`;
}

function scrollToRequestForm() {
  window.requestAnimationFrame(() => {
    const panel = document.querySelector(".request-panel");
    if (!panel) return;
    const top = panel.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top, behavior: "instant" });
  });
}

function renderAdminEditor() {
  if (!els.adminEditor) return;
  if (!state.adminUnlocked) {
    els.adminEditor.replaceChildren();
    return;
  }
  els.adminEditor.replaceChildren(
    ...state.data.licensing.tracks.map((track) => {
      const row = document.createElement("article");
      row.className = "admin-track";
      row.innerHTML = `
        <strong>${escapeHtml(track.title)}</strong>
        <label><span>bpm</span><input data-field="bpm" data-track="${escapeAttribute(track.id)}" value="${escapeAttribute(track.bpm || "")}" inputmode="numeric" /></label>
        <label><span>source</span><select data-field="source" data-track="${escapeAttribute(track.id)}"><option>published</option><option>unreleased</option></select></label>
        <label class="wide"><span>tags</span><input data-field="tags" data-track="${escapeAttribute(track.id)}" value="${escapeAttribute(getTrackTags(track).join(", "))}" /></label>
      `;
      row.querySelector("select").value = track.source;
      row.querySelectorAll("input, select").forEach((input) => {
        input.addEventListener("change", handleAdminChange);
      });
      return row;
    })
  );
}

function handleAdminChange(event) {
  const { track: trackId, field } = event.target.dataset;
  const track = state.data.licensing.tracks.find((entry) => entry.id === trackId);
  if (!track) return;
  if (field === "bpm") {
    track.bpm = event.target.value ? Number(event.target.value) : null;
  } else if (field === "source") {
    track.source = event.target.value;
  } else if (field === "tags") {
    track.tags = event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  saveArchiveDraft();
  renderCatalog();
}

function bindCatalogControls() {
  if (bindCatalogControls.bound) return;
  bindCatalogControls.bound = true;

  els.catalogSourceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.catalogSource = button.dataset.source;
      renderCatalog();
    });
  });
  els.catalogSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.catalogSort = button.dataset.sort;
      renderCatalog();
    });
  });
  els.catalogSearch?.addEventListener("input", () => {
    state.catalogSearch = els.catalogSearch.value;
    renderCatalog();
  });
  els.requestForm?.addEventListener("input", () => {
    renderSelectedTracks();
  });
  els.adminLogin?.addEventListener("submit", (event) => {
    event.preventDefault();
    const password = new FormData(els.adminLogin).get("password");
    if (password === "wevarchive") {
      state.adminUnlocked = true;
      sessionStorage.setItem("wevCmsUnlocked", "true");
      render();
      return;
    }
    if (els.adminLoginError) els.adminLoginError.hidden = false;
  });
  els.adminItemSelect?.addEventListener("change", () => {
    state.adminItemId = els.adminItemSelect.value;
    renderAdminArchiveEditor();
  });
  els.adminActions.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.adminAction === "export") {
        els.adminExport.value = JSON.stringify(state.data, null, 2);
      } else {
        localStorage.removeItem("wevArchiveDraft");
        location.reload();
      }
    });
  });
}

function applyArchiveDraft() {
  const draft = localStorage.getItem("wevArchiveDraft");
  if (!draft) return;
  try {
    const archive = JSON.parse(draft);
    if (archive && typeof archive === "object") state.data = archive;
  } catch {
    localStorage.removeItem("wevArchiveDraft");
  }
}

function saveArchiveDraft() {
  localStorage.setItem("wevArchiveDraft", JSON.stringify(state.data));
}

function getTrackTags(track) {
  const tags = track.tags && track.tags.length ? track.tags : [...(track.moods || []), ...(track.uses || [])];
  return [...new Set(tags.filter(Boolean))];
}

function getSpotifyTrackId(track) {
  if (!track?.spotifyUrl) return "";
  try {
    const url = new URL(track.spotifyUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const trackIndex = parts.indexOf("track");
    return trackIndex >= 0 ? parts[trackIndex + 1] || "" : "";
  } catch {
    return "";
  }
}

function createSpotifyEmbedUrl(spotifyId) {
  const embedUrl = new URL(`https://open.spotify.com/embed/track/${spotifyId}`);
  embedUrl.search = new URLSearchParams({ utm_source: "generator", theme: "0" }).toString();
  return embedUrl.href;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function setText(element, value) {
  if (element) element.textContent = value;
}

loadArchive().catch((error) => {
  document.body.innerHTML = `<main class="shell"><p class="description">${escapeHtml(error.message)}</p></main>`;
});

window.addEventListener("hashchange", renderPage);

function renderPage() {
  const requested =
    window.location.hash === "#archive"
      ? "archive"
      : window.location.hash === "#licensing"
        ? "licensing"
        : window.location.hash === "#cms" || window.location.hash === "#admin"
          ? "admin"
          : window.location.hash === "#contact"
            ? "contact"
            : "selected";
  state.page = requested;
  document.querySelectorAll(".page-view").forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === state.page);
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.openProjectId) {
    closeProject();
  }
});
