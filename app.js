const state = {
  filter: "all",
  page: "archive",
  openProjectId: null,
  data: null
};

const els = {
  filterBar: document.querySelector(".filter-bar"),
  archiveList: document.querySelector(".archive-list"),
  projectPanel: document.querySelector(".project-panel"),
  videoList: document.querySelector(".video-list"),
  mobileFeatureVideo: document.querySelector(".mobile-feature-video"),
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
  const { site, filters, items, videos, dates, licensing } = state.data;
  els.tagline.textContent = site.tagline;
  els.licensingIntro.textContent = licensing.intro;
  renderFilters(filters);
  renderItems(items);
  renderVideos(videos);
  renderMobileFeatureVideo(videos[0]);
  renderDates(dates);
  renderTracks(licensing.tracks);
  renderPage();
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
        renderItems(state.data.items);
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

function renderItem(item) {
  const article = document.createElement("article");
  article.className = "archive-item";
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
        <div class="link-row">
          ${item.links.map((link) => renderLink(link, item)).join("")}
        </div>
        <div class="tag-row">
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

function renderMobileFeatureVideo(video) {
  if (!video || !els.mobileFeatureVideo) return;

  const embedUrl = createYoutubeEmbedUrl(video);
  els.mobileFeatureVideo.innerHTML = `
    <iframe class="video-embed" src="${escapeAttribute(embedUrl.href)}" title="${escapeAttribute(video.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    <a class="video-link" href="${escapeAttribute(video.url)}" target="_blank" rel="noreferrer">
      <span>${escapeHtml(video.title)}</span>
      <small>${escapeHtml(video.caption)} / open on youtube</small>
    </a>
  `;
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
  const item = state.data.items.find((entry) => entry.id === id);
  if (!item || !item.project) return;

  state.openProjectId = id;
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
        <div class="link-row">
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
  const requested = window.location.hash === "#licensing" ? "licensing" : "archive";
  state.page = requested;
  document.querySelectorAll(".page-view").forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === state.page);
  });
  if (state.page === "archive" && state.openProjectId) {
    openProject(state.openProjectId);
  }
}

initMotionStage();

async function initMotionStage() {
  const canvas = document.querySelector("#motion-canvas");
  if (!canvas) return;
  if (window.matchMedia("(max-width: 900px)").matches) return;

  const THREE = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js");
  const { MTLLoader } = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/MTLLoader.js");
  const { OBJLoader } = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/three@0.166.1/examples/jsm/loaders/OBJLoader.js");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const group = new THREE.Group();
  scene.add(group);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xf2f2f2, 2.2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(4, 5, 7);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xc8ff42, 1.2);
  rimLight.position.set(-4, -2, 5);
  scene.add(rimLight);

  const loadingMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.4, 2.4),
    new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: true })
  );
  group.add(loadingMesh);

  try {
    const materialLoader = new MTLLoader();
    materialLoader.setPath("assets/");
    const materials = await materialLoader.loadAsync("w64.mtl");
    materials.preload();

    const objectLoader = new OBJLoader();
    objectLoader.setMaterials(materials);
    objectLoader.setPath("assets/");
    const object = await objectLoader.loadAsync("w64.obj");
    fitObjectToStage(object, THREE);
    group.remove(loadingMesh);
    group.add(object);
  } catch (error) {
    console.error("Model failed to load", error);
  }

  const drag = {
    active: false,
    x: 0,
    y: 0,
    rotationX: 0,
    rotationY: 0,
    targetX: -0.18,
    targetY: 0.42
  };

  group.rotation.x = drag.targetX;
  group.rotation.y = drag.targetY;

  const beginDrag = (event) => {
    drag.active = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    if (!drag.active) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.targetY += deltaX * 0.01;
    drag.targetX += deltaY * 0.01;
    drag.targetX = THREE.MathUtils.clamp(drag.targetX, -1.35, 1.35);
  };

  const endDrag = (event) => {
    drag.active = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  canvas.addEventListener("pointerdown", beginDrag);
  canvas.addEventListener("pointermove", moveDrag);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  const motionButton = document.querySelector(".motion-button");
  const handleOrientation = (event) => {
    if (drag.active) return;
    drag.targetY = THREE.MathUtils.clamp((event.gamma || 0) / 35, -1, 1) * 0.8;
    drag.targetX = THREE.MathUtils.clamp((event.beta || 0) / 55, -1, 1) * 0.7;
  };

  if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === "function") {
    motionButton.hidden = false;
    motionButton.addEventListener("click", async () => {
      const permission = await window.DeviceOrientationEvent.requestPermission();
      if (permission === "granted") {
        window.addEventListener("deviceorientation", handleOrientation);
        motionButton.hidden = true;
      }
    });
  } else if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", handleOrientation);
  }

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  const tick = () => {
    drag.rotationX += (drag.targetX - drag.rotationX) * 0.12;
    drag.rotationY += (drag.targetY - drag.rotationY) * 0.12;
    group.rotation.x = drag.rotationX;
    group.rotation.y = drag.rotationY;
    if (!drag.active) {
      drag.targetY += 0.0018;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  tick();
}

function fitObjectToStage(object, THREE) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  const scale = maxAxis > 0 ? 4.6 / maxAxis : 1;

  object.position.sub(center);
  object.scale.setScalar(scale);
  object.rotation.z = -0.08;

  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      });
    }
  });
}
