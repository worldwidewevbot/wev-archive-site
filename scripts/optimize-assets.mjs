#!/usr/bin/env node
/**
 * Optimizes images in assets/ to web-friendly sizes.
 *
 * - Resizes to max 1400px wide, JPEG Q82
 * - Generates assets/thumbs/ at 600px (for grid view)
 * - Stores tiny placeholder data URIs in archive.json (for blur-up loading)
 * - Outputs everything as .jpg; updates archive.json paths if needed
 *
 * Run: node scripts/optimize-assets.mjs
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from "fs";
import { readdirSync } from "fs";
import { rename } from "fs/promises";
import path from "path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const ASSETS = path.join(ROOT, "assets");
const THUMBS = path.join(ASSETS, "thumbs");
const ARCHIVE_PATH = path.join(ROOT, "data", "archive.json");

mkdirSync(THUMBS, { recursive: true });

const SKIP_PREFIXES = ["placeholder", "w64", "wev-logo"];
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const files = readdirSync(ASSETS).filter((f) => {
  const ext = path.extname(f).toLowerCase();
  return IMAGE_EXTS.has(ext) && !SKIP_PREFIXES.some((p) => f.startsWith(p));
});

console.log(`Processing ${files.length} images...\n`);

const renames = {}; // old relative path → new relative path (when .png → .jpg)
const placeholders = {}; // relative path (final) → data URI

for (const file of files) {
  const srcPath = path.join(ASSETS, file);
  const ext = path.extname(file).toLowerCase();
  const base = file.slice(0, -ext.length);
  const outName = base + ".jpg";
  const outPath = path.join(ASSETS, outName);
  const thumbPath = path.join(THUMBS, outName);
  const originalSize = statSync(srcPath).size;

  // --- Full-size optimized JPEG ---
  const skipFull = ext === ".jpg" && originalSize < 400_000 && !existsSync(outPath + ".skip");
  if (!skipFull) {
    const tmpPath = outPath + ".tmp";
    await sharp(srcPath)
      .resize({ width: 1400, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(tmpPath);

    const newSize = statSync(tmpPath).size;
    const saved = Math.round((1 - newSize / originalSize) * 100);

    // Atomic swap: rename tmp → final
    await rename(tmpPath, outPath);

    // If source was PNG and we created a new .jpg, remove the PNG
    if (ext !== ".jpg" && srcPath !== outPath) {
      unlinkSync(srcPath);
      renames["assets/" + file] = "assets/" + outName;
    }

    console.log(`  [full] ${file} → ${outName}  ${Math.round(originalSize / 1024)}KB → ${Math.round(newSize / 1024)}KB (${saved}% saved)`);
  } else {
    console.log(`  [skip] ${file} already small`);
  }

  // After potential PNG→JPG conversion, always read from outPath
  const readFrom = outPath;

  // --- Thumbnail ---
  if (!existsSync(thumbPath)) {
    await sharp(readFrom)
      .resize({ width: 600, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(thumbPath);
    const thumbSize = statSync(thumbPath).size;
    console.log(`  [thumb] ${outName}  ${Math.round(thumbSize / 1024)}KB`);
  }

  // --- Placeholder (20px, for blur-up) ---
  const placeholderBuf = await sharp(readFrom)
    .resize({ width: 20 })
    .jpeg({ quality: 15 })
    .toBuffer();
  placeholders["assets/" + outName] = `data:image/jpeg;base64,${placeholderBuf.toString("base64")}`;
}

// Patch archive.json: fix renamed paths + store placeholders
const archive = JSON.parse(readFileSync(ARCHIVE_PATH, "utf8"));

function patchPath(p) {
  if (!p) return p;
  return renames[p] || p;
}

for (const item of archive.items) {
  item.image = patchPath(item.image);
  if (item.gallery) item.gallery = item.gallery.map(patchPath);
  const imgKey = item.image;
  if (imgKey && placeholders[imgKey]) item.placeholder = placeholders[imgKey];
}

writeFileSync(ARCHIVE_PATH, JSON.stringify(archive, null, 2) + "\n");

console.log(`\nDone.`);
console.log(`  ${Object.keys(renames).length} paths renamed in archive.json`);
console.log(`  ${Object.keys(placeholders).length} placeholders generated`);
