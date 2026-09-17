# wev archive site

Static archive website for wev releases, projects, goods, licensing, live dates, and visual references.

GitHub Pages serves this repo from the `main` branch root.

## Private Imports

The website is static and must not read private source systems directly from the browser. Routebook and Spotify data are pulled by local/CI import scripts, then written into `data/archive.json` as sanitized public JSON.

Routebook import:

```sh
ROUTEBOOK_SHEET_ID="..." GOG_ACCOUNT=worldwidewev1@gmail.com node scripts/import-routebook.mjs
```

Only public date fields are emitted: `date`, `city`, `venue`, `status`, optional `tickets`, and optional `age`. The importer intentionally drops promoter contacts, guarantees, deal terms, internal notes, sheet URLs, and OAuth material.

Spotify catalog import:

```sh
SPOTIFY_CLIENT_ID="..." SPOTIFY_CLIENT_SECRET="..." node scripts/import-spotify-catalog.mjs
```

Spotify keys belong in the private runtime environment only. Do not commit them. BPMs, genre tags, mood tags, usage tags, and clearance notes should be merged through `data/catalog-overrides.json`, either manually or from a Notion export/API pull once Notion access is available.
