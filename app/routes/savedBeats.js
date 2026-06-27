const express = require("express");
const { readItems, writeItems } = require("../services/savedBeatsStore");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const items = await readItems();
    res.status(200).json({ items });
  } catch (error) {
    console.error("Failed to load saved beats:", error);
    res.status(500).json({ error: "Could not load saved beats." });
  }
});

router.post("/", async (req, res) => {
  const { name, loopLength, bpm, pattern } = req.body || {};

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "A beat name is required." });
  }

  if (!Array.isArray(pattern)) {
    return res.status(400).json({ error: "Pattern must be an array." });
  }

  const trimmedName = name.trim().slice(0, 80);
  if (!trimmedName) {
    return res.status(400).json({ error: "A beat name is required." });
  }

  const normalizedLoopLength = Math.max(1, Math.min(16, Number(loopLength) || 1));
  const normalizedBpm = Math.max(30, Math.min(960, Number(bpm) || 60));
  const allowedSounds = new Set(["Full", "High", "Low", "Hollow", null]);

  const normalizedPattern = Array.from({ length: normalizedLoopLength }, (_, index) => {
    const value = pattern[index] ?? null;
    return allowedSounds.has(value) ? value : null;
  });

  try {
    const items = await readItems();
    const next = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      loopLength: normalizedLoopLength,
      bpm: normalizedBpm,
      pattern: normalizedPattern,
      createdAt: new Date().toISOString()
    };

    const updatedItems = [next, ...items].slice(0, 200);
    await writeItems(updatedItems);

    res.status(201).json({ items: updatedItems });
  } catch (error) {
    console.error("Failed to save beat:", error);
    res.status(500).json({ error: "Could not save beat." });
  }
});

router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Beat id is required." });
  }

  try {
    const items = await readItems();
    const filtered = items.filter((item) => item.id !== id);

    if (filtered.length === items.length) {
      return res.status(404).json({ error: "Saved beat not found." });
    }

    await writeItems(filtered);
    res.status(200).json({ items: filtered });
  } catch (error) {
    console.error("Failed to delete beat:", error);
    res.status(500).json({ error: "Could not delete beat." });
  }
});

module.exports = router;
