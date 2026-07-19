const fs = require("fs");
const path = require("path");

const compression = require("compression");
const express = require("express");
const morgan = require("morgan");

require("dotenv").config();

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "127.0.0.1";
const SALES_DATA_PATH =
  process.env.SALES_DATA_PATH || path.join(__dirname, "data", "sales.json");

function normalizePin(pin) {
  const p = String(pin ?? "").trim();
  if (!p) return null;
  if (p.startsWith("28-")) return p;
  return `28-${p}`;
}

function loadSalesIndex(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") {
      console.warn(
        `[sales] Missing ${filePath}. Run: npm run data:convert:legacy-sales (offline) or npm run data:fetch:sales (ArcGIS)`
      );
      return new Map();
    }
    throw err;
  }

  let rows;
  try {
    rows = JSON.parse(raw);
  } catch (err) {
    console.warn(`[sales] Failed to parse ${filePath}: ${err?.message ?? err}`);
    return new Map();
  }

  if (!Array.isArray(rows)) {
    console.warn(`[sales] Expected an array in ${filePath}, got ${typeof rows}`);
    return new Map();
  }

  const index = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const key = typeof row.pnum === "string" ? row.pnum.trim() : null;
    if (!key) continue;
    const arr = index.get(key) ?? [];
    arr.push(row);
    index.set(key, arr);
  }

  for (const [key, arr] of index) {
    arr.sort((a, b) => {
      const av = Number(a?.saledate ?? 0);
      const bv = Number(b?.saledate ?? 0);
      return av - bv;
    });
    index.set(key, arr);
  }

  console.log(`[sales] Loaded ${rows.length} records from ${filePath}`);
  return index;
}

const salesIndex = loadSalesIndex(SALES_DATA_PATH);

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/sales/:pin", (req, res) => {
  const pnum = normalizePin(req.params.pin);
  if (!pnum) return res.status(400).json({ error: "invalid_pin" });
  return res.json({ pnum, records: salesIndex.get(pnum) ?? [] });
});

app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`tcplatmap listening on http://${HOST}:${PORT}`);
});
