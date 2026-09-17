#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const ARCHIVE_PATH = path.join(ROOT, "data", "archive.json");
const SHEET_ID = process.env.ROUTEBOOK_SHEET_ID;
const GOG_ACCOUNT = process.env.GOG_ACCOUNT || "worldwidewev1@gmail.com";
const YEARS = (process.env.ROUTEBOOK_YEARS || "2026,2027")
  .split(",")
  .map((year) => year.trim())
  .filter(Boolean);

if (!SHEET_ID) {
  throw new Error("Set ROUTEBOOK_SHEET_ID in the private environment before importing tour dates.");
}

const STATUS_LABELS = {
  C: "confirmed",
  T: "tentative",
  H: "hold"
};

const PUBLIC_STATUSES = new Set(Object.keys(STATUS_LABELS));

function readSheet(year) {
  const range = `${year}!A1:AH1000`;
  const output = execFileSync(
    "gog",
    ["sheets", "get", SHEET_ID, range, "--json", "--account", GOG_ACCOUNT],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  return JSON.parse(output).values || [];
}

function parseDate(value, year) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, rowYear] = match;
  if (rowYear !== String(year)) return null;
  return `${rowYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function eventFromRow(row, year) {
  const date = parseDate(row[1], year);
  const statusCode = clean(row[2]).toUpperCase();
  const city = clean(row[3]);
  const venue = clean(row[5]);

  if (!date || !city || !venue || !PUBLIC_STATUSES.has(statusCode)) return null;

  const tickets = clean(row[8]);
  const age = clean(row[15]);
  const event = {
    date,
    city,
    venue,
    status: STATUS_LABELS[statusCode]
  };

  if (tickets && tickets.toUpperCase() !== "TBD") event.tickets = tickets;
  if (age && age.toUpperCase() !== "TBD") event.age = age;

  return event;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const dates = YEARS.flatMap((year) => readSheet(year).slice(3).map((row) => eventFromRow(row, year)))
  .filter(Boolean)
  .filter((event) => new Date(`${event.date}T12:00:00`) >= today)
  .sort((a, b) => a.date.localeCompare(b.date));

const archive = JSON.parse(readFileSync(ARCHIVE_PATH, "utf8"));
archive.dates = dates;
writeFileSync(ARCHIVE_PATH, `${JSON.stringify(archive, null, 2)}\n`);

console.log(`Imported ${dates.length} public tour dates from ${YEARS.join(", ")}.`);
