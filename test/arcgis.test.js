const assert = require("node:assert/strict");
const test = require("node:test");
const { buildArcgisQueryUrl, DEFAULT_USER_AGENT } = require("../scripts/lib/arcgis");

test("buildArcgisQueryUrl applies polite ArcGIS paging parameters", () => {
  const url = buildArcgisQueryUrl("https://example.com/FeatureServer/0/query", {
    offset: 40,
    pageSize: 20,
    where: "PIN IS NOT NULL",
    outFields: "PIN,ADDRESS",
    returnGeometry: true,
  });
  assert.equal(url.searchParams.get("f"), "json");
  assert.equal(url.searchParams.get("resultOffset"), "40");
  assert.equal(url.searchParams.get("resultRecordCount"), "20");
  assert.equal(url.searchParams.get("where"), "PIN IS NOT NULL");
  assert.equal(url.searchParams.get("outFields"), "PIN,ADDRESS");
  assert.equal(url.searchParams.get("returnGeometry"), "true");
});

test("sync user agent points to buildingTC.com about-data", () => {
  assert.equal(DEFAULT_USER_AGENT, "tcplatmap-sync/1.0 (+https://buildingTC.com/about-data)");
});
