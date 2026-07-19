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
- **Layer status:** Candidate authoritative source is the ArcGIS Tax Parcel Viewer linked by the county gallery. The REST service URL, layer id, fields, and exact feature count still need to be resolved from ArcGIS item metadata before enabling full parcel sync.
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

- **Current repo source:** `scripts/fetch-sales.js` reads `ARCGIS_SALES_URL` from the environment and queries ArcGIS REST with `where`, `outFields=*`, `returnGeometry=false`, `resultOffset`, and `resultRecordCount`; no hard-coded endpoint is present in the repository.
- **Current local data:** `data/sales.json` and legacy `sales.json` contain sales records with `ObjectID`, `pnum`, `DateOfSale`, `saleprice`, `grantee`, `grantor`, `liberpage`, `terms`, and `saledate`.
- **Terms / access summary:** Treat the sales layer as unverified until `ARCGIS_SALES_URL` is confirmed county-official and its terms are reviewed. Do not publish buyer/seller names beyond the public facts already approved for the map until Michael confirms the PII posture.
- **Update cadence:** Daily sync target. Max sale date probing is implemented as a dry-run-friendly sync capability, but the source endpoint must be configured before it can be measured.

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
