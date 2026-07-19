import { Hono } from "hono";

const SITE_URL = "https://buildingTC.com";
const SITEMAP_PAGE_SIZE = 10000;
const app = new Hono();

function htmlPage(title, body, extraHead = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${extraHead}<style>body{font-family:system-ui,sans-serif;margin:0;color:#18202a;background:#f7f8fb}.wrap{max-width:960px;margin:0 auto;padding:32px 20px}a{color:#0b66c3}.card{background:white;border:1px solid #e3e7ee;border-radius:16px;padding:20px;margin:16px 0;box-shadow:0 8px 24px rgba(24,32,42,.06)}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e3e7ee;text-align:left;padding:10px}.muted{color:#627084}.badge{display:inline-block;background:#fff3cd;color:#674d00;border-radius:999px;padding:4px 10px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.parcel-link{display:block;padding:10px;border:1px solid #e3e7ee;border-radius:10px;background:#fff}</style></head><body><main class="wrap">${body}</main></body></html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("&#039;", "&apos;");
}

function normalizePin(pin) {
  const p = String(pin ?? "").trim();
  if (!p) return null;
  if (p.startsWith("28-")) return p;
  return `28-${p}`;
}

function parcelPath(parcel) {
  return `/parcel/${encodeURIComponent(parcel.slug || parcel.parcel_id)}`;
}

function indexableWhere() {
  return `address IS NOT NULL AND address != '' AND geometry_ref IS NOT NULL AND geometry_ref != '' AND (tier = 1 OR EXISTS (SELECT 1 FROM sales WHERE sales.parcel_id = parcels.parcel_id) OR EXISTS (SELECT 1 FROM auctions WHERE auctions.parcel_id = parcels.parcel_id))`;
}

async function asset(c) {
  if (c.env.ASSETS?.fetch) return c.env.ASSETS.fetch(c.req.raw);
  return c.text("Not found", 404);
}

function xml(c, body) {
  return c.body(body, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, s-maxage=86400" });
}

app.get("/health", (c) => c.json({ ok: true, site: "buildingTC.com" }));

app.get("/about-data", (c) => {
  const body = `<p><a href="/">← Map</a></p><h1>About buildingTC.com data</h1><div class="card"><p>buildingTC.com is being built from public Grand Traverse County property, sale, sheriff-sale, and tax-foreclosure sources.</p><p>Source terms, field mappings, and ingestion limits are maintained in <code>DATA-SOURCES.md</code>. Automated county GIS ingestion remains gated until the current source terms and authoritative parcel layer are confirmed.</p><p class="muted">To request owner-name suppression or flag a data issue, email <a href="mailto:privacy@buildingTC.com">privacy@buildingTC.com</a>.</p></div>`;
  return c.html(htmlPage("About data | buildingTC.com", body));
});

app.get("/api/sales/:pin", async (c) => {
  const pnum = normalizePin(c.req.param("pin"));
  if (!pnum) return c.json({ error: "invalid_pin" }, 400);
  if (!c.env.DB) return c.json({ pnum, records: [] });

  const legacy = await c.env.DB.prepare("SELECT sale_date, price, instrument, buyer, seller FROM sales WHERE parcel_id = ? ORDER BY sale_date DESC").bind(pnum).all();
  const records = (legacy.results ?? []).map((row) => ({
    pnum,
    DateOfSale: row.sale_date,
    saleprice: row.price,
    terms: row.instrument,
    grantee: row.buyer,
    grantor: row.seller,
  }));
  return c.json({ pnum, records });
});

app.get("/api/geojson", async (c) => {
  if (!c.env.GEOMETRY) return c.json({ error: "r2_binding_unavailable" }, 503);
  const obj = await c.env.GEOMETRY.get("county-simplified.geojson");
  if (!obj) return c.json({ error: "geojson_not_loaded" }, 404);
  return new Response(obj.body, {
    headers: { "content-type": "application/geo+json", "cache-control": "public, s-maxage=86400" },
  });
});

app.post("/api/auction-alerts", async (c) => {
  const form = await c.req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (!/^.+@.+\..+$/.test(email)) return c.text("Invalid email", 400);
  if (!c.env.DB) return c.text("D1 binding unavailable", 503);
  await c.env.DB.prepare("INSERT OR IGNORE INTO auction_alerts (email) VALUES (?)").bind(email).run();
  return c.html(htmlPage("Auction alerts | buildingTC.com", `<h1>You're on the list.</h1><p><a href="/auctions">Back to auctions</a></p>`));
});

app.get("/sitemap.xml", async (c) => {
  const total = c.env.DB ? await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM parcels WHERE ${indexableWhere()}`).first() : { n: 0 };
  const pages = Math.max(1, Math.ceil(Number(total?.n || 0) / SITEMAP_PAGE_SIZE));
  const entries = Array.from({ length: pages }, (_, i) => `<sitemap><loc>${SITE_URL}/sitemap-parcels-${i}.xml</loc></sitemap>`).join("");
  return xml(c, `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`);
});

app.get("/sitemap-parcels-:page.xml", async (c) => {
  const page = Math.max(0, Number(c.req.param("page")) || 0);
  const offset = page * SITEMAP_PAGE_SIZE;
  const rows = c.env.DB ? await c.env.DB.prepare(`SELECT slug, updated_at FROM parcels WHERE ${indexableWhere()} ORDER BY parcel_id LIMIT ? OFFSET ?`).bind(SITEMAP_PAGE_SIZE, offset).all() : { results: [] };
  const urls = (rows.results ?? []).map((row) => `<url><loc>${SITE_URL}/parcel/${escapeXml(encodeURIComponent(row.slug))}</loc>${row.updated_at ? `<lastmod>${escapeXml(String(row.updated_at).slice(0, 10))}</lastmod>` : ""}</url>`).join("");
  return xml(c, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

app.get("/parcel/:slug", async (c) => {
  const slug = c.req.param("slug");
  const parcelId = decodeURIComponent(slug).split("-").slice(0, 5).join("-");
  if (!c.env.DB) return c.text("D1 binding unavailable", 503);

  const parcel = await c.env.DB.prepare("SELECT * FROM parcels WHERE parcel_id = ? OR slug = ?").bind(parcelId, slug).first();
  if (!parcel) return c.html(htmlPage("Parcel not found", `<h1>Parcel not found</h1><p><a href="/">Return to the map</a>.</p>`), 404);

  if (parcel.slug && parcel.slug !== slug) {
    return c.redirect(`${SITE_URL}${parcelPath(parcel)}`, 301);
  }

  const sales = await c.env.DB.prepare("SELECT sale_date, price, instrument, buyer, seller FROM sales WHERE parcel_id = ? ORDER BY sale_date DESC").bind(parcel.parcel_id).all();
  const auctions = await c.env.DB.prepare("SELECT type, sale_date, min_bid, status, source_url FROM auctions WHERE parcel_id = ? ORDER BY sale_date DESC").bind(parcel.parcel_id).all();
  const neighbors = await c.env.DB.prepare("SELECT p.parcel_id, p.slug, p.address FROM parcel_neighbors n JOIN parcels p ON p.parcel_id = n.neighbor_parcel_id WHERE n.parcel_id = ? ORDER BY p.address LIMIT 12").bind(parcel.parcel_id).all();
  const nearbySales = await c.env.DB.prepare("SELECT p.slug, p.address, s.sale_date, s.price FROM sales s JOIN parcels p ON p.parcel_id = s.parcel_id WHERE s.parcel_id != ? AND (p.street_slug = ? OR p.plat_slug = ?) ORDER BY s.sale_date DESC LIMIT 8").bind(parcel.parcel_id, parcel.street_slug, parcel.plat_slug).all();
  const showOwner = c.env.OWNER_NAMES_ENABLED === "true" && !parcel.suppress_owner && parcel.owner_name;
  const indexable = (sales.results?.length || auctions.results?.length || parcel.tier === 1) && parcel.address && parcel.geometry_ref;
  const robots = indexable ? "index,follow" : "noindex,follow";
  const salesRows = (sales.results ?? []).map((sale) => `<tr><td>${escapeHtml(sale.sale_date ?? "")}</td><td>${sale.price == null ? "" : `$${Number(sale.price).toLocaleString()}`}</td><td>${escapeHtml(sale.instrument ?? "")}</td><td>${escapeHtml(sale.buyer ?? "")}</td><td>${escapeHtml(sale.seller ?? "")}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No sales history loaded yet.</td></tr>`;
  const neighborLinks = (neighbors.results ?? []).map((n) => `<a class="parcel-link" href="${parcelPath(n)}">${escapeHtml(n.address || n.parcel_id)}</a>`).join("") || `<p class="muted">Neighbor links will appear after adjacency precomputation.</p>`;
  const nearbyRows = (nearbySales.results ?? []).map((sale) => `<tr><td><a href="${parcelPath(sale)}">${escapeHtml(sale.address || "Nearby parcel")}</a></td><td>${escapeHtml(sale.sale_date ?? "")}</td><td>${sale.price == null ? "" : `$${Number(sale.price).toLocaleString()}`}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">No nearby recent sales loaded yet.</td></tr>`;
  const auctionBlock = (auctions.results ?? []).map((auction) => `<p><span class="badge">${escapeHtml(auction.type)} ${escapeHtml(auction.status)}</span> ${escapeHtml(auction.sale_date ?? "Date TBD")} ${auction.min_bid == null ? "" : `minimum bid $${Number(auction.min_bid).toLocaleString()}`} <a href="${escapeHtml(auction.source_url)}">source</a></p>`).join("");
  const breadcrumbs = [{ "@type": "ListItem", position: 1, name: "Home", item: SITE_URL }, { "@type": "ListItem", position: 2, name: parcel.address || parcel.parcel_id, item: `${SITE_URL}${parcelPath(parcel)}` }];
  const jsonLd = [{ "@context": "https://schema.org", "@type": "Place", name: parcel.address || parcel.parcel_id, identifier: parcel.parcel_id, url: `${SITE_URL}${parcelPath(parcel)}` }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumbs }];

  const hubLinks = `${parcel.street_slug ? `<a href="/street/${escapeHtml(parcel.street_slug)}">Browse ${escapeHtml(parcel.street_name || "this street")}</a>` : ""}${parcel.plat_slug ? ` · <a href="/plat/${escapeHtml(parcel.plat_slug)}">Browse ${escapeHtml(parcel.plat_name || "this plat")}</a>` : ""}`;
  const body = `<p><a href="/">← Map</a></p><h1>${escapeHtml(parcel.address || parcel.parcel_id)}</h1><div class="card"><p><strong>Parcel:</strong> ${escapeHtml(parcel.parcel_id)}</p><p><strong>Acreage:</strong> ${escapeHtml(parcel.acreage ?? "Unknown")}</p><p><strong>Assessed value:</strong> ${parcel.assessed_value == null ? "Unknown" : `$${Number(parcel.assessed_value).toLocaleString()}`}</p>${showOwner ? `<p><strong>Owner:</strong> ${escapeHtml(parcel.owner_name)}</p>` : ""}<p>${hubLinks}</p><p class="muted">Owner names are suppressed by default pending approval.</p></div><div class="card"><h2>Parcel map</h2><p class="muted">Static parcel image will render from the R2 geometry cache once parcel geometries are loaded.</p></div><div class="card"><h2>Sales history</h2><table><thead><tr><th>Date</th><th>Price</th><th>Instrument</th><th>Buyer</th><th>Seller</th></tr></thead><tbody>${salesRows}</tbody></table></div><div class="card"><h2>Neighboring parcels</h2><div class="grid">${neighborLinks}</div></div><div class="card"><h2>Nearby recent sales</h2><table><thead><tr><th>Parcel</th><th>Date</th><th>Price</th></tr></thead><tbody>${nearbyRows}</tbody></table></div>${auctionBlock ? `<div class="card"><h2>Auction status</h2>${auctionBlock}</div>` : ""}<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  return c.html(htmlPage(`${parcel.address || parcel.parcel_id} | buildingTC.com`, body, `<meta name="robots" content="${robots}">`), 200, { "cache-control": "public, s-maxage=86400" });
});

async function hubPage(c, kind) {
  const slug = c.req.param("slug");
  const column = kind === "plat" ? "plat_slug" : "street_slug";
  const nameColumn = kind === "plat" ? "plat_name" : "street_name";
  if (!c.env.DB) return c.text("D1 binding unavailable", 503);
  const rows = await c.env.DB.prepare(`SELECT parcel_id, slug, address, ${nameColumn} AS hub_name FROM parcels WHERE ${column} = ? AND address IS NOT NULL ORDER BY address LIMIT 500`).bind(slug).all();
  const hubName = rows.results?.[0]?.hub_name || slug.replaceAll("-", " ");
  const links = (rows.results ?? []).map((p) => `<a class="parcel-link" href="${parcelPath(p)}">${escapeHtml(p.address || p.parcel_id)}</a>`).join("") || `<p class="muted">No parcels loaded for this ${kind} yet.</p>`;
  return c.html(htmlPage(`${hubName} ${kind} parcels | buildingTC.com`, `<p><a href="/">← Map</a></p><h1>${escapeHtml(hubName)}</h1><div class="card"><p>${(rows.results ?? []).length} parcels loaded for this ${kind}.</p><div class="grid">${links}</div></div>`, `<meta name="robots" content="noindex,follow">`), 200, { "cache-control": "public, s-maxage=86400" });
}

app.get("/street/:slug", (c) => hubPage(c, "street"));
app.get("/plat/:slug", (c) => hubPage(c, "plat"));

app.get("/auctions", async (c) => {
  const rows = c.env.DB ? await c.env.DB.prepare("SELECT parcel_id, case_no, type, sale_date, min_bid, status, source_url FROM auctions ORDER BY sale_date ASC LIMIT 200").all() : { results: [] };
  const tr = (rows.results ?? []).map((a) => `<tr><td>${escapeHtml(a.sale_date ?? "")}</td><td>${escapeHtml(a.type)}</td><td>${escapeHtml(a.parcel_id ?? "Unmatched")}</td><td>${escapeHtml(a.case_no ?? "")}</td><td>${a.min_bid == null ? "" : `$${Number(a.min_bid).toLocaleString()}`}</td><td>${escapeHtml(a.status)}</td><td><a href="${escapeHtml(a.source_url)}">source</a></td></tr>`).join("") || `<tr><td colspan="7" class="muted">No auction records loaded yet.</td></tr>`;
  const body = `<p><a href="/">← Map</a></p><h1>Grand Traverse foreclosure auctions</h1><div class="card"><form method="post" action="/api/auction-alerts"><label>Get Grand Traverse foreclosure alerts <input type="email" name="email" required placeholder="you@example.com"></label> <button>Notify me</button></form><p class="muted">Capture only for v1; sending alerts is v2.</p></div><div class="card"><table><thead><tr><th>Date</th><th>Type</th><th>Parcel</th><th>Case</th><th>Min bid</th><th>Status</th><th>Source</th></tr></thead><tbody>${tr}</tbody></table></div>`;
  return c.html(htmlPage("Foreclosure auctions | buildingTC.com", body));
});

app.get("*", asset);

export default app;
