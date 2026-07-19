import { Hono } from "hono";
import { html, raw } from "hono/html";

const SITE_URL = "https://buildingTC.com";
const app = new Hono();

function page(title, body, extraHead = "") {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${title}</title>
        ${raw(extraHead)}
        <style>
          body{font-family:system-ui,sans-serif;margin:0;color:#18202a;background:#f7f8fb}.wrap{max-width:960px;margin:0 auto;padding:32px 20px}a{color:#0b66c3}.card{background:white;border:1px solid #e3e7ee;border-radius:16px;padding:20px;margin:16px 0;box-shadow:0 8px 24px rgba(24,32,42,.06)}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e3e7ee;text-align:left;padding:10px}.muted{color:#627084}.badge{display:inline-block;background:#fff3cd;color:#674d00;border-radius:999px;padding:4px 10px}
        </style>
      </head>
      <body><main class="wrap">${raw(body)}</main></body>
    </html>`;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return value == null ? "" : `$${Number(value).toLocaleString()}`;
}

app.get("/health", (c) => c.json({ ok: true, site: "buildingTC.com" }));

app.get("/about-data", (c) => {
  const body = `<p><a href="/">← Map</a></p><h1>About buildingTC.com data</h1><div class="card"><p>buildingTC.com is being built from public Grand Traverse County property, sale, sheriff-sale, and tax-foreclosure sources.</p><p>Source terms, field mappings, and ingestion limits are maintained in <code>DATA-SOURCES.md</code>. Automated county GIS ingestion remains gated until the current source terms and authoritative parcel layer are confirmed.</p><p class="muted">To request owner-name suppression or flag a data issue, email <a href="mailto:privacy@buildingTC.com">privacy@buildingTC.com</a>.</p></div>`;
  return c.html(page("About data | buildingTC.com", body));
});

app.get("/parcel/:slug", async (c) => {
  const { DB } = c.env;
  if (!DB) return c.text("D1 binding unavailable", 503);

  const slug = c.req.param("slug");
  const parcelId = decodeURIComponent(slug).split("-").slice(0, 5).join("-");
  const parcel = await DB.prepare("SELECT * FROM parcels WHERE parcel_id = ? OR slug = ?").bind(parcelId, slug).first();
  if (!parcel) {
    return c.html(page("Parcel not found", `<h1>Parcel not found</h1><p><a href="/">Return to the map</a>.</p>`), 404);
  }

  if (parcel.slug && parcel.slug !== slug) {
    return c.redirect(`${SITE_URL}/parcel/${encodeURIComponent(parcel.slug)}`, 301);
  }

  const sales = await DB.prepare("SELECT sale_date, price, instrument, buyer, seller FROM sales WHERE parcel_id = ? ORDER BY sale_date DESC").bind(parcel.parcel_id).all();
  const auctions = await DB.prepare("SELECT type, sale_date, min_bid, status, source_url FROM auctions WHERE parcel_id = ? ORDER BY sale_date DESC").bind(parcel.parcel_id).all();
  const showOwner = c.env.OWNER_NAMES_ENABLED === "true" && !parcel.suppress_owner && parcel.owner_name;
  const indexable = (sales.results?.length || auctions.results?.length) && parcel.address && parcel.geometry_ref;
  const salesRows = (sales.results ?? []).map((sale) => `<tr><td>${escapeHtml(sale.sale_date ?? "")}</td><td>${money(sale.price)}</td><td>${escapeHtml(sale.instrument ?? "")}</td><td>${escapeHtml(sale.buyer ?? "")}</td><td>${escapeHtml(sale.seller ?? "")}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No sales history loaded yet.</td></tr>`;
  const auctionBlock = (auctions.results ?? []).map((auction) => `<p><span class="badge">${escapeHtml(auction.type)} ${escapeHtml(auction.status)}</span> ${escapeHtml(auction.sale_date ?? "Date TBD")} ${auction.min_bid == null ? "" : `minimum bid ${money(auction.min_bid)}`} <a href="${escapeHtml(auction.source_url)}">source</a></p>`).join("");
  const jsonLd = { "@context": "https://schema.org", "@type": "Place", name: parcel.address || parcel.parcel_id, identifier: parcel.parcel_id, url: `${SITE_URL}/parcel/${parcel.slug}` };

  const body = `<p><a href="/">← Map</a></p><h1>${escapeHtml(parcel.address || parcel.parcel_id)}</h1><div class="card"><p><strong>Parcel:</strong> ${escapeHtml(parcel.parcel_id)}</p><p><strong>Acreage:</strong> ${escapeHtml(parcel.acreage ?? "Unknown")}</p><p><strong>Assessed value:</strong> ${parcel.assessed_value == null ? "Unknown" : money(parcel.assessed_value)}</p>${showOwner ? `<p><strong>Owner:</strong> ${escapeHtml(parcel.owner_name)}</p>` : ""}<p class="muted">Owner names are suppressed by default pending approval.</p></div><div class="card"><h2>Sales history</h2><table><thead><tr><th>Date</th><th>Price</th><th>Instrument</th><th>Buyer</th><th>Seller</th></tr></thead><tbody>${salesRows}</tbody></table></div>${auctionBlock ? `<div class="card"><h2>Auction status</h2>${auctionBlock}</div>` : ""}<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  const robots = indexable ? "index,follow" : "noindex,follow";
  c.header("cache-control", "public, s-maxage=86400");
  return c.html(page(`${parcel.address || parcel.parcel_id} | buildingTC.com`, body, `<meta name="robots" content="${robots}">`));
});

app.get("/auctions", async (c) => {
  const rows = c.env.DB ? await c.env.DB.prepare("SELECT parcel_id, case_no, type, sale_date, min_bid, status, source_url FROM auctions ORDER BY sale_date ASC LIMIT 200").all() : { results: [] };
  const tr = (rows.results ?? []).map((a) => `<tr><td>${escapeHtml(a.sale_date ?? "")}</td><td>${escapeHtml(a.type)}</td><td>${escapeHtml(a.parcel_id ?? "Unmatched")}</td><td>${escapeHtml(a.case_no ?? "")}</td><td>${money(a.min_bid)}</td><td>${escapeHtml(a.status)}</td><td><a href="${escapeHtml(a.source_url)}">source</a></td></tr>`).join("") || `<tr><td colspan="7" class="muted">No auction records loaded yet.</td></tr>`;
  const body = `<p><a href="/">← Map</a></p><h1>Grand Traverse foreclosure auctions</h1><div class="card"><form method="post" action="/api/auction-alerts"><label>Get Grand Traverse foreclosure alerts <input type="email" name="email" required placeholder="you@example.com"></label> <button>Notify me</button></form><p class="muted">Capture only for v1; sending alerts is v2.</p></div><div class="card"><table><thead><tr><th>Date</th><th>Type</th><th>Parcel</th><th>Case</th><th>Min bid</th><th>Status</th><th>Source</th></tr></thead><tbody>${tr}</tbody></table></div>`;
  return c.html(page("Foreclosure auctions | buildingTC.com", body));
});

app.post("/api/auction-alerts", async (c) => {
  if (!c.env.DB) return c.json({ error: "db_binding_unavailable" }, 503);
  const form = await c.req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ error: "invalid_email" }, 400);
  await c.env.DB.prepare("INSERT OR IGNORE INTO auction_alert_signups (email) VALUES (?)").bind(email).run();
  return c.redirect("/auctions?signup=ok", 303);
});

app.get("/api/geojson", async (c) => {
  if (!c.env.GEOMETRY) return c.json({ error: "r2_binding_unavailable" }, 503);
  const obj = await c.env.GEOMETRY.get("county-simplified.geojson");
  if (!obj) return c.json({ error: "geojson_not_loaded" }, 404);
  return new Response(obj.body, { headers: { "content-type": "application/geo+json", "cache-control": "public, s-maxage=86400" } });
});

app.all("*", (c) => {
  if (c.env.ASSETS?.fetch) return c.env.ASSETS.fetch(c.req.raw);
  return c.notFound();
});

export default app;
