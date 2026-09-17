#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const ARCHIVE_PATH = path.join(ROOT, "data", "archive.json");
const OVERRIDES_PATH = path.join(ROOT, "data", "catalog-overrides.json");
const ARTIST_ID = process.env.SPOTIFY_ARTIST_ID || "1KpEYlQPQN64r0aRE9Wg6i";
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  throw new Error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in the private environment before importing the catalog.");
}

async function spotifyToken() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) throw new Error(`Spotify token request failed: ${response.status}`);
  return (await response.json()).access_token;
}

async function spotifyGet(token, url) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Spotify API request failed: ${response.status} ${url}`);
  return response.json();
}

async function getAll(token, url) {
  const items = [];
  let next = url;
  while (next) {
    const page = await spotifyGet(token, next);
    items.push(...(page.items || []));
    next = page.next;
  }
  return items;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function msToDuration(ms) {
  if (!ms) return "tbd";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function loadOverrides() {
  if (!existsSync(OVERRIDES_PATH)) return {};
  return JSON.parse(readFileSync(OVERRIDES_PATH, "utf8"));
}

function overrideFor(overrides, track, album) {
  return overrides[track.id] || overrides[track.name] || overrides[`${album.name}::${track.name}`] || {};
}

const token = await spotifyToken();
const albums = await getAll(
  token,
  `https://api.spotify.com/v1/artists/${ARTIST_ID}/albums?include_groups=album,single,appears_on,compilation&market=US&limit=50`
);

const uniqueAlbums = [...new Map(albums.map((album) => [album.id, album])).values()]
  .sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")));
const overrides = loadOverrides();
const tracks = [];

for (const album of uniqueAlbums) {
  const albumTracks = await getAll(token, `https://api.spotify.com/v1/albums/${album.id}/tracks?market=US&limit=50`);
  for (const track of albumTracks) {
    const custom = overrideFor(overrides, track, album);
    const artistNames = (track.artists || []).map((artist) => artist.name);
    if (!artistNames.some((name) => name.toLowerCase() === "wev")) continue;
    tracks.push({
      id: custom.id || track.id || `${slug(album.name)}-${slug(track.name)}`,
      source: custom.source || "published",
      artist: artistNames.join(", ") || "wev",
      release: album.name,
      releaseDate: album.release_date || "",
      title: track.name,
      duration: custom.duration || msToDuration(track.duration_ms),
      bpm: custom.bpm ?? null,
      tags: custom.tags || [],
      moods: custom.moods || [],
      uses: custom.uses || [],
      status: custom.status || "clearable",
      notes: custom.notes || "",
      spotifyUrl: track.external_urls?.spotify || album.external_urls?.spotify || "",
      artwork: album.images?.[0]?.url || ""
    });
  }
}

const archive = JSON.parse(readFileSync(ARCHIVE_PATH, "utf8"));
archive.licensing.tracks = [...new Map(tracks.map((track) => [track.id, track])).values()];
writeFileSync(ARCHIVE_PATH, `${JSON.stringify(archive, null, 2)}\n`);

console.log(`Imported ${archive.licensing.tracks.length} Spotify catalog tracks.`);
