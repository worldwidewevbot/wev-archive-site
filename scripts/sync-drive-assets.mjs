#!/usr/bin/env node
// Syncs files from Google Drive /website folder to assets/
// Run: node scripts/sync-drive-assets.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createWriteStream } from "node:fs";

const TOKEN_PATH = process.env.HOME + "/.openclaw/secrets/gmail-token.json";
const CREDS_PATH = process.env.HOME + "/.openclaw/secrets/gmail-credentials.json";
const FOLDER_ID = "1FSCcrgivsP2KmquTWVEGiUroIHPouO-x";
const ASSETS_DIR = path.resolve(new URL("..", import.meta.url).pathname, "assets");

async function refreshToken(token, creds) {
  const { client_id, client_secret } = creds.installed || creds.web;
  if (!token.refresh_token) return token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token.refresh_token, client_id, client_secret }).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error("Token refresh failed: " + data.error);
  const updated = { ...token, access_token: data.access_token, expires_in: data.expires_in };
  writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
  return updated;
}

async function driveGet(accessToken, url) {
  const r = await fetch(url, { headers: { authorization: "Bearer " + accessToken } });
  if (!r.ok) throw new Error("Drive API error: " + r.status + " " + url);
  return r.json();
}

async function downloadFile(accessToken, fileId, destPath) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { authorization: "Bearer " + accessToken },
  });
  if (!r.ok) throw new Error("Download failed: " + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(destPath, buf);
}

const creds = JSON.parse(readFileSync(CREDS_PATH, "utf8"));
let token = JSON.parse(readFileSync(TOKEN_PATH, "utf8"));
token = await refreshToken(token, creds);

const q = encodeURIComponent(`'${FOLDER_ID}' in parents and trashed=false`);
const data = await driveGet(token.access_token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size)&orderBy=name&pageSize=200`);

const files = (data.files || []).filter(f => f.mimeType !== "application/vnd.google-apps.folder");
console.log(`Found ${files.length} file(s) in Drive /website folder`);

let downloaded = 0;
for (const file of files) {
  const dest = path.join(ASSETS_DIR, file.name);
  if (existsSync(dest)) {
    console.log(`  skip (exists): ${file.name}`);
    continue;
  }
  await downloadFile(token.access_token, file.id, dest);
  console.log(`  downloaded: ${file.name} (${Math.round(file.size / 1024)}KB)`);
  downloaded++;
}

console.log(`\nDone. Downloaded ${downloaded} new file(s) to assets/`);
