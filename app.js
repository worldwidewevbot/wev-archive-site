const state = {
  filter: "all",
  page: "selected",
  catalogSource: "published",
  catalogSort: "releaseDate",
  catalogSearch: "",
  catalogTag: "all",
  selectedTrackIds: new Set(),
  openProjectId: null,
  data: null
};

const els = {
  selectedList: document.querySelector(".selected-list"),
  filterBar: document.querySelector(".filter-bar"),
  archiveList: document.querySelector(".archive-list"),
  projectPanel: document.querySelector(".project-panel"),
  videoList: document.querySelector(".video-list"),
  dateList: document.querySelector(".date-list"),
  trackTable: document.querySelector(".track-table"),
  catalogTags: document.querySelector(".catalog-tags"),
  catalogSearch: document.querySelector(".catalog-search input"),
  catalogSourceButtons: document.querySelectorAll("[data-source]"),
  catalogSortButtons: document.querySelectorAll("[data-sort]"),
  selectedTracks: document.querySelector(".selected-tracks"),
  requestForm: document.querySelector(".request-form"),
  requestMail: document.querySelector(".request-mail"),
  adminEditor: document.querySelector(".admin-editor"),
  adminExport: document.querySelector(".admin-export"),
  adminActions: document.querySelectorAll("[data-admin-action]"),
  tagline: document.querySelector("#site-tagline"),
  licensingIntro: document.querySelector("#licensing-intro")
};

async function loadArchive() {
  const response = await fetch("data/archive.json");
  if (!response.ok) {
    throw new Error(`Archive content failed to load: ${response.status}`);
  }
  state.data = await response.json();
  applyCatalogDraft();
  render();
}

function render() {
  const { site, filters, selectedWorks, items, videos, dates, licensing } = state.data;
  setText(els.tagline, site.tagline);
  setText(els.licensingIntro, licensing.intro);
  renderSelectedWorks(selectedWorks);
  renderFilters(filters);
  renderItems(mergeArchiveItems(selectedWorks, items, videos));
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
  return [...selectedWorks, ...items, ...videoItems].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function renderSelectedWorks(works) {
  if (!els.selectedList) return;
  els.selectedList.replaceChildren(...works.map((work) => renderItem(work, { selected: true })));
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
        renderItems(mergeArchiveItems(state.data.selectedWorks, state.data.items, state.data.videos));
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
  article.className = options.selected ? "archive-item selected-work" : "archive-item";
  article.dataset.type = item.type;
  const media = item.video ? renderVideoEmbed(item.video) : `<img class="archive-media" src="${escapeAttribute(item.image)}" alt="" loading="lazy" />`;
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
      </div>
    </div>
    ${media}
  `;
  article.querySelectorAll("[data-action='open-project']").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openProject(item.id);
    });
  });
  return article;
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
          <span>${escapeHtml(date.venue)} / ${escapeHtml(date.status)}</span>
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

function openProject(id) {
  const archiveItems = mergeArchiveItems(state.data.selectedWorks, state.data.items, state.data.videos);
  const item = archiveItems.find((entry) => entry.id === id);
  if (!item || !item.project) return;
  if (!els.archiveList || !els.filterBar || !els.projectPanel) return;

  state.openProjectId = id;
  if (state.page !== "archive") {
    window.location.hash = "#archive";
    renderPage();
  }
  els.archiveList.hidden = true;
  els.filterBar.hidden = true;
  els.projectPanel.hidden = false;
  els.projectPanel.innerHTML = `
    <article class="project-detail">
      <div class="project-detail-media">
        <img src="${escapeAttribute(item.image)}" alt="" />
        <button class="text-link button-link project-close" type="button" data-action="close-project">close</button>
      </div>
      <div class="project-detail-copy">
        <div class="meta">
          <div>${escapeHtml(item.type)}</div>
          <div>${escapeHtml(item.year)}</div>
        </div>
        <h2>${escapeHtml(item.project.headline)}</h2>
        ${item.project.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        <div class="link-row" aria-label="Links">
          ${item.project.links.map((link) => `<a class="text-link" href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`).join("")}
        </div>
      </div>
    </article>
  `;
  els.projectPanel.querySelector("[data-action='close-project']").addEventListener("click", closeProject);
}

function closeProject() {
  state.openProjectId = null;
  if (!els.projectPanel || !els.archiveList || !els.filterBar) return;
  els.projectPanel.hidden = true;
  els.projectPanel.replaceChildren();
  els.archiveList.hidden = false;
  els.filterBar.hidden = false;
}

function renderCatalog() {
  if (!els.trackTable) return;
  const tracks = getVisibleTracks();
  renderCatalogButtons();
  renderCatalogTags();
  renderTracks(tracks);
  renderSelectedTracks();
  renderAdminEditor();
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
      row.innerHTML = `
        <button class="track-select" type="button" aria-pressed="${state.selectedTrackIds.has(track.id)}">${state.selectedTrackIds.has(track.id) ? "selected" : "select"}</button>
        <div>
          <strong>${escapeHtml(track.title)}</strong>
          <span class="small">${escapeHtml(track.artist || "wev")} / ${escapeHtml(track.release || track.source)}</span>
        </div>
        <span class="small">${escapeHtml(track.duration || "tbd")}</span>
        <span class="small">${track.bpm ? `${Number(track.bpm)} bpm` : "bpm tbd"}</span>
        <span class="small wide">${escapeHtml(getTrackTags(track).join(" / "))}</span>
        <span class="small">${escapeHtml(track.status)}</span>
      `;
      row.querySelector(".track-select").addEventListener("click", () => {
        if (state.selectedTrackIds.has(track.id)) {
          state.selectedTrackIds.delete(track.id);
        } else {
          state.selectedTrackIds.add(track.id);
        }
        renderCatalog();
      });
      return row;
    })
  );
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
          row.textContent = `${track.title} / ${track.bpm ? `${track.bpm} bpm` : "bpm tbd"}`;
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

function renderAdminEditor() {
  if (!els.adminEditor) return;
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
  saveCatalogDraft();
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
  els.adminActions.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.adminAction === "export") {
        els.adminExport.value = JSON.stringify(state.data.licensing.tracks, null, 2);
      } else {
        localStorage.removeItem("wevCatalogDraft");
        location.reload();
      }
    });
  });
}

function applyCatalogDraft() {
  const draft = localStorage.getItem("wevCatalogDraft");
  if (!draft) return;
  try {
    const tracks = JSON.parse(draft);
    if (Array.isArray(tracks)) state.data.licensing.tracks = tracks;
  } catch {
    localStorage.removeItem("wevCatalogDraft");
  }
}

function saveCatalogDraft() {
  localStorage.setItem("wevCatalogDraft", JSON.stringify(state.data.licensing.tracks));
}

function getTrackTags(track) {
  const tags = track.tags && track.tags.length ? track.tags : [...(track.moods || []), ...(track.uses || [])];
  return [...new Set(tags.filter(Boolean))];
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
        : window.location.hash === "#admin"
          ? "admin"
          : "selected";
  state.page = requested;
  document.querySelectorAll(".page-view").forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === state.page);
  });
  if (state.page !== "archive" && state.openProjectId) {
    closeProject();
  }
}
