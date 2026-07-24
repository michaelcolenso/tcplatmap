# Data Sources

This inventory is the Phase 1 source ledger for buildingTC.com. Every sync job must use the documented source URL, honor the listed terms posture, and identify as `tcplatmap-sync/1.0 (+https://buildingTC.com/about-data)`.

## Grand Traverse County GIS / parcel data

- **Authority:** Grand Traverse County Equalization/GIS Department.
- **Public pages:**
  - GIS department: https://www.gtcountymi.gov/437/GIS---Mapping
  - Mapping gallery: https://www.gtcountymi.gov/467/Mapping-Gallery
  - ArcGIS parcel viewer: https://experience.arcgis.com/experience/362fc509ce3f4227b79bb6ed242e2de5
  - Legacy parcel search: https://maps.grandtraverse.org/
- **Terms / access summary:** County GIS pages state the department maintains parcel ownership, road centerline, official address, internet mapping applications, and related spatial databases for public/government/private users. No explicit open-data republication license was found in-repo; initial automated ingest is blocked until Michael confirms the county's current data-use terms or obtains written approval.
- **Layer status:** Resolved (2026-07-24) from the county Experience Builder app's data sources: `https://gis.gtcountymi.gov/arcgis/rest/services/Public_Services/Tax_Parcel_Public/MapServer/0` (layer `TaxParcel`; also exposed as `FeatureServer/0`). Public, `maxRecordCount` 1000, supports pagination. Fields include `PARCELID`, `pnum`, `SITEADDRESS`, `OWNERNME1/2`, `ASSACRES`, `CNTASSDVAL`, `CNTTXBLVAL`, class/use codes, and geometry. Terms review still gates enabling `ARCGIS_PARCELS_URL` for automated sync.
- **Expected count:** Third-party parcel products advertise roughly 53k Grand Traverse County parcels; treat this as an order-of-magnitude check only, not an authoritative count.
- **Target field mapping:**
  - `parcel_id`: parcel number / PIN.
  - `slug`: generated from `parcel_id` and physical address.
  - `address`: physical situs address.
  - `acreage`: parcel acreage / net acres.
  - `assessed_value`: current assessed value.
  - `owner_name`: nullable and suppressed unless explicitly approved.
  - `geometry_ref`: R2 key for simplified parcel GeoJSON.

## Sales / transfer data

- **Authority:** City of Traverse City (municipal GIS, `tcgis.traversecitymi.gov`).
- **Verified endpoint (2026-07-24):** `https://tcgis.traversecitymi.gov/arcgis/rest/services/Property/CityParcelViewer/MapServer/2/query` — the `Sales` table (id 2) of the `Property/CityParcelViewer` MapServer. This is the current home of the same service the legacy app queried at the now-defunct `arcserver.tclp.org/arcgis/rest/services/City/CityParcelViewer/MapServer/2` (dead host, DNS no longer resolves). It is the default in `scripts/sync-sales.js`; `ARCGIS_SALES_URL` overrides it.
- **Service details:** public, no auth; `maxRecordCount` 2000; supports pagination (`resultOffset`/`resultRecordCount`). 27,607 records at verification, with sale dates through 2026-07-22 (actively maintained).
- **Fields:** `ObjectID`, `pnum`, `DateOfSale` (string), `saleprice`, `grantee`, `grantor`, `liberpage`, `terms`, `saledate` (esri date) — identical schema to the bundled legacy `data/sales.json` export.
- **Scope note:** city parcels only (`28-51-*` parcel numbers), not county-wide. County (`gis.gtcountymi.gov`) publishes parcels/assessments but no sales/transfer layer as of verification.
- **Terms / access summary:** Endpoint is confirmed municipal-official. Grantee/grantor names are present in the source; do not publish buyer/seller names beyond the public facts already approved for the map until Michael confirms the PII posture.
- **Update cadence:** Daily sync via `.github/workflows/sync.yml` (`npm run sync:sales`).

## Sheriff mortgage-foreclosure sales

- **Authority:** Grand Traverse County Sheriff's Office.
- **Public pages:**
  - Overview: https://www.gtcountymi.gov/1807/Sheriff-Foreclosure-Sale
  - Sales/adjournments: https://www.gtcountymi.gov/2246/Foreclosure-SalesAdjournments
  - FAQ: https://www.gtcountymi.gov/1808/Foreclosure-Sale-FAQs
- **Terms / access summary:** Public county pages list sale schedules and downloadable sale/adjournment summaries. The site footer points to county copyright/legal terms; parser should store only public sale facts and source URLs.
- **Format / cadence:** HTML page with links to dated summaries; current page text says weekly adjournments/sales and links to summary documents. Phase 4 parser must handle linked documents (likely PDF or document attachments) after source format inspection.

## Tax-foreclosure / public land auction

- **Authority:** Grand Traverse County Treasurer / Michigan Public Land Auction.
- **Public pages:**
  - County available properties: https://www.gtcountymi.gov/1615/Properties-Available-For-Sale
  - Delinquent taxes: https://www.gtcountymi.gov/883/Delinquent-Taxes
  - Timeline: https://www.gtcountymi.gov/2434/Property-Tax-Foreclosure-Timeline
  - Auction catalog: https://www.tax-sale.info/auctions
- **Terms / access summary:** County pages route public tax-foreclosure auction browsing to tax-sale.info. Do not scrape account-gated or authenticated pages; ingest only public catalog/listing pages and preserve source URLs.
- **Format / cadence:** Public HTML catalog/listings, with annual auction windows. Daily sync can check catalog availability and changed lots.

## Gate notes

- Phase 1 cannot pass until the parcel REST endpoint, terms, field list, authoritative count, and sales endpoint authority are verified.
- Owner names remain schema-supported but suppressed by default.
