const path = require("path");
const express = require("express");

const healthRouter = require("./routes/health");

const app = express();
const port = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use("/health", healthRouter);
app.use(express.static(path.join(__dirname, "..", "public"), {
  maxAge: "7d"
}));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Online Tabla server running on http://0.0.0.0:${port}`);
});