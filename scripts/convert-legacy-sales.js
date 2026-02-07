const fs = require("fs");
const path = require("path");

function firstExistingPath(paths) {
  for (const p of paths) {
    try {
      fs.accessSync(p, fs.constants.R_OK);
      return p;
    } catch {
      // ignore
    }
  }
  return null;
}

const DEFAULT_OUT = path.join(process.cwd(), "data", "sales.json");
const outPath = path.resolve(process.env.SALES_DATA_PATH || DEFAULT_OUT);

const srcPath =
  process.env.LEGACY_SALES_ARCGIS_JSON &&
  path.resolve(process.env.LEGACY_SALES_ARCGIS_JSON);

const discoveredSrc = firstExistingPath([
  srcPath,
  path.join(process.cwd(), "controllers", "salesdatatc.json"),
  path.join(process.cwd(), "legacy", "controllers", "salesdatatc.json"),
]);

if (!discoveredSrc) {
  console.error(
    "Could not find legacy ArcGIS JSON. Set LEGACY_SALES_ARCGIS_JSON or ensure controllers/salesdatatc.json exists."
  );
  process.exit(1);
}

const raw = fs.readFileSync(discoveredSrc, "utf8");
const json = JSON.parse(raw);
const features = Array.isArray(json?.features) ? json.features : [];

const rows = [];
for (const f of features) {
  const a = f?.attributes;
  if (!a || typeof a !== "object") continue;

  // Trim all string fields; the legacy export includes padded strings.
  for (const [k, v] of Object.entries(a)) {
    if (typeof v === "string") a[k] = v.trim();
  }

  rows.push(a);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));

console.log(
  `Converted ${rows.length} records from ${path.relative(
    process.cwd(),
    discoveredSrc
  )} -> ${path.relative(process.cwd(), outPath)}`
);

