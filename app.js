const state = {
  filter: "all",
  page: "selected",
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
  tagline: document.querySelector("#site-tagline"),
  licensingIntro: document.querySelector("#licensing-intro")
};

async function loadArchive() {
  const response = await fetch("data/archive.json");
  if (!response.ok) {
    throw new Error(`Archive content failed to load: ${response.status}`);
  }
  state.data = await response.json();
  render();
}

function render() {
  const { site, filters, selectedWorks, items, videos, dates, licensing } = state.data;
  els.tagline.textContent = site.tagline;
  els.licensingIntro.textContent = licensing.intro;
  renderSelectedWorks(selectedWorks);
  renderFilters(filters);
  renderItems(mergeArchiveItems(selectedWorks, items));
  renderVideos(videos);
  renderDates(dates);
  renderTracks(licensing.tracks);
  renderPage();
}

function mergeArchiveItems(selectedWorks, items) {
  const seen = new Set();
  return [...selectedWorks, ...items].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function renderSelectedWorks(works) {
  els.selectedList.replaceChildren(...works.map((work) => renderItem(work, { selected: true })));
}

function renderFilters(filters) {
  els.filterBar.replaceChildren(
    ...filters.map((filter) => {
      const button = document.createElement("button");
      button.className = "filter-button";
      button.type = "button";
      button.textContent = filter;
      button.setAttribute("aria-pressed", String(filter === state.filter));
      button.addEventListener("click", () => {
        state.filter = filter;
        renderItems(mergeArchiveItems(state.data.selectedWorks, state.data.items));
        renderFilters(state.data.filters);
      });
      return button;
    })
  );
}

function renderItems(items) {
  const visible = state.filter === "all" ? items : items.filter((item) => item.type === state.filter);
  els.archiveList.replaceChildren(...visible.map(renderItem));
}

function renderItem(item, options = {}) {
  const article = document.createElement("article");
  article.className = options.selected ? "archive-item selected-work" : "archive-item";
  article.dataset.type = item.type;
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
    <img class="archive-media" src="${escapeAttribute(item.image)}" alt="" loading="lazy" />
  `;
  article.querySelectorAll("[data-action='open-project']").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openProject(item.id);
    });
  });
  return article;
}

function renderVideos(videos) {
  els.videoList.replaceChildren(
    ...videos.map((video) => {
      const article = document.createElement("article");
      article.className = "video-card";
      const embedUrl = createYoutubeEmbedUrl(video);
      article.innerHTML = `
        <iframe class="video-embed" src="${escapeAttribute(embedUrl.href)}" title="${escapeAttribute(video.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>
        <a class="video-link" href="${escapeAttribute(video.url)}" target="_blank" rel="noreferrer">
          <span>${escapeHtml(video.title)}</span>
          <small>${escapeHtml(video.caption)} / open on youtube</small>
        </a>
      `;
      return article;
    })
  );
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

function renderLink(link, item) {
  const action = link.action ? ` data-action="${escapeAttribute(link.action)}"` : "";
  const target = link.action ? "" : ' target="_blank" rel="noreferrer"';
  return `<a class="text-link" href="${escapeAttribute(link.url)}"${action}${target}>${escapeHtml(link.label)}</a>`;
}

function openProject(id) {
  const archiveItems = mergeArchiveItems(state.data.selectedWorks, state.data.items);
  const item = archiveItems.find((entry) => entry.id === id);
  if (!item || !item.project) return;

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
  els.projectPanel.hidden = true;
  els.projectPanel.replaceChildren();
  els.archiveList.hidden = false;
  els.filterBar.hidden = false;
}

function renderDates(dates) {
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

function renderTracks(tracks) {
  els.trackTable.replaceChildren(
    ...tracks.map((track) => {
      const row = document.createElement("div");
      row.className = "track-row";
      row.role = "listitem";
      row.innerHTML = `
        <strong>${escapeHtml(track.title)}</strong>
        <span class="small">${escapeHtml(track.duration)}</span>
        <span class="small">${Number(track.bpm)} bpm</span>
        <span class="small wide">${escapeHtml([...track.moods, ...track.uses].join(" / "))}</span>
        <span class="small">${escapeHtml(track.status)}</span>
      `;
      return row;
    })
  );
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

loadArchive().catch((error) => {
  document.body.innerHTML = `<main class="shell"><p class="description">${escapeHtml(error.message)}</p></main>`;
});

window.addEventListener("hashchange", renderPage);

function renderPage() {
  const requested = window.location.hash === "#archive" ? "archive" : window.location.hash === "#licensing" ? "licensing" : "selected";
  state.page = requested;
  document.querySelectorAll(".page-view").forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === state.page);
  });
  if (state.page !== "archive" && state.openProjectId) {
    closeProject();
  }
}
