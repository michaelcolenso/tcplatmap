const assert = require("node:assert/strict");
const test = require("node:test");
const { buildArcgisQueryUrl } = require("../scripts/lib/arcgis");
const { canonicalParcelId, esriGeometryToGeoJSON, normalize } = require("../scripts/sync-parcels");

test("canonicalParcelId prefers full pnum over short PIN", () => {
  assert.equal(canonicalParcelId({ PIN: "51-826-104-00", pnum: "28-51-826-104-00" }), "28-51-826-104-00");
  assert.equal(canonicalParcelId({ PIN: "51-826-104-00" }), "28-51-826-104-00");
});

test("esriGeometryToGeoJSON converts rings to GeoJSON polygon geometry", () => {
  const geometry = esriGeometryToGeoJSON({ rings: [[[-85.1, 44.1], [-85.2, 44.1], [-85.1, 44.1]]] });
  assert.deepEqual(geometry, { type: "Polygon", coordinates: [[[-85.1, 44.1], [-85.2, 44.1], [-85.1, 44.1]]] });
});

test("normalize writes canonical parcel ids and GeoJSON geometry", () => {
  const feature = normalize({ attributes: { PIN: "51-826-104-00", pnum: "28-51-826-104-00", propstreetcombined: "123 Front St" }, geometry: { x: -85.6, y: 44.7 } });
  assert.equal(feature.properties.parcel_id, "28-51-826-104-00");
  assert.equal(feature.geometry.type, "Point");
  assert.equal(feature.properties.street_slug, "front-st");
});

test("ArcGIS parcel query can request WGS84 output coordinates", () => {
  const url = buildArcgisQueryUrl("https://example.com/FeatureServer/0/query", { outSR: 4326 });
  assert.equal(url.searchParams.get("outSR"), "4326");
});
