const fs = require("fs");
const path = require("path");

require("dotenv").config();

const arcgisUrl = process.env.ARCGIS_SALES_URL;
const where = process.env.ARCGIS_WHERE || "1=1";
const pageSize = Math.min(
  10000,
  Math.max(1, Number(process.env.ARCGIS_PAGE_SIZE) || 2000)
);

const DEFAULT_OUT = path.join(process.cwd(), "data", "sales.json");
const outPath = path.resolve(process.env.SALES_DATA_PATH || DEFAULT_OUT);

if (!arcgisUrl) {
  console.error("Missing ARCGIS_SALES_URL in environment.");
  process.exit(1);
}

function buildQueryUrl(offset) {
  const u = new URL(arcgisUrl);
  u.searchParams.set("f", "json");
  u.searchParams.set("where", where);
  u.searchParams.set("outFields", "*");
  u.searchParams.set("returnGeometry", "false");
  u.searchParams.set("resultOffset", String(offset));
  u.searchParams.set("resultRecordCount", String(pageSize));
  return u;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`.trim());
  }
  return res.json();
}

async function main() {
  const rows = [];
  let offset = 0;

  // ArcGIS REST uses paging; continue while we get full pages or it signals truncation.
  for (;;) {
    const url = buildQueryUrl(offset);
    console.log(`[arcgis] GET ${url.toString()}`);
    const json = await fetchJson(url);

    if (json?.error) {
      throw new Error(
        `[arcgis] ${json.error?.message || "error"} (${JSON.stringify(
          json.error
        )})`
      );
    }

    const features = Array.isArray(json?.features) ? json.features : [];
    for (const f of features) {
      const a = f?.attributes;
      if (!a || typeof a !== "object") continue;
      for (const [k, v] of Object.entries(a)) {
        if (typeof v === "string") a[k] = v.trim();
      }
      rows.push(a);
    }

    const exceeded = json?.exceededTransferLimit === true;
    const gotFullPage = features.length === pageSize;
    console.log(`[arcgis] page offset=${offset} got=${features.length}`);

    if (!exceeded && !gotFullPage) break;

    if (features.length === 0) break;
    offset += features.length;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
  console.log(`[arcgis] wrote ${rows.length} records -> ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

