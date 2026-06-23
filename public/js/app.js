const SOUND_FILES = {
  Full: "/assets/audio/tabla-single-hit-full.wav",
  High: "/assets/audio/tabla-single-hit-high.wav",
  Low: "/assets/audio/tabla-single-hit-low.wav",
  Hollow: "/assets/audio/tabla-single-hit-hollow.wav"
};

const MAX_PLAYBACK_RATE = 4;

const state = {
  bpm: 60,
  pattern: [],
  isPlaying: false,
  currentBeat: 0,
  nextBeatAt: 0,
  schedulerTimer: null,
  audioContext: null,
  audioBuffers: {}
};

const els = {
  loopLength: document.getElementById("loopLength"),
  buildPattern: document.getElementById("buildPattern"),
  sequencer: document.getElementById("sequencer"),
  palette: document.getElementById("palette"),
  grid: document.getElementById("grid"),
  tempo: document.getElementById("tempo"),
  bpmValue: document.getElementById("bpmValue"),
  bpsValue: document.getElementById("bpsValue"),
  tempoUp: document.getElementById("tempoUp"),
  tempoDown: document.getElementById("tempoDown"),
  play: document.getElementById("play"),
  stop: document.getElementById("stop"),
  clear: document.getElementById("clear")
};

function beatDurationMs() {
  return (60 / state.bpm) * 1000;
}

function updateTempoDisplay() {
  els.bpmValue.textContent = String(state.bpm);
  els.bpsValue.textContent = (state.bpm / 60).toFixed(2);
  els.tempo.value = String(state.bpm);
}

function createPalette() {
  els.palette.innerHTML = "";

  Object.keys(SOUND_FILES).forEach((soundName) => {
    const chip = document.createElement("div");
    chip.className = "sound-chip";
    chip.textContent = soundName;
    chip.dataset.sound = soundName;
    chip.draggable = true;

    chip.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", soundName);
      event.dataTransfer.effectAllowed = "copy";
    });

    chip.addEventListener("click", () => previewSound(soundName));

    els.palette.appendChild(chip);
  });
}

function createPattern() {
  const length = Number(els.loopLength.value);
  state.pattern = Array.from({ length }, () => null);
  state.currentBeat = 0;
  renderGrid();
  els.sequencer.classList.remove("hidden");
}

function renderGrid(activeBeat = -1) {
  els.grid.innerHTML = "";

  state.pattern.forEach((sound, index) => {
    const beat = document.createElement("button");
    beat.type = "button";
    beat.className = `beat ${sound ? "" : "empty"} ${index === activeBeat ? "active" : ""}`.trim();
    beat.dataset.index = String(index);

    beat.innerHTML = `
      <span class="beat-index">Beat ${index + 1}</span>
      <span class="beat-sound">${sound ?? "(empty)"}</span>
    `;

    beat.addEventListener("dragover", (event) => {
      event.preventDefault();
      beat.classList.add("drag-over");
      event.dataTransfer.dropEffect = "copy";
    });

    beat.addEventListener("dragleave", () => {
      beat.classList.remove("drag-over");
    });

    beat.addEventListener("drop", (event) => {
      event.preventDefault();
      beat.classList.remove("drag-over");
      const soundName = event.dataTransfer?.getData("text/plain");

      if (!SOUND_FILES[soundName]) {
        return;
      }

      state.pattern[index] = soundName;
      renderGrid(state.isPlaying ? state.currentBeat : -1);
    });

    beat.addEventListener("click", () => {
      if (state.pattern[index] !== null) {
        state.pattern[index] = null;
        renderGrid(state.isPlaying ? state.currentBeat : -1);
      }
    });

    els.grid.appendChild(beat);
  });
}

async function ensureAudioReady() {
  if (!state.audioContext) {
    state.audioContext = new AudioContext();
  }

  if (state.audioContext.state !== "running") {
    await state.audioContext.resume();
  }

  if (Object.keys(state.audioBuffers).length > 0) {
    return;
  }

  const entries = await Promise.all(
    Object.entries(SOUND_FILES).map(async ([name, url]) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Unable to fetch sample: ${name}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);
      return [name, audioBuffer];
    })
  );

  state.audioBuffers = Object.fromEntries(entries);
}

function calcPlaybackRate(bufferDurationSec, beatDurationSec) {
  if (!beatDurationSec || beatDurationSec <= 0) {
    return 1;
  }

  const minimumRateToFit = bufferDurationSec / beatDurationSec;
  const rawRate = Math.max(1, minimumRateToFit);
  return Math.min(MAX_PLAYBACK_RATE, rawRate);
}

function playSound(soundName, beatDurationSec) {
  const buffer = state.audioBuffers[soundName];
  if (!buffer || !state.audioContext) {
    return;
  }

  const source = state.audioContext.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = calcPlaybackRate(buffer.duration, beatDurationSec);

  const gain = state.audioContext.createGain();
  gain.gain.value = 0.95;

  source.connect(gain);
  gain.connect(state.audioContext.destination);
  source.start();
}

function stopPlayback() {
  state.isPlaying = false;
  state.currentBeat = 0;

  if (state.schedulerTimer) {
    clearTimeout(state.schedulerTimer);
    state.schedulerTimer = null;
  }

  els.play.disabled = false;
  els.stop.disabled = true;
  renderGrid(-1);
}

function scheduleLoop() {
  if (!state.isPlaying) {
    return;
  }

  const beatMs = beatDurationMs();
  const now = performance.now();

  if (now >= state.nextBeatAt - 2) {
    const beatIndex = state.currentBeat;
    const assigned = state.pattern[beatIndex];

    renderGrid(beatIndex);

    if (assigned) {
      playSound(assigned, beatMs / 1000);
    }

    state.currentBeat = (beatIndex + 1) % state.pattern.length;
    state.nextBeatAt += beatMs;
  }

  const wait = Math.max(8, state.nextBeatAt - performance.now() - 2);
  state.schedulerTimer = setTimeout(scheduleLoop, wait);
}

async function startPlayback() {
  if (!state.pattern.length) {
    return;
  }

  await ensureAudioReady();

  state.isPlaying = true;
  state.nextBeatAt = performance.now() + 80;
  els.play.disabled = true;
  els.stop.disabled = false;

  scheduleLoop();
}

function setTempo(nextBpm) {
  state.bpm = Math.max(30, Math.min(360, Math.round(nextBpm)));
  updateTempoDisplay();

  if (state.isPlaying) {
    // Re-anchor next tick so changes are heard immediately on upcoming hits.
    state.nextBeatAt = performance.now() + beatDurationMs();
  }
}

async function previewSound(soundName) {
  try {
    await ensureAudioReady();
    playSound(soundName, beatDurationMs() / 1000);
  } catch (error) {
    console.error(error);
  }
}

function wireEvents() {
  els.buildPattern.addEventListener("click", () => {
    if (state.isPlaying) {
      stopPlayback();
    }
    createPattern();
  });

  els.play.addEventListener("click", async () => {
    try {
      await startPlayback();
    } catch (error) {
      alert("Audio could not start. Click again after interacting with the page.");
      console.error(error);
    }
  });

  els.stop.addEventListener("click", stopPlayback);

  els.clear.addEventListener("click", () => {
    state.pattern = state.pattern.map(() => null);
    renderGrid(state.isPlaying ? state.currentBeat : -1);
  });

  els.tempo.addEventListener("input", (event) => {
    setTempo(Number(event.target.value));
  });

  els.tempoUp.addEventListener("click", () => setTempo(state.bpm + 5));
  els.tempoDown.addEventListener("click", () => setTempo(state.bpm - 5));

  window.addEventListener("beforeunload", () => {
    if (state.schedulerTimer) {
      clearTimeout(state.schedulerTimer);
    }
  });
}

function init() {
  updateTempoDisplay();
  createPalette();
  wireEvents();
  createPattern();
}

init();