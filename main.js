document.getElementById("year").textContent = new Date().getFullYear();

const BASE_TITLE = "Rithik Marudappa";
let activeTitle = BASE_TITLE;

function setDocumentTitle(title) {
  activeTitle = title;
  if (!document.hidden) document.title = title;
}

document.addEventListener("visibilitychange", () => {
  document.title = document.hidden ? `👀 ${BASE_TITLE}` : activeTitle;
});

// ---- vinyl → rain + beats ----
const vinyl = document.getElementById("vinyl");
const dimEl = document.getElementById("dim");
const rainEl = document.getElementById("rain");
const nowPlaying = document.getElementById("now-playing");
const trackTitle = document.getElementById("track-title");
const scIframe = document.getElementById("sc-player");
const localAudio = document.getElementById("local-audio");

const DIM_DELAY_MS = 1000;

const DEFAULT_RAIN = {
  file: "audio/Test_3_KLICKAUD.mp3",
  displayTitle: "Treasure",
  artist: "riiithuu",
  soundcloudUrl: "https://soundcloud.com/corbyx/test-3",
  bpm: 78,
  beatMs: 60000 / 78,
  dropsPerBeat: 3,
  fallBeatsMin: 3,
  fallBeatsMax: 5,
  freqMin: 150,
  freqMax: 2800,
  energyThreshold: 1.2,
  energyBoost: 8,
  calibrationMs: 2000,
  phraseBeats: 32,
  pourBeats: 3,
  pourMultiplier: 7,
  drops: [],
};

let widget = null;
let widgetReady = false;
let raining = false;
let useLocalAudio = false;
let rainConfig = { ...DEFAULT_RAIN };
let lastBeatIndex = -1;
let lastSubPourAt = 0;
let dimTimeout = null;
let drizzleInterval = null;
let energyRaf = null;
let wasHot = false;
let energyRing = [];
let monitorStartedAt = 0;
let audioGraphReady = false;

let audioCtx = null;
let analyser = null;
let tracksCatalog = null;

function matchTrack(title, catalog) {
  const needle = (title || "").toLowerCase().trim();
  if (!needle) return null;
  return catalog.tracks.find((t) => needle.includes(t.title.toLowerCase())) || null;
}

function buildRainConfig(base, defaults) {
  const bpm = base.bpm ?? defaults.bpm;
  return {
    file: base.file ?? defaults.file ?? null,
    displayTitle: base.displayTitle ?? defaults.displayTitle ?? "riiithuu",
    artist: base.artist ?? defaults.artist ?? "corbyx",
    soundcloudUrl: base.soundcloudUrl ?? defaults.soundcloudUrl ?? null,
    bpm,
    beatMs: 60000 / bpm,
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

async function loadTracksCatalog() {
  if (tracksCatalog) return tracksCatalog;
  const res = await fetch("./data/tracks.json");
  if (!res.ok) throw new Error("tracks unavailable");
  tracksCatalog = await res.json();
  return tracksCatalog;
}

async function fetchRainConfig(title) {
  const base = { ...DEFAULT_RAIN };
  try {
    const catalog = await loadTracksCatalog();
    const matched = matchTrack(title, catalog);
    const merged = { ...catalog.default, ...(matched || {}) };
    return { ...base, ...buildRainConfig(merged, catalog.default) };
  } catch {
    return base;
  }
}

async function applyRainConfig(title) {
  rainConfig = await fetchRainConfig(title);
  useLocalAudio = Boolean(rainConfig.file);
  lastBeatIndex = -1;
  lastSubPourAt = 0;
  energyRing = [];
  wasHot = false;
  monitorStartedAt = 0;
}

function binRange() {
  const sr = audioCtx?.sampleRate ?? 44100;
  const binHz = sr / analyser.fftSize;
  const start = Math.max(1, Math.floor((rainConfig.freqMin ?? 150) / binHz));
  const end = Math.min(
    analyser.frequencyBinCount - 1,
    Math.ceil((rainConfig.freqMax ?? 2800) / binHz)
  );
  return { start, end };
}

function readMidEnergy(data) {
  const { start, end } = binRange();
  let sum = 0;
  for (let i = start; i <= end; i++) sum += data[i];
  return sum / (end - start + 1);
}

function getPourState(pos, beatIndex) {
  for (const drop of rainConfig.drops || []) {
    const end = drop.atMs + (drop.durationMs ?? 4000);
    if (pos >= drop.atMs && pos < end) {
      const justHit = pos - drop.atMs < rainConfig.beatMs;
      const mult = drop.multiplier ?? rainConfig.pourMultiplier;
      return {
        intensity: justHit ? mult : Math.ceil(mult * 0.65),
        isHit: justHit,
      };
    }
  }

  const phraseBeats = rainConfig.phraseBeats || 32;
  const pourBeats = rainConfig.pourBeats || 3;
  const posInPhrase = beatIndex % phraseBeats;

  if (posInPhrase >= pourBeats) return { intensity: 1, isHit: false };
  if (posInPhrase === 0) return { intensity: rainConfig.pourMultiplier, isHit: true };
  return { intensity: Math.ceil(rainConfig.pourMultiplier * 0.65), isHit: false };
}

function spawnDrop({ pour = false, intensity = 1 } = {}) {
  const beatSec = 60 / rainConfig.bpm;
  const hot = pour || intensity > 2;
  const fallBeats = hot
    ? (0.7 + Math.random() * 1.2) / Math.max(1, intensity * 0.2)
    : rainConfig.fallBeatsMin +
      Math.random() * (rainConfig.fallBeatsMax - rainConfig.fallBeatsMin);
  const duration = Math.max(0.3, beatSec * fallBeats);

  const drop = document.createElement("div");
  drop.className = hot || Math.random() > 0.75 ? "drop drop--fat" : "drop";
  if (hot) drop.classList.add("drop--pour");
  drop.style.left = Math.random() * 100 + "vw";
  drop.style.height = (hot ? 24 : 14) + Math.random() * (hot ? 42 : 28) + "px";
  drop.style.animationDuration = `${duration}s`;
  drop.style.opacity = hot ? 0.55 + Math.random() * 0.4 : 0.3 + Math.random() * 0.45;
  rainEl.appendChild(drop);
  drop.addEventListener("animationend", () => drop.remove());
}

function spawnBeatBurst(intensity = 1) {
  const count = Math.max(1, Math.round(rainConfig.dropsPerBeat * intensity));
  const stagger = intensity > 2 ? 12 : 48;
  for (let i = 0; i < count; i++) {
    setTimeout(() => spawnDrop({ pour: intensity > 2, intensity }), i * stagger);
  }
}

function pourWall(intensity) {
  const count = 30 + Math.round(intensity * 7);
  for (let i = 0; i < count; i++) {
    setTimeout(() => spawnDrop({ pour: true, intensity }), Math.random() * 200);
  }
}

function setupAudioGraph() {
  if (audioGraphReady) return;
  audioCtx = new AudioContext();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.55;

  const source = audioCtx.createMediaElementSource(localAudio);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  audioGraphReady = true;
}

function startEnergyMonitor() {
  stopEnergyMonitor();
  monitorStartedAt = performance.now();
  const data = new Uint8Array(analyser.frequencyBinCount);

  function tick() {
    if (!raining || !useLocalAudio) return;

    analyser.getByteFrequencyData(data);
    const energy = readMidEnergy(data);
    const calibrating = performance.now() - monitorStartedAt < (rainConfig.calibrationMs ?? 2000);

    energyRing.push(energy);
    if (energyRing.length > 40) energyRing.shift();

    const avg = energyRing.reduce((a, b) => a + b, 0) / energyRing.length || 1;
    const ratio = energy / avg;
    const hot = !calibrating && ratio > (rainConfig.energyThreshold ?? 1.2);
    const intensity = Math.min(rainConfig.energyBoost ?? 8, ratio * 2.5);

    if (hot) {
      if (!wasHot) pourWall(intensity);
      else if (Math.random() > 0.35) spawnBeatBurst(intensity * 0.6);
    }

    wasHot = hot;
    energyRaf = requestAnimationFrame(tick);
  }

  energyRaf = requestAnimationFrame(tick);

  drizzleInterval = setInterval(() => {
    if (!raining || wasHot) return;
    spawnBeatBurst(0.9);
  }, 700);
}

function stopEnergyMonitor() {
  if (energyRaf) cancelAnimationFrame(energyRaf);
  energyRaf = null;
  if (drizzleInterval) clearInterval(drizzleInterval);
  drizzleInterval = null;
  wasHot = false;
  energyRing = [];
  monitorStartedAt = 0;
}

function onPlayProgress() {
  if (!raining || !widget || useLocalAudio) return;

  widget.getPosition((pos) => {
    const beatIndex = Math.floor(pos / rainConfig.beatMs);
    const { intensity, isHit } = getPourState(pos, beatIndex);
    const pouring = intensity > 1;

    if (beatIndex !== lastBeatIndex) {
      lastBeatIndex = beatIndex;
      if (isHit) pourWall(intensity);
      spawnBeatBurst(intensity);
      return;
    }

    if (pouring && pos - lastSubPourAt > rainConfig.beatMs / 3) {
      lastSubPourAt = pos;
      spawnBeatBurst(intensity * 0.45);
    }
  });
}

function setNowPlaying(title, artist) {
  const url = rainConfig.soundcloudUrl;
  const suffix = ` — ${artist} · i also make beats :D`;
  if (url) {
    trackTitle.innerHTML = `<a href="${url}" target="_blank" rel="noopener">${title}</a>${suffix}`;
  } else {
    trackTitle.textContent = `${title}${suffix}`;
  }
  nowPlaying.hidden = false;
  nowPlaying.classList.add("is-visible");
  setDocumentTitle(`🌧️ ${title}`);
}

function initWidget() {
  if (widget || typeof SC === "undefined") return;
  widget = SC.Widget(scIframe);
  widget.bind(SC.Widget.Events.READY, () => {
    widgetReady = true;
  });
  widget.bind(SC.Widget.Events.PLAY, () => {});
  widget.bind(SC.Widget.Events.FINISH, () => {});
  widget.bind(SC.Widget.Events.PLAY_PROGRESS, onPlayProgress);
}

function scheduleDim() {
  clearTimeout(dimTimeout);
  dimTimeout = setTimeout(() => dimEl.classList.add("is-active"), DIM_DELAY_MS);
}

function startRain() {
  if (raining) return;
  raining = true;
  document.body.classList.add("is-playing");
  rainEl.classList.add("is-active");
  scheduleDim();
  spawnBeatBurst(0.9);
}

function stopRain() {
  raining = false;
  clearTimeout(dimTimeout);
  dimTimeout = null;
  document.body.classList.remove("is-playing");
  dimEl.classList.remove("is-active");
  rainEl.classList.remove("is-active");
  rainEl.innerHTML = "";
  stopEnergyMonitor();
}

function audioUrl(file) {
  return new URL(file, window.location.href).href;
}

function waitForAudioReady() {
  return new Promise((resolve, reject) => {
    if (localAudio.readyState >= 2) {
      resolve();
      return;
    }
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error("audio load failed"));
    };
    const cleanup = () => {
      localAudio.removeEventListener("canplay", onReady);
      localAudio.removeEventListener("error", onErr);
    };
    localAudio.addEventListener("canplay", onReady);
    localAudio.addEventListener("error", onErr);
  });
}

async function startLocalMusic() {
  setupAudioGraph();

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  const src = audioUrl(rainConfig.file);
  if (localAudio.src !== src) {
    localAudio.src = src;
    localAudio.load();
  }

  try {
    await waitForAudioReady();
    await localAudio.play();
  } catch (err) {
    console.error(err);
    trackTitle.textContent = `${rainConfig.displayTitle} — ${rainConfig.artist} (audio failed)`;
    nowPlaying.hidden = false;
    nowPlaying.classList.add("is-visible");
    return;
  }

  setNowPlaying(rainConfig.displayTitle, rainConfig.artist);
  startEnergyMonitor();
}

function startSoundCloudMusic() {
  initWidget();
  if (!widget) return;
  trackTitle.textContent = "loading…";
  const play = () => widget.play();
  if (widgetReady) play();
  else widget.bind(SC.Widget.Events.READY, play);
}

function stopMusic() {
  if (useLocalAudio) {
    localAudio.pause();
    localAudio.currentTime = 0;
  } else if (widget) {
    widget.pause();
  }
}

async function startMusic() {
  nowPlaying.hidden = false;
  nowPlaying.classList.add("is-visible");
  await applyRainConfig("");

  if (useLocalAudio) {
    await startLocalMusic();
  } else {
    trackTitle.textContent = "no local file — soundcloud fallback";
    startSoundCloudMusic();
  }
}

vinyl.addEventListener("click", async () => {
  const playing = vinyl.classList.toggle("is-playing");

  if (playing) {
    startRain();
    await startMusic();
  } else {
    stopRain();
    stopMusic();
    nowPlaying.classList.remove("is-visible");
    setTimeout(() => {
      nowPlaying.hidden = true;
      trackTitle.textContent = "—";
    }, 350);
    setDocumentTitle(BASE_TITLE);
  }
});

if (typeof SC !== "undefined") {
  initWidget();
} else {
  scIframe.addEventListener("load", initWidget);
}
