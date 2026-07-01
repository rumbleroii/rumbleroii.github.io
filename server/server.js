const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const root = path.join(__dirname, "..");
const tracksPath = path.join(root, "data", "tracks.json");

function loadTracks() {
  return JSON.parse(fs.readFileSync(tracksPath, "utf8"));
}

function matchTrack(title, catalog) {
  const needle = (title || "").toLowerCase().trim();
  if (!needle) return null;
  return catalog.tracks.find((t) => needle.includes(t.title.toLowerCase())) || null;
}

function buildRainConfig(base, defaults) {
  const bpm = base.bpm ?? defaults.bpm;
  const beatMs = 60000 / bpm;

  return {
    file: base.file ?? defaults.file ?? null,
    displayTitle: base.displayTitle ?? defaults.displayTitle ?? "riiithuu",
    artist: base.artist ?? defaults.artist ?? "corbyx",
    soundcloudUrl: base.soundcloudUrl ?? defaults.soundcloudUrl ?? null,
    bpm,
    beatMs,
    dropsPerBeat: base.dropsPerBeat ?? defaults.dropsPerBeat ?? 2,
    fallBeatsMin: base.fallBeatsMin ?? defaults.fallBeatsMin ?? 3,
    fallBeatsMax: base.fallBeatsMax ?? defaults.fallBeatsMax ?? 5,
    freqMin: base.freqMin ?? defaults.freqMin ?? 150,
    freqMax: base.freqMax ?? defaults.freqMax ?? 2800,
    energyThreshold: base.energyThreshold ?? defaults.energyThreshold ?? 1.2,
    energyBoost: base.energyBoost ?? defaults.energyBoost ?? 8,
    calibrationMs: base.calibrationMs ?? defaults.calibrationMs ?? 2000,
    phraseBeats: base.phraseBeats ?? defaults.phraseBeats ?? 32,
    pourBeats: base.pourBeats ?? defaults.pourBeats ?? 3,
    pourMultiplier: base.pourMultiplier ?? defaults.pourMultiplier ?? 7,
    drops: base.drops ?? defaults.drops ?? [],
  };
}

app.get("/api/rain-sync", (req, res) => {
  const catalog = loadTracks();
  const matched = matchTrack(req.query.title, catalog);
  const merged = { ...catalog.default, ...(matched || {}) };
  const config = buildRainConfig(merged, catalog.default);

  res.json({
    ...config,
    matched: Boolean(matched),
    track: matched?.title || null,
  });
});

app.get("/api/tracks", (_req, res) => {
  res.json(loadTracks());
});

app.use(express.static(root));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`portfolio → http://localhost:${port}`);
});
