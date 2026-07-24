const assert = require("node:assert/strict");
const test = require("node:test");
const { cleanString, finalizeRows, instrumentParts, normalize, normalizePrice, normalizeSaleDate } = require("../scripts/sync-sales");

test("normalizeSaleDate handles esri epoch milliseconds", () => {
  assert.equal(normalizeSaleDate(Date.UTC(2026, 6, 22)), "2026-07-22");
});

test("normalizeSaleDate handles legacy YYYYMMDDHHMMSS strings", () => {
  assert.equal(normalizeSaleDate("19940926000000"), "1994-09-26");
  assert.equal(normalizeSaleDate("20260101"), "2026-01-01");
});

test("normalizeSaleDate nulls implausible or malformed dates", () => {
  assert.equal(normalizeSaleDate("17530101000000"), null);
  assert.equal(normalizeSaleDate(Date.UTC(1753, 0, 1)), null);
  assert.equal(normalizeSaleDate("20261301"), null);
  assert.equal(normalizeSaleDate("20260230"), null);
  assert.equal(normalizeSaleDate("not a date"), null);
  assert.equal(normalizeSaleDate(null), null);
  assert.equal(normalizeSaleDate(""), null);
});

test("normalizePrice keeps zero, rounds, and nulls invalid values", () => {
  assert.equal(normalizePrice(85000), 85000);
  assert.equal(normalizePrice("144900.4"), 144900);
  assert.equal(normalizePrice(0), 0);
  assert.equal(normalizePrice(-1), null);
  assert.equal(normalizePrice(undefined), null);
  assert.equal(normalizePrice("n/a"), null);
});

test("cleanString trims, collapses whitespace, and nulls empties", () => {
  assert.equal(cleanString("  DAVIS  ANDREW   C "), "DAVIS ANDREW C");
  assert.equal(cleanString("   "), null);
  assert.equal(cleanString(null), null);
});

test("instrumentParts splits the numeric code from the label", () => {
  assert.deepEqual(instrumentParts("03-ARM'S LENGTH"), { instrument: "ARM'S LENGTH", instrument_code: "03" });
  assert.deepEqual(instrumentParts("QUIT CLAIM"), { instrument: "QUIT CLAIM", instrument_code: null });
  assert.deepEqual(instrumentParts("  "), { instrument: null, instrument_code: null });
});

test("normalize prefers the esri saledate field and maps source attributes", () => {
  const row = normalize({
    pnum: " 28-51-745-009-00 ",
    saledate: Date.UTC(2026, 6, 22),
    DateOfSale: "17530101000000",
    saleprice: 800000,
    terms: "03-ARM'S LENGTH",
    liberpage: " 2026R-01234 ",
    grantee: "BUYER  NAME",
    grantor: "SELLER NAME",
    ObjectID: 27607,
  });
  assert.deepEqual(row, {
    parcel_id: "28-51-745-009-00",
    sale_date: "2026-07-22",
    price: 800000,
    instrument: "ARM'S LENGTH",
    instrument_code: "03",
    liber_page: "2026R-01234",
    buyer: "BUYER NAME",
    seller: "SELLER NAME",
    source_object_id: 27607,
  });
});

test("finalizeRows drops content duplicates and sorts by date then parcel", () => {
  const base = { price: 100, instrument: "ARM'S LENGTH", instrument_code: "03", liber_page: null, buyer: "B", seller: "S" };
  const rows = [
    { ...base, parcel_id: "28-51-002", sale_date: "2020-01-02", source_object_id: 2 },
    { ...base, parcel_id: "28-51-001", sale_date: "2020-01-01", source_object_id: 3 },
    { ...base, parcel_id: "28-51-002", sale_date: "2020-01-02", source_object_id: 9 },
  ];
  const { rows: unique, duplicates } = finalizeRows(rows);
  assert.equal(duplicates, 1);
  assert.deepEqual(unique.map((r) => r.parcel_id), ["28-51-001", "28-51-002"]);
});
