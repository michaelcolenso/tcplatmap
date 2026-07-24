const fs = require("fs");
const path = require("path");
const { arcgisPages } = require("./lib/arcgis");
require("dotenv").config();

const sourceUrl = process.env.ARCGIS_SALES_URL;
const checkpointPath = path.resolve(process.env.SALES_CHECKPOINT_PATH || "data/checkpoints/sales.json");
const outputPath = path.resolve(process.env.SALES_SYNC_OUT || "data/sales-sync.json");
const pageSize = Number(process.env.ARCGIS_PAGE_SIZE) || 2000;
const where = process.env.ARCGIS_WHERE || "1=1";

function readCheckpoint() {
  try { return JSON.parse(fs.readFileSync(checkpointPath, "utf8")); } catch { return { offset: 0 }; }
}
function writeCheckpoint(data) {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  fs.writeFileSync(checkpointPath, JSON.stringify(data, null, 2));
}

function normalize(attributes) {
  return {
    parcel_id: String(attributes.pnum || attributes.PIN || attributes.parcel_id || "").trim(),
    sale_date: attributes.DateOfSale || attributes.sale_date || null,
    price: Number(attributes.saleprice ?? attributes.price ?? 0),
    instrument: attributes.terms || attributes.instrument || null,
    buyer: attributes.grantee || attributes.buyer || null,
    seller: attributes.grantor || attributes.seller || null,
    source_object_id: attributes.ObjectID || attributes.OBJECTID || null,
  };
}

async function main() {
  if (!sourceUrl) {
    console.warn("[sales] ARCGIS_SALES_URL is not set; skipping sales sync. See DATA-SOURCES.md and .env.example to configure it.");
    return;
  }
  const checkpoint = readCheckpoint();
  const rows = [];
  for await (const page of arcgisPages(sourceUrl, { offset: checkpoint.offset, pageSize, where, returnGeometry: false })) {
    console.log(`[sales] ${page.url} -> ${page.features.length}`);
    for (const feature of page.features) rows.push(normalize(feature.attributes || {}));
    writeCheckpoint({ offset: page.offset + page.features.length, updated_at: new Date().toISOString() });
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
  console.log(`[sales] wrote ${rows.length} normalized rows to ${outputPath}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
