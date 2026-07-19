const fs = require("fs");
const path = require("path");
const { arcgisPages } = require("./lib/arcgis");
require("dotenv").config();

const sourceUrl = process.env.ARCGIS_PARCELS_URL;
const outputPath = path.resolve(process.env.PARCELS_SYNC_OUT || "data/parcels-sync.geojson");
const pageSize = Number(process.env.ARCGIS_PAGE_SIZE) || 1000;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function canonicalParcelId(attributes = {}) {
  const raw = attributes.pnum || attributes.PNUM || attributes.parcel_id || attributes.PARCEL_ID || attributes.PARCELNO || attributes.PIN || "";
  const id = String(raw).trim();
  if (!id) return "";
  return id.startsWith("28-") ? id : `28-${id}`;
}

function parcelSlug(parcelId, address) {
  const suffix = slugify(address || "property") || "property";
  return `${String(parcelId).toLowerCase()}-${suffix}`;
}

function streetFromAddress(address) {
  const text = String(address || "").trim();
  const withoutHouseNumber = text.replace(/^\d+[A-Za-z]?\s+/, "");
  return withoutHouseNumber.replace(/\b(?:apt|unit|ste|suite)\b.*$/i, "").trim() || null;
}

function esriGeometryToGeoJSON(geometry) {
  if (!geometry || typeof geometry !== "object") return null;
  if (geometry.type && (geometry.coordinates || geometry.geometries)) return geometry;
  if (Array.isArray(geometry.rings)) return { type: "Polygon", coordinates: geometry.rings };
  if (Array.isArray(geometry.paths)) return { type: "MultiLineString", coordinates: geometry.paths };
  if (Number.isFinite(geometry.x) && Number.isFinite(geometry.y)) return { type: "Point", coordinates: [geometry.x, geometry.y] };
  return null;
}

function normalize(feature) {
  const a = feature.attributes || {};
  const parcelId = canonicalParcelId(a);
  const address = a.propstreetcombined || a.SITE_ADDRESS || a.address || null;
  const streetName = streetFromAddress(address);
  const platName = a.platname || a.PLAT_NAME || a.subdivision || null;
  return {
    type: "Feature",
    geometry: esriGeometryToGeoJSON(feature.geometry),
    properties: {
      parcel_id: parcelId,
      slug: parcelSlug(parcelId, address),
      address,
      acreage: Number(a.land_netAcres ?? a.ACRES ?? a.acreage ?? 0) || null,
      assessed_value: Number(a.adjass_3 ?? a.ASSESSED ?? a.assessed_value ?? 0) || null,
      owner_name: a.ownername1 || a.OWNER || null,
      suppress_owner: true,
      street_name: streetName,
      street_slug: streetName ? slugify(streetName) : null,
      plat_name: platName,
      plat_slug: platName ? slugify(platName) : null,
      tier: 0,
    },
  };
}

async function main() {
  if (!sourceUrl) throw new Error("Missing ARCGIS_PARCELS_URL; verify DATA-SOURCES.md terms before enabling.");
  const features = [];
  for await (const page of arcgisPages(sourceUrl, { pageSize, returnGeometry: true, outFields: "*", outSR: 4326 })) {
    console.log(`[parcels] ${page.url} -> ${page.features.length}`);
    for (const feature of page.features) features.push(normalize(feature));
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ type: "FeatureCollection", features }, null, 2));
  console.log(`[parcels] wrote ${features.length} features to ${outputPath}`);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1); });

module.exports = { canonicalParcelId, esriGeometryToGeoJSON, normalize, parcelSlug, slugify, streetFromAddress };
