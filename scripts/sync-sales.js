const fs = require("fs");
const path = require("path");
const { arcgisPages } = require("./lib/arcgis");
require("dotenv").config();

// City of Traverse City sales table (verified 2026-07-24; see DATA-SOURCES.md).
const DEFAULT_SALES_URL = "https://tcgis.traversecitymi.gov/arcgis/rest/services/Property/CityParcelViewer/MapServer/2/query";
const sourceUrl = process.env.ARCGIS_SALES_URL || DEFAULT_SALES_URL;
const checkpointPath = path.resolve(process.env.SALES_CHECKPOINT_PATH || "data/checkpoints/sales.json");
const outputPath = path.resolve(process.env.SALES_SYNC_OUT || "data/sales-sync.json");
const pageSize = Number(process.env.ARCGIS_PAGE_SIZE) || 2000;
const where = process.env.ARCGIS_WHERE || "1=1";

// City records begin well after Traverse City's 1850s founding; anything
// earlier is a data-entry error in the source (it contains years like 1753).
const MIN_SALE_YEAR = 1850;
const MAX_SALE_YEAR = new Date().getUTCFullYear() + 1;

function readCheckpoint() {
  try { return JSON.parse(fs.readFileSync(checkpointPath, "utf8")); } catch { return { offset: 0 }; }
}
function writeCheckpoint(data) {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  fs.writeFileSync(checkpointPath, JSON.stringify(data, null, 2));
}

function cleanString(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text ? text : null;
}

function isoDateOrNull(year, month, day) {
  if (year < MIN_SALE_YEAR || year > MAX_SALE_YEAR) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

// Accepts esri epoch milliseconds or YYYYMMDD[HHMMSS], YYYY-MM-DD, and
// M/D/YYYY strings (the source's DateOfSale formats). Components are
// validated explicitly — never via Date.parse, whose rollover would turn
// a malformed "02/30/2026" into 2026-03-02 instead of rejecting it.
// Returns "YYYY-MM-DD" or null for missing/implausible dates.
function normalizeSaleDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return isoDateOrNull(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const text = String(value).trim();
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?$/);
  if (compact) return isoDateOrNull(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (iso) return isoDateOrNull(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return isoDateOrNull(Number(us[3]), Number(us[1]), Number(us[2]));
  return null;
}

function normalizePrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) return null;
  return Math.round(price);
}

// Source terms look like "03-ARM'S LENGTH"; split off the leading code so
// consumers can filter (e.g. arm's-length only) without string matching.
function instrumentParts(value) {
  const instrument = cleanString(value);
  if (!instrument) return { instrument: null, instrument_code: null };
  const match = instrument.match(/^(\d{2})\s*-\s*(.+)$/);
  if (!match) return { instrument, instrument_code: null };
  return { instrument: match[2].trim(), instrument_code: match[1] };
}

function normalize(attributes) {
  const { instrument, instrument_code } = instrumentParts(attributes.terms ?? attributes.instrument);
  return {
    parcel_id: cleanString(attributes.pnum || attributes.PIN || attributes.parcel_id),
    sale_date: normalizeSaleDate(attributes.saledate ?? attributes.DateOfSale ?? attributes.sale_date),
    price: normalizePrice(attributes.saleprice ?? attributes.price),
    instrument,
    instrument_code,
    liber_page: cleanString(attributes.liberpage ?? attributes.liber_page),
    buyer: cleanString(attributes.grantee || attributes.buyer),
    seller: cleanString(attributes.grantor || attributes.seller),
    source_object_id: attributes.ObjectID ?? attributes.OBJECTID ?? null,
  };
}

function dedupeKey(row) {
  return [row.parcel_id, row.sale_date, row.price, row.instrument_code, row.instrument, row.liber_page, row.buyer, row.seller].join("|");
}

// Drops rows that are identical in every field except source_object_id and
// sorts by sale date then parcel so reruns produce stable, diffable output.
function finalizeRows(rows) {
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = dedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  unique.sort((a, b) =>
    (a.sale_date ?? "").localeCompare(b.sale_date ?? "") ||
    (a.parcel_id ?? "").localeCompare(b.parcel_id ?? "") ||
    (a.source_object_id ?? 0) - (b.source_object_id ?? 0));
  return { rows: unique, duplicates: rows.length - unique.length };
}

async function main() {
  if (!sourceUrl) {
    console.warn("[sales] ARCGIS_SALES_URL is not set; skipping sales sync. See DATA-SOURCES.md and .env.example to configure it.");
    return;
  }
  const checkpoint = readCheckpoint();
  const rows = [];
  let invalidDates = 0;
  for await (const page of arcgisPages(sourceUrl, { offset: checkpoint.offset, pageSize, where, returnGeometry: false })) {
    console.log(`[sales] ${page.url} -> ${page.features.length}`);
    for (const feature of page.features) {
      const attributes = feature.attributes || {};
      const row = normalize(attributes);
      if (row.sale_date === null && (attributes.saledate ?? attributes.DateOfSale ?? attributes.sale_date) != null) invalidDates += 1;
      rows.push(row);
    }
    writeCheckpoint({ offset: page.offset + page.features.length, updated_at: new Date().toISOString() });
  }
  const { rows: unique, duplicates } = finalizeRows(rows);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(unique, null, 2));
  console.log(`[sales] wrote ${unique.length} normalized rows to ${outputPath} (${duplicates} duplicates dropped, ${invalidDates} implausible dates nulled)`);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });

module.exports = { cleanString, finalizeRows, instrumentParts, normalize, normalizePrice, normalizeSaleDate };
