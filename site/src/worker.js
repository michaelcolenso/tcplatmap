const SITE_URL = "https://buildingTC.com";

function htmlPage(title, body, extraHead = "") {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${extraHead}<style>body{font-family:system-ui,sans-serif;margin:0;color:#18202a;background:#f7f8fb}.wrap{max-width:960px;margin:0 auto;padding:32px 20px}a{color:#0b66c3}.card{background:white;border:1px solid #e3e7ee;border-radius:16px;padding:20px;margin:16px 0;box-shadow:0 8px 24px rgba(24,32,42,.06)}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e3e7ee;text-align:left;padding:10px}.muted{color:#627084}.badge{display:inline-block;background:#fff3cd;color:#674d00;border-radius:999px;padding:4px 10px}</style></head><body><main class="wrap">${body}</main></body></html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

async function serveAsset(env, request) {
  if (env.ASSETS?.fetch) return env.ASSETS.fetch(request);
  return new Response("Not found", { status: 404 });
}

async function aboutData() {
  const body = `<p><a href="/">← Map</a></p><h1>About buildingTC.com data</h1><div class="card"><p>buildingTC.com is being built from public Grand Traverse County property, sale, sheriff-sale, and tax-foreclosure sources.</p><p>Source terms, field mappings, and ingestion limits are maintained in <code>DATA-SOURCES.md</code>. Automated county GIS ingestion remains gated until the current source terms and authoritative parcel layer are confirmed.</p><p class="muted">To request owner-name suppression or flag a data issue, email <a href="mailto:privacy@buildingTC.com">privacy@buildingTC.com</a>.</p></div>`;
  return new Response(htmlPage("About data | buildingTC.com", body), { headers: { "content-type": "text/html; charset=utf-8" } });
}

async function parcelPage(env, slug) {
  const parcelId = decodeURIComponent(slug).split("-").slice(0, 5).join("-");
  if (!env.DB) return new Response("D1 binding unavailable", { status: 503 });

  const parcel = await env.DB.prepare("SELECT * FROM parcels WHERE parcel_id = ? OR slug = ?").bind(parcelId, slug).first();
  if (!parcel) return new Response(htmlPage("Parcel not found", `<h1>Parcel not found</h1><p><a href="/">Return to the map</a>.</p>`), { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });

  if (parcel.slug && parcel.slug !== slug) {
    return Response.redirect(`${SITE_URL}/parcel/${encodeURIComponent(parcel.slug)}`, 301);
  }

  const sales = await env.DB.prepare("SELECT sale_date, price, instrument, buyer, seller FROM sales WHERE parcel_id = ? ORDER BY sale_date DESC").bind(parcel.parcel_id).all();
  const auctions = await env.DB.prepare("SELECT type, sale_date, min_bid, status, source_url FROM auctions WHERE parcel_id = ? ORDER BY sale_date DESC").bind(parcel.parcel_id).all();
  const showOwner = env.OWNER_NAMES_ENABLED === "true" && !parcel.suppress_owner && parcel.owner_name;
  const indexable = (sales.results?.length || auctions.results?.length) && parcel.address && parcel.geometry_ref;
  const robots = indexable ? "index,follow" : "noindex,follow";
  const salesRows = (sales.results ?? []).map((sale) => `<tr><td>${escapeHtml(sale.sale_date ?? "")}</td><td>${sale.price == null ? "" : `$${Number(sale.price).toLocaleString()}`}</td><td>${escapeHtml(sale.instrument ?? "")}</td><td>${escapeHtml(sale.buyer ?? "")}</td><td>${escapeHtml(sale.seller ?? "")}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No sales history loaded yet.</td></tr>`;
  const auctionBlock = (auctions.results ?? []).map((auction) => `<p><span class="badge">${escapeHtml(auction.type)} ${escapeHtml(auction.status)}</span> ${escapeHtml(auction.sale_date ?? "Date TBD")} ${auction.min_bid == null ? "" : `minimum bid $${Number(auction.min_bid).toLocaleString()}`} <a href="${escapeHtml(auction.source_url)}">source</a></p>`).join("");
  const jsonLd = { "@context": "https://schema.org", "@type": "Place", name: parcel.address || parcel.parcel_id, identifier: parcel.parcel_id, url: `${SITE_URL}/parcel/${parcel.slug}` };

  const body = `<p><a href="/">← Map</a></p><h1>${escapeHtml(parcel.address || parcel.parcel_id)}</h1><div class="card"><p><strong>Parcel:</strong> ${escapeHtml(parcel.parcel_id)}</p><p><strong>Acreage:</strong> ${escapeHtml(parcel.acreage ?? "Unknown")}</p><p><strong>Assessed value:</strong> ${parcel.assessed_value == null ? "Unknown" : `$${Number(parcel.assessed_value).toLocaleString()}`}</p>${showOwner ? `<p><strong>Owner:</strong> ${escapeHtml(parcel.owner_name)}</p>` : ""}<p class="muted">Owner names are suppressed by default pending approval.</p></div><div class="card"><h2>Sales history</h2><table><thead><tr><th>Date</th><th>Price</th><th>Instrument</th><th>Buyer</th><th>Seller</th></tr></thead><tbody>${salesRows}</tbody></table></div>${auctionBlock ? `<div class="card"><h2>Auction status</h2>${auctionBlock}</div>` : ""}<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  return new Response(htmlPage(`${parcel.address || parcel.parcel_id} | buildingTC.com`, body, `<meta name="robots" content="${robots}">`), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, s-maxage=86400" } });
}

async function auctionsPage(env) {
  const rows = env.DB ? await env.DB.prepare("SELECT parcel_id, case_no, type, sale_date, min_bid, status, source_url FROM auctions ORDER BY sale_date ASC LIMIT 200").all() : { results: [] };
  const tr = (rows.results ?? []).map((a) => `<tr><td>${escapeHtml(a.sale_date ?? "")}</td><td>${escapeHtml(a.type)}</td><td>${escapeHtml(a.parcel_id ?? "Unmatched")}</td><td>${escapeHtml(a.case_no ?? "")}</td><td>${a.min_bid == null ? "" : `$${Number(a.min_bid).toLocaleString()}`}</td><td>${escapeHtml(a.status)}</td><td><a href="${escapeHtml(a.source_url)}">source</a></td></tr>`).join("") || `<tr><td colspan="7" class="muted">No auction records loaded yet.</td></tr>`;
  const body = `<p><a href="/">← Map</a></p><h1>Grand Traverse foreclosure auctions</h1><div class="card"><form method="post" action="/api/auction-alerts"><label>Get Grand Traverse foreclosure alerts <input type="email" name="email" required placeholder="you@example.com"></label> <button>Notify me</button></form><p class="muted">Capture only for v1; sending alerts is v2.</p></div><div class="card"><table><thead><tr><th>Date</th><th>Type</th><th>Parcel</th><th>Case</th><th>Min bid</th><th>Status</th><th>Source</th></tr></thead><tbody>${tr}</tbody></table></div>`;
  return new Response(htmlPage("Foreclosure auctions | buildingTC.com", body), { headers: { "content-type": "text/html; charset=utf-8" } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, site: "buildingTC.com" });
    if (url.pathname === "/about-data") return aboutData();
    if (url.pathname === "/auctions") return auctionsPage(env);
    if (url.pathname.startsWith("/parcel/")) return parcelPage(env, url.pathname.slice("/parcel/".length));
    if (url.pathname === "/api/geojson") {
      if (!env.GEOMETRY) return json({ error: "r2_binding_unavailable" }, 503);
      const obj = await env.GEOMETRY.get("county-simplified.geojson");
      if (!obj) return json({ error: "geojson_not_loaded" }, 404);
      return new Response(obj.body, { headers: { "content-type": "application/geo+json", "cache-control": "public, s-maxage=86400" } });
    }
    return serveAsset(env, request);
  },
};
