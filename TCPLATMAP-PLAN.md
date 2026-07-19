# tcplatmap — Implementation Plan & Agent Handoff

**Owner:** Michael Colenso
**Repo:** `michaelcolenso/tcplatmap` (d3.js plat map of Traverse City; ~1,400 commits; recent map-only rebuild pulling parcel sales from an ArcGIS REST endpoint; legacy Express/Bower scaffolding and an old Mongo app in `legacy/`)
**Audience:** Coding agent (Claude Code or equivalent). Follow literally. STOP at every gate. When ambiguous, ask Michael — do not improvise. When this document conflicts with your judgment, follow the document and flag the conflict.

---

## 0. Mission

Turn tcplatmap from a map demo into **the Grand Traverse County property intelligence layer**: the modern map stays the front door, but the product becomes (a) a programmatic-SEO page per parcel with sales history and plat context, and (b) a sheriff-sale / tax-foreclosure overlay (SaleScout's playbook pointed at Michigan). Runs on the standard stack: Cloudflare Workers + Hono + D1 + KV + R2, static frontend, GitHub Actions crons. Zero-to-near-zero hosting cost.

**v1 ships when:** the map runs on Workers, every qualifying parcel has an indexed page, sales data refreshes automatically, and the foreclosure overlay is live for Grand Traverse County.

## 1. Hard rules

1. **Data source terms:** before ingesting any layer, read the county/state GIS terms of use and record the URL + a one-line summary in `DATA-SOURCES.md`. If terms prohibit republication, STOP and ask Michael. Public-record parcel and sales data is normally fine; do not assume — verify.
2. **Polite ingestion:** ArcGIS REST pulls at ≤2 req/sec, resumable pagination (`resultOffset`), exponential backoff on 429/5xx, honest User-Agent `tcplatmap-sync/1.0 (+{site}/about-data)`. No credential workarounds, no scraping pages that sit behind auth.
3. **PII discipline:** publish parcel/property facts only. Owner names: include ONLY if the county publishes them in the open GIS layer AND Michael approves (Open Question ★2). Build an owner-name suppression flag into the schema either way, plus a `/remove` request path (mailto link is sufficient for v1).
4. **No thin-content mass indexation.** Indexation is gated and tiered (§6). Never submit the full parcel set to sitemaps in one shot.
5. **Preserve history:** work on branch `v2-workers`, PRs to merge. Do not delete `legacy/` until Phase 2 gate passes; then remove it in its own PR.
6. **Secrets** in Actions/Wrangler secrets only.
7. **Scope:** P0 only. Ideas go to `PARKING-LOT.md`.

## 2. Target architecture

```
[GitHub Actions cron]
  ├── parcels-sync (weekly): ArcGIS parcel layer → normalize → D1
  ├── sales-sync (daily): ArcGIS sales endpoint (already used by repo) → D1
  └── auctions-sync (daily): sheriff sale + tax foreclosure sources → D1
        │
        ▼
[Worker (Hono)]
  ├── /                     map UI (static assets, MapLibre GL or existing d3 — see 3.2)
  ├── /parcel/:slug         SSR parcel page (HTML, cache on KV, s-maxage 24h)
  ├── /auctions             upcoming sales list + map filter
  ├── /api/tiles|geojson    vector data for map (R2-hosted tiles or simplified GeoJSON)
  ├── /sitemap-*.xml        tiered sitemaps generated from D1
  └── existing infra hooks: IndexNow Worker (multi-domain — register this domain),
      internal-linking system, GSC→BigQuery pipeline
```

**Domain:** Open Question ★1 (tcplatmap.com vs. a stronger commercial name). Do not buy anything without approval.

## 3. Execution phases — in order, each gated

### Phase 1 — Data foundation (gate: verified counts + terms)
- [ ] 1.1 Inventory current repo: document the ArcGIS endpoints the rebuild already calls (base URL, layer IDs, fields) in `DATA-SOURCES.md`.
- [ ] 1.2 Locate and verify the authoritative Grand Traverse County parcel layer (geometry + parcel number + address + acreage + assessed value if present). Record field mapping. Expected order of magnitude: tens of thousands of parcels — record the exact count.
- [ ] 1.3 Verify the sales/transfer layer: fields, date range, update cadence (probe by comparing max sale date across two days).
- [ ] 1.4 Identify auction sources: county sheriff's office mortgage-foreclosure sale listings and Michigan tax-foreclosure (county treasurer / state auction site). Record format (HTML/PDF/CSV), cadence, and terms. If PDF-only, note it — parsing is Phase 4 work, not now.
- [ ] 1.5 D1 schema + migrations:
  - `parcels` (pk parcel_id, slug, address, geometry_ref, acreage, assessed_value, owner_name NULLABLE, suppress_owner BOOL default 0, updated_at)
  - `sales` (parcel_id, sale_date, price, instrument, buyer NULLABLE, seller NULLABLE)
  - `auctions` (parcel_id NULLABLE, case_no, type ENUM(sheriff,tax), sale_date, min_bid, status, source_url)
  - `sync_runs` (source, started_at, rows, status, error)
  Geometry itself goes to R2 as simplified GeoJSON per parcel (D1 stores the R2 key), plus one county-wide simplified layer for the map.
- [ ] 1.6 Build the three sync jobs with resumable checkpoints; full initial load; row counts within 2% of source counts.
- [ ] **GATE:** Michael reviews DATA-SOURCES.md (terms) and spot-checks 20 parcels against the county's own viewer.

### Phase 2 — Stack port (gate: map paritiy on Workers)
- [ ] 2.1 New `/site` frontend: keep the existing map-only rebuild's UX. Decision rule for renderer: if current d3 build renders the full county at acceptable perf from static GeoJSON, keep d3; otherwise MapLibre GL + tiles generated with tippecanoe in CI to R2. Do not hand-roll a tile server.
- [ ] 2.2 Hono app serving static assets + `/api/geojson` from R2 with KV caching.
- [ ] 2.3 Feature parity checklist vs. current deployment: pan/zoom, parcel hover/click, sales popup. Screenshot comparison in PR.
- [ ] 2.4 Remove Express/Procfile/Bower and `legacy/` (separate PR, after gate).
- [ ] **GATE:** Michael approves parity + performance on phone.

### Phase 3 — pSEO parcel pages (gate: quality audit before indexation)
- [ ] 3.1 URL: `/parcel/{parcel_id}-{address-slug}` (parcel_id first = permanent even if address changes; 301 old slugs on change).
- [ ] 3.2 Page content blocks (SSR, no client JS required to read):
  1. H1 = address; parcel number, acreage, assessed value
  2. Mini-map (static image rendered at build from geometry, R2-cached) — no live map on parcel pages
  3. **Sales history table** (the differentiator — every recorded sale w/ date + price)
  4. Neighboring parcels (spatial adjacency, precomputed): links = internal-linking fuel
  5. Nearby recent sales (same section/plat, last 24 months)
  6. Auction flag if parcel appears in `auctions`
  7. JSON-LD: `Place` + `Dataset` reference; breadcrumbs
- [ ] 3.3 **Indexation tiers:**
  - Tier 1 (index now): parcels with ≥1 recorded sale OR an auction record
  - Tier 2 (index after Tier 1 is >50% indexed in GSC): parcels with assessed value + acreage but no sales — `noindex` until promoted
  - Never index: parcels missing address or geometry
- [ ] 3.4 Sitemaps: 10k URLs/file, Tier 1 only at launch; register domain in the IndexNow Worker; wire into the GSC→BigQuery pipeline and internal-linking system.
- [ ] 3.5 Hub pages: `/plat/{plat-slug}` and `/street/{street-slug}` listing child parcels (crawl paths + genuine browse value).
- [ ] **GATE:** Michael reviews 25 random Tier-1 pages for quality/uniqueness + Lighthouse ≥90 mobile before sitemap submission.

### Phase 4 — Auction overlay (SaleScout DNA)
- [ ] 4.1 Parser for the sheriff-sale listing format found in 1.4 (HTML/CSV first; PDF via pdfplumber only if that's all there is). Match to parcels by address/parcel number; unmatched records still get list entries.
- [ ] 4.2 `/auctions` page: table + map layer (upcoming, sorted by date); auction badge on parcel pages.
- [ ] 4.3 Email capture: single field on `/auctions` — "Get Grand Traverse foreclosure alerts." Store in D1. **Sending alerts is v2**, capture only.
- [ ] **GATE:** two consecutive weekly cycles where new auction records appear automatically and correctly.

## 4. Non-goals (v1)

Other Michigan counties; valuation/AVM estimates; user accounts; paid tiers (email capture only); comment/claim features; owner-lookup search (privacy posture); live-map on parcel pages; PainDex integration; any outreach automation. Parking-lot everything else.

## 5. Definition of done

- [ ] Map at parity on Workers; legacy scaffolding removed
- [ ] All three syncs green for 14 consecutive days (check `sync_runs`)
- [ ] Tier-1 parcel pages live, in sitemaps, IndexNow firing, GSC verified and piping to BigQuery
- [ ] Auctions page updating automatically; email capture working
- [ ] DATA-SOURCES.md complete with terms links; `/about-data` page published
- [ ] Infra cost ≤ $5/mo (Workers paid plan already exists — note the nobodynamed billing lapse; put this domain on the same monitored account and add a billing-failure alert)

## 6. Open questions for Michael (★ = blocking)

1. ★ Domain/brand: keep tcplatmap or launch under a commercial name (e.g., a "buildingseattle-for-TC" style brand)? Affects §2 and all URLs.
2. ★ Owner names on parcel pages: publish (if county layer includes them) or suppress by default?
3. ★ Confirm which ArcGIS endpoints the current rebuild uses are county-official vs. third-party mirrors (agent will inventory in 1.1; Michael confirms acceptability).
4. Renderer preference if d3 perf is marginal: keep d3 aesthetic vs. MapLibre?
5. Is the SaleScout Washington spec's auction-parsing code reusable here, or should this be a clean-room build?
