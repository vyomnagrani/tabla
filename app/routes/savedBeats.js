const fs = require("fs");
const path = require("path");
const express = require("express");

const router = express.Router();
const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "saved-beats.json");

function ensureDataStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, "[]", "utf8");
  }
}

function readItems() {
  ensureDataStore();
  const raw = fs.readFileSync(dataFile, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeItems(items) {
  ensureDataStore();
  fs.writeFileSync(dataFile, JSON.stringify(items, null, 2), "utf8");
}

router.get("/", (req, res) => {
  const items = readItems();
  res.status(200).json({ items });
});

router.post("/", (req, res) => {
  const { name, loopLength, bpm, pattern } = req.body || {};

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "A beat name is required." });
  }

  if (!Array.isArray(pattern)) {
    return res.status(400).json({ error: "Pattern must be an array." });
  }

  const normalizedLoopLength = Math.max(1, Math.min(16, Number(loopLength) || 1));
  const normalizedBpm = Math.max(30, Math.min(360, Number(bpm) || 60));
  const allowedSounds = new Set(["Full", "High", "Low", "Hollow", null]);

  const normalizedPattern = Array.from({ length: normalizedLoopLength }, (_, index) => {
    const value = pattern[index] ?? null;
    return allowedSounds.has(value) ? value : null;
  });

  const items = readItems();
  const next = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim().slice(0, 80),
    loopLength: normalizedLoopLength,
    bpm: normalizedBpm,
    pattern: normalizedPattern,
    createdAt: new Date().toISOString()
  };

  items.unshift(next);
  writeItems(items.slice(0, 200));

  res.status(201).json({ items: items.slice(0, 200) });
});

module.exports = router;
