import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const ARCHIVE_PATH = path.join(ROOT, "data", "archive.json");
const CLIENT_ID = "e959659748cb4ee4b923c391bff2f4f5";
const CLIENT_SECRET = "07d4e98ca63440f19ac393f91c77b6dd";
const ARTIST_ID = "1KpEYlQPQN64r0aRE9Wg6i";

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function spotifyToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { authorization: `Basic ${credentials}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  return (await res.json()).access_token;
}

async function getAll(token, url) {
  const items = [];
  let next = url;
  while (next) {
    const res = await fetch(next, { headers: { authorization: `Bearer ${token}` } });
    const data = await res.json();
    items.push(...(data.items || []));
    next = data.next;
  }
  return items;
}

const token = await spotifyToken();
const albums = await getAll(token, `https://api.spotify.com/v1/artists/${ARTIST_ID}/albums?include_groups=album,single,appears_on,compilation&market=US&limit=50`);

// Build lookup by normalized name
const albumByNorm = new Map();
const albumByNormShort = new Map();
for (const a of albums) {
  albumByNorm.set(norm(a.name), a);
  // Also map just first word for partial matches
  const firstWord = norm(a.name).slice(0, 8);
  if (!albumByNormShort.has(firstWord)) albumByNormShort.set(firstWord, a);
}

function findAlbum(title) {
  const n = norm(title);
  if (albumByNorm.has(n)) return albumByNorm.get(n);
  // Try substring match
  for (const [key, album] of albumByNorm) {
    if (n.includes(key) || key.includes(n)) return album;
  }
  return null;
}

// Manual overrides for items where title doesn't match Spotify album name
const manualMatches = {
  "HERO EP": "hero",
  "feel everything EP (w/ nick.am)": "feel everything",
  "feel everything (remixes)": "feel everything (remixes)",
  "technobody (w/ djhoodboi)": null, // not on Spotify as own release
  "technobody remix pack": "technobody (Remixes)",
  "tek it (wev remix) for cafune": "Tek It (wev Remix)",
  "mazeworld (wev remix) for nextdimensional": "mazeworld remixes",
  "SPECTRUM (w/ sc.ruz)": "SPECTRUM",
  "watchyaback!": "watchyaback!",
  "start something EP": "start something EP",
  "shiki no uta (wev edit)": null,
  "remix for fifi zhang x": null,
  "walk2me (w/ nick.am)": "feel everything",
  "second nick.am single": "feel everything",
  "deep pockets dub": "feel everything",
  "powerstar": "feel everything",
  "gotsmoke": "feel everything",
  "savestate (wev's metro acid mix) for boy.2ooo": null,
  "2manychain$": null,
  "pinkpantheress edit": null,
  "dawn (w/ laurenfaith)": null,
  "e4rfquake edit": null,
  "OUT OF MY MIND (feat. birocratic + revvtheband)": null,
  "timesup! (w/ carbike000)": "timesup!",
  "acid in tokyo (feat. yinyo_tyo)": null, // iTunes has it, not Spotify as album
  "TECHNOCHRONIC (feat. yoshitee_)": "TECHNOCHRONIC",
  "GET W THIS": "GET W THIS",
  "OST": "OST",
};

// Enrichment data for placements and notable items
const enrichmentData = {
  "Bomb Rush Cyberfunk (Team Reptile)": {
    description: "wev contributed original music to Bomb Rush Cyberfunk, the acclaimed Jet Set Radio-inspired game by Team Reptile released in 2023. The track 'get w this' appears in the official soundtrack.",
    links: [
      { label: "Team Reptile", url: "https://www.teamreptile.com/" },
      { label: "Steam", url: "https://store.steampowered.com/app/1353230/Bomb_Rush_Cyberfunk/" },
    ],
    image: "https://cdn.cloudflare.steamstatic.com/steam/apps/1353230/header.jpg",
  },
  "Forbes feature": {
    description: "Forbes coverage of wev's rise in electronic music and creative approach.",
    links: [],
  },
  "Highsnobiety x adidas — 'hot'": {
    description: "'hot' was licensed for a Highsnobiety x adidas campaign.",
    links: [{ label: "highsnobiety.com", url: "https://www.highsnobiety.com" }],
  },
  "Rocket League — wev flag in-game": {
    description: "wev received an in-game flag in Rocket League, added by the community as recognition of his presence in the game's music scene.",
    links: [{ label: "Rocket League", url: "https://www.rocketleague.com" }],
  },
  "Paralympics x Toyota animation sync": {
    description: "wev's music was synced to a Toyota animation produced for the Paralympics.",
    links: [],
  },
};

const archive = JSON.parse(readFileSync(ARCHIVE_PATH, "utf8"));
let updated = 0;
let artworkAdded = 0;
let linksAdded = 0;

for (const item of archive.items) {
  let changed = false;

  // --- RELEASES: match to Spotify album ---
  if (item.type === "releases") {
    let album = null;
    if (manualMatches.hasOwnProperty(item.title)) {
      const matchName = manualMatches[item.title];
      if (matchName) album = albumByNorm.get(norm(matchName));
    } else {
      album = findAlbum(item.title);
    }

    if (album) {
      // Set artwork if it's a placeholder
      if (album.images?.[0]?.url && (!item.image || item.image.includes("placeholder"))) {
        item.image = album.images[0].url;
        artworkAdded++;
        changed = true;
      }

      // Add Spotify link if not present
      const spotifyUrl = album.external_urls?.spotify;
      if (spotifyUrl) {
        const hasSpotify = (item.links || []).some(l => l.url && l.url.includes("spotify.com"));
        if (!hasSpotify) {
          item.links = item.links || [];
          item.links.push({ label: "spotify", url: spotifyUrl });
          linksAdded++;
          changed = true;
        }
      }

      // Update project links too
      if (item.project) {
        const spotifyInProject = (item.project.links || []).some(l => l.url && l.url.includes("spotify.com"));
        if (!spotifyInProject && spotifyUrl) {
          item.project.links = item.project.links || [];
          item.project.links.push({ label: "spotify", url: spotifyUrl });
        }
      }
    }
  }

  // --- PLACEMENTS: apply enrichment data ---
  if (item.type === "placements" && enrichmentData[item.title]) {
    const e = enrichmentData[item.title];
    if (e.image && (!item.image || item.image.includes("placeholder"))) {
      item.image = e.image;
      artworkAdded++;
      changed = true;
    }
    if (e.description && (!item.description || item.description.length < 50)) {
      item.description = e.description;
      if (item.project) item.project.body = [e.description, ...(item.project.body || []).filter(b => !b.includes("Source-ready"))];
      changed = true;
    }
    if (e.links?.length) {
      for (const link of e.links) {
        const exists = (item.links || []).some(l => l.url === link.url);
        if (!exists) {
          item.links = item.links || [];
          item.links.push(link);
          if (item.project) { item.project.links = item.project.links || []; item.project.links.push(link); }
          linksAdded++;
        }
      }
      changed = true;
    }
  }

  if (changed) updated++;
}

// Also match licensing tracks artwork to remaining placeholder release items
const tracksByRelease = new Map();
for (const t of archive.licensing.tracks) {
  if (t.artwork && !tracksByRelease.has(norm(t.release))) {
    tracksByRelease.set(norm(t.release), t);
  }
}
for (const item of archive.items) {
  if (item.type === "releases" && (!item.image || item.image.includes("placeholder"))) {
    const match = tracksByRelease.get(norm(item.title));
    if (match?.artwork) {
      item.image = match.artwork;
      if (match.spotifyUrl) {
        const hasSpotify = (item.links || []).some(l => l.url && l.url.includes("spotify.com"));
        if (!hasSpotify) item.links.push({ label: "spotify", url: match.spotifyUrl });
      }
      artworkAdded++;
      updated++;
    }
  }
}

writeFileSync(ARCHIVE_PATH, `${JSON.stringify(archive, null, 2)}\n`);
console.log(`Updated ${updated} items. Artwork added: ${artworkAdded}. Links added: ${linksAdded}.`);

// Summary of remaining placeholders
const remaining = archive.items.filter(i => !i.image || i.image.includes("placeholder"));
console.log(`\nStill using placeholder images: ${remaining.length}`);
remaining.forEach(i => console.log(" ", i.type, "|", i.title));
