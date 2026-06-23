const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "online-tabla",
    uptimeSeconds: Math.round(process.uptime())
  });
});

module.exports = router;