# rumbleroii.github.io

Personal site for Rithik Marudappa — [rumbleroii.github.io](https://rumbleroii.github.io).

A static single-page site: hand-written HTML, CSS and vanilla JavaScript, no build step and
no framework. Served straight from GitHub Pages off `main`.

## Stack

| | |
|---|---|
| Markup | `index.html` — one page, five sections |
| Styles | `style.css` — CSS custom properties for the palette, type and spacing |
| Behaviour | `main.js` — vanilla JS, no dependencies |
| Type | Instrument Serif + IBM Plex Mono, from Google Fonts |
| Dev server | Express (`server/server.js`), serves the folder and a small track API |
| Hosting | GitHub Pages, `main` / root, with `.nojekyll` so Jekyll is skipped |

## Running locally

```bash
npm install
npm start        # http://localhost:3000
```

`PORT` overrides the port.

## Layout

- `index.html` — the whole page
- `style.css` — all styling; `--max` at the top sets the column width
- `main.js` — vinyl-and-rain player: drops the needle, dims the page, and rains in time with
  the beat. Reads `data/tracks.json` through `/api/rain-sync` to calibrate per track
- `server/server.js` — static file serving plus `/api/tracks` and `/api/rain-sync`
- `data/tracks.json` — per-track BPM and rain tuning
- `audio/` — local tracks; `images/portrait.jpg` — the photo
- `deploy.ps1` — one-shot: authenticates `gh`, creates the repo if needed, pushes, enables Pages

## The vinyl button

Bottom-left. Click to drop the needle: the page dims and it rains. Track info appears bottom-right.
SoundCloud loads only on click, so the page stays light on first paint. Honours
`prefers-reduced-motion`.

## Caching

Assets are versioned by query string — `style.css?v=9`, `main.js?v=4`, `images/portrait.jpg?v=3`.
**Bump the `?v=` when you change an asset**, otherwise returning visitors keep the old copy.

## Deploying

Push to `main` and Pages builds it. From scratch, `deploy.ps1` handles it:

```powershell
.\deploy.ps1
```

If Pages isn't on yet: repo Settings → Pages → deploy from `main` / `(root)`.

## Notes

The resume links point at a Google Doc, not the `resume.pdf` sitting in this folder — that copy is
stale. Update the Doc, not the file.