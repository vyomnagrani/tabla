const SOUND_FILES = {
  Hollow: "/assets/audio/tabla-single-hit-hollow.wav",
  High: "/assets/audio/tabla-single-hit-high.wav",
  Low: "/assets/audio/tabla-single-hit-low.wav",
  Full: "/assets/audio/tabla-single-hit-full.wav"
};

const state = {
  bpm: 60,
  pattern: [],
  loopLength: 16,
  savedBeats: [],
  isPlaying: false,
  currentBeat: 0,
  nextBeatAt: 0,
  schedulerTimer: null,
  audioContext: null,
  audioBuffers: {}
};

const els = {
  loopLength: document.getElementById("loopLength"),
  loopLengthValue: document.getElementById("loopLengthValue"),
  buildPattern: document.getElementById("buildPattern"),
  savedBeatSelect: document.getElementById("savedBeatSelect"),
  loadSaved: document.getElementById("loadSaved"),
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
  clear: document.getElementById("clear"),
  beatName: document.getElementById("beatName"),
  saveBeat: document.getElementById("saveBeat"),
  savedTableBody: document.getElementById("savedTableBody")
};

function beatDurationMs() {
  return (60 / state.bpm) * 1000;
}

function updateTempoDisplay() {
  els.bpmValue.textContent = String(state.bpm);
  els.bpsValue.textContent = (state.bpm / 60).toFixed(2);
  els.tempo.value = String(state.bpm);
}

function updateLoopLengthDisplay() {
  state.loopLength = Number(els.loopLength.value);
  els.loopLengthValue.textContent = String(state.loopLength);
  els.loopLength.value = String(state.loopLength);
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
  const length = state.loopLength;
  state.pattern = Array.from({ length }, () => null);
  state.currentBeat = 0;
  renderGrid();
  els.sequencer.classList.remove("hidden");
}

function renderSavedList() {
  if (!state.savedBeats.length) {
    els.savedBeatSelect.innerHTML = "<option value=''>No saved beats</option>";
    els.savedBeatSelect.disabled = true;
    els.savedTableBody.innerHTML = "<tr><td colspan='3' class='saved-empty'>No saved beats yet.</td></tr>";
    return;
  }

  els.savedBeatSelect.disabled = false;
  els.savedBeatSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select saved beat";
  els.savedBeatSelect.appendChild(placeholder);

  state.savedBeats.forEach((beat) => {
    const option = document.createElement("option");
    option.value = beat.id;
    option.textContent = beat.name;
    els.savedBeatSelect.appendChild(option);
  });

  els.savedTableBody.innerHTML = state.savedBeats
    .map((beat) => {
      return `<tr><td>${beat.name}</td><td>${beat.loopLength}</td><td>${beat.bpm} BPM</td></tr>`;
    })
    .join("");
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

function playSound(soundName) {
  const buffer = state.audioBuffers[soundName];
  if (!buffer || !state.audioContext) {
    return;
  }

  const source = state.audioContext.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = 1;

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
      playSound(assigned);
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
    playSound(soundName);
  } catch (error) {
    console.error(error);
  }
}

async function loadSavedBeats() {
  const response = await fetch("/api/saved-beats");
  if (!response.ok) {
    throw new Error("Could not load saved beats.");
  }

  const payload = await response.json();
  state.savedBeats = Array.isArray(payload.items) ? payload.items : [];
  renderSavedList();
}

async function saveCurrentBeat() {
  const name = els.beatName.value.trim();
  if (!name) {
    alert("Please provide a beat name before saving.");
    return;
  }

  if (!state.pattern.length) {
    alert("Create a beat pattern first.");
    return;
  }

  const response = await fetch("/api/saved-beats", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      loopLength: state.pattern.length,
      bpm: state.bpm,
      pattern: state.pattern
    })
  });

  if (!response.ok) {
    throw new Error("Could not save beat.");
  }

  const payload = await response.json();
  state.savedBeats = Array.isArray(payload.items) ? payload.items : [];
  // Re-read from disk-backed API so table and load list always reflect persisted state.
  await loadSavedBeats();
  els.beatName.value = "";
  renderSavedList();
}

function applySavedBeat(beatId) {
  const selected = state.savedBeats.find((beat) => beat.id === beatId);
  if (!selected) {
    return;
  }

  if (state.isPlaying) {
    stopPlayback();
  }

  state.loopLength = Math.max(1, Math.min(16, Number(selected.loopLength) || 1));
  state.pattern = Array.from({ length: state.loopLength }, (_, index) => {
    const value = selected.pattern?.[index] ?? null;
    return SOUND_FILES[value] ? value : null;
  });
  state.bpm = Math.max(30, Math.min(360, Number(selected.bpm) || 60));
  updateLoopLengthDisplay();
  updateTempoDisplay();
  renderGrid();
  els.sequencer.classList.remove("hidden");
}

function wireEvents() {
  els.buildPattern.addEventListener("click", () => {
    if (state.isPlaying) {
      stopPlayback();
    }
    state.loopLength = Number(els.loopLength.value);
    updateLoopLengthDisplay();
    createPattern();
  });

  els.loopLength.addEventListener("input", (event) => {
    state.loopLength = Number(event.target.value);
    updateLoopLengthDisplay();
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

  els.saveBeat.addEventListener("click", async () => {
    try {
      await saveCurrentBeat();
    } catch (error) {
      console.error(error);
      alert("Unable to save beat right now.");
    }
  });

  els.loadSaved.addEventListener("click", () => {
    const beatId = els.savedBeatSelect.value;
    if (!beatId) {
      return;
    }
    applySavedBeat(beatId);
  });

  window.addEventListener("beforeunload", () => {
    if (state.schedulerTimer) {
      clearTimeout(state.schedulerTimer);
    }
  });
}

async function init() {
  updateTempoDisplay();
  updateLoopLengthDisplay();
  createPalette();
  wireEvents();
  createPattern();
  try {
    await loadSavedBeats();
  } catch (error) {
    console.error(error);
    renderSavedList();
  }
}

init();