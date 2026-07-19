const fs = require("fs");
const path = require("path");
const { arcgisPages } = require("./lib/arcgis");
require("dotenv").config();

const sourceUrl = process.env.ARCGIS_PARCELS_URL;
const outputPath = path.resolve(process.env.PARCELS_SYNC_OUT || "data/parcels-sync.geojson");
const pageSize = Number(process.env.ARCGIS_PAGE_SIZE) || 1000;

function slugify(parcelId, address) {
  const suffix = String(address || "property").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `${String(parcelId).toLowerCase()}-${suffix}`;
}
function normalize(feature) {
  const a = feature.attributes || {};
  const parcelId = String(a.PIN || a.pnum || a.PARCELNO || a.parcel_id || "").trim();
  const address = a.propstreetcombined || a.SITE_ADDRESS || a.address || null;
  return { type: "Feature", geometry: feature.geometry || null, properties: { parcel_id: parcelId, slug: slugify(parcelId, address), address, acreage: Number(a.land_netAcres ?? a.ACRES ?? a.acreage ?? 0) || null, assessed_value: Number(a.adjass_3 ?? a.ASSESSED ?? a.assessed_value ?? 0) || null, owner_name: a.ownername1 || a.OWNER || null, suppress_owner: true } };
}
async function main() {
  if (!sourceUrl) throw new Error("Missing ARCGIS_PARCELS_URL; verify DATA-SOURCES.md terms before enabling.");
  const features = [];
  for await (const page of arcgisPages(sourceUrl, { pageSize, returnGeometry: true, outFields: "*" })) {
    console.log(`[parcels] ${page.url} -> ${page.features.length}`);
    for (const feature of page.features) features.push(normalize(feature));
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ type: "FeatureCollection", features }, null, 2));
  console.log(`[parcels] wrote ${features.length} features to ${outputPath}`);
}
main().catch((error) => { console.error(error); process.exit(1); });
